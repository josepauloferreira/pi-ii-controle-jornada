"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { horarioDoServidor, proximoCampo, justificativaValida, registroVazio, diaAnterior, resolverDataJornada, minutosPlanejados, previstasValidas } = require("./jornada.cjs");

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

test("jornada após meia-noite permanece vinculada à data da entrada original", () => {
  const agora = new Date("2026-10-19T04:20:00.000Z"); // 01:20 em São Paulo
  const entradaOntem = "2026-10-19T02:45:00.000Z"; // 23:45 do dia anterior
  const ontem = { entrada: "23:45", saidaAlmoco: null, retornoAlmoco: null, saida: null };
  assert.equal(diaAnterior("2027-01-01"), "2026-12-31");
  assert.equal(resolverDataJornada(agora, null, ontem, entradaOntem), "2026-10-18");
  assert.equal(resolverDataJornada(agora, registroVazio(), ontem, entradaOntem), "2026-10-18");
  assert.equal(resolverDataJornada(agora, { entrada: "01:00" }, ontem, entradaOntem), "2026-10-19");
  assert.equal(resolverDataJornada(agora, null, ontem, null), "2026-10-19");
  assert.equal(resolverDataJornada(agora, null,
    { ...ontem, saidaAlmoco: "23:50", retornoAlmoco: "00:10", saida: "00:20" },
    entradaOntem), "2026-10-19");
  assert.equal(resolverDataJornada(new Date("2026-10-20T00:00:00.000Z"), null,
    ontem, entradaOntem), "2026-10-19"); // ontem local mudou: origem anterior informada não indica jornada ativa
  assert.equal(resolverDataJornada(new Date("2026-10-19T23:20:00.000Z"), null, ontem, entradaOntem), "2026-10-19");
});

test("jornada prevista por dia usa minutos inteiros e aceita backup versionado", () => {
  assert.equal(minutosPlanejados("06:30"), 390);
  assert.equal(minutosPlanejados("00:00"), 0);
  assert.equal(minutosPlanejados("24:00"), null);
  const registros = { "2026-10-19": registroVazio() };
  assert.equal(previstasValidas(undefined, registros), true);
  assert.equal(previstasValidas({ "2026-10-19": { minutos: 390, origem: "registrada" } }, registros), true);
  assert.equal(previstasValidas({ "2026-10-19": { minutos: 1440 } }, registros), false);
  assert.equal(previstasValidas({ "2026-10-20": { minutos: 390 } }, registros), false);
  assert.equal(previstasValidas([], registros), false);
});
