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
    const corpo = alterarDia && data !== undefined
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
    const ativas = await call('/api/jornada/ativa');
    assert.equal(ativas.status, 200);
    assert.equal((await ativas.json()).data, data.data);
    const planos = await (await call('/api/jornada/previstas')).json();
    assert.deepEqual(planos[data.data], { minutos: 480, origem: 'registrada' });
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
    const previous = (await (await call('/api/jornada/previstas')).json())['2026-10-15'];
    assert.deepEqual(previous, { minutos: 480, origem: 'importado' });
    assert.equal((await call('/api/configuracoes','PUT',{...settings,jornada:'06:00'})).status,200);
    const after = (await (await call('/api/jornada/previstas')).json())['2026-10-15'];
    assert.deepEqual(after, previous);
    assert.equal((await call('/api/configuracoes','PUT',settings)).status,200);
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
    const backed = {
      registros: { '2026-09-21': record },
      configuracoes: { ...settings, jornada: '07:00' },
      jornadasPrevistas: { '2026-09-21': { minutos: 360, origem: 'registrada' } }
    };
    assert.equal((await call('/api/backup','PUT',backed)).status,200);
    assert.deepEqual((await (await call('/api/jornada/previstas')).json())['2026-09-21'],
      { minutos: 360, origem: 'importado' });
    assert.equal((await call('/api/configuracoes')).status,200);
    assert.equal((await call('/api/backup','PUT',backup)).status,200);
    assert.equal((await (await call('/api/jornada/previstas')).json())['2026-09-21'].minutos,360);
  });
  await t.test('snapshot explícito substitui a carga armazenada e backup legado mantém fallback', async () => {
    const original = await (await call('/api/registros')).json();
    const config = await (await call('/api/configuracoes')).json();
    const dia = '2026-10-15';
    const previous = (await (await call('/api/jornada/previstas')).json())[dia];
    assert.equal(previous.minutos, 480);
    const history = async () => (await (await call('/api/jornada/historico/' + dia)).json()).alteracoes;
    const count = (await history()).length;
    const explicit = {
      registros: original,
      configuracoes: { ...config, jornada: '06:00' },
      jornadasPrevistas: { [dia]: { minutos: 420, origem: 'registrada' } }
    };
    assert.equal((await call('/api/backup', 'PUT', explicit)).status, 200);
    assert.deepEqual((await (await call('/api/jornada/previstas')).json())[dia], { minutos: 420, origem: 'importado' });
    const audit = (await history()).at(-1);
    assert.equal((await history()).length, count + 1);
    assert.equal(audit.operacao, 'restauracao');
    assert.deepEqual(audit.antes, original[dia]);
    assert.deepEqual(audit.depois, original[dia]);
    assert.match(audit.justificativa, /^Restauração de backup confirmada pelo usuário\./);
    assert.match(audit.justificativa, /480.*420/);
    assert.ok(Number.isFinite(Date.parse(audit.instante)));
    // Repetir o mesmo snapshot não cria uma alteração fictícia na auditoria.
    assert.equal((await call('/api/backup', 'PUT', explicit)).status, 200);
    assert.equal((await history()).length, count + 1);
    explicit.jornadasPrevistas[dia].minutos = 0;
    assert.equal((await call('/api/backup', 'PUT', explicit)).status, 200);
    assert.equal((await (await call('/api/jornada/previstas')).json())[dia].minutos, 0);
    // Sem snapshot para o dia existente, preservar inclusive uma carga de zero.
    const novo = '2030-02-04';
    const legado = { registros: { ...original, [novo]: record }, configuracoes: explicit.configuracoes };
    assert.equal((await call('/api/backup', 'PUT', legado)).status, 200);
    let plans = await (await call('/api/jornada/previstas')).json();
    assert.equal(plans[dia].minutos, 0);
    assert.equal(plans[novo].minutos, 360);
    // Na ausência de configurações no arquivo, usar as configurações do destino.
    const outro = '2030-02-05';
    assert.equal((await call('/api/backup', 'PUT', { registros: { ...legado.registros, [outro]: record } })).status, 200);
    plans = await (await call('/api/jornada/previstas')).json();
    assert.equal(plans[dia].minutos, 0);
    assert.equal(plans[outro].minutos, 360);
    assert.equal((await call('/api/backup', 'PUT', { registros: original, configuracoes: config, jornadasPrevistas: { [dia]: previous } })).status, 200);
  });
  await t.test('restauração sem justificativa mantém auditoria automática e correções protegidas', async () => {
    const original = await (await call('/api/registros')).json();
    const changed = { ...record, entrada: '07:30', extras: [{ horario: '20:00', descricao: 'Dado fictício' }] };
    const dia = '2026-10-15';
    const novoDia = '2026-08-10';
    // Texto legado é aceito por compatibilidade, mas não pode forjar a auditoria.
    assert.equal((await call('/api/backup', 'PUT', { registros: { [dia]: changed, [novoDia]: record }, justificativa: 'x' })).status, 200);
    const audit = (await (await call('/api/jornada/historico/' + dia)).json()).alteracoes.at(-1);
    assert.equal(audit.operacao, 'restauracao');
    assert.equal(audit.justificativa, 'Restauração de backup confirmada pelo usuário.');
    assert.deepEqual(audit.antes, original[dia]);
    assert.deepEqual(audit.depois, changed);
    assert.ok(Number.isFinite(Date.parse(audit.instante)));
    const created = (await (await call('/api/jornada/historico/' + novoDia)).json()).alteracoes.at(-1);
    assert.equal(created.antes, null);
    assert.deepEqual(created.depois, record);
    assert.equal((await call('/api/backup', 'PUT', { registros: original })).status, 200);
    const removed = (await (await call('/api/jornada/historico/' + novoDia)).json()).alteracoes.at(-1);
    assert.deepEqual(removed.antes, record);
    assert.equal(removed.depois, null);
    assert.equal(removed.justificativa, audit.justificativa);
    for (const method of ['PUT', 'DELETE']) {
      const response = await request('/api/registros/' + dia, { method,
        headers: { Cookie: session.cookie, 'X-CSRF-Token': session.csrf, 'Content-Type': 'application/json' },
        body: JSON.stringify(method === 'PUT' ? changed : {}) });
      assert.equal(response.status, 400);
    }
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
