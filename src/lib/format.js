export const fields = ['entrada', 'saidaAlmoco', 'retornoAlmoco', 'saida'];
export const labels = ['Entrada', 'Início da pausa', 'Retorno', 'Saída'];
export const emptyRecord = () => ({ entrada: null, saidaAlmoco: null, retornoAlmoco: null, saida: null, extras: [] });
export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function today() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}
export function dateLabel(date, long = false) {
  return new Intl.DateTimeFormat('pt-BR', long
    ? { dateStyle: 'full', timeZone: 'UTC' }
    : { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }
  ).format(new Date(date + 'T12:00:00Z'));
}
export function timestampLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Data indisponível' : new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo'
  }).format(date);
}
export function bindTimeInputs(root = document) {
  root.querySelectorAll('[data-time]').forEach(input => input.addEventListener('input', () => {
    if (/^\d{4}$/.test(input.value)) input.value = input.value.slice(0, 2) + ':' + input.value.slice(2);
  }));
}
export function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
