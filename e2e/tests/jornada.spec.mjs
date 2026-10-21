import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// A configuração exige E2E_DB_PATH e o runner cria um SQLite descartável.
const usuario = 'jornada.e2e';
const senha = 'senha-ficticia-e2e-123';
const nextPassword = 'nova-senha-ficticia-e2e-456';
const reason = 'Correção fictícia durante a validação automatizada.';
test.describe.configure({ mode: 'serial' });
async function login(page, route = 'jornada', password = senha) {
  await page.goto('/#/' + route);
  await expect(page.locator('#authSubmit')).toContainText('Entrar');
  await page.locator('#authUsuario').fill(usuario);
  await page.locator('#authSenha').fill(password);
  await page.locator('#authSubmit').click();
  await expect(page.locator('#appView')).toBeVisible();
  await expect(page.locator('#viewTitle')).not.toContainText('Carregando');
}
async function goto(page, route) {
  await page.locator(`nav:visible a[href="#/${route}"]`).click();
}
async function fixture(page, date, record) {
  return page.evaluate(async ({ date, record, reason }) => {
    const session = await (await fetch('/api/auth/me')).json();
    const r = await fetch('/api/registros/' + date, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrfToken }, body: JSON.stringify({ ...record, justificativa: reason }) });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }, { date, record, reason });
}
async function expectFocusInside(page, dialog) {
  await dialog.locator('button:enabled, input:enabled, textarea:enabled, select:enabled').last().focus();
  await page.keyboard.press('Tab');
  await expect.poll(() => dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Shift+Tab');
  await expect.poll(() => dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
}

test('landing, cadastro inicial, marcação, correção, extras, downloads e sessão', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Seu tempo,bem registrado.');
  await page.getByRole('link', { name: 'Acessar Meu Ponto', exact: true }).click();
  await expect(page.locator('#authSubmit')).toContainText('Criar conta');
  await page.locator('#authUsuario').fill(usuario);
  await page.locator('#authSenha').fill(senha);
  await page.locator('#authConfirmarSenha').fill(senha + 'x');
  await page.locator('#authSubmit').click();
  await expect(page.locator('#authError')).toContainText('não coincidem');
  await page.locator('#authConfirmarSenha').fill(senha);
  await page.locator('#authSubmit').click();
  await expect(page.locator('#viewTitle')).toHaveText('Visão Geral');
  await expect(page.getByRole('heading', { name: 'Tudo pronto para começar.' })).toBeVisible();
  await goto(page, 'jornada');
  await expect(page.locator('#quantidadeBatidas')).toHaveText('0 de 4 etapas principais · 0 batidas extras');
  await page.locator('#btnBaterPonto').click();
  await expect(page.locator('#entrada')).toHaveText(/^\d\d:\d\d$/);
  await page.locator('#editarEntrada').click();
  await page.locator('#editHorario').fill('1830');
  await expect(page.locator('#editHorario')).toHaveValue('18:30');
  await page.locator('#editReason').fill(reason);
  await page.getByRole('button', { name: 'Salvar correção', exact: true }).click();
  await expect(page.locator('#entrada')).toHaveText('18:30');
  await page.getByRole('button', { name: 'Gerenciar extras', exact: true }).click();
  await page.locator('#horarioExtra').fill('1945');
  await expect(page.locator('#horarioExtra')).toHaveValue('19:45');
  await page.locator('#descricaoExtra').fill('Atividade fictícia');
  await page.locator('#extraReason').fill(reason);
  await page.getByRole('button', { name: 'Adicionar batida', exact: true }).click();
  await expect(page.locator('#quantidadeBatidas')).toHaveText('1 de 4 etapas principais · 1 batida extra');
  await goto(page, 'historico');
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar CSV' }).click()]);
  expect(await readFile(await csv.path(), 'utf8')).toContain('18:30');
  await goto(page, 'configuracoes');
  const [json] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Fazer backup', exact: true }).click()]);
  const backup = JSON.parse(await readFile(await json.path(), 'utf8'));
  expect(Object.values(backup.registros)).toEqual(expect.arrayContaining([expect.objectContaining({ entrada: '18:30', extras: [{ horario: '19:45', descricao: 'Atividade fictícia' }] })]));
  await page.reload();
  await expect(page.locator('#appView')).toBeVisible();
  await page.locator('button[data-action="logout"]:visible').click();
  await expect(page.locator('#authSubmit')).toContainText('Entrar');
  await expect(page.locator('#authConfirmarSenha')).toHaveCount(0);
  await page.locator('#authUsuario').fill(usuario);
  await page.locator('#authSenha').fill(senha);
  await page.locator('#authSubmit').click();
  await goto(page, 'jornada');
  await expect(page.locator('#entrada')).toHaveText('18:30');
  expect(errors).toEqual([]);
});

test('navegação mobile, detalhes, auditoria e Escape com retorno de foco', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 600 });
  await login(page);
  await expect(page.locator('#quantidadeBatidas')).toHaveText('1 de 4 etapas principais · 1 batida extra');
  await expect(page.locator('.sidebar')).toBeHidden();
  await expect(page.locator('.mobile-nav')).toBeVisible();
  await goto(page, 'historico');
  await page.getByRole('button', { name: /^Ver detalhes de/ }).first().click();
  const detail = page.getByRole('dialog', { name: 'Detalhes da jornada' });
  await expect(detail).toBeVisible();
  await expectFocusInside(page, detail);
  await detail.getByRole('button', { name: 'Histórico de alterações' }).click();
  const audit = page.getByRole('dialog', { name: 'Histórico de alterações' });
  await expect(audit).toContainText('Correção de registro');
  await expectFocusInside(page, audit);
  await page.keyboard.press('Escape');
  await expect(audit).toHaveCount(0);
  await expect(detail.getByRole('button', { name: 'Histórico de alterações' })).toBeFocused();
  await detail.getByRole('button', { name: 'Corrigir horários' }).click();
  const edit = page.locator('#modalEdicao');
  await expect(edit).toBeVisible();
  await expectFocusInside(page, edit);
  const footer = await edit.locator('.dialog-footer').boundingBox();
  expect(footer.y + footer.height).toBeLessThanOrEqual(600);
  await page.keyboard.press('Escape');
  await expect(detail.getByRole('button', { name: 'Corrigir horários' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /^Ver detalhes de/ }).first()).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('restauração revisada sem justificativa e jornada histórica congelada', async ({ page }) => {
  await login(page, 'configuracoes');
  const date = await page.evaluate(() => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date()));
  const data = { versao: 1, configuracoes: { nome: 'Demonstração E2E', jornada: '06:00', inicioSemana: '1' }, registros: { [date]: { entrada: '08:00', saidaAlmoco: '12:00', retornoAlmoco: '13:00', saida: '15:00', extras: [] } } };
  await page.locator('#chooseBackup').focus();
  await page.locator('#arquivoJSON').setInputFiles({ name: 'backup-ficticio.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  const modal = page.locator('#restoreModal');
  await expect(modal).toBeVisible();
  await expect(modal.locator('textarea')).toHaveCount(0);
  await expect(modal.getByRole('button', { name: 'Restaurar backup', exact: true })).toBeDisabled();
  await modal.locator('#confirmRestore').check();
  await modal.getByRole('button', { name: 'Restaurar backup', exact: true }).click();
  await expect(page.locator('#nomeFuncionario')).toHaveValue('Demonstração E2E');
  await goto(page, 'jornada');
  await expect(page.locator('#entrada')).toHaveText('08:00');
  await expect(page.locator('#horasHoje')).toHaveText('06:00');
  await expect(page.locator('#jornadaHoje')).toHaveText('08:00');
  await expect(page.locator('#saldoHoje')).toHaveText('-02:00');
  await expect(page.locator('#quantidadeBatidas')).toHaveText('4 de 4 etapas principais · 0 batidas extras');
  await page.getByRole('button', { name: 'Histórico de alterações' }).click();
  const audit = page.getByRole('dialog', { name: 'Histórico de alterações' });
  await expect(audit).toContainText('Restauração de backup confirmada pelo usuário.');
  await expect(audit).toContainText('18:30');
});

test('backup inválido, restauração cancelada, configurações e senha com erro', async ({ page }) => {
  await login(page, 'configuracoes');
  await page.locator('#arquivoJSON').setInputFiles({ name: 'invalido.json', mimeType: 'application/json', buffer: Buffer.from('{') });
  await expect(page.locator('#backupError')).toContainText('JSON válido');
  await expect(page.locator('#restoreModal')).toHaveCount(0);
  await page.locator('#arquivoJSON').setInputFiles({ name: 'vazio.json', mimeType: 'application/json', buffer: Buffer.from('{"registros":{}}') });
  await page.keyboard.press('Escape');
  await expect(page.locator('#restoreModal')).toHaveCount(0);
  await page.locator('#nomeFuncionario').fill('Nome fictício atualizado');
  await page.locator('#jornadaDiaria').fill('0730');
  await page.locator('#inicioSemana').selectOption('0');
  await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
  await expect(page.locator('#configStatus')).toHaveText('Alterações salvas.');
  await page.getByRole('button', { name: 'Alterar senha', exact: true }).click();
  await page.locator('#senhaAtual').fill('incorreta');
  await page.locator('#senhaNova').fill(nextPassword);
  await page.getByRole('button', { name: 'Salvar nova senha' }).click();
  await expect(page.locator('#senhaAtualError')).toContainText('incorreta');
  await expect(page.locator('#senhaAtual')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#senhaAtual')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#btnTrocarSenha')).toBeFocused();
  await goto(page, 'jornada');
  await expect(page.locator('#jornadaHoje')).toHaveText('08:00');
});

test('exclusão justificada, confirmação e auditoria de jornada excluída', async ({ page }) => {
  await login(page, 'historico');
  const date = '2026-09-17';
  await fixture(page, date, { entrada: '08:00', saidaAlmoco: null, retornoAlmoco: null, saida: '16:00', extras: [] });
  await page.reload();
  await page.locator('#mesFiltro').fill('2026-09');
  await page.getByRole('button', { name: 'Ver detalhes de 17/09/2026' }).click();
  const detail = page.getByRole('dialog', { name: 'Detalhes da jornada' });
  await detail.getByRole('button', { name: 'Excluir registro', exact: true }).click();
  const remove = page.locator('#modalExclusao');
  await remove.getByRole('button', { name: 'Cancelar' }).click();
  await expect(detail).toBeVisible();
  await detail.getByRole('button', { name: 'Excluir registro', exact: true }).click();
  await page.locator('#deleteReason').fill(reason);
  await remove.getByRole('button', { name: 'Confirmar exclusão' }).click();
  await expect(detail).toContainText('Esta jornada foi excluída.');
  await detail.getByRole('button', { name: 'Histórico de alterações' }).click();
  await expect(page.getByRole('dialog', { name: 'Histórico de alterações' })).toContainText('Exclusão de registro');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Nenhuma jornada neste mês.' })).toBeVisible();
  await page.getByText('Consultar histórico de alterações por data', { exact: true }).click();
  await page.locator('#auditDate').fill(date);
  await page.getByRole('button', { name: 'Consultar alterações' }).click();
  await expect(page.getByRole('dialog', { name: 'Histórico de alterações' })).toContainText(reason);
});

test('carregamento, erro da API e recuperação sem renderizar dados fictícios', async ({ page }) => {
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  let fail = false;
  await page.route('**/api/registros', async route => {
    await wait;
    if (fail) await route.fulfill({ status: 503, contentType: 'application/json', body: '{"erro":"Falha fictícia de rede. Tente novamente."}' });
    else await route.continue();
  });
  await page.goto('/#/jornada');
  await page.locator('#authUsuario').fill(usuario);
  await page.locator('#authSenha').fill(senha);
  await page.locator('#authSubmit').click();
  await expect(page.getByRole('heading', { name: 'Carregando sua jornada…' })).toBeVisible();
  await expect(page.locator('#btnBaterPonto')).toHaveCount(0);
  fail = true;
  release();
  await expect(page.getByRole('heading', { name: 'Não foi possível carregar sua jornada.' })).toBeVisible();
  await expect(page.locator('#appView')).toContainText('Falha fictícia de rede.');
  fail = false;
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.locator('#viewTitle')).toHaveText('Minha Jornada');
  await expect(page.locator('#entrada')).toHaveText('08:00');
});

test('a interface segue a data ativa do servidor ao concluir uma jornada de ontem', async ({ page }) => {
  await login(page);
  const today = await page.evaluate(() => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date()));
  const previous = new Date(today + 'T12:00:00Z');
  previous.setUTCDate(previous.getUTCDate() - 1);
  const date = previous.toISOString().slice(0, 10);
  const record = { entrada: '21:00', saidaAlmoco: '23:00', retornoAlmoco: '23:30', saida: null, extras: [] };
  await fixture(page, date, record);
  let finished = false;
  await page.route('**/api/jornada/ativa', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: finished ? today : date, registro: record }) }));
  await page.route('**/api/jornada/marcar', async r => {
    expect(r.request().postDataJSON()).toEqual({});
    finished = true;
    await r.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: date, campo: 'saida', horario: '00:30', instante: today + 'T03:30:00Z', registro: { ...record, saida: '00:30' }, jornadaPrevista: { minutos: 480, origem: 'registrada' } }) });
  });
  await page.reload();
  await expect(page.locator('#entrada')).toHaveText('21:00');
  await expect(page.locator('#btnBaterPonto')).toHaveText('Registrar saída');
  await page.locator('#btnBaterPonto').click();
  // Após concluir ontem, a próxima data ativa vem novamente da API, sem adivinhação no cliente.
  await expect(page.locator('#entrada')).toHaveText('08:00');
  await expect(page.locator('#btnBaterPonto')).toHaveText('Jornada concluída');
});

test('edição e exclusão de extras preservam as horas e a correção mantém a ordem explícita', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Gerenciar extras', exact: true }).click();
  await page.locator('#horarioExtra').fill('19:30');
  await page.locator('#descricaoExtra').fill('Descrição fictícia inicial');
  await page.locator('#extraReason').fill(reason);
  await page.getByRole('button', { name: 'Adicionar batida', exact: true }).click();
  await expect(page.locator('#horasHoje')).toHaveText('06:00');
  await page.getByRole('button', { name: 'Gerenciar extras', exact: true }).click();
  await page.getByRole('button', { name: 'Editar batida extra das 19:30' }).click();
  await page.locator('#horarioExtraEdit').fill('20:00');
  await page.locator('#descricaoExtraEdit').fill('Descrição fictícia corrigida');
  await page.locator('#extraReasonEdit').fill(reason);
  await page.getByRole('button', { name: 'Salvar batida', exact: true }).click();
  await expect(page.locator('#modalExtra [data-extra-list]')).toContainText('20:00');
  await page.getByRole('button', { name: 'Excluir batida extra das 20:00' }).click();
  await page.locator('#deleteReason').fill(reason);
  await page.getByRole('button', { name: 'Confirmar exclusão' }).click();
  await expect(page.locator('#modalExtra [data-extra-list]')).toContainText('Nenhuma');
  await page.keyboard.press('Escape');
  await expect(page.locator('#horasHoje')).toHaveText('06:00');
  await page.getByRole('button', { name: 'Excluir retorno', exact: true }).click();
  await page.locator('#deleteReason').fill(reason);
  await page.getByRole('button', { name: 'Confirmar exclusão' }).click();
  await expect(page.locator('#retornoAlmoco')).toHaveText('--:--');
  await expect(page.locator('#btnBaterPonto')).toBeDisabled();
  await expect(page.locator('#btnBaterPonto')).toHaveText('Correção necessária');
  await page.getByRole('button', { name: 'Corrigir horários', exact: true }).click();
  await page.locator('input[name="campo"][value="retornoAlmoco"]').check();
  await page.locator('#editHorario').fill('13:00');
  await page.locator('#editReason').fill(reason);
  await page.getByRole('button', { name: 'Salvar correção', exact: true }).click();
  await expect(page.locator('#horasHoje')).toHaveText('06:00');
  await expect(page.locator('#saldoHoje')).toHaveText('-02:00');
});

test('falha ao corrigir mantém os dados e permite nova tentativa no mesmo modal', async ({ page }) => {
  await login(page);
  await page.locator('#editarEntrada').click();
  await page.locator('#editHorario').fill('07:45');
  await page.locator('#editReason').fill(reason);
  await page.route('**/api/registros/*', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"erro":"Falha fictícia ao salvar."}' }));
  await page.getByRole('button', { name: 'Salvar correção', exact: true }).click();
  await expect(page.locator('#modalEdicao [data-dialog-error]')).toContainText('Falha fictícia ao salvar');
  await expect(page.locator('#entrada')).toHaveText('08:00');
  await expect(page.locator('#editHorario')).toHaveValue('07:45');
  await page.unroute('**/api/registros/*');
  await page.locator('#editHorario').fill('08:00');
  await page.getByRole('button', { name: 'Salvar correção', exact: true }).click();
  await expect(page.locator('#modalEdicao')).toHaveCount(0);
  await expect(page.locator('#editarEntrada')).toBeFocused();
});

test('backup exportado após exclusões pode ser restaurado e não inclui snapshots órfãos', async ({ page }) => {
  await login(page, 'configuracoes');
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Fazer backup', exact: true }).click()]);
  const content = await readFile(await file.path());
  const data = JSON.parse(content.toString());
  expect(Object.keys(data.jornadasPrevistas).every(date => Object.hasOwn(data.registros, date))).toBe(true);
  await page.locator('#arquivoJSON').setInputFiles({ name: 'reimportar-ficticio.json', mimeType: 'application/json', buffer: content });
  await expect(page.locator('#restoreModal')).toBeVisible();
  await page.locator('#confirmRestore').check();
  await page.getByRole('button', { name: 'Restaurar backup', exact: true }).click();
  await expect(page.locator('#restoreModal')).toHaveCount(0);
  await expect(page.locator('#nomeFuncionario')).toHaveValue('Nome fictício atualizado');
});

test('migração preserva dados locais, conflitos e configurações existentes', async ({ page }) => {
  await page.addInitScript(() => {
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    const record = { entrada: '01:00', saidaAlmoco: null, retornoAlmoco: null, saida: '03:00', extras: [] };
    localStorage.setItem('meu_ponto_registros', JSON.stringify({ '2026-07-14': record, [today]: record }));
    localStorage.setItem('meu_ponto_config', JSON.stringify({ nome: 'Local fictício', jornada: '04:00', inicioSemana: '1' }));
  });
  await login(page);
  const migration = page.getByRole('dialog', { name: 'Dados antigos neste navegador' });
  await expect(migration).toBeVisible();
  const [file] = await Promise.all([page.waitForEvent('download'), migration.getByRole('button', { name: 'Baixar backup local antigo' }).click()]);
  expect(JSON.parse(await readFile(await file.path(), 'utf8')).registros['2026-07-14'].entrada).toBe('01:00');
  await migration.getByRole('button', { name: 'Copiar dados ausentes' }).click();
  await expect(migration).toHaveCount(0);
  await expect(page.locator('#entrada')).toHaveText('08:00');
  await goto(page, 'historico');
  await page.locator('#mesFiltro').fill('2026-07');
  await expect(page.getByRole('button', { name: 'Ver detalhes de 14/07/2026' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('meu_ponto_registros'))['2026-07-14'].entrada)).toBe('01:00');
  await goto(page, 'configuracoes');
  await expect(page.locator('#nomeFuncionario')).toHaveValue('Nome fictício atualizado');
});

test('sessão expirada fecha diálogos e remove os dados privados da interface', async ({ page }) => {
  await login(page);
  await page.locator('#editarEntrada').click();
  await page.locator('#editReason').fill(reason);
  await page.evaluate(async () => {
    const session = await (await fetch('/api/auth/me')).json();
    await fetch('/api/auth/logout', { method: 'POST', headers: { 'X-CSRF-Token': session.csrfToken } });
  });
  await page.getByRole('button', { name: 'Salvar correção', exact: true }).click();
  await expect(page.locator('#authDescription')).toContainText('Sua sessão terminou');
  await expect(page.locator('#appView')).toHaveCount(0);
  await expect(page.locator('dialog')).toHaveCount(0);
  await expect(page.locator('#screen')).not.toContainText('Nome fictício atualizado');
});

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`responsividade e ações dos modais em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 600 });
    await login(page);
    await page.getByRole('button', { name: 'Gerenciar extras', exact: true }).click();
    const extra = page.locator('#modalExtra');
    await expectFocusInside(page, extra);
    for (const btn of await extra.locator('.dialog-footer button').all()) {
      const box = await btn.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.y + box.height).toBeLessThanOrEqual(600);
    }
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Gerenciar extras', exact: true })).toBeFocused();
    await goto(page, 'historico');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await goto(page, 'configuracoes');
    await page.getByRole('button', { name: 'Alterar senha', exact: true }).click();
    await expectFocusInside(page, page.locator('#senhaModal'));
    await page.keyboard.press('Escape');
    await expect(page.locator('#btnTrocarSenha')).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('troca de senha real encerra a sessão e permite novo login', async ({ page }) => {
  await login(page, 'configuracoes');
  await page.getByRole('button', { name: 'Alterar senha', exact: true }).click();
  await page.locator('#senhaAtual').fill(senha);
  await page.locator('#senhaNova').fill(nextPassword);
  await page.getByRole('button', { name: 'Salvar nova senha' }).click();
  await expect(page.locator('#authDescription')).toContainText('Senha atualizada');
  await page.locator('#authUsuario').fill(usuario);
  await page.locator('#authSenha').fill(senha);
  await page.locator('#authSubmit').click();
  await expect(page.locator('#authError')).toContainText('incorretos');
  await page.locator('#authSenha').fill(nextPassword);
  await page.locator('#authSubmit').click();
  await expect(page.locator('#appView')).toBeVisible();
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 320, height: 600 }]) {
  test(`grava as quatro seções reais em ${viewport.width}px com shell estável`, async ({ browser, baseURL }, info) => {
    const context = await browser.newContext({ baseURL, viewport, recordVideo: { dir: info.outputPath('videos'), size: viewport } });
    const page = await context.newPage();
    try {
      await login(page, 'visao-geral', nextPassword);
      const shell = page.locator(viewport.width < 900 ? '.mobile-nav' : '.sidebar');
      const bounds = await shell.boundingBox();
      for (const route of ['jornada', 'historico', 'configuracoes', 'visao-geral']) {
        await goto(page, route);
        // Pausa só da gravação; a aplicação nunca espera para trocar de seção.
        await page.waitForTimeout(650);
        expect(await shell.boundingBox()).toEqual(bounds);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await info.attach(`${route}-${viewport.width}`, { body: await page.screenshot(), contentType: 'image/png' });
      }
    } finally {
      await context.close();
      await info.attach(`navegacao-${viewport.width}`, { path: await page.video().path(), contentType: 'video/webm' });
    }
  });
}
