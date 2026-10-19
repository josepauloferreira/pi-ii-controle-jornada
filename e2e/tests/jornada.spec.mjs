import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

// Dados fictícios em banco SQLite descartável; a conta única é criada uma vez.
const usuario = "jornada.e2e";
const senha = "senha-ficticia-e2e-123";
test.describe.configure({ mode: "serial" });

test("cadastro, registro, edição, extras, downloads e sessão", async ({ page }) => {
  page.on("dialog", dialog => dialog.accept(dialog.type() === "prompt" ? "Correção necessária durante a validação automatizada." : undefined));
  await page.goto("/");
  await expect(page.locator("#authSubmit")).toHaveText("Criar conta");
  await page.locator("#authUsuario").fill(usuario);
  await page.locator("#authSenha").fill(senha);
  await page.locator("#authConfirmarSenha").fill(senha);
  await page.locator("#authSubmit").click();

  await expect(page.locator("#appView")).toBeVisible();
  await expect(page.locator("#btnBaterPonto")).toBeEnabled();
  await page.locator("#btnBaterPonto").click();
  await expect(page.locator("#entrada")).toHaveText(/^\d\d:\d\d$/);

  // Entrada 24h e persistência da edição.
  await page.locator("#editarEntrada").click();
  await page.locator("#editEntrada").fill("1830");
  await expect(page.locator("#editEntrada")).toHaveValue("18:30");
  await page.locator('#modalEdicao button[onclick="salvarEdicao()"]').click();
  await expect(page.locator("#entrada")).toHaveText("18:30");

  await page.locator('button[onclick="abrirModalExtra()"]').click();
  await page.locator("#horarioExtra").fill("1945");
  await expect(page.locator("#horarioExtra")).toHaveValue("19:45");
  await page.locator("#descricaoExtra").fill("Atividade fictícia");
  await page.locator('#modalExtra button[onclick="salvarBatidaExtra()"]').click();
  await expect(page.locator("#quantidadeBatidas")).toHaveText("2");

  const [csv] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exportar CSV" }).click()
  ]);
  const csvData = await readFile(await csv.path(), "utf8");
  expect(csv.suggestedFilename()).toMatch(/\.csv$/);
  expect(csvData).toContain("18:30");

  const [json] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Fazer backup" }).click()
  ]);
  const backup = JSON.parse(await readFile(await json.path(), "utf8"));
  expect(json.suggestedFilename()).toMatch(/\.json$/);
  expect(Object.values(backup.registros)).toEqual(expect.arrayContaining([
    expect.objectContaining({
      entrada: "18:30",
      extras: [{ horario: "19:45", descricao: "Atividade fictícia" }]
    })
  ]));

  await page.reload();
  await expect(page.locator("#appView")).toBeVisible();
  await expect(page.locator("#entrada")).toHaveText("18:30");
  await page.locator("#btnSair").click();
  await expect(page.locator("#authSubmit")).toHaveText("Entrar");

  await page.locator("#authUsuario").fill(usuario);
  await page.locator("#authSenha").fill(senha);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#appView")).toBeVisible();
  await expect(page.locator("#entrada")).toHaveText("18:30");
});

test("histórico e tela pequena após novo login", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#authSubmit")).toHaveText("Entrar");
  await page.locator("#authUsuario").fill(usuario);
  await page.locator("#authSenha").fill(senha);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#appView")).toBeVisible();
  await expect(page.locator("#quantidadeBatidas")).toHaveText("2");
  await expect(page.locator("#tabelaHistorico tr")).toHaveCount(1);
  await expect(page.locator("#btnBaterPonto")).toBeVisible();
});

test("restauração de backup JSON com configurações e registros fictícios", async ({ page }) => {
  await page.goto("/");
  await page.locator("#authUsuario").fill(usuario);
  await page.locator("#authSenha").fill(senha);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#appView")).toBeVisible();

  const data = await page.evaluate(() => {
    const partes = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date()).map(({type,value}) => [type,value]));
    return `${partes.year}-${partes.month}-${partes.day}`;
  });
  const backup = {
    versao: 1,
    configuracoes: { nome: "Demonstração E2E", jornada: "06:00", inicioSemana: "1" },
    registros: {
      [data]: {
        entrada: "08:00", saidaAlmoco: "12:00", retornoAlmoco: "13:00",
        saida: "15:00", extras: []
      }
    }
  };
  page.on("dialog", dialog => dialog.accept(dialog.type() === "prompt" ? "Restauracao ficticia para teste E2E." : undefined));
  await page.locator("#arquivoJSON").setInputFiles({
    name: "backup-ficticio.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup))
  });
  await expect(page.locator("#nomeFuncionario")).toHaveValue("Demonstração E2E");
  await expect(page.locator("#entrada")).toHaveText("08:00");
  await expect(page.locator("#horasHoje")).toHaveText("06:00");
  await expect(page.locator("#saldoHoje")).toHaveText("00:00");
});
