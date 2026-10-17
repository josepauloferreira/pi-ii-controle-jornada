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
    response = await request("/api/registros/2026-10-15", { method: "PUT", headers: csrfHeaders(cookie, initial.csrfToken), body: JSON.stringify(record) });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).saida, "18:30");
    assert.equal((await request("/api/registros?mes=2026-10", { headers: getAuth(cookie) }).then(r => r.json()))["2026-10-15"].saida, "18:30");

    const badBackup = { registros: { "2026-10-16": { ...record, entrada: "99:99" } } };
    assert.equal((await request("/api/backup", { method: "PUT", headers: csrfHeaders(cookie, initial.csrfToken), body: JSON.stringify(badBackup) })).status, 400);
    assert.equal((await request("/api/registros/2026-10-15", { headers: getAuth(cookie) })).status, 200);

    const backup = { registros: { "2026-10-16": record }, configuracoes: {nome:"Conta Pessoal",jornada:"08:00",inicioSemana:"1"} };
    assert.equal((await request("/api/backup", { method: "PUT", headers: csrfHeaders(cookie, initial.csrfToken), body: JSON.stringify(backup) })).status, 200);
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
