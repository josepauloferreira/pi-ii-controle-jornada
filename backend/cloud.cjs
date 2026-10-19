"use strict";

// Adaptador da API para Vercel Functions + Turso.
// O backend local (backend/server.js com better-sqlite3) permanece inalterado.
const express = require("express");
const { horarioDoServidor, proximoCampo, justificativaValida, registroVazio } = require("./jornada.cjs");
const crypto = require("node:crypto");

const COOKIE_NAME = "meu_ponto_sessao";
const DURATION = 12 * 60 * 60 * 1000;
const ATTEMPT_WINDOW = 15 * 60 * 1000;
const FIELDS = ["entrada", "saidaAlmoco", "retornoAlmoco", "saida"];
const fakeHash = encodePassword("senha-inexistente-para-comparacao");

function encodePassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  return "scrypt:" + salt + ":" + crypto.scryptSync(password, salt, 64).toString("hex");
}
function verifyPassword(password, encoded) {
  const parts = /^scrypt:([a-f0-9]{32}):([a-f0-9]{128})$/.exec(encoded || "");
  if (!parts) return false;
  return crypto.timingSafeEqual(
    crypto.scryptSync(password, parts[1], 64), Buffer.from(parts[2], "hex")
  );
}
function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
function validUser(value) {
  return typeof value === "string" && /^[a-z][a-z0-9._-]{2,39}$/.test(value);
}
function validPassword(value) {
  return typeof value === "string" && value.length >= 12 && Buffer.byteLength(value, "utf8") <= 256;
}
function validTime(value) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const stamp = Date.parse(value + "T00:00:00Z");
  return !Number.isNaN(stamp) && new Date(stamp).toISOString().slice(0, 10) === value;
}
function validRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    FIELDS.every(field => Object.hasOwn(value, field) &&
      (value[field] === null || validTime(value[field]))) &&
    Array.isArray(value.extras) && value.extras.every(extra =>
      extra && typeof extra === "object" && !Array.isArray(extra) &&
      validTime(extra.horario) &&
      (extra.descricao == null || typeof extra.descricao === "string"));
}
function validSettings(value) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    typeof value.nome === "string" && validTime(value.jornada) &&
    (value.inicioSemana === "0" || value.inicioSemana === "1");
}
function settingsRow(row) {
  return { nome: row.nome, jornada: row.jornada, inicioSemana: row.inicioSemana };
}
function recordRow(row) {
  return {
    entrada: row.entrada, saidaAlmoco: row.saidaAlmoco,
    retornoAlmoco: row.retornoAlmoco, saida: row.saida,
    extras: JSON.parse(row.extras)
  };
}
function sql(query, args = []) { return { sql: query, args }; }
const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS registros (data TEXT PRIMARY KEY, entrada TEXT, saidaAlmoco TEXT, retornoAlmoco TEXT, saida TEXT, extras TEXT NOT NULL DEFAULT '[]')",
  "CREATE TABLE IF NOT EXISTS configuracoes (id INTEGER PRIMARY KEY CHECK (id = 1), nome TEXT NOT NULL DEFAULT '', jornada TEXT NOT NULL DEFAULT '08:00', inicioSemana TEXT NOT NULL DEFAULT '1')",
  "INSERT OR IGNORE INTO configuracoes (id) VALUES (1)",
  "CREATE TABLE IF NOT EXISTS conta (id INTEGER PRIMARY KEY CHECK(id = 1), usuario TEXT NOT NULL COLLATE NOCASE UNIQUE, senha_hash TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS sessoes_conta (token_hash TEXT PRIMARY KEY, csrf_token TEXT NOT NULL, expira_em INTEGER NOT NULL)",
  "CREATE INDEX IF NOT EXISTS sessoes_conta_expiracao ON sessoes_conta(expira_em)",
  "CREATE TABLE IF NOT EXISTS login_tentativas (chave TEXT PRIMARY KEY, quantidade INTEGER NOT NULL, expira_em INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS marcacoes_servidor (data TEXT NOT NULL, campo TEXT NOT NULL CHECK(campo IN ('entrada','saidaAlmoco','retornoAlmoco','saida')), horario TEXT NOT NULL, instante TEXT NOT NULL, PRIMARY KEY(data,campo))",
  "CREATE TABLE IF NOT EXISTS registro_auditoria (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL, operacao TEXT NOT NULL CHECK(operacao IN ('marcacao','correcao','exclusao','restauracao')), antes TEXT, depois TEXT, justificativa TEXT NOT NULL, instante TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS registro_auditoria_data ON registro_auditoria(data, id)"
];

function createCloudApp({ client: suppliedClient } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "2mb" }));
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    next();
  });

  let pendingClient;
  let initializing;
  async function database() {
    if (!initializing) {
      initializing = (async () => {
        if (!pendingClient) {
          if (suppliedClient) {
            pendingClient = suppliedClient;
          } else {
            const url = process.env.TURSO_DATABASE_URL;
            const authToken = process.env.TURSO_AUTH_TOKEN;
            if (!url || !authToken || !/^((libsql|https|wss?):\/\/)/.test(url)) {
              throw new Error("Turso nao configurado. Exija TURSO_DATABASE_URL e TURSO_AUTH_TOKEN.");
            }
            // Driver HTTP sem armazenamento local e sem binarios nativos na Function.
            const { createClient } = require("@libsql/client/web");
            pendingClient = createClient({ url, authToken });
          }
        }
        await pendingClient.batch(SCHEMA, "write");
        return pendingClient;
      })().catch(error => {
        initializing = undefined; // permite nova tentativa apos falha transitoria
        throw error;
      });
    }
    return initializing;
  }

  function getCookie(req) {
    for (const part of String(req.headers.cookie || "").split(";")) {
      const [name, ...value] = part.trim().split("=");
      if (name === COOKIE_NAME) return value.join("=");
    }
    return "";
  }
  function cookieOptions(req) {
    return {
      httpOnly: true, sameSite: "strict", path: "/",
      secure: process.env.VERCEL === "1" || req.secure || req.get("x-forwarded-proto") === "https"
    };
  }
  function requireJson(req, res, next) {
    if (!req.is("application/json")) return res.status(415).json({ erro: "Envie os dados em JSON." });
    next();
  }
  async function startSession(db, req, res, account) {
    const token = crypto.randomBytes(32).toString("base64url");
    const csrfToken = crypto.randomBytes(32).toString("base64url");
    const inserted = await db.execute(sql(
      "INSERT INTO sessoes_conta (token_hash, csrf_token, expira_em) " +
      "SELECT ?, ?, ? FROM conta WHERE id = 1 AND senha_hash = ?",
      [tokenHash(token), csrfToken, Date.now() + DURATION, account.senha_hash]
    ));
    // Uma troca de senha durante o login não pode criar sessão com a senha antiga.
    if (inserted.rowsAffected !== 1) {
      return res.status(401).json({ erro: "Sua sessão terminou. Entre novamente." });
    }
    res.cookie(COOKIE_NAME, token, { ...cookieOptions(req), maxAge: DURATION });
    res.json({ usuario: account.usuario, csrfToken });
  }
  async function getAccount(db) {
    return (await db.execute("SELECT id, usuario, senha_hash FROM conta WHERE id = 1")).rows[0];
  }
  async function requireAuth(req, res, next) {
    const token = getCookie(req);
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      return res.status(401).json({ erro: "Entre na sua conta para continuar." });
    }
    try {
      const db = await database();
      const session = (await db.execute(sql(
        "SELECT token_hash, csrf_token FROM sessoes_conta WHERE token_hash = ? AND expira_em > ?",
        [tokenHash(token), Date.now()]
      ))).rows[0];
      const account = session ? await getAccount(db) : null;
      if (!session || !account) {
        return res.status(401).json({ erro: "Sua sessão terminou. Entre novamente." });
      }
      req.account = account;
      req.session = session;
      req.cloudDb = db;
      next();
    } catch (error) { next(error); }
  }
  function requireCsrf(req, res, next) {
    if (!req.session || req.session.csrf_token !== req.get("x-csrf-token")) {
      return res.status(403).json({ erro: "Confirmação de segurança inválida. Atualize a página." });
    }
    next();
  }
  function attemptKey(req, username) {
    // O cabeçalho de IP deve ser definido pela plataforma, nao pelo cliente.
    const ip = String(req.get("x-vercel-forwarded-for") || req.socket.remoteAddress || "unknown").slice(0, 128);
    return tokenHash(ip + ":" + username);
  }

  app.get("/api/health", async (_req, res) => {
    await database();
    res.json({ status: "ok" });
  });
  app.get("/api/auth/status", async (_req, res) => {
    const db = await database();
    res.json({ cadastroDisponivel: !(await getAccount(db)) });
  });
  app.post("/api/auth/register", requireJson, async (req, res) => {
    const db = await database();
    if (await getAccount(db)) return res.status(409).json({ erro: "Uma conta já foi criada. Faça login." });
    const username = typeof req.body?.usuario === "string" ? req.body.usuario.trim().toLowerCase() : "";
    const password = req.body?.senha;
    if (!validUser(username)) return res.status(400).json({ erro: "Use 3 a 40 caracteres: letras, números, ponto, hífen ou sublinhado; comece com uma letra." });
    if (!validPassword(password)) return res.status(400).json({ erro: "A senha precisa ter pelo menos 12 caracteres e no máximo 256 bytes." });
    if (req.body.confirmarSenha !== password) return res.status(400).json({ erro: "As senhas não coincidem." });
    const passwordHash = encodePassword(password);
    const result = await db.execute(sql(
      "INSERT OR IGNORE INTO conta (id, usuario, senha_hash) VALUES (1, ?, ?)",
      [username, passwordHash]
    ));
    if (result.rowsAffected !== 1) return res.status(409).json({ erro: "Uma conta já foi criada. Faça login." });
    await startSession(db, req, res, { usuario: username, senha_hash: passwordHash });
  });
  app.post("/api/auth/login", requireJson, async (req, res) => {
    const db = await database();
    const username = typeof req.body?.usuario === "string" ? req.body.usuario.trim().toLowerCase() : "";
    const password = req.body?.senha;
    if (!validUser(username) || typeof password !== "string" || Buffer.byteLength(password, "utf8") > 256) {
      return res.status(400).json({ erro: "Informe o usuário e a senha." });
    }
    const key = attemptKey(req, username);
    const now = Date.now();
    // Reserva atômica antes do scrypt: invocações concorrentes compartilham o teto.
    await db.batch([
      sql("DELETE FROM login_tentativas WHERE expira_em <= ?", [now]),
      sql("DELETE FROM sessoes_conta WHERE expira_em <= ?", [now])
    ], "write");
    const attempt = await db.execute(sql(
      "INSERT INTO login_tentativas (chave, quantidade, expira_em) VALUES (?, 1, ?) " +
      "ON CONFLICT(chave) DO UPDATE SET quantidade = quantidade + 1 " +
      "WHERE quantidade < 8 RETURNING quantidade",
      [key, now + ATTEMPT_WINDOW]
    ));
    if (!attempt.rows.length) {
      res.set("Retry-After", "900");
      return res.status(429).json({ erro: "Muitas tentativas. Tente novamente em 15 minutos." });
    }
    const account = await getAccount(db);
    const valid = verifyPassword(password, account?.senha_hash || fakeHash);
    if (!account || account.usuario !== username || !valid) {
      return res.status(401).json({ erro: "Usuário ou senha incorretos." });
    }
    await db.execute(sql("DELETE FROM login_tentativas WHERE chave = ?", [key]));
    await startSession(db, req, res, account);
  });
  app.get("/api/auth/me", requireAuth, (req, res) => {
    res.json({ usuario: req.account.usuario, csrfToken: req.session.csrf_token });
  });
  app.post("/api/auth/logout", requireAuth, requireCsrf, async (req, res) => {
    await req.cloudDb.execute(sql("DELETE FROM sessoes_conta WHERE token_hash = ?", [req.session.token_hash]));
    res.clearCookie(COOKIE_NAME, cookieOptions(req));
    res.status(204).end();
  });
  app.post("/api/auth/password", requireAuth, requireCsrf, requireJson, async (req, res) => {
    const { senhaAtual, novaSenha } = req.body || {};
    if (typeof senhaAtual !== "string" || Buffer.byteLength(senhaAtual, "utf8") > 256 || !validPassword(novaSenha)) {
      return res.status(400).json({ erro: "Informe a senha atual e uma nova senha de pelo menos 12 caracteres." });
    }
    if (!verifyPassword(senhaAtual, req.account.senha_hash)) {
      return res.status(403).json({ erro: "Senha atual incorreta." });
    }
    if (senhaAtual === novaSenha) return res.status(400).json({ erro: "A nova senha deve ser diferente da anterior." });
    const db = req.cloudDb;
    const updatedHash = encodePassword(novaSenha);
    const [changed] = await db.batch([
      sql("UPDATE conta SET senha_hash = ? WHERE id = 1 AND senha_hash = ?",
        [updatedHash, req.account.senha_hash]),
      sql("DELETE FROM sessoes_conta WHERE EXISTS (SELECT 1 FROM conta WHERE id = 1 AND senha_hash = ?)",
        [updatedHash])
    ], "write");
    if (changed.rowsAffected !== 1) return res.status(409).json({ erro: "A senha foi alterada em outra sessão. Entre novamente." });
    res.clearCookie(COOKIE_NAME, cookieOptions(req));
    res.status(204).end();
  });

  app.use("/api", requireAuth);
  app.use("/api", (req, res, next) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      return requireCsrf(req, res, next);
    }
    next();
  });
  function saveDay(data, record) {
    return sql("INSERT INTO registros (data, entrada, saidaAlmoco, retornoAlmoco, saida, extras) " +
      "VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(data) DO UPDATE SET " +
      "entrada=excluded.entrada, saidaAlmoco=excluded.saidaAlmoco, retornoAlmoco=excluded.retornoAlmoco, " +
      "saida=excluded.saida, extras=excluded.extras",
      [data, record.entrada, record.saidaAlmoco, record.retornoAlmoco, record.saida,
        JSON.stringify(record.extras.map(extra => ({
          horario: extra.horario, descricao: extra.descricao ?? "Batida extra"
        })))]);
  }
  app.post("/api/jornada/marcar", async (req, res) => {
    if (req.body && (typeof req.body !== "object" || Array.isArray(req.body) || Object.keys(req.body).length)) {
      return res.status(400).json({ erro: "Esta operação não aceita horários enviados pelo cliente." });
    }
    const { data, horario, instante } = horarioDoServidor();
    const db = req.cloudDb;
    const anterior = (await db.execute(sql("SELECT * FROM registros WHERE data = ?", [data]))).rows[0];
    const antigo = anterior ? recordRow(anterior) : registroVazio();
    const campo = proximoCampo(antigo);
    if (campo === undefined) return res.status(409).json({ erro: "Jornada anterior inconsistente. Utilize correção justificada." });
    if (campo === null) return res.status(409).json({ erro: "As quatro marcações da jornada já foram realizadas." });

    const ultima = (await db.execute(sql(
      "SELECT instante FROM marcacoes_servidor WHERE data = ? ORDER BY instante DESC LIMIT 1", [data]
    ))).rows[0];
    if (ultima && Date.parse(instante) - Date.parse(ultima.instante) < 60_000) {
      return res.status(409).json({ erro: "Aguarde pelo menos um minuto entre marcações." });
    }
    const novo = { ...antigo, [campo]: horario };
    try {
      // batch(write) e uma transacao: falha de UNIQUE desfaz evento e projecao.
      await db.batch([
        sql("INSERT INTO marcacoes_servidor (data, campo, horario, instante) VALUES (?, ?, ?, ?)",
          [data, campo, horario, instante]),
        saveDay(data, novo),
        sql("INSERT INTO registro_auditoria (data, operacao, antes, depois, justificativa, instante) VALUES (?, 'marcacao', ?, ?, ?, ?)",
          [data, JSON.stringify(antigo), JSON.stringify(novo), "Marcação automática pelo servidor", instante])
      ], "write");
    } catch (error) {
      if (/UNIQUE constraint failed|SQLITE_CONSTRAINT/i.test(String(error.message))) {
        return res.status(409).json({ erro: "Marcação já registrada. Atualize a página." });
      }
      throw error;
    }
    res.status(201).json({ data, campo, horario, instante, registro: novo });
  });

  app.get("/api/jornada/historico/:data", async (req, res) => {
    const { data } = req.params;
    if (!validDate(data)) return res.status(400).json({ erro: "Data inválida." });
    const db = req.cloudDb;
    const [eventos, alteracoes] = await Promise.all([
      db.execute(sql("SELECT campo, horario, instante FROM marcacoes_servidor WHERE data = ? ORDER BY instante", [data])),
      db.execute(sql("SELECT id, operacao, antes, depois, justificativa, instante FROM registro_auditoria WHERE data = ? ORDER BY id", [data]))
    ]);
    res.json({
      data, eventos: eventos.rows,
      alteracoes: alteracoes.rows.map(item => ({
        ...item, antes: item.antes ? JSON.parse(item.antes) : null,
        depois: item.depois ? JSON.parse(item.depois) : null
      })),
      origem: eventos.rows.length ? "servidor" : "legado_ou_importado"
    });
  });

  app.get("/api/registros", async (req, res) => {
    const mes = req.query.mes;
    if (mes !== undefined && (typeof mes !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes))) {
      return res.status(400).json({ erro: "Informe o mês no formato AAAA-MM." });
    }
    const result = await req.cloudDb.execute(mes ?
      sql("SELECT * FROM registros WHERE data LIKE ? ORDER BY data", [mes + "-%"]) :
      "SELECT * FROM registros ORDER BY data");
    const registros = {};
    for (const row of result.rows) registros[row.data] = recordRow(row);
    res.json(registros);
  });
  app.get("/api/registros/:data", async (req, res) => {
    const { data } = req.params;
    if (!validDate(data)) return res.status(400).json({ erro: "Data inválida. Use AAAA-MM-DD." });
    const row = (await req.cloudDb.execute(sql("SELECT * FROM registros WHERE data = ?", [data]))).rows[0];
    if (!row) return res.status(404).json({ erro: "Registro não encontrado." });
    res.json(recordRow(row));
  });
  app.put("/api/registros/:data", async (req, res) => {
    const { data } = req.params;
    if (!validDate(data)) return res.status(400).json({ erro: "Data inválida. Use AAAA-MM-DD." });
    if (!validRecord(req.body)) return res.status(400).json({ erro: "Registro inválido. Informe os quatro horários (HH:mm ou null) e a lista extras." });
    if (!justificativaValida(req.body.justificativa)) {
      return res.status(400).json({ erro: "Informe a justificativa da correção (10 a 500 caracteres)." });
    }
    const db = req.cloudDb;
    const anterior = (await db.execute(sql("SELECT * FROM registros WHERE data = ?", [data]))).rows[0];
    const novo = { entrada: req.body.entrada, saidaAlmoco: req.body.saidaAlmoco,
      retornoAlmoco: req.body.retornoAlmoco, saida: req.body.saida,
      extras: req.body.extras.map(extra => ({
        horario: extra.horario, descricao: extra.descricao ?? "Batida extra"
      })) };
    await db.batch([
      saveDay(data, novo),
      sql("INSERT INTO registro_auditoria (data, operacao, antes, depois, justificativa, instante) VALUES (?, 'correcao', ?, ?, ?, ?)",
        [data, anterior ? JSON.stringify(recordRow(anterior)) : "null", JSON.stringify(novo),
          req.body.justificativa.trim(), new Date().toISOString()])
    ], "write");
    res.status(anterior ? 200 : 201).json(novo);
  });
  app.delete("/api/registros/:data", async (req, res) => {
    const { data } = req.params;
    if (!validDate(data)) return res.status(400).json({ erro: "Data inválida. Use AAAA-MM-DD." });
    if (!justificativaValida(req.body?.justificativa)) {
      return res.status(400).json({ erro: "Informe justificativa para a exclusão (10 a 500 caracteres)." });
    }
    const db = req.cloudDb;
    const anterior = (await db.execute(sql("SELECT * FROM registros WHERE data = ?", [data]))).rows[0];
    if (!anterior) return res.status(404).json({ erro: "Registro não encontrado." });
    await db.batch([
      sql("DELETE FROM registros WHERE data = ?", [data]),
      sql("INSERT INTO registro_auditoria (data, operacao, antes, depois, justificativa, instante) VALUES (?, 'exclusao', ?, NULL, ?, ?)",
        [data, JSON.stringify(recordRow(anterior)), req.body.justificativa.trim(), new Date().toISOString()])
    ], "write");
    res.status(204).end();
  });
  app.get("/api/configuracoes", async (req, res) => {
    const result = await req.cloudDb.execute("SELECT nome, jornada, inicioSemana FROM configuracoes WHERE id = 1");
    res.json(settingsRow(result.rows[0]));
  });
  app.put("/api/configuracoes", async (req, res) => {
    if (!validSettings(req.body)) return res.status(400).json({
      erro: "Configurações inválidas. Informe nome (texto), jornada (HH:mm) e inicioSemana (0 ou 1)."
    });
    const d = req.body;
    await req.cloudDb.execute(sql(
      "UPDATE configuracoes SET nome = ?, jornada = ?, inicioSemana = ? WHERE id = 1",
      [d.nome, d.jornada, d.inicioSemana]));
    const result = await req.cloudDb.execute("SELECT nome, jornada, inicioSemana FROM configuracoes WHERE id = 1");
    res.json(settingsRow(result.rows[0]));
  });
  app.put("/api/backup", async (req, res) => {
    const backup = req.body;
    const registros = backup?.registros;
    const configuracoes = backup?.configuracoes;
    const ok = registros && typeof registros === "object" && !Array.isArray(registros) &&
      Object.entries(registros).every(([date, record]) => validDate(date) && validRecord(record)) &&
      (configuracoes === undefined || validSettings(configuracoes));
    if (!ok) return res.status(400).json({ erro: "Backup inválido. Confira registros e configurações." });
    // Uma transacao atomica garante rollback completo se algum item falhar.
    const statements = ["DELETE FROM registros"];
    for (const [date, record] of Object.entries(registros)) statements.push(saveDay(date, record));
    if (configuracoes) statements.push(sql(
      "UPDATE configuracoes SET nome = ?, jornada = ?, inicioSemana = ? WHERE id = 1",
      [configuracoes.nome, configuracoes.jornada, configuracoes.inicioSemana]));
    await req.cloudDb.batch(statements, "write");
    res.json({ registros: Object.keys(registros).length });
  });
  app.use((error, _req, res, _next) => {
    if (error.status === 400) return res.status(400).json({ erro: "JSON inválido." });
    if (error.status === 413) return res.status(413).json({ erro: "Backup excede o limite de 2 MB." });
    // Erros de transporte podem conter URLs/headers privados: nunca registrar o objeto.
    console.error("Falha da API em nuvem; operação indisponível.");
    res.status(503).json({ erro: "Servidor ou banco indisponível. Tente novamente." });
  });
  return app;
}

module.exports = { createCloudApp };
