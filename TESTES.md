# Estratégia de testes e qualidade

Este documento explica **como reproduzir as verificações** do Meu Ponto, quais comportamentos cada suíte cobre e o que ainda não está automatizado. O projeto é uma demonstração acadêmica de uso individual, não um sistema homologado de controle de ponto.

> Os números abaixo são resultados **registrados em 17/10/2026**, não uma promessa de que sempre haverá exatamente a mesma quantidade de testes. Consulte o GitHub Actions para o estado do commit atual.

## Início rápido

Requisitos: Node.js **22.12+ ou 24.x** (preferencialmente 24 LTS), npm e dependências necessárias para instalar o módulo nativo `better-sqlite3`.

Na raiz do repositório:

```bash
npm ci
npm --prefix backend ci
npm --prefix backend test
npm run test:cloud
npm run test:unit
npm run build
```

Os comandos de teste utilizam **arquivos SQLite/libSQL temporários**, isolados do banco local `backend/dados/jornada.db` e dos bancos Turso de Preview e Production. Não são necessárias variáveis Turso para executar as suítes.

O build compila a aplicação Vite para `dist/`, ignorada pelo Git; não equivale a um teste de navegador.

Para executar os cenários reais de navegação com **Chromium local**:

```bash
npm --prefix e2e ci
./e2e/node_modules/.bin/playwright install chromium
npm run test:e2e
```

Os testes E2E iniciam Vite e Express automaticamente em `127.0.0.1:5173` e `127.0.0.1:3000`, usando **banco SQLite exclusivo e descartável**. Deixe as portas livres. Em Linux CI, use `playwright install --with-deps chromium` para instalar as bibliotecas do navegador. Detalhes em [e2e/README.md](e2e/README.md).

## Matriz de verificações

| Camada | Comando ou procedimento | Arquivos | Resultado registrado |
| --- | --- | --- | --- |
| API Express + SQLite | `npm --prefix backend test` | `backend/auth.test.js`, `backend/contract.test.cjs` | **17 aprovados, 0 falhas** |
| API Express + libSQL e entrada da Vercel | `npm run test:cloud` | `backend/cloud.test.cjs`, `backend/entry.test.cjs` | **41 aprovados, 0 falhas** |
| Regras de jornada (unitários) | `npm run test:unit` | `tests/jornada.test.js` → `src/jornada.js` | **12 aprovados, 0 falhas** |
| Playwright local (E2E) | `npm run test:e2e` | `e2e/tests/jornada.spec.mjs` | **3 cenários aprovados no Chromium**; banco descartável |
| Compilação | `npm run build` | Vite, HTML, CSS e JS | Build aprovado, saída `dist/` |
| Preview hospedado | Requisições HTTP e Chromium/Playwright | Evidências em [VALIDACAO-PREVIEW.md](VALIDACAO-PREVIEW.md) | **14 cenários aprovados**, não versionados como suíte E2E |
| Produção | Verificações de disponibilidade e controle de acesso | Evidências em [VALIDACAO-PRODUCAO.md](VALIDACAO-PRODUCAO.md) | Smoke tests registrados; **não** repetição da suíte E2E completa |

A contagem de 17/41 refere-se às asserções/subtestes reconhecidos por `node:test`, não a 58 casos unitários isolados. A maior parte da cobertura atual é de **integração HTTP**.

## O que os testes automatizados exercitam

### 1. Contrato HTTP compartilhado

O arquivo [`backend/api-contract.cjs`](backend/api-contract.cjs) define o comportamento esperado para as **duas persistências**, sendo reutilizado por `backend/contract.test.cjs` (SQLite) e `backend/cloud.test.cjs` (libSQL).

| Área | Casos verificados |
| --- | --- |
| Disponibilidade e autenticação | `/api/health`, bloqueio de dados sem sessão, cadastro inicial e bloqueio do segundo cadastro |
| Sessões | Login correto/incorreto, cookie `HttpOnly`/`SameSite=Strict`, consulta da sessão e logout |
| Proteção de escrita | CSRF obrigatório em registro, exclusão, configurações, backup, troca de senha e logout |
| Marcações | Criação, edição, exclusão, batidas extras, datas inválidas e horários `HH:mm` inválidos |
| Histórico | Listagem mensal, preservação de query parameters e rejeição de filtros inválidos |
| Configurações | Atualização, persistência e rejeição de jornada inválida |
| Backups | Validação prévia, preservação dos dados em erro, restauração e exclusão |
| Entradas HTTP | JSON inválido e corpo acima do limite |
| Credenciais | Troca de senha, invalidação das sessões antigas e limite de tentativas de login |

### 2. Backend local SQLite

`backend/auth.test.js` também exerce cadastro concorrente, autenticação sobre registros anteriores à criação da conta, CSRF, sessões e limite de tentativas no servidor local.

O banco de teste é criado em pasta temporária e removido ao concluir a suíte.

### 3. API libSQL e runtime serverless

`backend/cloud.test.cjs` verifica, além do contrato compartilhado:

- Cadastro simultâneo por clientes independentes: apenas uma conta é criada.
- Compartilhamento de sessão e dados entre instâncias.
- Persistência após recriar aplicação e cliente libSQL.
- Expiração de sessões.
- Limite atômico sob tentativas de login concorrentes.
- Corrida entre login e alteração de senha.
- Rollback de backup quando ocorre falha SQL durante a transação.
- Respostas e logs sem mensagens privadas em erros simulados.
- Recuperação após falha transitória na inicialização da conexão.

`backend/entry.test.cjs` executa o handler de `api/index.js` com URL original e destino de rewrite, inclusive filtros de mês e rejeição de caminhos malformados.

**Limite:** esses testes utilizam libSQL sobre arquivos temporários; não substituem uma verificação de rede e configuração na Vercel com Turso remoto.

### 4. Testes unitários de jornada e E2E local

O módulo [src/jornada.js](src/jornada.js) contém funções puras extraídas da interface, sem mudança intencional nas regras. A suíte `tests/jornada.test.js` verifica horários `HH:mm`, conversão para minutos, pausas, expediente incompleto, saldo negativo/positivo, virada de meia-noite e formatação de duração.

O projeto [e2e/](e2e/) utiliza Playwright 1.64.1 com instalação fixada por lockfile. Os três cenários automatizam cadastro, registro, edição, extras, downloads, sessão, histórico em tela pequena e restauração de backup. Não utilizam a Vercel e não substituem os 14 cenários hospedados históricos.

## Integração contínua — GitHub Actions

O arquivo [`.github/workflows/ci.yml`](.github/workflows/ci.yml) executa os comandos automatizados em matriz **Node.js 22 e 24**, para Pull Requests dirigidos à `main` e pushes na `main`. Também admite execução manual.

A matriz Node.js 22 e 24 instala as dependências com lockfiles, executa as suítes SQLite e libSQL, executa os testes unitários da jornada e compila o frontend. Um job independente com Node.js 24 instala Chromium e executa o Playwright E2E. Nenhum deles recebe credenciais Turso ou Vercel.

- [Acompanhar execuções](https://github.com/josepauloferreira/pi-ii-controle-jornada/actions/workflows/ci.yml)
- [Execução inicial bem-sucedida (Node 22 e 24)](https://github.com/josepauloferreira/pi-ii-controle-jornada/actions/runs/39052232752)
- [Primeira execução com unitários e Playwright, 3 E2E aprovados](https://github.com/josepauloferreira/pi-ii-controle-jornada/actions/runs/39053909867)

O workflow foi integrado à `main` pelo [PR #29](https://github.com/josepauloferreira/pi-ii-controle-jornada/pull/29). A aprovação dos checks e a política de proteção da `main` são assuntos distintos: configurar regras de branch ainda é uma etapa administrativa.

## Validação hospedada: evidência, não suíte reproduzível

O arquivo [VALIDACAO-PREVIEW.md](VALIDACAO-PREVIEW.md) registra 14 cenários executados em uma versão anterior do Preview real, incluindo:

- Vercel Authentication e health check com acesso protegido.
- Cadastro concorrente, login, sessão, logout, CSRF e rate limiting.
- Criação/edição de batidas, extras, filtro de mês e dados persistidos no Turso.
- Interação no navegador, formatação `1830 → 18:30`, exportação CSV/JSON e restauração.
- Troca de senha, persistência após redeploy e ausência de falhas inesperadas nos fluxos verificados.

Esses **14 cenários hospedados** não foram transpostos integralmente para a suíte Playwright local. Os novos **3 cenários E2E versionados** são executados pela CI, mas cobrem somente a interface com Express e SQLite temporário. A validação da Vercel com Turso, proteção OIDC e rede permanece uma evidência histórica vinculada aos commits e deployments do relatório.

O arquivo [VALIDACAO-PRODUCAO.md](VALIDACAO-PRODUCAO.md) registra verificações públicas de saúde, carregamento, cadastro já inicializado e proteção de dados sem autenticação. Os testes completos com login e manipulação de registros **não foram repetidos com credenciais reais de produção**, por decisão de segurança.

## Limites e próximos testes

- Não há percentual de cobertura instrumentada de código; não invente uma taxa de cobertura.
- A suíte E2E está restrita ao Chromium local: não inclui Firefox/WebKit nem a implantação Vercel/Turso.
- O módulo puro de cálculo tem testes unitários, mas a UI completa não possui instrumentação de cobertura.
- Testes de carga, disponibilidade contínua, recuperação de desastre e homologação legal estão fora do escopo atual.
- As suites de integração não devem acessar Preview/Production; utilize contas e dados fictícios em ambientes isolados.

**Próxima evolução sugerida:** expandir os cenários E2E com tratamento de falhas de rede, acessibilidade, navegadores adicionais e execução em ambiente de Preview protegido, mantendo credenciais restritas e dados fictícios.

## Manutenção

Sempre que alterar rotas HTTP, atualize `backend/api-contract.cjs` e confirme compatibilidade em **ambos** os backends. Execute `npm --prefix backend test`, `npm run test:cloud`, `npm run test:unit`, `npm run test:e2e` e `npm run build` antes de abrir PR. Para publicação protegida e rotação de credenciais, consulte [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md).
