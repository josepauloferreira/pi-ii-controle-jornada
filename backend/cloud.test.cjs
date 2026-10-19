"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { once } = require("node:events");
const { createClient } = require("@libsql/client");
const { createCloudApp } = require("./cloud.cjs");

test("Turso API: cadastro, autenticação, CSRF, persistência, backup, senha e rate limit", async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "jornada-libsql-"));
  const client = createClient({ url: "file:" + path.join(folder, "test.db") });
  const app = createCloudApp({ client });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const root = "http://127.0.0.1:" + server.address().port;
  const password = "uma-senha-forte-123";
  const newer = "nova-senha-forte-456";
  const json = (body) => ({ "Content-Type": "application/json", body: JSON.stringify(body) });
  const request = (route, options = {}) => fetch(root + route, options);

  try {
    let response = await request("/api/health");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });

    // Um registro anterior pode existir antes do cadastro inicial.
    await client.execute({
      sql: "INSERT INTO registros (data, entrada, extras) VALUES (?, ?, ?)",
      args: ["2026-10-14", "08:00", "[]"]
    });
    assert.equal((await request("/api/registros")).status, 401);
    assert.equal((await request("/api/configuracoes")).status, 401);
    assert.equal((await request("/api/backup", { method: "PUT", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 401);
    response = await request("/api/auth/status");
    assert.equal((await response.json()).cadastroDisponivel, true);

    const create = { usuario: "minha.conta", senha: password, confirmarSenha: password };
    const both = await Promise.all([request("/api/auth/register", { method: "POST", ...json(create), headers: { "Content-Type": "application/json" } }),
      request("/api/auth/register", { method: "POST", ...json(create), headers: { "Content-Type": "application/json" } })]);
    assert.deepEqual(both.map(r => r.status).sort(), [200, 409]);
    const created = both.find(r => r.status === 200);
    const cookie = (created.headers.get("set-cookie") || "").split(";")[0];
    const initial = await created.json();
    assert.ok(cookie.startsWith("meu_ponto_sessao="));
    assert.ok(initial.csrfToken);
    assert.equal((await request("/api/auth/status").then(r => r.json())).cadastroDisponivel, false);
    assert.equal((await request("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(create) })).status, 409);

    const getAuth = (c) => ({ Cookie: c });
    const csrfHeaders = (c, token) => ({ Cookie: c, "X-CSRF-Token": token, "Content-Type": "application/json" });
    assert.equal((await request("/api/registros/2026-10-14", { headers: getAuth(cookie) })).status, 200);
    assert.equal((await request("/api/configuracoes", { headers: getAuth(cookie) })).status, 200);
    assert.equal((await request("/api/configuracoes", { method: "PUT", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({nome:"x",jornada:"08:00",inicioSemana:"1"}) })).status, 403);

    const record = { entrada: "08:30", saidaAlmoco: "12:00", retornoAlmoco: "13:00", saida: "18:30", extras: [] };
    response = await request("/api/registros/2026-10-15", { method: "PUT", headers: csrfHeaders(cookie, initial.csrfToken), body: JSON.stringify({ ...record, justificativa: "Correção fictícia validada nos testes." }) });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).saida, "18:30");
    assert.equal((await request("/api/registros?mes=2026-10", { headers: getAuth(cookie) }).then(r => r.json()))["2026-10-15"].saida, "18:30");

    const badBackup = { registros: { "2026-10-16": { ...record, entrada: "99:99" } } };
    assert.equal((await request("/api/backup", { method: "PUT", headers: csrfHeaders(cookie, initial.csrfToken), body: JSON.stringify(badBackup) })).status, 400);
    assert.equal((await request("/api/registros/2026-10-15", { headers: getAuth(cookie) })).status, 200);

    const backup = { registros: { "2026-10-16": record }, configuracoes: {nome:"Conta Pessoal",jornada:"08:00",inicioSemana:"1"} };
    assert.equal((await request("/api/backup", { method: "PUT", headers: csrfHeaders(cookie, initial.csrfToken), body: JSON.stringify({ ...backup, justificativa: "Restauração fictícia validada nos testes." }) })).status, 200);
    assert.equal((await request("/api/registros/2026-10-15", { headers: getAuth(cookie) })).status, 404);
    assert.equal((await request("/api/configuracoes", { headers: getAuth(cookie) }).then(r => r.json())).nome, "Conta Pessoal");

    response = await request("/api/auth/password", { method: "POST", headers: csrfHeaders(cookie, initial.csrfToken),
      body: JSON.stringify({ senhaAtual: password, novaSenha: newer }) });
    assert.equal(response.status, 204);
    assert.equal((await request("/api/auth/me", { headers: getAuth(cookie) })).status, 401);
    assert.equal((await request("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuario: "minha.conta", senha: password }) })).status, 401);

    response = await request("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario: "minha.conta", senha: newer }) });
    assert.equal(response.status, 200);
    const session = await response.json();
    const newCookie = (response.headers.get("set-cookie") || "").split(";")[0];
    assert.equal((await request("/api/auth/logout", { method: "POST", headers: { Cookie: newCookie, "X-CSRF-Token": session.csrfToken } })).status, 204);
    assert.equal((await request("/api/auth/me", { headers: getAuth(newCookie) })).status, 401);

    for (let i = 0; i < 8; i++) {
      assert.equal((await request("/api/auth/login", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: "outro.usuario", senha: "senha-invalida" })
      })).status, 401);
    }
    assert.equal((await request("/api/auth/login", { method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario: "outro.usuario", senha: "senha-invalida" })
    })).status, 429);
  } finally {
    await new Promise(resolve => server.close(resolve));
    client.close();
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

test('contrato completo: libSQL em arquivo temporário', async t => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(),'jornada-cloud-contract-'));
  const client = createClient({url:'file:'+path.join(folder,'test.db')});
  const server = createCloudApp({client}).listen(0,'127.0.0.1');
  try {
    await once(server,'listening');
    await require('./api-contract.cjs')(t,(route,options)=>fetch(`http://127.0.0.1:${server.address().port}${route}`,options));
  } finally { await new Promise(r=>server.close(r)); client.close(); fs.rmSync(folder,{recursive:true,force:true}); }
});

test('instâncias serverless: concorrência, persistência e rollback', async t => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(),'jornada-instances-'));
  const url = 'file:'+path.join(folder,'test.db');
  const clients = [createClient({url}),createClient({url})];
  let pauseInsert=false, reached, resume;
  const wrapped = { batch:(...a)=>clients[1].batch(...a), execute:async statement=>{
    if(pauseInsert && statement.sql?.startsWith('INSERT INTO sessoes_conta')) {
      pauseInsert=false; reached(); await new Promise(r=>{resume=r;});
    }
    return clients[1].execute(statement);
  }};
  const servers=[createCloudApp({client:clients[0]}).listen(0,'127.0.0.1'),createCloudApp({client:wrapped}).listen(0,'127.0.0.1')];
  const request=(i,route,method='GET',data,session,csrf=true)=>fetch(`http://127.0.0.1:${servers[i].address().port}${route}`,{
    method,headers:{'Content-Type':'application/json',...(session?{Cookie:session.cookie,...(csrf?{'X-CSRF-Token':session.csrf}:{})}:{}),'X-Forwarded-Proto':'https'},
    ...(data===undefined?{}:{body:JSON.stringify(
      ((method==='PUT' && /^\/api\/(registros\/|backup$)/.test(route)) || (method==='DELETE' && route.startsWith('/api/registros/')))
        ? {...data, justificativa: 'Alteração fictícia testada com auditoria.'} : data
    )})
  });
  const user={usuario:'instancias.teste',senha:'senha-ficticia-instancias-123'};
  const record={entrada:'08:00',saidaAlmoco:null,retornoAlmoco:null,saida:'18:30',extras:[]};
  let session;
  try {
    await Promise.all(servers.map(s=>once(s,'listening')));
    for(let i=0;i<2;i++) assert.equal((await request(i,'/api/health')).status,200);
    await t.test('cadastro concorrente em clientes independentes e cookies HTTPS',async()=>{
      const results=await Promise.all([0,1].map(i=>request(i,'/api/auth/register','POST',{...user,confirmarSenha:user.senha})));
      assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
      const r=results.find(r=>r.status===200);
      const cookie=r.headers.get('set-cookie'); assert.ok(cookie.includes('Secure')&&cookie.includes('HttpOnly')&&cookie.includes('SameSite=Strict'));
      session={cookie:cookie.split(';')[0],csrf:(await r.json()).csrfToken};
      assert.equal(Number((await clients[0].execute('SELECT COUNT(*) AS n FROM conta')).rows[0].n),1);
    });
    await t.test('sessão e dados compartilhados entre instâncias',async()=>{
      assert.equal((await request(1,'/api/auth/me','GET',undefined,session)).status,200);
      assert.equal((await request(0,'/api/registros/2026-10-17','PUT',record,session)).status,201);
      assert.deepEqual(await (await request(1,'/api/registros/2026-10-17','GET',undefined,session)).json(),record);
    });
    await t.test('marcacoes simultaneas em duas instancias nao duplicam eventos',async()=>{
      const responses = await Promise.all([
        request(0,'/api/jornada/marcar','POST',{},session),
        request(1,'/api/jornada/marcar','POST',{},session)
      ]);
      assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);
      const dia = (await responses.find(r=>r.status===201).json()).data;
      const eventos = await clients[0].execute({
        sql: 'SELECT COUNT(*) AS total FROM marcacoes_servidor WHERE data = ?', args:[dia]
      });
      assert.equal(Number(eventos.rows[0].total),1);
      const history = await request(1,'/api/jornada/historico/'+dia,'GET',undefined,session);
      assert.equal(history.status,200);
      assert.equal((await history.json()).eventos.length,1);
    });
    await t.test('rollback de backup após falha real no meio da transação',async()=>{
      await clients[0].execute("CREATE TRIGGER rejeitar_teste BEFORE INSERT ON registros WHEN NEW.data = '2026-10-18' BEGIN SELECT RAISE(ABORT, 'teste privado'); END");
      const old=console.error; const logs=[];console.error=(...args)=>logs.push(args.join(' '));
      let r;
      try {r=await request(1,'/api/backup','PUT',{registros:{'2026-10-19':record,'2026-10-18':record},configuracoes:{nome:'Não gravar',jornada:'04:00',inicioSemana:'0'}},session);} finally {console.error=old;}
      assert.equal(r.status,503); assert.ok(!(await r.text()).includes('teste privado'));
      assert.ok(logs.every(line=>!line.includes('teste privado')));
      assert.equal((await request(0,'/api/registros/2026-10-17','GET',undefined,session)).status,200);
      assert.equal((await request(0,'/api/registros/2026-10-19','GET',undefined,session)).status,404);
      assert.equal((await (await request(0,'/api/configuracoes','GET',undefined,session)).json()).jornada,'08:00');
      await clients[0].execute('DROP TRIGGER rejeitar_teste');
    });
    await t.test('limite atômico sob 16 logins concorrentes',async()=>{
      const results=await Promise.all(Array.from({length:16},(_,i)=>request(i%2,'/api/auth/login','POST',{usuario:'concorrente.teste',senha:'incorreta'})));
      assert.equal(results.filter(r=>r.status===401).length,8);
      assert.equal(results.filter(r=>r.status===429).length,8);
    });
    await t.test('login em andamento não sobrevive à troca de senha',async()=>{
      const barrier=new Promise(r=>{reached=r;});pauseInsert=true;
      const login=request(1,'/api/auth/login','POST',user);
      await barrier;
      const r=await request(0,'/api/auth/password','POST',{senhaAtual:user.senha,novaSenha:'nova-ficticia-instancias-456'},session);
      resume();assert.equal(r.status,204);assert.equal((await login).status,401);
      assert.equal((await request(1,'/api/auth/me','GET',undefined,session)).status,401);
    });
    await t.test('persistência após recriar cliente e aplicação',async()=>{
      await new Promise(r=>servers[0].close(r));clients[0].close();
      clients[0]=createClient({url});servers[0]=createCloudApp({client:clients[0]}).listen(0,'127.0.0.1');await once(servers[0],'listening');
      const r=await request(0,'/api/auth/login','POST',{...user,senha:'nova-ficticia-instancias-456'});assert.equal(r.status,200);
      session={cookie:r.headers.get('set-cookie').split(';')[0],csrf:(await r.json()).csrfToken};
      assert.deepEqual(await (await request(0,'/api/registros/2026-10-17','GET',undefined,session)).json(),record);
      await clients[0].execute('UPDATE sessoes_conta SET expira_em = 0');
      assert.equal((await request(1,'/api/auth/me','GET',undefined,session)).status,401);
    });
  } finally { if(resume)resume();await Promise.all(servers.map(s=>new Promise(r=>s.close(r))));clients.forEach(c=>c.close());fs.rmSync(folder,{recursive:true,force:true}); }
});

test('falha de inicialização retorna erro genérico e permite nova tentativa', async () => {
  let fail=true;
  const client={batch:async()=>{if(fail)throw new Error('credencial-privada-simulada');}};
  const server=createCloudApp({client}).listen(0,'127.0.0.1');await once(server,'listening');
  const old=console.error;const logs=[];console.error=(...a)=>logs.push(a.join(' '));
  try {
    const first=await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
    assert.equal(first.status,503);assert.ok(!(await first.text()).includes('credencial-privada'));
    assert.ok(logs.every(line=>!line.includes('credencial-privada')));
    fail=false;
    assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/api/health`)).status,200);
  } finally {console.error=old;await new Promise(r=>server.close(r));}
});
