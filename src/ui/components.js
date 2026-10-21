import { escape, fields, labels, dateLabel } from '../lib/format.js';
import { icon } from './icons.js';
import { formatarDuracao, minutosTrabalhados, minutosDeHorario, jornadaConcluida, saldoCalculado, saldoDaJornada } from '../jornada.js';

export { icon };
export const brand = (href = '#/') => `<a class="brand" href="${href}" aria-label="Meu Ponto — início"><span class="brand-symbol">${icon('clock')}</span><span>Meu Ponto</span></a>`;
export const button = (label, action, glyph = '', kind = '', attrs = '') => `<button type="button" class="btn ${kind}" data-action="${action}" ${attrs}>${glyph ? icon(glyph) : ''}${escape(label)}</button>`;
export function pageHeader(title, description, date) {
  return `<div class="page-header"><div><h1 id="viewTitle" tabindex="-1">${escape(title)}</h1><p>${escape(description)}</p></div>${date ? `<span class="date-label">${icon('calendar')}${escape(dateLabel(date, true))}</span>` : ''}</div>`;
}
export const planned = (state, date) => state.plans[date]?.minutos ?? minutosDeHorario(state.settings.jornada) ?? 480;
export function status(record) {
  return jornadaConcluida(record) ? 'Concluída' : record?.entrada ? 'Em andamento' : 'Não iniciada';
}
export const badge = record => `<span class="status ${jornadaConcluida(record) ? 'status-success' : record?.entrada ? 'status-active' : ''}">${escape(status(record))}</span>`;
export function metrics(state, date, ids = false) {
  const record = state.records[date];
  const hours = formatarDuracao(minutosTrabalhados(record));
  const plan = formatarDuracao(planned(state, date));
  const balance = saldoDaJornada(record, planned(state, date));
  const difference = saldoCalculado(record, planned(state, date));
  const cls = difference > 0 ? 'positive' : difference < 0 ? 'negative' : '';
  return `<div class="metrics">
    <div class="metric"><div class="metric-label">Horas trabalhadas ${icon('clock')}</div><strong class="time" ${ids ? 'id="horasHoje"' : ''}>${hours}</strong><p>Períodos já encerrados</p></div>
    <div class="metric"><div class="metric-label">Jornada prevista ${icon('calendar')}</div><strong class="time" ${ids ? 'id="jornadaHoje"' : ''}>${plan}</strong><p>${state.plans[date]?.origem === 'legado_estimado' ? 'Estimativa congelada na migração' : 'Carga definida para esta jornada'}</p></div>
    <div class="metric"><div class="metric-label">Saldo do dia ${icon('balance')}</div><strong class="${difference === null ? 'metric-text' : 'time'} ${cls}" ${ids ? 'id="saldoHoje"' : ''}>${escape(balance)}</strong><p>${difference === null ? 'Consolidado ao concluir a jornada' : difference === 0 ? 'Sem diferença em relação à prevista' : 'Diferença em relação à prevista'}</p></div>
  </div>`;
}
export function timeline(record, { editable = false, date, ids = false } = {}) {
  return `<ol class="journey-timeline">${fields.map((field, index) => `<li class="${record?.[field] ? 'recorded' : ''}">
    <span class="timeline-label"><span class="step-dot" aria-hidden="true"></span>${labels[index]}</span>
    <strong class="time" ${ids ? `id="${field}"` : ''}>${escape(record?.[field] || '--:--')}</strong>
    <span class="muted caption">${record?.[field] ? 'Registrada' : 'Pendente'}</span>
    ${editable && record?.[field] ? `<div class="timeline-actions">${button('Corrigir', 'edit', 'edit', '', `data-date="${date}" data-field="${field}" id="editar${field[0].toUpperCase() + field.slice(1)}"`)}${button('', 'delete-field', 'trash', 'icon-button danger', `data-date="${date}" data-field="${field}" aria-label="Excluir ${labels[index].toLowerCase()}"`)}</div>` : ''}
    </li>`).join('')}</ol>`;
}
export function emptyState(title, description, action = '') {
  return `<div class="empty-state">${icon('calendar')}<h3>${escape(title)}</h3><p>${escape(description)}</p>${action}</div>`;
}
export function historyTable(state, dates, { recent = false } = {}) {
  if (!dates.length) return emptyState(recent ? 'Sua história começa aqui.' : 'Nenhuma jornada neste mês.', recent
    ? 'Registre seu primeiro ponto para acompanhar suas jornadas.' : 'Escolha outro mês ou comece uma jornada em Minha Jornada.', `<a class="btn" href="#/jornada">Ir para Minha Jornada ${icon('arrow')}</a>`);
  return `<div class="table-wrap"><table class="history-table"><caption class="sr-only">${recent ? 'Jornadas anteriores' : 'Histórico de jornadas'}</caption><thead><tr><th scope="col">Data</th><th scope="col">Entrada</th><th scope="col">Saída</th><th scope="col">Trabalhadas</th><th scope="col">Prevista</th><th scope="col">Saldo</th><th scope="col"><span class="sr-only">Ações</span></th></tr></thead><tbody ${recent ? '' : 'id="tabelaHistorico"'}>${dates.map(date => {
    const r = state.records[date];
    const diff = saldoCalculado(r, planned(state, date));
    return `<tr><td data-label="Data"><div class="history-date"><strong>${escape(dateLabel(date))}</strong>${badge(r)}</div></td><td data-label="Entrada" class="numeric">${escape(r.entrada || '—')}</td><td data-label="Saída" class="numeric">${escape(r.saida || '—')}</td><td data-label="Trabalhadas" class="numeric">${formatarDuracao(minutosTrabalhados(r))}</td><td data-label="Prevista" class="numeric">${formatarDuracao(planned(state, date))}${state.plans[date]?.origem === 'legado_estimado' ? '<span class="caption muted"> (estimada)</span>' : ''}</td><td data-label="Saldo" class="numeric ${diff > 0 ? 'positive' : diff < 0 ? 'negative' : ''}">${escape(saldoDaJornada(r, planned(state, date)))}</td><td class="history-actions">${button('Ver detalhes', 'details', 'arrow', 'btn-link', `data-date="${date}" aria-label="Ver detalhes de ${escape(dateLabel(date))}"`)}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}
export const timeField = (id, label, value = '', required = false) => `<div class="field"><label for="${id}">${escape(label)}</label><input id="${id}" name="${id}" data-time type="text" inputmode="numeric" placeholder="HH:mm" pattern="([01][0-9]|2[0-3]):[0-5][0-9]" maxlength="5" value="${escape(value)}" ${required ? 'required' : ''} aria-describedby="${id}Help"><span id="${id}Help" class="field-help">Formato de 24 horas</span></div>`;
export function reasonField(id, label = 'Justificativa') {
  return `<div class="field"><label for="${id}">${label} <span class="muted">(obrigatória)</span></label><textarea id="${id}" name="justificativa" rows="3" minlength="10" maxlength="500" required aria-describedby="${id}Help" placeholder="Descreva o motivo da alteração."></textarea><span class="field-help" id="${id}Help">De 10 a 500 caracteres. A alteração ficará no histórico.</span></div>`;
}
export function passwordField(id, label, autocomplete, minLength = 1) {
  const creating = minLength === 12;
  const help = id === 'authConfirmarSenha' ? 'Digite a mesma senha novamente.' : creating
    ? 'Use pelo menos 12 caracteres. Prefira uma frase longa e exclusiva.' : '';
  return `<div class="field"><label for="${id}">${label}</label><div class="password-field"><input id="${id}" name="${id}" type="password" required ${creating ? `minlength="12" data-new-password` : ''} autocomplete="${autocomplete}"${help ? ` aria-describedby="${id}Help"` : ''}><button type="button" class="btn icon-button" data-password="${id}" aria-label="Mostrar ${label.toLowerCase()}" aria-pressed="false">${icon('eye')}</button></div>${help ? `<span class="field-help" id="${id}Help">${help}</span>` : ''}${creating ? `<span class="field-help" id="${id}Limit" hidden>Esta senha ultrapassa o limite de 256 bytes. Use uma frase mais curta.</span>` : ''}</div>`;
}
