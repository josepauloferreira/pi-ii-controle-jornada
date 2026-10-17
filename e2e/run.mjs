import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

// Banco sempre temporário: nunca reutilizar o SQLite pessoal nem tocar no Turso.
const directory = mkdtempSync(join(tmpdir(), "meu-ponto-e2e-"));
const cwd = dirname(fileURLToPath(import.meta.url));
const executable = process.platform === "win32" ? "playwright.cmd" : "playwright";
try {
  const code = await new Promise((resolve, reject) => {
    const child = spawn(executable, ["test", ...process.argv.slice(2)], {
      cwd,
      env: { ...process.env, E2E_DB_PATH: join(directory, "jornada.db") },
      stdio: "inherit",
      shell: process.platform === "win32"
    });
    child.once("error", reject);
    child.once("exit", (exitCode, signal) => resolve(exitCode ?? (signal ? 1 : 0)));
  });
  process.exitCode = code;
} finally {
  // O runner Playwright termina os dois webServers antes do retorno.
  rmSync(directory, { recursive: true, force: true });
}
