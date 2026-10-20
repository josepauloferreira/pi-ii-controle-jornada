import { fields } from './format.js';
import { horarioValido } from '../jornada.js';
import { validDate } from './backup.js';

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
export function legacySnapshot() {
  const origin = read('meu_ponto_registros', {});
  const records = {};
  if (origin && typeof origin === 'object' && !Array.isArray(origin)) {
    for (const [date, source] of Object.entries(origin)) {
      if (!validDate(date) || !source || typeof source !== 'object') continue;
      records[date] = Object.fromEntries(fields.map(f => [f, horarioValido(source[f]) ? source[f] : null]));
      records[date].extras = Array.isArray(source.extras) ? source.extras.filter(e => e && horarioValido(e.horario)).map(e => ({ horario: e.horario, descricao: typeof e.descricao === 'string' ? e.descricao : 'Batida extra' })) : [];
    }
  }
  const local = read('meu_ponto_config', {});
  const settings = { nome: typeof local?.nome === 'string' ? local.nome : '', jornada: horarioValido(local?.jornada) ? local.jornada : '08:00', inicioSemana: ['0', '1'].includes(String(local?.inicioSemana)) ? String(local.inicioSemana) : '1' };
  return { versao: 1, exportadoEm: new Date().toISOString(), registros: records, configuracoes: settings };
}
export function migrationWasDisabled() {
  try { return !!localStorage.getItem('meu_ponto_backup_restaurado'); } catch { return false; }
}
export function disableMigrationOffer() {
  try { localStorage.setItem('meu_ponto_backup_restaurado', '1'); } catch { /* A falha da preferência não desfaz a restauração confirmada. */ }
}
export function legacyPlan(state) {
  const backup = legacySnapshot();
  const missing = Object.keys(backup.registros).filter(date => !Object.hasOwn(state.records, date));
  const defaults = { nome: '', jornada: '08:00', inicioSemana: '1' };
  const copySettings = Object.entries(defaults).every(([k,v]) => state.settings[k] === v)
    && Object.entries(defaults).some(([k,v]) => backup.configuracoes[k] !== v);
  return { backup, missing, copySettings };
}
