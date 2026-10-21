import { test, expect } from '@playwright/test';

// Casos isolados de UI; a suíte jornada.spec integra a API/SQLite real descartável.
const user = 'motion.ficticio';
const password = 'frase-ficticia-comprida';
const titles = { 'visao-geral': 'Visão Geral', jornada: 'Minha Jornada', historico: 'Histórico', configuracoes: 'Configurações' };
async function mockApi(page, authenticated = true, setup = false) {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const values = {
      '/api/auth/me': { usuario: user, csrfToken: 'csrf-ficticio' },
      '/api/auth/status': { cadastroDisponivel: setup },
      '/api/registros': {}, '/api/configuracoes': { nome: '', jornada: '08:00', inicioSemana: '1' },
      '/api/jornada/previstas': {}, '/api/jornada/ativa': { data: '2026-10-21' }
    };
    if (path === '/api/auth/me' && !authenticated) return route.fulfill({ status: 401, json: { erro: 'Sem sessão' } });
    if (!(path in values)) throw new Error('API inesperada: ' + path);
    await route.fulfill({ json: values[path] });
  });
}
async function ready(page, route = 'visao-geral') {
  await page.goto('/#/' + route);
  await expect(page.locator('#viewTitle')).toHaveText(titles[route]);
}
async function navigation(page, route) {
  await page.locator(`nav:visible a[href="#/${route}"]`).click();
  await expect(page.locator('#viewTitle')).toHaveText(titles[route]);
}
async function recordAnimationStarts(page) {
  await page.evaluate(() => {
    window.routeAnimations = [];
    document.addEventListener('animationstart', event => window.routeAnimations.push({ name: event.animationName, target: event.target.id }));
  });
}
async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test('rotas, teclado, histórico, hash direto, mesma aba e navegação rápida', async ({ page }) => {
  await mockApi(page);
  await ready(page);
  await recordAnimationStarts(page);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const sidebar = await page.locator('.sidebar').boundingBox();
  const main = page.locator('#main-content');
  await expect(main).not.toHaveClass(/route-enter/);
  await page.locator('nav:visible a[href="#/jornada"]').focus();
  await expect(page.locator('nav:visible a[href="#/jornada"]')).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Enter');
  await expect(page.locator('#viewTitle')).toHaveText('Minha Jornada');
  await expect(page.locator('#viewTitle')).toBeFocused();
  await expect(page.locator('nav:visible [aria-current="page"]')).toHaveAttribute('href', '#/jornada');
  await expect(main).toHaveClass(/route-enter/);
  expect(await page.locator('.sidebar').boundingBox()).toEqual(sidebar);
  await navigation(page, 'historico');
  await expect.poll(() => page.evaluate(() => window.routeAnimations.length)).toBe(2);
  expect(await page.evaluate(() => window.routeAnimations)).toEqual([
    { name: 'route-enter', target: 'main-content' }, { name: 'route-enter', target: 'main-content' }
  ]);
  await page.goBack();
  await expect(page.locator('#viewTitle')).toHaveText('Minha Jornada');
  await expect.poll(() => page.evaluate(() => window.routeAnimations.length)).toBe(3);
  await page.goForward();
  await expect(page.locator('#viewTitle')).toHaveText('Histórico');
  await expect.poll(() => page.evaluate(() => window.routeAnimations.length)).toBe(4);
  // Um frame e apenas uma espera de conclusão, nunca um atraso no produto.
  await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished)));
  const starts = await page.evaluate(() => window.routeAnimations.length);
  await navigation(page, 'historico');
  await page.evaluate(() => new Promise(requestAnimationFrame));
  expect(await page.evaluate(() => window.routeAnimations.length)).toBe(starts);
  await page.locator('#mesFiltro').fill('2026-09');
  expect(await page.evaluate(() => window.routeAnimations.length)).toBe(starts);
  await page.evaluate(async () => {
    for (const route of ['jornada', 'configuracoes', 'visao-geral', 'historico', 'configuracoes']) {
      location.hash = '/' + route;
      await new Promise(requestAnimationFrame);
    }
  });
  await expect(page.locator('#viewTitle')).toHaveText('Configurações');
  await expect(page.locator('#viewTitle')).toBeFocused();
  expect(await page.locator('.sidebar').boundingBox()).toEqual(sidebar);
  await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished)));
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await page.goto('/#/historico');
  await page.reload();
  await expect(page.locator('#viewTitle')).toHaveText('Histórico');
  await expect(main).not.toHaveClass(/route-enter/);
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test('movimento reduzido, troca de preferência e navegador sem View Transitions', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(document, 'startViewTransition', { value: undefined }));
  await mockApi(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await recordAnimationStarts(page);
  await navigation(page, 'jornada');
  await navigation(page, 'historico');
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  expect(await page.evaluate(() => window.routeAnimations)).toEqual([]);
  await expect(page.locator('#main-content')).toHaveCSS('opacity', '1');
  await expect(page.locator('#main-content')).toHaveCSS('transform', 'none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await navigation(page, 'configuracoes');
  await expect.poll(() => page.evaluate(() => window.routeAnimations.length)).toBe(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test('cadastro: exemplos, erros associados, 11/12 caracteres e limite UTF-8 sem truncar', async ({ page }) => {
  await mockApi(page, false, true);
  await page.goto('/#/acesso');
  const username = page.locator('#authUsuario');
  const secret = page.locator('#authSenha');
  const confirm = page.locator('#authConfirmarSenha');
  const submit = page.locator('#authSubmit');
  await expect(submit).toContainText('Criar conta');
  await expect(username).toHaveAttribute('placeholder', 'Ex.: joao.silva');
  await expect(secret).toHaveAttribute('autocomplete', 'new-password');
  await expect(confirm).toHaveAttribute('autocomplete', 'new-password');
  await expect(page.locator('#authConfirmarSenhaHelp')).toHaveText('Digite a mesma senha novamente.');
  await username.fill('Nome Inválido');
  await secret.fill('12345678901');
  await confirm.fill('12345678901');
  await submit.click();
  await expect(username).toBeFocused();
  await expect(username).toHaveAttribute('aria-invalid', 'true');
  await expect(username).toHaveAttribute('aria-describedby', 'userHelp authUsuarioError');
  await expect(page.locator('#authSenhaError')).toContainText('12 caracteres');
  await username.fill(user);
  await secret.fill('123456789012');
  await confirm.fill('outra-frase-de-senha');
  await submit.click();
  await expect(confirm).toBeFocused();
  await expect(confirm).toHaveAttribute('aria-describedby', 'authConfirmarSenhaHelp authConfirmarSenhaError');
  await confirm.fill('123456789012');
  await expect(page.locator('#authConfirmarSenhaError')).toHaveCount(0);
  await expect(confirm).not.toHaveAttribute('aria-invalid');
  let sent;
  await page.route('**/api/auth/register', async route => {
    sent = route.request().postDataJSON();
    await route.fulfill({ status: 400, json: { erro: 'A senha precisa ter pelo menos 12 caracteres e no máximo 256 bytes.' } });
  });
  await submit.click();
  await expect(page.locator('#authError')).toContainText('256 bytes');
  expect(sent.senha).toBe('123456789012');
  const multibyte = 'á'.repeat(128);
  await secret.fill(multibyte);
  await expect(page.locator('#authSenhaLimit')).toBeHidden();
  await secret.fill(multibyte + 'á');
  await expect(page.locator('#authSenhaLimit')).toBeVisible();
  await expect(secret).toHaveAttribute('aria-describedby', 'authSenhaHelp authSenhaLimit');
  await confirm.fill(multibyte + 'á');
  await submit.click();
  await expect(page.locator('#authError')).toContainText('256 bytes');
  expect(sent.senha).toBe(multibyte + 'á');
  await expect(secret).toBeFocused();
  await expect(secret).toHaveAttribute('aria-invalid', 'true');
  await expect(secret).toHaveValue(multibyte + 'á');
});

test('login aceita senha antiga, preserva valor/caret, autocomplete, Enter e espera real', async ({ page }) => {
  await mockApi(page, false);
  await page.goto('/#/acesso');
  const secret = page.locator('#authSenha');
  await expect(page.locator('#authSubmit')).toContainText('Entrar');
  await expect(secret).not.toHaveAttribute('minlength');
  await expect(secret).toHaveAttribute('autocomplete', 'current-password');
  await expect(secret).not.toHaveAttribute('placeholder');
  await page.locator('#authUsuario').fill(user);
  await secret.fill('antiga');
  await secret.evaluate(input => input.setSelectionRange(1, 4));
  const show = page.locator('[data-password="authSenha"]');
  await show.click();
  await expect(secret).toHaveAttribute('type', 'text');
  expect(await secret.evaluate(input => [input.selectionStart, input.selectionEnd])).toEqual([1, 4]);
  await expect(show).toHaveAttribute('aria-pressed', 'true');
  await expect(show).toHaveAccessibleName('Ocultar senha');
  await page.keyboard.press('Enter');
  await expect(secret).toHaveAttribute('type', 'password');
  await expect(secret).toHaveValue('antiga');
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let attempts = 0;
  await page.route('**/api/auth/login', async route => {
    attempts++;
    await gate;
    await route.fulfill({ status: 401, json: { erro: 'Usuário ou senha incorretos.' } });
  });
  await secret.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#authSubmit')).toHaveText('Entrando…');
  await expect(page.locator('#authSubmit')).toBeDisabled();
  await page.keyboard.press('Enter');
  release();
  await expect(page.locator('#authError')).toHaveText('Usuário ou senha incorretos.');
  await expect(page.locator('#authError')).toBeFocused();
  await expect(secret).toHaveValue('antiga');
  expect(attempts).toBe(1);
});

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`reflow, foco e shell estável em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 600 });
    await mockApi(page);
    await ready(page);
    const shell = page.locator(width <= 900 ? '.mobile-nav' : '.sidebar');
    const bounds = await shell.boundingBox();
    for (const route of ['jornada', 'historico', 'configuracoes', 'visao-geral']) {
      await navigation(page, route);
      expect(await shell.boundingBox()).toEqual(bounds);
      await noOverflow(page);
      await expect(page.locator('#viewTitle')).toBeFocused();
    }
    await navigation(page, 'configuracoes');
    await page.locator('#btnTrocarSenha').click();
    await page.locator('#senhaNova').fill('curta');
    await page.getByRole('button', { name: 'Salvar nova senha' }).click();
    await expect(page.locator('#senhaAtual')).toBeFocused();
    await expect(page.locator('#senhaNovaError')).toContainText('12 caracteres');
    const dialog = page.getByRole('dialog');
    await dialog.locator('button').last().focus();
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator('#btnTrocarSenha')).toBeFocused();
    // 200% de zoom de layout: metade do viewport CSS, respeitando o mínimo de 320px.
    await page.setViewportSize({ width: Math.max(320, width / 2), height: 450 });
    await noOverflow(page);
  });
}

test('salvar, relógio e expiração não animam a rota nem antecipam sucesso', async ({ page }) => {
  await mockApi(page);
  await ready(page, 'jornada');
  await recordAnimationStarts(page);
  const clock = await page.locator('#relogio').textContent();
  await expect.poll(() => page.locator('#relogio').textContent()).not.toBe(clock);
  expect(await page.evaluate(() => window.routeAnimations)).toEqual([]);
  await navigation(page, 'configuracoes');
  await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished)));
  await page.evaluate(() => { window.routeAnimations = []; });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let writes = 0;
  await page.route('**/api/configuracoes', async route => {
    writes++;
    await gate;
    await route.fulfill({ json: { nome: 'Nome fictício', jornada: '08:00', inicioSemana: '1' } });
  });
  await page.locator('#nomeFuncionario').fill('Nome fictício');
  await page.locator('#saveSettings').click();
  await expect(page.locator('#saveSettings')).toHaveText('Salvando…');
  await expect(page.locator('#saveSettings')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#mensagem')).toBeHidden();
  await page.locator('#configForm').evaluate(form => form.requestSubmit());
  release();
  await expect(page.locator('#configStatus')).toHaveText('Alterações salvas.');
  await expect(page.locator('#saveSettings')).toBeFocused();
  expect(writes).toBe(1);
  expect(await page.evaluate(() => window.routeAnimations)).toEqual([]);
  await expect(page.locator('#main-content')).not.toHaveClass(/route-enter/);
  await page.route('**/api/auth/password', route => route.fulfill({ status: 401, json: { erro: 'Sessão encerrada' } }));
  await page.locator('#btnTrocarSenha').click();
  await page.locator('#senhaAtual').fill(password);
  await page.locator('#senhaNova').fill(password + '-nova');
  await page.getByRole('button', { name: 'Salvar nova senha' }).click();
  await expect(page.locator('#authDescription')).toContainText('Sua sessão terminou');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('#appView')).toHaveCount(0);
  expect(await page.evaluate(() => window.routeAnimations)).toEqual([]);
});
