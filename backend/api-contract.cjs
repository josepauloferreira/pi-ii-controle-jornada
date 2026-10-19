// Contrato HTTP compartilhado pelos testes SQLite e libSQL. Somente bases temporárias.
const assert = require('node:assert/strict');

module.exports = async function apiContract(t, request) {
  const user = { usuario: 'contrato.teste', senha: 'senha-ficticia-contrato-123' };
  const nextPassword = 'nova-ficticia-contrato-456';
  const record = { entrada: '08:30', saidaAlmoco: '12:00', retornoAlmoco: '13:00', saida: '18:30', extras: [] };
  const settings = { nome: 'Demonstração fictícia', jornada: '08:00', inicioSemana: '1' };
  let session, second;
  const justificativa = "Correção fictícia realizada no contrato HTTP.";
  const call = (route, method = 'GET', data, auth = session, csrf = true) => {
    const alterarDia = /^\/api\/registros\/\d{4}-/.test(route) && (method === 'PUT' || method === 'DELETE');
    const importar = route === '/api/backup' && method === 'PUT';
    const corpo = (alterarDia || importar) && data !== undefined
      ? { ...data, justificativa }
      : method === 'DELETE' && alterarDia ? { justificativa } : data;
    return request(route, {
      method, headers: {
        ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(auth ? { Cookie: auth.cookie } : {}),
        ...(auth && csrf ? { 'X-CSRF-Token': auth.csrf } : {})
      }, ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {})
    });
  };
  async function credentials(response) {
    assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie');
    assert.ok(cookie.includes('HttpOnly') && cookie.includes('SameSite=Strict'));
    const body = await response.json();
    assert.equal(typeof body.csrfToken, 'string');
    return { cookie: cookie.split(';')[0], csrf: body.csrfToken };
  }
  await t.test('health e dados privados', async () => {
    const r = await call('/api/health');
    assert.equal(r.status, 200); assert.deepEqual(await r.json(), {status:'ok'});
    for (const path of ['/api/registros','/api/configuracoes','/api/auth/me']) assert.equal((await call(path)).status, 401);
  });
  await t.test('cadastro inicial e bloqueio do segundo cadastro', async () => {
    assert.equal((await (await call('/api/auth/status')).json()).cadastroDisponivel, true);
    session = await credentials(await call('/api/auth/register','POST',{...user, confirmarSenha:user.senha}));
    assert.equal((await call('/api/auth/register','POST',{})).status, 409);
    assert.equal((await (await call('/api/auth/status')).json()).cadastroDisponivel, false);
  });
  await t.test('login incorreto, correto e sessão autenticada', async () => {
    assert.equal((await call('/api/auth/login','POST',{...user,senha:'incorreta'})).status,401);
    second = await credentials(await call('/api/auth/login','POST',user));
    assert.equal((await call('/api/auth/me')).status,200);
  });
  await t.test('CSRF em todas as operações protegidas', async () => {
    for (const [path,method,body] of [
      ['/api/registros/2026-10-15','PUT',record], ['/api/registros/2026-10-15','DELETE'],
      ['/api/configuracoes','PUT',settings], ['/api/backup','PUT',{registros:{}}],
      ['/api/auth/password','POST',{senhaAtual:user.senha,novaSenha:nextPassword}], ['/api/auth/logout','POST']
    ]) assert.equal((await call(path,method,body,session,false)).status,403);
  });
  await t.test('marcação segura usa horário do servidor e impede repetição imediata', async () => {
    assert.equal((await call('/api/jornada/marcar', 'POST', { horario: '08:00' })).status, 400);
    assert.equal((await call('/api/jornada/marcar', 'POST', { campo: 'saida', instante: '2020-01-01T00:00:00.000Z' })).status, 400);
    assert.equal((await call('/api/jornada/marcar', 'POST', {}, session, false)).status, 403);
    const response = await call('/api/jornada/marcar', 'POST', {});
    assert.equal(response.status, 201);
    const data = await response.json();
    assert.equal(data.campo, 'entrada');
    assert.match(data.data, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(data.horario, /^(?:[01]\d|2[0-3]):[0-5]\d$/);
    assert.equal(data.registro.entrada, data.horario);
    assert.ok(!Number.isNaN(Date.parse(data.instante)));
    assert.equal((await call('/api/jornada/marcar', 'POST', {})).status, 409);
    const history = await call('/api/jornada/historico/' + data.data);
    assert.equal(history.status, 200);
    const body = await history.json();
    assert.equal(body.origem, 'servidor');
    assert.equal(body.eventos.length, 1);
    assert.equal(body.eventos[0].horario, data.horario);
    assert.equal(body.alteracoes[0].operacao, 'marcacao');
  });
  await t.test('criação e edição com batidas extras', async () => {
    assert.equal((await call('/api/registros/2026-10-15','PUT',record)).status,201);
    const updated = {...record, extras:[{horario:'19:15',descricao:'Atividade fictícia'}]};
    const r = await call('/api/registros/2026-10-15','PUT',updated);
    assert.equal(r.status,200); assert.deepEqual(await r.json(),updated);
    const history = await call('/api/jornada/historico/2026-10-15');
    assert.equal(history.status, 200);
    const audit = (await history.json()).alteracoes;
    assert.equal(audit.length, 2);
    assert.equal(audit[0].operacao, 'correcao');
    assert.equal(audit[0].antes, null);
    assert.deepEqual(audit[0].depois, record);
    assert.deepEqual(audit[1].antes, record);
    assert.deepEqual(audit[1].depois, updated);
    assert.ok(audit.every(row => row.justificativa.length >= 10));
  });
  await t.test('validação HH:mm, datas e extras', async () => {
    for (const entrada of ['24:00','08:60','8:30','18:30 PM',1830]) assert.equal((await call('/api/registros/2026-10-15','PUT',{...record,entrada})).status,400);
    assert.equal((await call('/api/registros/2026-02-30','PUT',record)).status,400);
    assert.equal((await call('/api/registros/2026-10-15','PUT',{...record,extras:[{horario:'99:00'}]})).status,400);
  });
  await t.test('histórico, filtros e query parameters', async () => {
    const r = await call('/api/registros?mes=2026-10'); assert.equal(r.status,200);
    assert.equal((await r.json())['2026-10-15'].saida,'18:30');
    assert.deepEqual(await (await call('/api/registros?mes=2026-09')).json(),{});
    for (const path of ['/api/registros?mes=2026-13','/api/registros?mes=2026-10&mes=2026-09']) assert.equal((await call(path)).status,400);
  });
  await t.test('configurações persistem e rejeitam horário inválido', async () => {
    assert.equal((await call('/api/configuracoes','PUT',settings)).status,200);
    assert.deepEqual(await (await call('/api/configuracoes')).json(),settings);
    assert.equal((await call('/api/configuracoes','PUT',{...settings,jornada:'25:00'})).status,400);
  });
  await t.test('backup inválido preserva registros e configurações', async () => {
    for (const data of [{}, {registros:[]}, {registros:{'2026-02-30':record}}, {registros:{},configuracoes:null}]) assert.equal((await call('/api/backup','PUT',data)).status,400);
    assert.equal((await call('/api/registros/2026-10-15')).status,200);
    assert.deepEqual(await (await call('/api/configuracoes')).json(),settings);
  });
  await t.test('exportação de dados e restauração de backup', async () => {
    const backup = {registros:await (await call('/api/registros')).json(),configuracoes:await (await call('/api/configuracoes')).json()};
    assert.equal((await call('/api/backup','PUT',backup)).status,200);
    assert.deepEqual(await (await call('/api/registros')).json(),backup.registros);
  });
  await t.test('exclusão de registro', async () => {
    assert.equal((await call('/api/registros/2026-10-15','DELETE')).status,204);
    assert.equal((await call('/api/registros/2026-10-15')).status,404);
    assert.equal((await call('/api/registros/2026-10-15','DELETE')).status,404);
    const audit = (await (await call('/api/jornada/historico/2026-10-15')).json()).alteracoes;
    assert.equal(audit.at(-1).operacao, 'exclusao');
    assert.equal(audit.at(-1).depois, null);
    assert.ok(audit.at(-1).antes);
  });
  await t.test('JSON inválido e limite de payload', async () => {
    const send = body => request('/api/backup',{method:'PUT',headers:{Cookie:session.cookie,'X-CSRF-Token':session.csrf,'Content-Type':'application/json'},body});
    assert.equal((await send('{')).status,400);
    assert.equal((await send(JSON.stringify({padding:'x'.repeat(2*1024*1024)}))).status,413);
  });
  await t.test('troca de senha invalida todas as sessões', async () => {
    assert.equal((await call('/api/auth/password','POST',{senhaAtual:'incorreta',novaSenha:nextPassword})).status,403);
    assert.equal((await call('/api/auth/password','POST',{senhaAtual:user.senha,novaSenha:nextPassword})).status,204);
    for (const auth of [session,second]) assert.equal((await call('/api/auth/me','GET',undefined,auth)).status,401);
    assert.equal((await call('/api/auth/login','POST',user)).status,401);
    session=await credentials(await call('/api/auth/login','POST',{...user,senha:nextPassword}));
  });
  await t.test('logout encerra a sessão', async () => {
    assert.equal((await call('/api/auth/logout','POST')).status,204);
    assert.equal((await call('/api/auth/me')).status,401);
  });
  await t.test('limitação de tentativas', async () => {
    for(let i=0;i<8;i++) assert.equal((await call('/api/auth/login','POST',{usuario:'limite.teste',senha:'incorreta'})).status,401);
    assert.equal((await call('/api/auth/login','POST',{usuario:'limite.teste',senha:'incorreta'})).status,429);
  });
};
