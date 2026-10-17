# E2E local com Playwright

Os cenários deste diretório exercitam o **frontend Vite e a API Express/SQLite local**, sem acesso ao banco Turso ou à URL de produção.

## Como executar

Requisitos: Node.js 22.12+ ou 24.x, npm e Chromium instalado pelo Playwright.

```bash
npm ci
npm --prefix backend ci
npm --prefix e2e ci
./e2e/node_modules/.bin/playwright install chromium
npm run test:e2e
```

Em Linux CI, se faltarem bibliotecas do sistema, instale também as dependências com:

```bash
./e2e/node_modules/.bin/playwright install --with-deps chromium
```

O script `npm run test:e2e` cria um arquivo **SQLite temporário** fora do repositório e inicia automaticamente Vite (`127.0.0.1:5173`) e Express (`127.0.0.1:3000`). Os servidores são encerrados e o banco descartado ao término do runner. **Mantenha essas portas livres.**

Não rode os testes E2E apontando para Turso, Preview ou Production. A configuração `playwright.config.mjs` exige um caminho temporário definido pelo script `run.mjs`; não utiliza o SQLite pessoal em `backend/dados`. Os dados e a conta usados nos cenários são fictícios.

## Fluxos cobertos

- Cadastro da única conta e acesso à interface.
- Primeiro registro de ponto e edição `1830` → `18:30`.
- Inclusão de batida extra.
- Downloads CSV e JSON com validação de conteúdo.
- Sessão persistida após reload; logout e novo login.
- Consulta de histórico com viewport móvel.
- Restauração JSON com substituição de registros e configurações.

São **3 cenários E2E versionados**, que não correspondem exatamente aos 14 cenários históricos de Preview apresentados em [VALIDACAO-PREVIEW.md](../VALIDACAO-PREVIEW.md). A suíte atual usa **Chromium local**. Não cobre diretamente a proteção Vercel Authentication, a conexão Turso remota, navegação com credenciais de produção nem outros navegadores.

## Depuração

```bash
npm run test:e2e -- --headed
npm run test:e2e -- --grep "cadastro"
```

A flag é repassada para a CLI Playwright. Traces e screenshots de falhas são gerados em `e2e/test-results/` e ignorados pelo Git. Não anexe traces que contenham credenciais reais.
