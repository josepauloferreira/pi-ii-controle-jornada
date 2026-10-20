import { escape, fields, labels, today } from '../lib/format.js';
import { jornadaConcluida } from '../jornada.js';
import { brand, button, pageHeader, icon, metrics, timeline, historyTable, timeField, badge } from '../ui/components.js';

const links = [
  ['visao-geral', 'Visão Geral', 'grid'], ['jornada', 'Minha Jornada', 'clock'],
  ['historico', 'Histórico', 'calendar'], ['configuracoes', 'Configurações', 'settings']
];
export function appShell(state, route) {
  const nav = mobile => links.map(([path, label, glyph]) => `<a href="#/${path}" class="nav-link${path === route ? ' is-current' : ''}" ${path === route ? 'aria-current="page"' : ''}>${icon(glyph)}<span>${mobile && path === 'configuracoes' ? 'Ajustes' : label}</span></a>`).join('');
  const name = state.settings.nome || state.user;
  return `<div id="appView" class="app-shell"><aside class="sidebar">${brand('#/visao-geral')}
    <nav aria-label="Navegação principal">${nav(false)}</nav><div class="sidebar-account"><span class="avatar" aria-hidden="true">${escape(name.slice(0, 2).toUpperCase())}</span><div><strong id="usuarioAtual" title="${escape(name)}">${escape(name)}</strong><span class="caption muted">Conta individual</span></div>${button('', 'logout', 'logout', 'icon-button', 'id="btnSair" aria-label="Sair da conta"')}</div></aside>
    <div class="workspace"><header class="app-bar"><a class="mobile-brand brand" href="#/visao-geral"><span class="brand-symbol">${icon('clock')}</span>Meu Ponto</a><span class="app-context">Jornada individual</span><span class="app-location">${icon('home')} Home office</span>${button('', 'logout', 'logout', 'icon-button mobile-logout', 'aria-label="Sair da conta"')}</header>
    <main id="main-content" class="app-main" tabindex="-1">${state.loading ? loadingView() : state.error ? errorView(state.error) : view(state, route)}</main></div>
    <nav class="mobile-nav" aria-label="Navegação principal mobile">${nav(true)}</nav></div>`;
}
function loadingView() {
  return `<div class="page-header"><h1 id="viewTitle" tabindex="-1">Carregando sua jornada…</h1></div><div class="loading-state" role="status" aria-live="polite"><p>Buscando seus registros e configurações.</p><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton short"></div></div>`;
}
function errorView(message) {
  return `<section class="error-state"><span class="error-symbol">${icon('info')}</span><h1 id="viewTitle" tabindex="-1">Não foi possível carregar sua jornada.</h1><p>${escape(message)}</p>${button('Tentar novamente', 'reload', 'history', 'btn-primary')}</section>`;
}
function view(state, route) {
  if (route === 'jornada') return journey(state);
  if (route === 'historico') return history(state);
  if (route === 'configuracoes') return settings(state);
  return overview(state);
}
export function overviewContent(state, { preview = false } = {}) {
  const date = state.activeDate || today();
  const record = state.records[date];
  const finished = jornadaConcluida(record);
  const count = fields.filter(field => record?.[field]).length;
  const title = finished ? 'Jornada concluída' : record?.entrada ? 'Sua jornada está em andamento.' : 'Tudo pronto para começar.';
  return `<section class="status-banner"><span class="status-symbol${finished ? ' is-success' : ''}">${icon(finished ? 'check' : 'clock')}</span><div><h2>${title}</h2><p>${finished ? 'As marcações desta jornada foram registradas.' : record?.entrada ? 'Acompanhe suas marcações e registre a próxima etapa.' : 'Registre a entrada para iniciar sua jornada.'}</p></div><a class="btn ${finished ? '' : 'btn-primary'}" href="#/${preview ? 'acesso' : 'jornada'}">${finished ? 'Ver minha jornada' : 'Ir para Minha Jornada'} ${icon('arrow')}</a></section>
    ${metrics(state, date)}
    <section class="card steps-card"><div class="section-heading"><h2>Resumo das etapas</h2><span class="muted caption">${count} de 4 etapas registradas</span></div>${preview ? timeline(record) : `<ol class="steps-inline">${labels.map((label, i) => `<li class="${record?.[fields[i]] ? 'done' : ''}"><span class="step-number">${i + 1}</span>${label}${record?.[fields[i]] ? icon('check') : ''}</li>`).join('')}</ol>`}${!preview ? '<a class="text-link" href="#/jornada">Ver marcações ' + icon('arrow') + '</a>' : ''}</section>`;
}
function overview(state) {
  const previous = Object.keys(state.records).filter(date => date !== state.activeDate).sort().reverse().slice(0, 3);
  return `${pageHeader('Visão Geral', 'Sua jornada de trabalho, em um só lugar.', state.activeDate || today())}${overviewContent(state)}
    <section class="card"><div class="section-heading"><div><h2>Jornadas anteriores</h2><p>Os últimos expedientes registrados.</p></div><a class="text-link" href="#/historico">Ver histórico ${icon('arrow')}</a></div>${historyTable(state, previous, { recent: true })}</section>`;
}
function journey(state) {
  const date = state.activeDate || today();
  const record = state.records[date];
  const next = fields.findIndex(field => !record?.[field]);
  const finished = jornadaConcluida(record);
  const inconsistent = next >= 0 && fields.slice(next + 1).some(field => record?.[field]);
  const titles = ['Comece sua jornada.', 'Hora de fazer uma pausa.', 'Retome sua jornada.', 'Encerre seu expediente.'];
  const actions = ['Registrar entrada', 'Iniciar pausa', 'Registrar retorno', 'Registrar saída'];
  return `${pageHeader('Minha Jornada', 'Registre seu ponto e acompanhe as marcações do dia.', date)}
    <section class="card punch-card"><div class="section-heading"><h2>Registro de ponto</h2>${badge(record)}</div><div class="punch-layout"><div><p class="muted">${inconsistent ? 'Revisão necessária' : 'Próxima marcação'}</p><h3>${finished ? 'Expediente concluído.' : inconsistent ? 'Confira os horários desta jornada.' : titles[next]}</h3><div class="punch-action">${button(finished ? 'Jornada concluída' : inconsistent ? 'Correção necessária' : state.marking ? 'Registrando…' : actions[next], 'punch', finished ? 'check' : 'clock', 'btn-primary', `id="btnBaterPonto" ${finished || inconsistent || state.marking ? 'disabled' : ''}`)}<span class="caption muted">Horário da marcação definido pelo servidor.</span></div></div><div class="local-clock"><strong class="time" id="relogio">--:--:--</strong><span class="caption muted">Relógio local · Brasília</span></div></div></section>
    <section class="card"><div class="section-heading"><h2>Marcações do dia</h2><span class="caption muted">4 etapas</span></div>${timeline(record, { editable: true, date, ids: true })}</section>
    <section class="journey-summary"><div class="section-heading"><h2>Resumo do dia</h2><span class="caption muted"><span id="quantidadeBatidas">${fields.filter(f => record?.[f]).length + (record?.extras?.length || 0)}</span> marcações no total</span></div>${metrics(state, date, true)}</section>
    <section class="card"><div class="section-heading"><div><h2>Batidas extras</h2><p>${record?.extras?.length ? `${record.extras.length} ${record.extras.length === 1 ? 'batida registrada' : 'batidas registradas'}.` : 'Nenhuma batida extra registrada.'}</p></div>${button('Gerenciar extras', 'extras', 'plus', '', `data-date="${date}"`)}</div><p class="caption muted">As batidas extras são registros adicionais e não alteram automaticamente as horas trabalhadas.</p></section>
    <div class="page-actions">${button('Corrigir horários', 'edit', 'edit', '', `data-date="${date}" ${record ? '' : 'disabled'}`)}${button('Histórico de alterações', 'audit', 'history', 'btn-link', `data-date="${date}"`)}<a class="text-link" href="#/historico">Ver histórico ${icon('arrow')}</a></div>`;
}
export function historyContent(state) {
  const dates = Object.keys(state.records).filter(date => !state.month || date.startsWith(state.month)).sort().reverse();
  return `<p class="caption muted history-count" role="status">${dates.length} ${dates.length === 1 ? 'jornada encontrada' : 'jornadas encontradas'}</p>${historyTable(state, dates)}`;
}
function history(state) {
  return `${pageHeader('Histórico', 'Consulte suas jornadas e os horários registrados.')}
    <section class="card history-card"><div class="history-toolbar"><div class="field"><label for="mesFiltro">Mês dos registros</label><input type="month" id="mesFiltro" value="${escape(state.month)}"></div>${button('Exportar CSV', 'csv', 'download')}</div><div id="historyContent">${historyContent(state)}</div></section>
    <details class="audit-lookup"><summary>Consultar histórico de alterações por data</summary><p class="muted">Consulte também a auditoria de jornadas excluídas ou removidas por uma restauração.</p><form id="auditLookup"><div class="field"><label for="auditDate">Data da jornada</label><input type="date" id="auditDate" required value="${today()}"></div><button class="btn" type="submit">${icon('history')} Consultar alterações</button></form></details>`;
}
function settings(state) {
  return `<div class="settings-page">${pageHeader('Configurações', 'Personalize sua jornada e gerencie seus dados.')}
    <form id="configForm"><section class="card"><h2>Jornada de trabalho</h2><div class="settings-grid">${timeField('jornadaDiaria', 'Jornada diária', state.settings.jornada, true)}<div class="field"><label for="inicioSemana">Início da semana</label><select id="inicioSemana"><option value="1" ${state.settings.inicioSemana === '1' ? 'selected' : ''}>Segunda-feira</option><option value="0" ${state.settings.inicioSemana === '0' ? 'selected' : ''}>Domingo</option></select></div></div><p class="field-help">Alterar a jornada prevista não modifica a carga já registrada para os dias anteriores.</p></section>
    <section class="card"><h2>Preferências pessoais</h2><div class="field"><label for="nomeFuncionario">Nome de exibição</label><input type="text" id="nomeFuncionario" value="${escape(state.settings.nome)}" autocomplete="name"><span class="field-help">O nome de usuário para acesso continua sendo ${escape(state.user)}.</span></div></section>
    <div class="settings-save"><p id="configStatus" class="caption muted" role="status">Alterações aplicadas ao salvar.</p><button type="submit" class="btn btn-primary" id="saveSettings">${icon('check')} Salvar alterações</button></div><p class="form-error" id="configError" role="alert"></p></form>
    <section class="card"><h2>Segurança</h2><div class="settings-row"><div><h3>Senha de acesso</h3><p>Mantenha uma senha exclusiva para sua conta.</p></div>${button('Alterar senha', 'password', 'lock', '', 'id="btnTrocarSenha"')}</div></section>
    <section class="card"><h2>Seus dados</h2><p class="notice">${icon('info')}A restauração substitui todos os registros atuais e exige confirmação.</p><div class="settings-row"><div><h3>Fazer backup</h3><p>Baixe registros, configurações e jornadas previstas em JSON.</p></div>${button('Fazer backup', 'backup', 'download')}</div><div class="settings-row"><div><h3>Restaurar backup</h3><p>Escolha um arquivo JSON. Você poderá revisá-lo antes de confirmar.</p></div>${button('Selecionar arquivo JSON', 'choose-backup', 'upload', '', 'id="chooseBackup"')}<input id="arquivoJSON" type="file" accept=".json,application/json" hidden></div>
    ${state.legacyAvailable ? `<div class="settings-row"><div><h3>Dados antigos deste navegador</h3><p>Baixe uma cópia antes de migrar ou substituir registros.</p></div>${button('Baixar backup local antigo', 'legacy-backup', 'download', '', 'id="btnBackupLocal"')}${button('Revisar migração local', 'legacy-migrate', 'history')}</div>` : ''}<p id="backupError" class="form-error" role="alert"></p></section></div>`;
}
