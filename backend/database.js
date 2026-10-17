const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

const pastaDados = path.join(__dirname, "dados");
fs.mkdirSync(pastaDados, { recursive: true });

const db = new Database(process.env.MEU_PONTO_DB_PATH || path.join(pastaDados, "jornada.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS registros (
    data TEXT PRIMARY KEY,
    entrada TEXT,
    saidaAlmoco TEXT,
    retornoAlmoco TEXT,
    saida TEXT,
    extras TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS configuracoes (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    nome TEXT NOT NULL DEFAULT '',
    jornada TEXT NOT NULL DEFAULT '08:00',
    inicioSemana TEXT NOT NULL DEFAULT '1'
  );

  INSERT OR IGNORE INTO configuracoes (id) VALUES (1);
`);

// As tabelas de ponto existentes permanecem inalteradas.
db.exec(`
  CREATE TABLE IF NOT EXISTS conta (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    usuario TEXT NOT NULL COLLATE NOCASE UNIQUE,
    senha_hash TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessoes_conta (
    token_hash TEXT PRIMARY KEY,
    csrf_token TEXT NOT NULL,
    expira_em INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessoes_conta_expiracao ON sessoes_conta(expira_em);
`);

module.exports = db;
