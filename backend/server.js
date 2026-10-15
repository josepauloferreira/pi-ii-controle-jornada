const express = require("express");
const path = require("node:path");
const db = require("./database");

const app = express();
const porta = Number(process.env.PORT) || 3000;
const campos = ["entrada", "saidaAlmoco", "retornoAlmoco", "saida"];

app.use(express.json());

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

app.use((erro, req, res, next) => {
  if (erro.status === 400) return res.status(400).json({ erro: "JSON inválido." });
  console.error(erro);
  res.status(500).json({ erro: "Erro interno no servidor." });
});

app.listen(porta, "127.0.0.1", () => {
  console.log(`Backend iniciado em http://localhost:${porta}`);
});
