"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { horarioDoServidor, proximoCampo, justificativaValida, registroVazio } = require("./jornada.cjs");

test("fuso da jornada e definido pelo servidor, nao pelo navegador", () => {
  assert.deepEqual(
    horarioDoServidor(new Date("2026-10-19T02:10:00.000Z"), "America/Sao_Paulo"),
    { data: "2026-10-18", horario: "23:10", instante: "2026-10-19T02:10:00.000Z" }
  );
  assert.deepEqual(
    horarioDoServidor(new Date("2026-10-19T12:05:00.000Z"), "America/Sao_Paulo"),
    { data: "2026-10-19", horario: "09:05", instante: "2026-10-19T12:05:00.000Z" }
  );
});

test("sequencia de eventos nao permite saltar ou repetir campos", () => {
  const r = registroVazio();
  assert.equal(proximoCampo(null), "entrada");
  assert.equal(proximoCampo(r), "entrada");
  r.entrada = "08:00";
  assert.equal(proximoCampo(r), "saidaAlmoco");
  r.saidaAlmoco = "12:00";
  assert.equal(proximoCampo(r), "retornoAlmoco");
  r.retornoAlmoco = "13:00";
  assert.equal(proximoCampo(r), "saida");
  r.saida = "17:00";
  assert.equal(proximoCampo(r), null);
  r.saidaAlmoco = null;
  assert.equal(proximoCampo(r), undefined);
  assert.equal(proximoCampo({ entrada: "08:00", saidaAlmoco: null, retornoAlmoco: null, saida: "17:00" }), null);
});

test("motivos vazios e excessivos nao sao justificativas validas", () => {
  for (const motivo of ["", "          ", "curto", null, 123, "a".repeat(501)]) {
    assert.equal(justificativaValida(motivo), false);
  }
  assert.equal(justificativaValida("Correção manual necessária"), true);
  assert.equal(justificativaValida(" a ".repeat(10)), true);
});
