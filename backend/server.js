const express = require("express");
const path = require("node:path");
const db = require("./database");
const { configureAuth } = require("./auth");
const { horarioDoServidor, proximoCampo, justificativaValida, registroVazio, resolverDataJornada, diaAnterior, previstasValidas, minutosPlanejados, JUSTIFICATIVA_RESTAURACAO } = require("./jornada.cjs");

const app = express();
const porta = Number(process.env.PORT) || 3000;
const campos = ["entrada", "saidaAlmoco", "retornoAlmoco", "saida"];

app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  res.set("X-Content-Type-Options", "nosniff");
  next();
});
const { requireAuth, requireCsrf } = configureAuth(app, db);

function dataValida(data) {
  if (typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const timestamp = Date.parse(`${data}T00:00:00Z`);
  return !Number.isNaN(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === data;
}

function horarioValido(horario) {
  return typeof horario === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(horario);
}

function registroValido(registro) {
  if (!registro || typeof registro !== "object" || Array.isArray(registro)) return false;
  const camposValidos = campos.every(campo =>
    Object.hasOwn(registro, campo) &&
    (registro[campo] === null || horarioValido(registro[campo]))
  );
  const extrasValidas = Array.isArray(registro.extras) && registro.extras.every(extra =>
    extra && typeof extra === "object" && !Array.isArray(extra) &&
    horarioValido(extra.horario) &&
    (extra.descricao == null || typeof extra.descricao === "string")
  );
  return camposValidos && extrasValidas;
}

function converterRegistro(linha) {
  return {
    entrada: linha.entrada,
    saidaAlmoco: linha.saidaAlmoco,
    retornoAlmoco: linha.retornoAlmoco,
    saida: linha.saida,
    extras: JSON.parse(linha.extras)
  };
}

const buscarDia = db.prepare("SELECT * FROM registros WHERE data = ?");
const buscarTodos = db.prepare("SELECT * FROM registros ORDER BY data");
const buscarMes = db.prepare("SELECT * FROM registros WHERE data LIKE ? ORDER BY data");
const salvarDia = db.prepare(`
  INSERT INTO registros (data, entrada, saidaAlmoco, retornoAlmoco, saida, extras)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(data) DO UPDATE SET
    entrada = excluded.entrada,
    saidaAlmoco = excluded.saidaAlmoco,
    retornoAlmoco = excluded.retornoAlmoco,
    saida = excluded.saida,
    extras = excluded.extras
`);
const excluirDia = db.prepare("DELETE FROM registros WHERE data = ?");

// Prévia do frontend atual integrada à API. A versão original permanece intacta.
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "demo.html"));
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Os dados de ponto exigem login e confirmação nas operações de escrita.
app.use("/api", requireAuth);
app.use("/api", (req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return requireCsrf(req, res, next);
  }
  next();
});

// Marcações normais são originadas no servidor, jamais no relógio do navegador.
// A transação serializa leitura do estado, inclusão do evento e projeção do dia.
const buscarPrevista = db.prepare("SELECT minutos, origem FROM jornada_prevista_dia WHERE data = ?");
const congelarPrevista = db.prepare(
  "INSERT OR IGNORE INTO jornada_prevista_dia (data, minutos, origem, definido_em) " +
  "SELECT ?, CAST(SUBSTR(jornada,1,2) AS INTEGER)*60 + CAST(SUBSTR(jornada,4,2) AS INTEGER), ?, ? " +
  "FROM configuracoes WHERE id=1"
);
const buscarEntradaOriginal = db.prepare(
  "SELECT instante FROM marcacoes_servidor WHERE data = ? AND campo = 'entrada'"
);

function diaDaJornada(agora = new Date()) {
  const hoje = horarioDoServidor(agora).data;
  const anterior = diaAnterior(hoje);
  const atual = buscarDia.get(hoje);
  const ontem = buscarDia.get(anterior);
  const entrada = buscarEntradaOriginal.get(anterior);
  return resolverDataJornada(agora, atual && converterRegistro(atual),
    ontem && converterRegistro(ontem), entrada?.instante);
}

app.get("/api/jornada/ativa", (_req, res) => {
  const data = diaDaJornada();
  const row = buscarDia.get(data);
  res.json({ data, registro: row ? converterRegistro(row) : registroVazio() });
});

app.get("/api/jornada/previstas", (_req, res) => {
  const previstas = {};
  for (const { data, minutos, origem } of db.prepare(
    "SELECT data, minutos, origem FROM jornada_prevista_dia ORDER BY data"
  ).all()) previstas[data] = { minutos, origem };
  res.json(previstas);
});

const registrarMarcacao = db.transaction(() => {
  const agora = new Date();
  const { horario, instante } = horarioDoServidor(agora);
  const data = diaDaJornada(agora);
  const anterior = buscarDia.get(data);
  const antigo = anterior ? converterRegistro(anterior) : registroVazio();
  const campo = proximoCampo(antigo);
  if (campo === undefined) return { erro: "Jornada anterior inconsistente. Utilize correção justificada.", status: 409 };
  if (campo === null) return { erro: "As quatro marcações da jornada já foram realizadas.", status: 409 };

  const ultimo = db.prepare(
    "SELECT instante FROM marcacoes_servidor WHERE data = ? ORDER BY instante DESC LIMIT 1"
  ).get(data);
  if (ultimo && Date.parse(instante) - Date.parse(ultimo.instante) < 60_000) {
    return { erro: "Aguarde pelo menos um minuto entre marcações.", status: 409 };
  }

  db.prepare("INSERT INTO marcacoes_servidor (data, campo, horario, instante) VALUES (?, ?, ?, ?)")
    .run(data, campo, horario, instante);
  const atualizado = { ...antigo, [campo]: horario };
  salvarDia.run(data, atualizado.entrada, atualizado.saidaAlmoco,
    atualizado.retornoAlmoco, atualizado.saida, JSON.stringify(atualizado.extras));
  congelarPrevista.run(data, "registrada", instante);
  db.prepare(
    "INSERT INTO registro_auditoria (data, operacao, antes, depois, justificativa, instante) VALUES (?, 'marcacao', ?, ?, ?, ?)"
  ).run(data, JSON.stringify(antigo), JSON.stringify(atualizado), "Marcação automática pelo servidor", instante);
  return { data, campo, horario, instante, registro: atualizado, jornadaPrevista: buscarPrevista.get(data) };
});

app.post("/api/jornada/marcar", (req, res) => {
  if (req.body && (typeof req.body !== "object" || Array.isArray(req.body) || Object.keys(req.body).length)) {
    return res.status(400).json({ erro: "Esta operação não aceita horários enviados pelo cliente." });
  }
  try {
    const resultado = registrarMarcacao();
    if (resultado.status) return res.status(resultado.status).json({ erro: resultado.erro });
    return res.status(201).json(resultado);
  } catch (erro) {
    if (erro.code?.startsWith("SQLITE_CONSTRAINT")) {
      return res.status(409).json({ erro: "Marcação já registrada. Atualize a página." });
    }
    throw erro;
  }
});

app.get("/api/jornada/historico/:data", (req, res) => {
  const { data } = req.params;
  if (!dataValida(data)) return res.status(400).json({ erro: "Data inválida." });
  const eventos = db.prepare(
    "SELECT campo, horario, instante FROM marcacoes_servidor WHERE data = ? ORDER BY instante"
  ).all(data);
  const alteracoes = db.prepare(
    "SELECT id, operacao, antes, depois, justificativa, instante FROM registro_auditoria WHERE data = ? ORDER BY id"
  ).all(data).map(item => ({
    ...item,
    antes: item.antes ? JSON.parse(item.antes) : null,
    depois: item.depois ? JSON.parse(item.depois) : null
  }));
  res.json({ data, eventos, alteracoes, origem: eventos.length ? "servidor" : "legado_ou_importado" });
});

app.get("/api/registros", (req, res) => {
  const mes = req.query.mes;
  if (mes !== undefined && (typeof mes !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes))) {
    return res.status(400).json({ erro: "Informe o mês no formato AAAA-MM." });
  }

  const linhas = mes ? buscarMes.all(`${mes}-%`) : buscarTodos.all();
  const registros = {};
  for (const linha of linhas) registros[linha.data] = converterRegistro(linha);
  res.json(registros);
});

app.get("/api/registros/:data", (req, res) => {
  const { data } = req.params;
  if (!dataValida(data)) return res.status(400).json({ erro: "Data inválida. Use AAAA-MM-DD." });

  const linha = buscarDia.get(data);
  if (!linha) return res.status(404).json({ erro: "Registro não encontrado." });
  res.json(converterRegistro(linha));
});

// Edicoes manuais devem preservar a versao anterior e a justificativa.
const alterarRegistro = db.transaction((data, registro, justificativa) => {
  const antes = buscarDia.get(data);
  const anterior = antes ? converterRegistro(antes) : null;
  const extras = registro.extras.map(extra => ({
    horario: extra.horario, descricao: extra.descricao ?? "Batida extra"
  }));
  const novo = { entrada: registro.entrada, saidaAlmoco: registro.saidaAlmoco,
    retornoAlmoco: registro.retornoAlmoco, saida: registro.saida, extras };
  salvarDia.run(data, novo.entrada, novo.saidaAlmoco, novo.retornoAlmoco,
    novo.saida, JSON.stringify(novo.extras));
  congelarPrevista.run(data, "importado", new Date().toISOString());
  db.prepare(
    "INSERT INTO registro_auditoria (data, operacao, antes, depois, justificativa, instante) VALUES (?, 'correcao', ?, ?, ?, ?)"
  ).run(data, JSON.stringify(anterior), JSON.stringify(novo), justificativa.trim(), new Date().toISOString());
  return { criado: !antes, novo };
});

app.put("/api/registros/:data", (req, res) => {
  const { data } = req.params;
  if (!dataValida(data)) return res.status(400).json({ erro: "Data inválida. Use AAAA-MM-DD." });
  if (!registroValido(req.body)) {
    return res.status(400).json({ erro: "Registro inválido. Informe os quatro horários (HH:mm ou null) e a lista extras." });
  }
  if (!justificativaValida(req.body.justificativa)) {
    return res.status(400).json({ erro: "Informe a justificativa da correção (10 a 500 caracteres)." });
  }
  const resultado = alterarRegistro(data, req.body, req.body.justificativa);
  res.status(resultado.criado ? 201 : 200).json(resultado.novo);
});

const excluirRegistroAuditado = db.transaction((data, justificativa) => {
  const atual = buscarDia.get(data);
  if (!atual) return false;
  db.prepare("DELETE FROM registros WHERE data = ?").run(data);
  db.prepare(
    "INSERT INTO registro_auditoria (data, operacao, antes, depois, justificativa, instante) VALUES (?, 'exclusao', ?, NULL, ?, ?)"
  ).run(data, JSON.stringify(converterRegistro(atual)), justificativa.trim(), new Date().toISOString());
  return true;
});

app.delete("/api/registros/:data", (req, res) => {
  const { data } = req.params;
  if (!dataValida(data)) return res.status(400).json({ erro: "Data inválida. Use AAAA-MM-DD." });
  if (!justificativaValida(req.body?.justificativa)) {
    return res.status(400).json({ erro: "Informe justificativa para a exclusão (10 a 500 caracteres)." });
  }
  if (!excluirRegistroAuditado(data, req.body.justificativa)) {
    return res.status(404).json({ erro: "Registro não encontrado." });
  }
  res.status(204).end();
});

const buscarConfiguracoes = db.prepare("SELECT nome, jornada, inicioSemana FROM configuracoes WHERE id = 1");
const salvarConfiguracoes = db.prepare(
  "UPDATE configuracoes SET nome = ?, jornada = ?, inicioSemana = ? WHERE id = 1"
);

app.get("/api/configuracoes", (req, res) => {
  res.json(buscarConfiguracoes.get());
});

app.put("/api/configuracoes", (req, res) => {
  const dados = req.body;
  const valido = dados && typeof dados === "object" && !Array.isArray(dados)
    && typeof dados.nome === "string"
    && horarioValido(dados.jornada)
    && (dados.inicioSemana === "0" || dados.inicioSemana === "1");

  if (!valido) {
    return res.status(400).json({
      erro: "Configurações inválidas. Informe nome (texto), jornada (HH:mm) e inicioSemana (0 ou 1)."
    });
  }

  salvarConfiguracoes.run(dados.nome, dados.jornada, dados.inicioSemana);
  res.json(buscarConfiguracoes.get());
});


// Restauração completa em transação: falha na validação não altera o banco.
const restaurarBackup = db.transaction((backup) => {
  const anteriores = new Map(buscarTodos.all().map(linha => [linha.data, converterRegistro(linha)]));
  db.prepare("DELETE FROM registros").run();
  for (const [data, registro] of Object.entries(backup.registros)) {
    const extras = registro.extras.map(extra => ({
      horario: extra.horario, descricao: extra.descricao ?? "Batida extra"
    }));
    salvarDia.run(data, registro.entrada, registro.saidaAlmoco,
      registro.retornoAlmoco, registro.saida, JSON.stringify(extras));
    const minutos = backup.jornadasPrevistas?.[data]?.minutos ??
      minutosPlanejados(backup.configuracoes?.jornada ?? buscarConfiguracoes.get().jornada);
    db.prepare("INSERT OR IGNORE INTO jornada_prevista_dia (data, minutos, origem, definido_em) VALUES (?, ?, 'importado', ?)")
      .run(data, minutos, new Date().toISOString());
  }
  const posteriores = new Map(buscarTodos.all().map(linha => [linha.data, converterRegistro(linha)]));
  const evento = db.prepare(
    "INSERT INTO registro_auditoria (data, operacao, antes, depois, justificativa, instante) VALUES (?, 'restauracao', ?, ?, ?, ?)"
  );
  const agora = new Date().toISOString();
  for (const data of new Set([...anteriores.keys(), ...posteriores.keys()])) {
    const antes = anteriores.get(data) ?? null;
    const depois = posteriores.get(data) ?? null;
    if (JSON.stringify(antes) !== JSON.stringify(depois)) {
      evento.run(data, JSON.stringify(antes), JSON.stringify(depois), JUSTIFICATIVA_RESTAURACAO, agora);
    }
  }
  if (backup.configuracoes) {
    const config = backup.configuracoes;
    salvarConfiguracoes.run(config.nome, config.jornada, config.inicioSemana);
  }
});

app.put("/api/backup", (req, res) => {
  const backup = req.body;
  const registros = backup?.registros;
  const config = backup?.configuracoes;
  const registrosValidos = registros && typeof registros === "object"
    && !Array.isArray(registros)
    && Object.entries(registros).every(([data, registro]) => dataValida(data) && registroValido(registro));
  const configValida = config === undefined || (
    config && typeof config === "object" && !Array.isArray(config)
    && typeof config.nome === "string"
    && horarioValido(config.jornada)
    && (config.inicioSemana === "0" || config.inicioSemana === "1")
  );

  if (!registrosValidos || !configValida ||
      !previstasValidas(backup?.jornadasPrevistas, registros)) {
    return res.status(400).json({ erro: "Backup inválido. Confira registros, configurações e jornadas previstas." });
  }

  restaurarBackup(backup);
  res.json({ registros: Object.keys(registros).length });
});

app.use((erro, req, res, next) => {
  if (erro.status === 400) return res.status(400).json({ erro: "JSON inválido." });
  if (erro.status === 413) return res.status(413).json({ erro: "Backup excede o limite de 2 MB." });
  console.error(erro);
  res.status(500).json({ erro: "Erro interno no servidor." });
});

if (require.main === module) {
  app.listen(porta, "127.0.0.1", () => {
    console.log(`Backend iniciado em http://localhost:${porta}`);
  });
}
module.exports = app;
