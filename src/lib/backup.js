import { horarioValido } from '../jornada.js';
import { fields } from './format.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validateBackup(value) {
  const validRecord = r => object(r) && fields.every(f => Object.hasOwn(r, f) && (r[f] === null || horarioValido(r[f])))
    && Array.isArray(r.extras) && r.extras.every(e => object(e) && horarioValido(e.horario) && (e.descricao == null || typeof e.descricao === 'string'));
  if (!object(value) || !object(value.registros) || !Object.entries(value.registros).every(([date, r]) => validDate(date) && validRecord(r))) {
    throw new Error('O arquivo precisa conter registros válidos, com datas reais, quatro horários em HH:mm ou null e uma lista de extras.');
  }
  const c = value.configuracoes;
  if (c !== undefined && !(object(c) && typeof c.nome === 'string' && horarioValido(c.jornada) && ['0', '1'].includes(c.inicioSemana))) {
    throw new Error('As configurações do backup são inválidas. Confira nome, jornada diária e início da semana.');
  }
  const p = value.jornadasPrevistas;
  if (p !== undefined && !(object(p) && Object.entries(p).every(([date, plan]) => Object.hasOwn(value.registros, date) && object(plan)
    && Number.isInteger(plan.minutos) && plan.minutos >= 0 && plan.minutos <= 1439
    && (plan.origem === undefined || ['registrada', 'legado_estimado', 'importado'].includes(plan.origem))))) {
    throw new Error('As jornadas previstas do backup são inválidas ou não correspondem aos registros.');
  }
  return { registros: value.registros, ...(c !== undefined ? { configuracoes: c } : {}), ...(p !== undefined ? { jornadasPrevistas: p } : {}) };
}
