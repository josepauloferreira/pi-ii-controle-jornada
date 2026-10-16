"use strict";

const crypto = require("node:crypto");

const COOKIE_NAME = "meu_ponto_sessao";
const DURATION = 12 * 60 * 60 * 1000;
const ATTEMPT_WINDOW = 15 * 60 * 1000;
const attempts = new Map();
const dummyHash = makeHash("senha-inexistente-para-comparacao");

function makeHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}
function checkHash(password, encoded) {
  const match = /^scrypt:([a-f0-9]{32}):([a-f0-9]{128})$/.exec(encoded || "");
  if (!match) return false;
  const got = crypto.scryptSync(password, match[1], 64);
  return crypto.timingSafeEqual(got, Buffer.from(match[2], "hex"));
}
function validUser(value) {
  return typeof value === "string" && /^[a-z][a-z0-9._-]{2,39}$/.test(value);
}
function validPassword(value) {
  return typeof value === "string" && value.length >= 12 && Buffer.byteLength(value, "utf8") <= 256;
}
function hashToken(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function cookieOptions(req) {
  // O Vite encaminha /api ao Express no Codespaces. Respeitar HTTPS do proxy.
  const forwarded = req.get("x-forwarded-proto");
  const secure = req.secure || forwarded === "https";
  return { httpOnly: true, secure, sameSite: "strict", path: "/" };
}
function readCookie(req) {
  for (const item of String(req.headers.cookie || "").split(";")) {
    const [name, ...value] = item.trim().split("=");
    if (name === COOKIE_NAME) return value.join("=");
  }
  return "";
}

function configureAuth(app, db) {
  const getAccount = db.prepare("SELECT id, usuario, senha_hash FROM conta WHERE id = 1");
  const addAccount = db.prepare("INSERT INTO conta (id, usuario, senha_hash) VALUES (1, ?, ?)");
  const insertAccount = db.transaction((username, passwordHash) => {
    if (getAccount.get()) return false;
    addAccount.run(username, passwordHash);
    return true;
  });
  const insertSession = db.prepare("INSERT INTO sessoes_conta (token_hash, csrf_token, expira_em) VALUES (?, ?, ?)");
  const findSession = db.prepare("SELECT token_hash, csrf_token FROM sessoes_conta WHERE token_hash = ? AND expira_em > ?");
  const deleteSession = db.prepare("DELETE FROM sessoes_conta WHERE token_hash = ?");
  const clearSessions = db.prepare("DELETE FROM sessoes_conta");
  const changePassword = db.prepare("UPDATE conta SET senha_hash = ? WHERE id = 1");

  function startSession(req, res, username) {
    const token = crypto.randomBytes(32).toString("base64url");
    const csrfToken = crypto.randomBytes(32).toString("base64url");
    insertSession.run(hashToken(token), csrfToken, Date.now() + DURATION);
    res.cookie(COOKIE_NAME, token, { ...cookieOptions(req), maxAge: DURATION });
    return res.json({ usuario: username, csrfToken });
  }
  function requireAuth(req, res, next) {
    const token = readCookie(req);
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      return res.status(401).json({ erro: "Entre na sua conta para continuar." });
    }
    const session = findSession.get(hashToken(token), Date.now());
    const account = getAccount.get();
    if (!session || !account) return res.status(401).json({ erro: "Sua sessão terminou. Entre novamente." });
    req.account = account;
    req.session = session;
    next();
  }
  function requireCsrf(req, res, next) {
    if (!req.session || req.session.csrf_token !== req.get("x-csrf-token")) {
      return res.status(403).json({ erro: "Confirmação de segurança inválida. Atualize a página." });
    }
    next();
  }
  function jsonOnly(req, res, next) {
    if (!req.is("application/json")) return res.status(415).json({ erro: "Envie os dados em JSON." });
    next();
  }

  app.get("/api/auth/status", (_req, res) => {
    res.json({ cadastroDisponivel: !getAccount.get() });
  });

  app.post("/api/auth/register", jsonOnly, (req, res) => {
    if (getAccount.get()) return res.status(409).json({ erro: "Uma conta já foi criada. Faça login." });
    const username = typeof req.body?.usuario === "string" ? req.body.usuario.trim().toLowerCase() : "";
    const password = req.body?.senha;
    if (!validUser(username)) {
      return res.status(400).json({ erro: "Use 3 a 40 caracteres: letras, números, ponto, hífen ou sublinhado; comece com uma letra." });
    }
    if (!validPassword(password)) {
      return res.status(400).json({ erro: "A senha precisa ter pelo menos 12 caracteres e no máximo 256 bytes." });
    }
    if (req.body.confirmarSenha !== password) {
      return res.status(400).json({ erro: "As senhas não coincidem." });
    }
    try {
      if (!insertAccount(username, makeHash(password))) {
        return res.status(409).json({ erro: "Uma conta já foi criada. Faça login." });
      }
    } catch (error) {
      if (error.code?.startsWith("SQLITE_CONSTRAINT")) {
        return res.status(409).json({ erro: "Uma conta já foi criada. Faça login." });
      }
      throw error;
    }
    return startSession(req, res, username);
  });

  app.post("/api/auth/login", jsonOnly, (req, res) => {
    const username = typeof req.body?.usuario === "string" ? req.body.usuario.trim().toLowerCase() : "";
    const password = req.body?.senha;
    if (!validUser(username) || typeof password !== "string" || Buffer.byteLength(password, "utf8") > 256) {
      return res.status(400).json({ erro: "Informe o usuário e a senha." });
    }
    const key = `${req.socket.remoteAddress}:${username}`;
    const now = Date.now();
    const attempt = attempts.get(key);
    if (attempt && attempt.expires > now && attempt.count >= 8) {
      return res.status(429).json({ erro: "Muitas tentativas. Tente novamente em 15 minutos." });
    }
    const account = getAccount.get();
    if (!account || account.usuario !== username || !checkHash(password, account.senha_hash)) {
      const item = attempt && attempt.expires > now ? attempt : { count: 0, expires: now + ATTEMPT_WINDOW };
      item.count++;
      attempts.set(key, item);
      if (attempts.size > 2000) attempts.clear();
      return res.status(401).json({ erro: "Usuário ou senha incorretos." });
    }
    attempts.delete(key);
    return startSession(req, res, account.usuario);
  });

  app.get("/api/auth/me", requireAuth, (req, res) => {
    res.json({ usuario: req.account.usuario, csrfToken: req.session.csrf_token });
  });

  app.post("/api/auth/logout", requireAuth, requireCsrf, (req, res) => {
    deleteSession.run(req.session.token_hash);
    res.clearCookie(COOKIE_NAME, cookieOptions(req));
    res.status(204).end();
  });

  app.post("/api/auth/password", requireAuth, requireCsrf, jsonOnly, (req, res) => {
    const { senhaAtual, novaSenha } = req.body || {};
    if (typeof senhaAtual !== "string" || !validPassword(novaSenha)) {
      return res.status(400).json({ erro: "Informe a senha atual e uma nova senha de pelo menos 12 caracteres." });
    }
    if (!checkHash(senhaAtual, req.account.senha_hash)) {
      return res.status(403).json({ erro: "Senha atual incorreta." });
    }
    if (senhaAtual === novaSenha) {
      return res.status(400).json({ erro: "A nova senha deve ser diferente da anterior." });
    }
    db.transaction(() => {
      changePassword.run(makeHash(novaSenha));
      clearSessions.run();
    })();
    res.clearCookie(COOKIE_NAME, cookieOptions(req));
    res.status(204).end();
  });

  return { requireAuth, requireCsrf };
}

module.exports = { configureAuth };
