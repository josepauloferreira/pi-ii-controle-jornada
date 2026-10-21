import { icon } from './icons.js';

// Erros locais têm associação própria; mensagens do servidor continuam sendo autoridade.
export function clearFieldError(input) {
  if (!input) return;
  const id = `${input.id}Error`;
  document.getElementById(id)?.remove();
  input.removeAttribute('aria-invalid');
  const descriptions = (input.getAttribute('aria-describedby') || '').split(' ').filter(value => value && value !== id);
  if (descriptions.length) input.setAttribute('aria-describedby', descriptions.join(' '));
  else input.removeAttribute('aria-describedby');
}

export function fieldError(input, message) {
  clearFieldError(input);
  const error = document.createElement('span');
  error.id = `${input.id}Error`;
  error.className = 'field-error';
  error.textContent = message;
  input.closest('.field').append(error);
  input.setAttribute('aria-invalid', 'true');
  input.setAttribute('aria-describedby', [input.getAttribute('aria-describedby'), error.id].filter(Boolean).join(' '));
}

export function validateForm(form) {
  let first;
  for (const input of form.querySelectorAll('input')) {
    clearFieldError(input);
    let message = '';
    if (input.validity.valueMissing) message = 'Preencha este campo.';
    else if (input.autocomplete === 'username' && !input.validity.valid) {
      message = 'Use de 3 a 40 caracteres, começando com uma letra. Use letras, números, ponto, hífen ou sublinhado.';
    } else if (input.minLength > 1 && input.value.length < input.minLength) {
      message = `Use pelo menos ${input.minLength} caracteres.`;
    }
    if (message) {
      fieldError(input, message);
      first ||= input;
    }
  }
  first?.focus();
  return !first;
}

export function passwordFeedback(input) {
  if (!input.matches('[data-new-password]')) return;
  const hint = document.getElementById(`${input.id}Limit`);
  // Não bloquear nem truncar: o servidor valida o limite real de bytes UTF-8.
  hint.hidden = new TextEncoder().encode(input.value).length <= 256;
  const descriptions = (input.getAttribute('aria-describedby') || '').split(' ').filter(value => value && value !== hint.id);
  if (!hint.hidden) descriptions.push(hint.id);
  input.setAttribute('aria-describedby', descriptions.join(' '));
}

export function togglePassword(toggle) {
  const input = document.getElementById(toggle.dataset.password);
  const { selectionStart, selectionEnd, selectionDirection } = input;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  if (selectionStart !== null) input.setSelectionRange(selectionStart, selectionEnd, selectionDirection);
  toggle.setAttribute('aria-pressed', String(show));
  toggle.setAttribute('aria-label', `${show ? 'Ocultar' : 'Mostrar'} ${document.querySelector(`label[for="${input.id}"]`).textContent.toLowerCase()}`);
  toggle.innerHTML = icon(show ? 'eyeOff' : 'eye');
}
