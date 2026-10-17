const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createClient } = require('@libsql/client');
const { createCloudApp } = require('./cloud.cjs');

test('entrada serverless: URL original, destino da rewrite e query parameters',async t=>{
  const { createHandler } = await import('../api/index.js');
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'jornada-handler-'));
  const client=createClient({url:'file:'+path.join(folder,'test.db')});
  const server=http.createServer(createHandler(createCloudApp({client}))).listen(0,'127.0.0.1');
  try {
    await once(server,'listening');
    const request=(route,options)=>fetch(`http://127.0.0.1:${server.address().port}${route}`,options);
    assert.equal((await request('/api/health')).status,200);
    for(const route of ['/api/index','/api/index?apiPath=../health','/api/index.js?apiPath=%3Fhealth']) assert.equal((await request(route)).status,404);
    await require('./api-contract.cjs')(t,(route,options)=>{
      const parsed=new URL(route,'http://internal.local');
      parsed.searchParams.set('apiPath',parsed.pathname.slice('/api/'.length));
      return request('/api/index'+parsed.search,options);
    });
  } finally {await new Promise(r=>server.close(r));client.close();fs.rmSync(folder,{recursive:true,force:true});}
});
