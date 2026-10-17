const express = require("express");
const path = require("node:path");
const db = require("./database");
const { configureAuth } = require("./auth");

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

app.put("/api/registros/:data", (req, res) => {
  const { data } = req.params;
  if (!dataValida(data)) return res.status(400).json({ erro: "Data inválida. Use AAAA-MM-DD." });
  if (!registroValido(req.body)) {
    return res.status(400).json({ erro: "Registro inválido. Informe os quatro horários (HH:mm ou null) e a lista extras." });
  }

  const novo = !buscarDia.get(data);
  const registro = req.body;
  const extras = registro.extras.map(extra => ({
    horario: extra.horario,
    descricao: extra.descricao ?? "Batida extra"
  }));

  salvarDia.run(data, registro.entrada, registro.saidaAlmoco, registro.retornoAlmoco, registro.saida, JSON.stringify(extras));
  res.status(novo ? 201 : 200).json(converterRegistro(buscarDia.get(data)));
});

app.delete("/api/registros/:data", (req, res) => {
  const { data } = req.params;
  if (!dataValida(data)) return res.status(400).json({ erro: "Data inválida. Use AAAA-MM-DD." });

  const resultado = excluirDia.run(data);
  if (!resultado.changes) return res.status(404).json({ erro: "Registro não encontrado." });
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
  db.prepare("DELETE FROM registros").run();
  for (const [data, registro] of Object.entries(backup.registros)) {
    const extras = registro.extras.map(extra => ({
      horario: extra.horario,
      descricao: extra.descricao ?? "Batida extra"
    }));
    salvarDia.run(
      data, registro.entrada, registro.saidaAlmoco,
      registro.retornoAlmoco, registro.saida, JSON.stringify(extras)
    );
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

  if (!registrosValidos || !configValida) {
    return res.status(400).json({ erro: "Backup inválido. Confira registros e configurações." });
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
