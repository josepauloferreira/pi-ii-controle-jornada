const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const contract = require('./api-contract.cjs');

test('contrato completo: SQLite local', async t => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(),'jornada-local-contract-'));
  process.env.MEU_PONTO_DB_PATH = path.join(folder,'test.db');
  const app = require('./server');
  const db = require('./database');
  const server = app.listen(0,'127.0.0.1');
  try {
    await once(server,'listening');
    await contract(t,(route,options)=>fetch(`http://127.0.0.1:${server.address().port}${route}`,options));
  } finally { await new Promise(r=>server.close(r)); db.close(); fs.rmSync(folder,{recursive:true,force:true}); }
});
