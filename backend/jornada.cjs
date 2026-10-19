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


const MAX_JORNADA_ABERTA_MS = 20 * 60 * 60 * 1000;

function diaAnterior(data) {
  const instante = new Date(data + "T00:00:00Z");
  instante.setUTCDate(instante.getUTCDate() - 1);
  return instante.toISOString().slice(0, 10);
}

// Uma jornada de ontem somente continua hoje quando a entrada original foi
// capturada pelo servidor, a sequência segue aberta e há menos de 20 horas.
// Registros legados/importados incompletos não capturam o dia seguinte.
function resolverDataJornada(agora, registroHoje, registroAnterior, entradaAnteriorISO) {
  const atual = horarioDoServidor(agora);
  if (registroHoje && CAMPOS.some(campo => registroHoje[campo] != null)) return atual.data;
  if (!entradaAnteriorISO || !registroAnterior?.entrada) return atual.data;
  const decorrido = agora.getTime() - Date.parse(entradaAnteriorISO);
  if (!Number.isFinite(decorrido) || decorrido < 0 || decorrido > MAX_JORNADA_ABERTA_MS) return atual.data;
  return proximoCampo(registroAnterior) ? diaAnterior(atual.data) : atual.data;
}

// Minutos planejados são um snapshot do dia, não uma referência à configuração atual.
function minutosPlanejados(hhmm) {
  if (typeof hhmm !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm)) return null;
  const [horas, minutos] = hhmm.split(":").map(Number);
  return horas * 60 + minutos;
}

function previstasValidas(previstas, registros) {
  if (previstas === undefined) return true; // backups v1 continuam aceitos
  if (!previstas || typeof previstas !== "object" || Array.isArray(previstas)) return false;
  return Object.entries(previstas).every(([data, plano]) =>
    Object.hasOwn(registros, data) &&
    plano && typeof plano === "object" && !Array.isArray(plano) &&
    Number.isInteger(plano.minutos) && plano.minutos >= 0 && plano.minutos <= 1439 &&
    (plano.origem === undefined || ["registrada", "legado_estimado", "importado"].includes(plano.origem))
  );
}

module.exports = { CAMPOS, FUSO, horarioDoServidor, proximoCampo, justificativaValida, registroVazio, diaAnterior, resolverDataJornada, minutosPlanejados, previstasValidas };
