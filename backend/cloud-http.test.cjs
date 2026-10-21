// Rodar somente contra um sqld local descartável; nunca contra Turso remoto.
const test=require('node:test');
const assert=require('node:assert/strict');
const {once}=require('node:events');
const {createClient}=require('@libsql/client/web');
const {createCloudApp}=require('./cloud.cjs');

test('HTTP libSQL real: remarcação, transações, concorrência e rollback',async t=>{
  const url=new URL(process.env.MEU_PONTO_TEST_HTTP_DB || '');
  assert.equal(url.protocol,'http:');
  assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname),'somente banco HTTP local descartável');
  const client=createClient({url:url.href});
  const server=createCloudApp({client}).listen(0,'127.0.0.1');
  try {
    await once(server,'listening');
    await require('./punch-retry-contract.cjs')(t,{
      request:(route,options)=>fetch(`http://127.0.0.1:${server.address().port}${route}`,options),
      execute:statement=>client.execute(statement)
    });
  } finally {t.mock.timers.reset();await new Promise(r=>server.close(r));client.close();}
});
