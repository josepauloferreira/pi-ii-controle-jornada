import { escape, bindTimeInputs } from '../lib/format.js';
import { icon } from './icons.js';

let sequence = 0;
const stack = [];

// O dialog nativo mantém o fundo inerte, inclusive entre sobreposições aninhadas.
export function openDialog({ id, title, description = '', body, footer = '', drawer = false, initialFocus, onClose }) {
  const trigger = document.activeElement;
  const triggerSelector = trigger?.id ? '#' + CSS.escape(trigger.id)
    : trigger?.dataset.action ? '[data-action="' + CSS.escape(trigger.dataset.action) + '"]' + ['date', 'field', 'index'].filter(key => trigger.dataset[key] !== undefined).map(key => '[data-' + key + '="' + CSS.escape(trigger.dataset[key]) + '"]').join('') : null;
  const number = ++sequence;
  const element = document.createElement('dialog');
  element.id = id || `dialog-${number}`;
  element.className = `dialog${drawer ? ' drawer' : ''}`;
  element.setAttribute('aria-labelledby', `dialog-title-${number}`);
  if (description) element.setAttribute('aria-describedby', `dialog-description-${number}`);
  element.innerHTML = `<div class="dialog-layout"><header class="dialog-header"><div>
    <h2 id="dialog-title-${number}" tabindex="-1">${escape(title)}</h2>
    ${description ? `<p id="dialog-description-${number}">${escape(description)}</p>` : ''}
    </div><button type="button" class="btn icon-button" data-close aria-label="Fechar ${escape(title)}">${icon('close')}</button></header>
    <div class="dialog-body">${body}<p class="form-error" role="alert" data-dialog-error></p></div>
    ${footer ? `<footer class="dialog-footer">${footer}</footer>` : ''}</div>`;
  let busy = false;
  const handle = {
    element,
    query: selector => element.querySelector(selector),
    close() { if (!busy) element.close(); },
    error(message) {
      const error = element.querySelector('[data-dialog-error]');
      error.textContent = message;
      error.tabIndex = -1;
      error.focus();
      error.scrollIntoView({ block: 'nearest' });
    },
    setBusy(value, label = 'Salvando…') {
      busy = value;
      element.setAttribute('aria-busy', String(value));
      element.querySelectorAll('button, input, select, textarea').forEach(control => {
        if (value) {
          control.dataset.wasDisabled = String(control.disabled);
          control.disabled = true;
        } else {
          control.disabled = control.dataset.wasDisabled === 'true';
          delete control.dataset.wasDisabled;
        }
      });
      const submit = element.querySelector('[data-submit]');
      if (submit) {
        if (value) { submit.dataset.label = submit.innerHTML; submit.textContent = label; }
        else if (submit.dataset.label) { submit.innerHTML = submit.dataset.label; delete submit.dataset.label; }
      }
    }
  };
  element.addEventListener('click', event => {
    if (event.target.closest('[data-close]')) handle.close();
  });
  element.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  element.addEventListener('keydown', event => {
    if (event.key !== 'Tab' || stack.at(-1) !== handle) return;
    const controls = [...element.querySelectorAll('button:not(:disabled), input:not(:disabled):not([type=hidden]), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])')]
      .filter(control => control.getClientRects().length && !control.closest('[hidden]'));
    const first = controls[0];
    const last = controls.at(-1);
    if (!first) { event.preventDefault(); element.querySelector('h2').focus(); }
    else if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement))) { event.preventDefault(); first.focus(); }
  });
  element.addEventListener('close', () => {
    const index = stack.indexOf(handle);
    if (index !== -1) stack.splice(index, 1);
    element.remove();
    document.documentElement.classList.toggle('dialog-open', stack.length > 0);
    onClose?.();
    const parent = stack.at(-1)?.element;
    const replacement = triggerSelector ? (parent || document).querySelector(triggerSelector) : null;
    const candidate = trigger?.isConnected ? trigger : replacement;
    const target = candidate?.getClientRects().length && !candidate.closest('[hidden]') && (!parent || parent.contains(candidate))
      ? candidate : parent?.querySelector('h2') || document.querySelector('#viewTitle, #authTitle, #landingTitle');
    target?.focus({ preventScroll: true });
  });
  document.body.append(element);
  bindTimeInputs(element);
  stack.push(handle);
  document.documentElement.classList.add('dialog-open');
  element.showModal();
  (initialFocus && element.querySelector(initialFocus) || element.querySelector('h2')).focus({ preventScroll: true });
  return handle;
}
export function closeDialogs() {
  for (const handle of [...stack].reverse()) {
    handle.setBusy(false);
    handle.close();
  }
}
export const cancelButton = '<button type="button" class="btn" data-close>Cancelar</button>';
