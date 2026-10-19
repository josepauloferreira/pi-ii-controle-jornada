"use strict";

// Regra de negocio unica para os dois adaptadores SQLite/libSQL.
// Nao confundir o horario de exibicao com o instante persistido (ISO UTC).
const CAMPOS = Object.freeze(["entrada", "saidaAlmoco", "retornoAlmoco", "saida"]);
const FUSO = process.env.MEU_PONTO_TIMEZONE || "America/Sao_Paulo";

function horarioDoServidor(instante = new Date(), fuso = FUSO) {
  const partes = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(instante).map(({ type, value }) => [type, value]));
  return {
    data: `${partes.year}-${partes.month}-${partes.day}`,
    horario: `${partes.hour}:${partes.minute}`,
    instante: instante.toISOString()
  };
}

function proximoCampo(registro) {
  if (!registro) return CAMPOS[0];
  // Jornadas legadas sem pausa, mas com entrada e saida, ja estao concluidas.
  if (registro.entrada && registro.saida && !registro.saidaAlmoco && !registro.retornoAlmoco) return null;
  let ausente = false;
  for (const campo of CAMPOS) {
    if (registro[campo] == null) ausente = true;
    else if (ausente) return undefined; // estado legado inconsistente; nao gravar sobre ele
  }
  return CAMPOS.find(campo => registro[campo] == null) || null;
}

function justificativaValida(valor) {
  return typeof valor === "string" && valor.trim().length >= 10 && valor.trim().length <= 500;
}

function registroVazio() {
  return { entrada: null, saidaAlmoco: null, retornoAlmoco: null, saida: null, extras: [] };
}

module.exports = { CAMPOS, FUSO, horarioDoServidor, proximoCampo, justificativaValida, registroVazio };
