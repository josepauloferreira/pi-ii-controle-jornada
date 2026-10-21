// Fluxos de regressão compartilhados: somente contas e bancos descartáveis.
const assert = require('node:assert/strict');

module.exports = async function punchRetryContract(t, { request, execute }) {
  const start = new Date('2026-10-21T12:00:00.000Z');
  t.mock.timers.enable({ apis: ['Date'], now: start });
  const user = { usuario:'nova.entrada', senha:'frase-ficticia-para-testes' };
  const registered = await request('/api/auth/register', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...user, confirmarSenha:user.senha}) });
  assert.equal(registered.status,200);
  let cookie = registered.headers.get('set-cookie').split(';')[0];
  let csrf = (await registered.json()).csrfToken;
  const call = (path, method='GET', data) => request(path, { method,
    headers:{Cookie:cookie,'X-CSRF-Token':csrf,'Content-Type':'application/json'},
    ...(data===undefined?{}:{body:JSON.stringify(data)}) });
  const punch = () => call('/api/jornada/marcar','POST',{});
  const remove = () => call('/api/registros/2026-10-21','DELETE',{justificativa:'Exclusão fictícia para testar um novo registro.'});
  const history = async () => (await(await call('/api/jornada/historico/2026-10-21')).json());
  let first, original;

  await t.test('excluir a jornada permite nova entrada e mantém a evidência original',async()=>{
    const initial = await punch();assert.equal(initial.status,201);
    first = await initial.json();original = (await history()).eventos;
    assert.equal((await remove()).status,204);
    assert.equal((await call('/api/registros/2026-10-21')).status,404);
    t.mock.timers.tick(120000);
    const repeated = await punch();assert.equal(repeated.status,201);
    const data = await repeated.json();
    assert.equal(data.campo,'entrada');assert.equal(data.horario,'09:02');
    assert.equal((await(await call('/api/registros/2026-10-21')).json()).entrada,data.horario);
    const audit = await history();
    assert.deepEqual(audit.eventos,original);
    assert.deepEqual(audit.alteracoes.map(item=>item.operacao),['marcacao','exclusao','marcacao']);
    assert.equal(audit.alteracoes[0].depois.entrada,first.horario);
    assert.equal(audit.alteracoes.at(-1).antes.entrada,null);
    assert.equal(audit.alteracoes.at(-1).depois.entrada,data.horario);
    assert.deepEqual(data.jornadaPrevista,first.jornadaPrevista);
  });
  await t.test('o intervalo considera a nova marcação, sem liberar a próxima etapa imediatamente',async()=>{
    const count = (await history()).alteracoes.length;
    const repeated = await punch();assert.equal(repeated.status,409);
    assert.match((await repeated.json()).erro,/um minuto/);
    assert.equal((await history()).alteracoes.length,count);
  });
  await t.test('excluir somente a pausa permite remarcá-la e preserva a entrada',async()=>{
    t.mock.timers.tick(120000);
    const pause = await punch();assert.equal(pause.status,201);
    const previous = await pause.json();assert.equal(previous.campo,'saidaAlmoco');
    const originals = (await history()).eventos;
    const cleared = { ...previous.registro, saidaAlmoco:null, justificativa:'Remover uma pausa fictícia antes de registrá-la novamente.' };
    assert.equal((await call('/api/registros/2026-10-21','PUT',cleared)).status,200);
    t.mock.timers.tick(120000);
    const retry = await punch();assert.equal(retry.status,201);
    const saved = await retry.json();
    assert.equal(saved.campo,'saidaAlmoco');assert.equal(saved.horario,'09:06');
    assert.equal(saved.registro.entrada,'09:02');
    assert.deepEqual((await history()).eventos,originals);
    assert.equal((await punch()).status,409);
  });
  await t.test('duas novas entradas simultâneas depois de excluir gravam uma única marcação',async()=>{
    assert.equal((await remove()).status,204);
    t.mock.timers.tick(120000);
    const count=(await history()).alteracoes.length;
    const responses=await Promise.all([punch(),punch()]);
    assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);
    assert.equal((await history()).alteracoes.length,count+1);
  });
  await t.test('restauração sem a jornada não deixa a primeira evidência bloquear nova entrada',async()=>{
    assert.equal((await call('/api/backup','PUT',{registros:{}})).status,200);
    t.mock.timers.tick(120000);
    const result=await punch();assert.equal(result.status,201);
    assert.equal((await result.json()).campo,'entrada');
    assert.equal((await history()).alteracoes.at(-2).operacao,'restauracao');
  });
  await t.test('falha na auditoria desfaz a nova projeção e libera a transação',async()=>{
    assert.equal((await remove()).status,204);
    t.mock.timers.tick(120000);
    const before=await history();
    await execute("CREATE TRIGGER rejeitar_marcacao BEFORE INSERT ON registro_auditoria WHEN NEW.operacao='marcacao' BEGIN SELECT RAISE(ABORT,'falha fictícia'); END");
    try {
      const response=await punch();
      assert.ok(response.status>=500,`falha interna não deve ser duplicidade: ${response.status}`);
      assert.equal((await call('/api/registros/2026-10-21')).status,404);
      assert.deepEqual(await history(),before);
    } finally { await execute('DROP TRIGGER rejeitar_marcacao'); }
    assert.equal((await punch()).status,201);
  });
  await t.test('jornada noturna usa a entrada nova, e não o instante original já excluído',async()=>{
    assert.equal((await remove()).status,204);
    t.mock.timers.setTime(new Date('2026-10-22T02:45:00.000Z').getTime());
    // A sessão inicial expirou durante o avanço do relógio do teste.
    const login=await call('/api/auth/login','POST',user);assert.equal(login.status,200);
    cookie=login.headers.get('set-cookie').split(';')[0];csrf=(await login.json()).csrfToken;
    const result=await punch();assert.equal(result.status,201);
    assert.equal((await result.json()).data,'2026-10-21');
    t.mock.timers.setTime(new Date('2026-10-22T09:00:00.000Z').getTime());
    assert.equal((await(await call('/api/jornada/ativa')).json()).data,'2026-10-21');
  });
};
