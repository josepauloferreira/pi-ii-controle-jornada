import { configureSession, request } from './lib/api.js';
import { escape, fields, today, dateLabel, download, bindTimeInputs } from './lib/format.js';
import { validateBackup } from './lib/backup.js';
import { legacySnapshot, legacyPlan, migrationWasDisabled } from './lib/legacy.js';
import { minutosTrabalhados, formatarDuracao, saldoDaJornada } from './jornada.js';
import { appShell, historyContent } from './views/app.js';
import { landing, authentication } from './views/public.js';
import { planned, icon } from './ui/components.js';
import { openDialog, closeDialogs, cancelButton } from './ui/dialog.js';
import { createJourneyDialogs } from './ui/journey-dialogs.js';
import { validateForm, fieldError, clearFieldError, passwordFeedback, togglePassword } from './ui/forms.js';

const routes = ['visao-geral', 'jornada', 'historico', 'configuracoes'];
const defaults = () => ({ nome: '', jornada: '08:00', inicioSemana: '1' });
const state = {
  user: null, records: {}, plans: {}, settings: defaults(), activeDate: null,
  loading: false, marking: false, error: null, month: today().slice(0, 7),
  booting: true, registrationAvailable: false, authError: '', authNotice: '',
  authUnavailable: false, nextRoute: 'visao-geral', legacyAvailable: false
};
const screen = document.querySelector('#screen');
let generation = 0;
let messageTimer;
let renderedRoute = null;
const dialogs = createJourneyDialogs({ getState: () => state, refresh: () => loadData({ silent: true }), notify,
  afterPassword: () => expire('Senha atualizada. Entre novamente com sua nova senha.')
});

function route() { return location.hash.replace(/^#\/?/, '').split('?')[0]; }
function navigate(path, replace = false) {
  if (replace) { history.replaceState(null, '', '#/' + path); render(true); }
  else if (route() === path) return;
  else location.hash = '/' + path;
}
function render(focus = false, routeChange = false) {
  let path = route();
  const activeId = screen.contains(document.activeElement) ? document.activeElement.id : null;
  const previousRoute = renderedRoute;
  const sectionChange = routeChange && routes.includes(path) && previousRoute && previousRoute !== path;
  if (state.user) {
    if (!routes.includes(path)) {
      path = state.nextRoute;
      history.replaceState(null, '', '#/' + path);
    }
    screen.innerHTML = appShell(state, path);
    document.title = `${({ 'visao-geral': 'Visão Geral', jornada: 'Minha Jornada', historico: 'Histórico', configuracoes: 'Configurações' })[path]} — Meu Ponto`;
  } else {
    if (routes.includes(path) && !state.booting) {
      state.nextRoute = path;
      path = 'acesso';
      history.replaceState(null, '', '#/acesso');
    }
    screen.innerHTML = path === 'acesso' ? authentication(state) : landing(state);
    document.title = path === 'acesso' ? `${state.registrationAvailable ? 'Primeiro acesso' : 'Entrar'} — Meu Ponto` : 'Meu Ponto — Seu tempo, bem registrado';
  }
  renderedRoute = state.user ? path : null;
  // Somente navegação por hash entre seções: dados, acesso e a mesma rota não animam.
  if (sectionChange && renderedRoute && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    screen.querySelector('.app-main')?.classList.add('route-enter');
  }
  bindTimeInputs(screen);
  updateClock();
  if (focus) {
    screen.querySelector('#viewTitle, #authTitle, #landingTitle')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  } else if (activeId) document.getElementById(activeId)?.focus({ preventScroll: true });
}
function notify(message, auditDate) {
  const toast = document.querySelector('#mensagem');
  clearTimeout(messageTimer);
  toast.innerHTML = `${escape(message)}${auditDate ? `<button type="button" class="btn" data-action="audit" data-date="${auditDate}">Ver auditoria</button>` : ''}`;
  toast.hidden = false;
  messageTimer = setTimeout(() => { toast.hidden = true; }, auditDate ? 12000 : 6500);
}
function clearSession() {
  generation++;
  state.user = null;
  state.records = {};
  state.plans = {};
  state.settings = defaults();
  state.activeDate = null;
  state.loading = false;
  state.marking = false;
  state.error = null;
  state.legacyAvailable = false;
  state.registrationAvailable = false;
  configureSession(null);
  closeDialogs();
  document.querySelector('#mensagem').hidden = true;
  clearTimeout(messageTimer);
}
function expire(message = 'Sua sessão terminou. Entre novamente.') {
  clearSession();
  state.authNotice = message;
  state.authError = '';
  state.booting = false;
  navigate('acesso', true);
}
async function startAccess() {
  state.booting = true;
  state.authUnavailable = false;
  state.authError = '';
  render();
  try {
    const response = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
    if (response.ok) return await activateSession(await response.json());
    if (response.status !== 401) throw new Error('Não foi possível validar a sessão.');
    const available = await fetch('/api/auth/status', { cache: 'no-store' });
    if (!available.ok) throw new Error('Não foi possível consultar o cadastro.');
    state.registrationAvailable = !!(await available.json()).cadastroDisponivel;
  } catch {
    state.authError = 'Servidor indisponível. Confira sua conexão e tente conectar novamente.';
    state.authUnavailable = true;
  } finally {
    state.booting = false;
    if (!state.user) render();
  }
}
async function activateSession(data) {
  generation++;
  state.user = data.usuario;
  state.registrationAvailable = false;
  state.booting = false;
  state.authError = '';
  state.authNotice = '';
  configureSession(data.csrfToken, () => expire());
  const desired = routes.includes(route()) ? route() : state.nextRoute;
  state.loading = true;
  navigate(desired, true);
  await loadData({ offerLegacy: true });
}
async function authenticate(form) {
  const submit = form.querySelector('#authSubmit');
  if (submit.disabled) return;
  const error = form.querySelector('#authError');
  const setup = state.registrationAvailable;
  const usuario = form.querySelector('#authUsuario').value.trim().toLowerCase();
  const senha = form.querySelector('#authSenha').value;
  const confirmarSenha = form.querySelector('#authConfirmarSenha')?.value;
  error.textContent = '';
  if (!validateForm(form)) return;
  if (setup && senha !== confirmarSenha) {
    error.textContent = 'As senhas não coincidem. Confira a confirmação.';
    fieldError(form.querySelector('#authConfirmarSenha'), error.textContent);
    form.querySelector('#authConfirmarSenha').focus();
    return;
  }
  submit.disabled = true;
  submit.setAttribute('aria-busy', 'true');
  const original = submit.innerHTML;
  submit.textContent = setup ? 'Criando conta…' : 'Entrando…';
  try {
    const response = await fetch(setup ? '/api/auth/register' : '/api/auth/login', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, senha, ...(setup ? { confirmarSenha } : {}) })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 409 && setup) {
        state.registrationAvailable = false;
        state.authError = 'O cadastro inicial já foi concluído. Entre com a conta existente.';
        render();
        return;
      }
      if (setup && response.status === 400 && data.erro === 'A senha precisa ter pelo menos 12 caracteres e no máximo 256 bytes.') {
        error.textContent = data.erro;
        fieldError(form.querySelector('#authSenha'), data.erro);
        form.querySelector('#authSenha').focus();
        return;
      }
      throw new Error(data.erro || 'Não foi possível acessar a conta. Confira sua conexão e tente novamente.');
    }
    form.reset();
    await activateSession(data);
  } catch (failure) {
    error.textContent = failure.message || 'Verifique sua conexão e tente novamente.';
    error.tabIndex = -1;
    error.focus();
  } finally {
    submit.disabled = false;
    submit.removeAttribute('aria-busy');
    submit.innerHTML = original;
  }
}
async function loadData({ silent = false, offerLegacy = false } = {}) {
  if (!state.user) return false;
  const current = generation;
  if (!silent) { state.loading = true; render(); }
  try {
    const [records, settings, plans, active] = await Promise.all([
      request('/api/registros'), request('/api/configuracoes'), request('/api/jornada/previstas'), request('/api/jornada/ativa')
    ]);
    if (current !== generation) return false;
    Object.assign(state, { records, settings, plans, activeDate: active.data, loading: false, error: null });
    const legacy = legacySnapshot();
    state.legacyAvailable = Object.keys(legacy.registros).length > 0 || Object.entries(defaults()).some(([k,v]) => legacy.configuracoes[k] !== v);
    render();
    if (offerLegacy && !migrationWasDisabled() && state.legacyAvailable) {
      const plan = legacyPlan(state);
      if (plan.missing.length || plan.copySettings) openLegacy(plan);
      else notify('Há dados antigos neste navegador. Preserve uma cópia em Configurações.');
    }
    return true;
  } catch (failure) {
    if (current !== generation) return false;
    state.loading = false;
    state.error = failure.message || 'Verifique sua conexão e tente novamente.';
    render();
    return false;
  }
}
async function punch() {
  if (state.loading || state.marking || state.error) return;
  state.marking = true;
  const current = generation;
  const btn = document.querySelector('#btnBaterPonto');
  if (btn) { btn.disabled = true; btn.textContent = 'Registrando…'; btn.setAttribute('aria-busy', 'true'); }
  try {
    const data = await request('/api/jornada/marcar', { method: 'POST', data: {} });
    if (current !== generation) return;
    state.records[data.data] = data.registro;
    state.plans[data.data] = data.jornadaPrevista;
    state.activeDate = data.data;
    // O servidor decide se a próxima jornada pertence a um novo dia.
    try {
      const active = await request('/api/jornada/ativa');
      if (current !== generation) return;
      state.activeDate = active.data;
    } catch { if (current !== generation) return; }
    state.marking = false;
    render();
    document.querySelector('#btnBaterPonto')?.focus({ preventScroll: true });
    notify(`Ponto registrado pelo servidor às ${data.horario}.`);
  } catch (failure) {
    if (current !== generation) return;
    state.marking = false;
    if (state.user) await loadData({ silent: true });
    notify(failure.message || 'Não foi possível registrar o ponto. Tente novamente.');
  }
}
async function saveSettings(form) {
  const current = generation;
  const btn = form.querySelector('#saveSettings');
  if (btn.disabled) return;
  const error = form.querySelector('#configError');
  const original = btn.innerHTML;
  error.textContent = '';
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  btn.textContent = 'Salvando…';
  const data = { nome: form.querySelector('#nomeFuncionario').value.trim(), jornada: form.querySelector('#jornadaDiaria').value, inicioSemana: form.querySelector('#inicioSemana').value };
  try {
    const settings = await request('/api/configuracoes', { method: 'PUT', data });
    if (current !== generation) return;
    state.settings = settings;
    if (route() === 'configuracoes') {
      render();
      document.querySelector('#configStatus').textContent = 'Alterações salvas.';
      document.querySelector('#saveSettings').focus({ preventScroll: true });
    }
    notify('Configurações salvas. As jornadas anteriores foram preservadas.');
  } catch (failure) {
    error.textContent = failure.message;
    error.tabIndex = -1;
    error.focus();
  } finally {
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
    btn.innerHTML = original;
  }
}
function backup() {
  download(`backup-meu-ponto-${today()}.json`, JSON.stringify({ versao: 2, exportadoEm: new Date().toISOString(), configuracoes: state.settings, registros: state.records, jornadasPrevistas: Object.fromEntries(Object.entries(state.plans).filter(([date]) => Object.hasOwn(state.records, date))) }, null, 2), 'application/json;charset=utf-8');
  notify('Backup JSON baixado. Guarde o arquivo em um local seguro.');
}
function csv() {
  const rows = [['Data', 'Entrada', 'Saída almoço', 'Retorno almoço', 'Saída', 'Extras', 'Horas trabalhadas', 'Saldo', 'Jornada prevista', 'Origem do plano']];
  Object.keys(state.records).filter(date => !state.month || date.startsWith(state.month)).sort().forEach(date => {
    const r = state.records[date];
    rows.push([dateLabel(date), ...fields.map(f => r[f] || ''), r.extras.map(e => `${e.horario} ${e.descricao || 'Batida extra'}`).join(' | '), formatarDuracao(minutosTrabalhados(r)), saldoDaJornada(r, planned(state, date)), formatarDuracao(planned(state, date)), state.plans[date]?.origem || 'sem_snapshot']);
  });
  const data = '\uFEFF' + rows.map(row => row.map(value => '"' + String(value).replace(/"/g, '""') + '"').join(';')).join('\r\n');
  download(`meu-ponto-${state.month || today().slice(0, 7)}.csv`, data, 'text/csv;charset=utf-8');
  notify('Arquivo CSV baixado.');
}
async function chooseBackup(input) {
  const file = input.files?.[0];
  if (!file) return;
  const error = document.querySelector('#backupError');
  error.textContent = '';
  try {
    if (file.size > 2 * 1024 * 1024) throw new Error('O backup excede o limite de 2 MB.');
    let parsed;
    try { parsed = JSON.parse(await file.text()); } catch { throw new Error('Este arquivo não contém JSON válido. Escolha um backup do Meu Ponto.'); }
    const data = validateBackup(parsed);
    if (new TextEncoder().encode(JSON.stringify(data)).length > 2 * 1024 * 1024) throw new Error('O backup excede o limite de 2 MB.');
    dialogs.openRestore(file, data);
  } catch (failure) {
    error.textContent = failure.message;
    error.tabIndex = -1;
    error.focus();
  } finally { input.value = ''; }
}
function openLegacy(plan = legacyPlan(state)) {
  const dialog = openDialog({ title: 'Dados antigos neste navegador',
    body: `<p>Encontramos ${plan.missing.length} dia(s) locais ausentes no banco.${plan.copySettings ? ' Também há configurações locais que podem substituir os padrões iniciais.' : ''}</p><p class="notice dialog-section">${icon('info')}Dias já existentes no servidor não serão substituídos. Os dados locais serão preservados.</p><p class="field-help dialog-section">Baixe uma cópia antes de migrar. Correções conflitantes devem ser revisadas individualmente.</p><p class="dialog-section"><button type="button" class="btn" data-action="legacy-backup">${icon('download')} Baixar backup local antigo</button></p>`,
    footer: cancelButton + `<button class="btn btn-primary" type="button" data-migrate ${!plan.missing.length && !plan.copySettings ? 'disabled' : ''}>Copiar dados ausentes</button>`
  });
  dialog.query('[data-migrate]').addEventListener('click', async () => {
    dialog.setBusy(true);
    let failures = 0;
    try {
      for (const date of plan.missing) {
        try {
          if (!await request('/api/registros/' + date)) await request('/api/registros/' + date, { method: 'PUT', data: { ...plan.backup.registros[date], justificativa: 'Importação de registros anteriores do navegador' } });
        } catch { failures++; }
      }
      if (plan.copySettings) {
        const current = await request('/api/configuracoes');
        if (Object.entries(defaults()).every(([k,v]) => current[k] === v)) await request('/api/configuracoes', { method: 'PUT', data: plan.backup.configuracoes });
      }
      await loadData({ silent: true });
      dialog.setBusy(false);
      dialog.close();
      notify(failures ? `${failures} dia(s) não foram copiados. Preserve o backup local e tente novamente.` : 'Migração concluída. Dados locais preservados.');
    } catch (failure) { dialog.setBusy(false); if (dialog.element.isConnected) dialog.error(failure.message); }
  });
}
async function logout() {
  try {
    await request('/api/auth/logout', { method: 'POST' });
    expire('Sessão encerrada. Entre para continuar.');
  } catch (failure) { notify(failure.message); }
}
function updateClock() {
  const target = document.querySelector('#relogio');
  if (target) target.textContent = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());
}

document.addEventListener('click', event => {
  const toggle = event.target.closest('[data-password]');
  if (toggle) {
    togglePassword(toggle);
    return;
  }
  const target = event.target.closest('[data-action]');
  if (!target || target.disabled) return;
  const { action, date, field, index } = target.dataset;
  if (action === 'retry-auth') return void startAccess();
  if (!state.user) return;
  if (action === 'logout') return void logout();
  if (action === 'reload') return void loadData();
  if (state.loading || state.error) return;
  const actions = {
    punch, details: () => dialogs.openDetails(date), edit: () => dialogs.openEdit(date, field),
    'delete-record': () => dialogs.openDelete(date), 'delete-field': () => dialogs.openDelete(date, { field }),
    extras: () => dialogs.openExtras(date), 'edit-extra': () => dialogs.openExtras(date, Number(index)),
    'delete-extra': () => dialogs.openDelete(date, { index: Number(index) }),
    audit: () => dialogs.openAudit(date), password: () => dialogs.openPassword(),
    backup, csv, 'choose-backup': () => document.querySelector('#arquivoJSON').click(),
    'legacy-backup': () => download(`backup-local-antigo-${today()}.json`, JSON.stringify(legacySnapshot(), null, 2), 'application/json;charset=utf-8'),
    'legacy-migrate': () => openLegacy()
  };
  actions[action]?.();
});
document.addEventListener('submit', event => {
  const form = event.target;
  if (form.id === 'authForm') { event.preventDefault(); void authenticate(form); }
  if (form.id === 'configForm') { event.preventDefault(); void saveSettings(form); }
  if (form.id === 'auditLookup') { event.preventDefault(); dialogs.openAudit(form.querySelector('#auditDate').value); }
});
document.addEventListener('change', event => {
  if (event.target.id === 'mesFiltro') { state.month = event.target.value; document.querySelector('#historyContent').innerHTML = historyContent(state); }
  if (event.target.id === 'arquivoJSON') void chooseBackup(event.target);
});
document.addEventListener('input', event => {
  clearFieldError(event.target);
  passwordFeedback(event.target);
  if (event.target.id === 'authSenha') clearFieldError(document.getElementById('authConfirmarSenha'));
  if (event.target.closest('#authForm')) document.getElementById('authError').textContent = '';
});
for (const eventName of ['animationend', 'animationcancel']) {
  document.addEventListener(eventName, event => {
    if (event.animationName === 'route-enter') event.target.classList.remove('route-enter');
  });
}
window.addEventListener('hashchange', () => {
  if (['como-funciona', 'main-content'].includes(route())) return;
  render(true, true);
});
let lastDay = today();
window.setInterval(() => {
  updateClock();
  const day = today();
  if (day !== lastDay && state.user && !state.loading && !state.marking && route() !== 'configuracoes' && !document.querySelector('dialog[open]')) {
    lastDay = day;
    void loadData({ silent: true });
  }
}, 1000);
void startAccess();
