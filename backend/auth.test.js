"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");
const { once } = require("node:events");

const folder = fs.mkdtempSync(path.join(os.tmpdir(), "jornada-conta-unica-"));
process.env.MEU_PONTO_DB_PATH = path.join(folder, "test.db");
const db = require("./database");
const app = require("./server");

test("cadastro concorrente, login, autorização, CSRF, jornada anterior, troca de senha e limite de tentativas", async () => {
  // Simula um registro criado antes de haver qualquer login.
  db.prepare("INSERT INTO registros (data, entrada, extras) VALUES (?, ?, ?)").run("2026-10-14", "08:00", "[]");
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = "http://127.0.0.1:" + server.address().port;

  async function request(url, options = {}) {
    const headers = {};
    if (options.data !== undefined) headers["Content-Type"] = "application/json";
    if (options.cookie) headers.cookie = options.cookie;
    if (options.csrf) headers["X-CSRF-Token"] = options.csrf;
    return fetch(base + url, {
      method: options.method || "GET",
      headers,
      ...(options.data !== undefined ? { body: JSON.stringify(options.data) } : {})
    });
  }
  function credentials(response) {
    return { cookie: response.headers.get("set-cookie").split(";")[0] };
  }
  const user = { usuario: "minha.conta", senha: "uma-senha-bem-segura-123", confirmarSenha: "uma-senha-bem-segura-123" };

  try {
    const initial = await (await request("/api/auth/status")).json();
    assert.equal(initial.cadastroDisponivel, true);
    assert.equal((await request("/api/registros")).status, 401);
    assert.equal((await request("/api/configuracoes")).status, 401);
    assert.equal((await request("/api/backup", { method: "PUT", data: { registros: {} } })).status, 401);

    // Duas requisições simultâneas só podem criar uma conta.
    const concurrent = await Promise.all([
      request("/api/auth/register", { method: "POST", data: user }),
      request("/api/auth/register", { method: "POST", data: user })
    ]);
    assert.deepEqual(concurrent.map(response => response.status).sort((a, b) => a - b), [200, 409]);
    const registered = concurrent.find(response => response.status === 200);
    const created = { ...credentials(registered), csrf: (await registered.json()).csrfToken };
    assert.ok(created.csrf);
    assert.equal((await request("/api/auth/status")).status, 200);
    assert.equal((await (await request("/api/auth/status")).json()).cadastroDisponivel, false);
    assert.equal((await request("/api/auth/register", { method: "POST", data: { ...user, usuario: "outra.conta" } })).status, 409);
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM conta").get().total, 1);

    const old = await (await request("/api/registros/2026-10-14", { cookie: created.cookie })).json();
    assert.equal(old.entrada, "08:00");

    const wrong = await request("/api/auth/login", { method: "POST", data: { usuario: user.usuario, senha: "errado" } });
    assert.equal(wrong.status, 401);
    const login = await request("/api/auth/login", { method: "POST", data: { usuario: user.usuario, senha: user.senha } });
    assert.equal(login.status, 200);
    const authenticated = { ...credentials(login), csrf: (await login.json()).csrfToken };
    const updatedRecord = { entrada: "08:45", saidaAlmoco: null, retornoAlmoco: null, saida: null, extras: [] };
    assert.equal((await request("/api/registros/2026-10-16", { method: "PUT", cookie: authenticated.cookie, data: updatedRecord })).status, 403);
    assert.equal((await request("/api/configuracoes", {
      method: "PUT", cookie: authenticated.cookie,
      data: { nome: "Teste", jornada: "08:00", inicioSemana: "1" }
    })).status, 403);
    assert.equal((await request("/api/backup", {
      method: "PUT", cookie: authenticated.cookie, data: { registros: {} }
    })).status, 403);
    assert.equal((await request("/api/auth/password", {
      method: "POST", cookie: authenticated.cookie,
      data: { senhaAtual: user.senha, novaSenha: "outra-senha-segura-123" }
    })).status, 403);
    assert.equal((await request("/api/registros/2026-10-16", { method: "PUT", cookie: authenticated.cookie, csrf: authenticated.csrf, data: updatedRecord })).status, 201);
    assert.equal((await request("/api/registros/2026-10-16", { method: "DELETE", cookie: authenticated.cookie })).status, 403);
    assert.equal((await (await request("/api/registros/2026-10-16", { cookie: created.cookie })).json()).entrada, "08:45");

    const changed = await request("/api/auth/password", {
      method: "POST", cookie: authenticated.cookie, csrf: authenticated.csrf,
      data: { senhaAtual: user.senha, novaSenha: "nova-senha-segura-987654" }
    });
    assert.equal(changed.status, 204);
    assert.equal((await request("/api/registros", { cookie: created.cookie })).status, 401);
    assert.equal((await request("/api/registros", { cookie: authenticated.cookie })).status, 401);
    assert.equal((await request("/api/auth/login", { method: "POST", data: { usuario: user.usuario, senha: user.senha } })).status, 401);

    const newLogin = await request("/api/auth/login", { method: "POST", data: { usuario: user.usuario, senha: "nova-senha-segura-987654" } });
    assert.equal(newLogin.status, 200);
    const session = { ...credentials(newLogin), csrf: (await newLogin.json()).csrfToken };
    assert.equal((await request("/api/auth/logout", { method: "POST", cookie: session.cookie, csrf: session.csrf })).status, 204);
    assert.equal((await request("/api/registros", { cookie: session.cookie })).status, 401);

    // O nono erro de login dentro da janela deve ser bloqueado.
    const wrongUser = { usuario: "outra.conta", senha: "senha-incorreta" };
    for (let attempt = 0; attempt < 8; attempt++) {
      const response = await request("/api/auth/login", { method: "POST", data: wrongUser });
      assert.equal(response.status, 401);
    }
    assert.equal((await request("/api/auth/login", { method: "POST", data: wrongUser })).status, 429);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    db.close();
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
