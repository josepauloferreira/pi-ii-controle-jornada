import test from "node:test";
import assert from "node:assert/strict";
import {
  horarioValido, minutosDeHorario, minutosTrabalhados, formatarDuracao,
  jornadaConcluida, saldoDaJornada, saldoCalculado
} from "../src/jornada.js";

const registro = (ponto = {}) => ({
  entrada: null, saidaAlmoco: null, retornoAlmoco: null, saida: null,
  extras: [], ...ponto
});

test("validação de HH:mm em 24 horas aceita somente horários exatos", () => {
  for (const hora of ["00:00", "08:30", "12:05", "18:30", "23:59"]) assert.equal(horarioValido(hora), true, hora);
  for (const hora of ["24:00", "12:60", "1:30", "1230", "18:30 PM", "", " 08:30", null, 1830]) {
    assert.equal(horarioValido(hora), false, String(hora));
  }
});

test("horário válido vira minutos e inválido vira null", () => {
  assert.equal(minutosDeHorario("00:00"), 0);
  assert.equal(minutosDeHorario("08:30"), 510);
  assert.equal(minutosDeHorario("23:59"), 1439);
  assert.equal(minutosDeHorario("24:00"), null);
  assert.equal(minutosDeHorario(null), null);
});

test("sem registro ou sem dois horários não há minutos completos", () => {
  assert.equal(minutosTrabalhados(null), 0);
  assert.equal(minutosTrabalhados(registro({ entrada: "08:00" })), 0);
  assert.equal(minutosTrabalhados(registro({ saida: "18:00" })), 0);
});

test("jornada sem pausa calcula horas e saldo positivo", () => {
  const dia = registro({ entrada: "08:00", saida: "17:15" });
  assert.equal(minutosTrabalhados(dia), 555);
  assert.equal(jornadaConcluida(dia), true);
  assert.equal(saldoCalculado(dia, 480), 75);
  assert.equal(saldoDaJornada(dia, 480), "01:15");
});

test("jornada com almoço desconta intervalo de descanso", () => {
  const dia = registro({
    entrada: "08:00", saidaAlmoco: "12:00", retornoAlmoco: "13:00", saida: "17:00"
  });
  assert.equal(minutosTrabalhados(dia), 480);
  assert.equal(saldoCalculado(dia, 480), 0);
  assert.equal(saldoDaJornada(dia, 480), "00:00");
});

test("saldo negativo é formatado com sinal", () => {
  const dia = registro({ entrada: "09:00", saida: "16:30" });
  assert.equal(minutosTrabalhados(dia), 450);
  assert.equal(saldoCalculado(dia, 480), -30);
  assert.equal(saldoDaJornada(dia, 480), "-00:30");
});

test("registro não iniciado e jornada incompleta não criam saldo definitivo", () => {
  assert.equal(saldoDaJornada(null, 480), "Não iniciada");
  assert.equal(saldoCalculado(null, 480), null);
  const dia = registro({ entrada: "08:00", saidaAlmoco: "12:00" });
  assert.equal(jornadaConcluida(dia), false);
  assert.equal(saldoCalculado(dia, 480), null);
  assert.equal(saldoDaJornada(dia, 480), "Em andamento");
});

test("pausa de almoço parcial mantém jornada em andamento", () => {
  const dia = registro({ entrada: "08:00", saidaAlmoco: "12:00", saida: "17:00" });
  assert.equal(jornadaConcluida(dia), false);
  assert.equal(minutosTrabalhados(dia), 240);
  assert.equal(saldoDaJornada(dia, 480), "Em andamento");
});

test("virada de meia-noite sem almoço é considerada dentro do intervalo", () => {
  const dia = registro({ entrada: "22:30", saida: "06:30" });
  assert.equal(minutosTrabalhados(dia), 480);
  assert.equal(saldoDaJornada(dia, 480), "00:00");
});

test("virada de meia-noite com dois blocos preserva minutos trabalhados", () => {
  const dia = registro({
    entrada: "22:00", saidaAlmoco: "23:45",
    retornoAlmoco: "00:15", saida: "06:30"
  });
  assert.equal(minutosTrabalhados(dia), 480);
  assert.equal(saldoCalculado(dia, 480), 0);
});

test("batidas extras não alteram o cálculo dos quatro campos principais", () => {
  const dia = registro({
    entrada: "08:00", saida: "16:00",
    extras: [{ horario: "19:00", descricao: "Teste" }]
  });
  assert.equal(minutosTrabalhados(dia), 480);
});

test("duração arredonda minutos e suporta horas acima de 24", () => {
  assert.equal(formatarDuracao(0), "00:00");
  assert.equal(formatarDuracao(61), "01:01");
  assert.equal(formatarDuracao(-15), "-00:15");
  assert.equal(formatarDuracao(61.6), "01:02");
  assert.equal(formatarDuracao(1500), "25:00");
});
