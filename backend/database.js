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

// Migracao aditiva: registros legados permanecem intactos e nao sao apresentados
// como marcacoes originadas no servidor.
db.exec(`
  CREATE TABLE IF NOT EXISTS marcacoes_servidor (
    data TEXT NOT NULL,
    campo TEXT NOT NULL CHECK(campo IN ('entrada','saidaAlmoco','retornoAlmoco','saida')),
    horario TEXT NOT NULL,
    instante TEXT NOT NULL,
    PRIMARY KEY (data, campo)
  );

  CREATE TABLE IF NOT EXISTS registro_auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    operacao TEXT NOT NULL CHECK(operacao IN ('marcacao','correcao','exclusao','restauracao')),
    antes TEXT,
    depois TEXT,
    justificativa TEXT NOT NULL,
    instante TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS registro_auditoria_data ON registro_auditoria(data, id);
`);

// Snapshot diario: datas legadas recebem a jornada atual como estimativa
// congelada no momento desta migracao; nao se presume o plano historico real.
db.exec(`
  CREATE TABLE IF NOT EXISTS jornada_prevista_dia (
    data TEXT PRIMARY KEY,
    minutos INTEGER NOT NULL CHECK(minutos BETWEEN 0 AND 1439),
    origem TEXT NOT NULL CHECK(origem IN ('registrada','legado_estimado','importado')),
    definido_em TEXT NOT NULL
  );
  INSERT OR IGNORE INTO jornada_prevista_dia (data, minutos, origem, definido_em)
  SELECT r.data,
    CAST(SUBSTR(c.jornada,1,2) AS INTEGER) * 60 + CAST(SUBSTR(c.jornada,4,2) AS INTEGER),
    'legado_estimado', CURRENT_TIMESTAMP
  FROM registros r CROSS JOIN configuracoes c WHERE c.id = 1;
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
