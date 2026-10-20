# Estratégia de testes e qualidade

Este documento explica como reproduzir as verificações do Meu Ponto e os limites das evidências. Resultados locais registrados em **20/10/2026**, com **Node.js 24.22.0 e npm 11.19.1**. As contagens não representam percentual de cobertura; o estado remoto do commit deve ser consultado no GitHub Actions.

## Início rápido

Requisitos: Node.js **22.12+ ou 24.x**, npm e dependências para instalar o módulo nativo `better-sqlite3`. Na raiz:

```bash
npm ci
npm --prefix backend ci
npm --prefix backend test
npm run test:cloud
npm run test:unit
npm run build
npm --prefix e2e ci
./e2e/node_modules/.bin/playwright install chromium
npm run test:e2e
```

As suítes usam arquivos SQLite/libSQL temporários, isolados de `backend/dados/jornada.db` e dos bancos Turso de Preview e produção. Não exigem credenciais Turso. O build gera `dist/` e verifica a compilação; a navegação é exercitada separadamente pelo Playwright.

Os E2E iniciam Vite e Express em `127.0.0.1:5173` e `127.0.0.1:3000`; mantenha as portas livres. Em Linux CI, a instalação usa `playwright install --with-deps chromium`. O runner encerra os servidores e descarta o SQLite. Detalhes em [e2e/README.md](e2e/README.md).

## Matriz de verificações

| Camada | Comando | Arquivos | Resultado local |
| --- | --- | --- | --- |
| Express + SQLite | `npm --prefix backend test` | `backend/auth.test.js`, `backend/contract.test.cjs`, `backend/jornada.test.cjs` | **24 aprovados**, 0 falhas |
| Express + libSQL e entrada serverless | `npm run test:cloud` | `backend/cloud.test.cjs`, `backend/entry.test.cjs` | **48 aprovados**, 0 falhas |
| Jornada e validação de backup | `npm run test:unit` | `tests/jornada.test.js`, `tests/backup.test.js` | **15 aprovados**, 0 falhas |
| Interface com SQLite temporário | `npm run test:e2e` | `e2e/tests/jornada.spec.mjs` | **18 aprovados** no Chromium |
| Compilação | `npm run build` | Vite, HTML, CSS e JavaScript | Aprovado |

A linha de base desta rodada, antes da integração da interface, passou com **23 SQLite, 46 cloud, 12 unitários e 3 E2E**, além do build. O documento anterior ainda citava resultados de 17/10/2026 (17/41/12/3); ambos são históricos. A contagem de `node:test` inclui testes e subtestes de integração, sem equivaler a casos unitários isolados.

## Contrato HTTP e regras de jornada

[backend/api-contract.cjs](backend/api-contract.cjs) é reutilizado pelos adaptadores SQLite e libSQL.

| Área | Comportamentos exercitados |
| --- | --- |
| Acesso | Health, cadastro único, login correto/incorreto, cookie de sessão, consulta e logout. |
| Proteção de escrita | CSRF em registros, exclusão, configurações, backup, senha e logout. |
| Jornada normal | Horário e data definidos pelo servidor, sequência de etapas, rejeição de parâmetros de horário do cliente e duplicação. |
| Correções e auditoria | Justificativa de 10–500 caracteres, valores anteriores/posteriores e consulta após exclusão. |
| Jornada prevista | Carga congelada por dia; alterar configurações preserva os dias anteriores; backup versionado. |
| Marcações e histórico | Datas e horários válidos, extras, exclusão, listagem mensal e filtros inválidos. |
| Backup | Validação antes da escrita, preservação em erro, cargas históricas, restauração sem justificativa manual e auditoria automática por registro alterado. |
| HTTP e credenciais | JSON inválido, limite de payload, troca de senha, invalidação de sessões e limite de login. |

O backend local também verifica cadastro concorrente, registros anteriores à conta e o módulo de jornada: fuso do servidor, ordem das etapas, motivos inválidos e jornada após meia-noite vinculada à data da entrada.

A integração libSQL verifica cadastro concorrente por clientes independentes; sessão e dados entre instâncias; persistência após recriar o cliente; expiração; limite atômico de login; corrida entre login e troca de senha; rollback de backup; erros sem detalhes privados; e recuperação de conexão transitória. `backend/entry.test.cjs` verifica o handler de `api/index.js`, URL original, rewrite, query parameters e caminhos malformados.

**Limite:** libSQL é executado sobre arquivos locais descartáveis. Esta rodada não verifica rede Turso, configuração Vercel nem dados de produção.

## Unitários do frontend

Os 12 testes de [src/jornada.js](src/jornada.js) exercitam `HH:mm`, minutos, pausas, expediente incompleto, saldos, virada de meia-noite, extras sem efeito automático no cálculo e duração acima de 24 horas. Os 3 testes de [src/lib/backup.js](src/lib/backup.js) verificam backup legado/noturno, rejeição de estrutura/datas/horários/extras inválidos, configurações e snapshots correspondentes aos registros.

## Matriz E2E — 18 cenários

Playwright **1.64.1**, com versão fixada no lockfile, executa a suíte em série, com um worker e sem retries automáticos. Conta e dados são fictícios.

| Caso | Fluxo e verificação principal |
| --- | --- |
| 1 | Landing, confirmação de senha, cadastro, marcação, correção `1830 → 18:30`, extra, CSV/JSON, reload, logout e login. |
| 2 | Navegação em 320×600, detalhes e auditoria empilhados, Tab/Shift+Tab, Escape, retorno de foco e ações visíveis. |
| 3 | Backup v1 com revisão e confirmação, sem textarea de justificativa, auditoria automática e carga histórica preservada. |
| 4 | JSON inválido, cancelamento de restauração, configurações, senha atual incorreta e foco ao fechar. |
| 5 | Exclusão cancelada e confirmada com motivo; auditoria da jornada excluída pelo drawer e consulta por data. |
| 6 | Carregamento, falha 503 simulada e recuperação por “Tentar novamente”. |
| 7 | Conclusão de jornada de ontem e nova consulta da data ativa; respostas da API interceptadas para simular a virada. |
| 8 | Adição/edição/exclusão de extra sem alterar horas; remoção de etapa, bloqueio por inconsistência e correção explícita. |
| 9 | Falha 503 simulada ao corrigir, manutenção dos dados e do formulário, nova tentativa e retorno de foco. |
| 10 | Exportação após exclusões, ausência de snapshots órfãos e restauração do arquivo exportado. |
| 11 | Backup dos dados locais antigos, migração de dias ausentes e preservação dos conflitos, configurações existentes e localStorage. |
| 12 | Sessão encerrada fora da interface, escrita recebe 401, diálogos fecham e dados privados saem da tela. |
| 13 | 320×600: extras e senha com contenção/retorno de foco, ações com 44px e sem overflow de página. |
| 14 | Mesmas verificações em 390×600. |
| 15 | Mesmas verificações em 768×600. |
| 16 | Mesmas verificações em 1024×600. |
| 17 | Mesmas verificações em 1440×600. |
| 18 | Troca real da senha fictícia na API local, encerramento de sessão, rejeição da senha antiga e novo login. |

Os testes de erro e virada de dia usam interceptação controlada. Os demais fluxos integram o navegador à API local; o teste de senha efetua uma alteração real no banco descartável. Estes 18 cenários não são uma medição de cobertura completa nem uma reprodução integral dos testes hospedados históricos.

## Revisão visual desta entrega

A rodada de capturas local, separada da suíte E2E versionada, registrou **100 PNGs de 20 estados em cinco larguras** (320/390/768/1024/1440px) e **300 medições**, combinadas com alturas 600/667/900px. Os registros automáticos não apontaram overflow de página, alvos menores que 44px, rótulos ausentes, baixo contraste nas amostras ou ações de diálogo fora da área visível. Não houve erro JavaScript, de console ou resposta HTTP inesperada; interações de toque emuladas em 320/390px passaram.

A revisão visual Impeccable encontrou quebra interna de palavra nas métricas do drawer em 320px. Após o ajuste restrito a até 360px, houve 10 recapturas de detalhes/restauração, 30 medições sem violações e revisão das imagens de detalhes em 320/390px. O relatório encerrou o achado como resolvido, sem regressão observada nesse lote, com `remaining: clear` e `disposition: ship` para a correção pontuada. Isso não amplia a revisão para novos navegadores ou dispositivos.

Logs, imagens e relatórios desta rodada ficam em `/tmp/meu-ponto-redesign-review/`, fora do Git e temporários. São evidência local, não um link hospedado permanente. Viewports, contraste amostrado e foco automatizado não substituem avaliação com leitor de tela real ou dispositivo físico.

## Integração contínua — GitHub Actions

[.github/workflows/ci.yml](.github/workflows/ci.yml) está configurado para PRs à `main`, pushes à `main` e execução manual. A matriz **Node.js 22 e 24** instala lockfiles, executa SQLite, libSQL, unitários e build. Um job Node.js 24 separado instala Chromium e executa os E2E, sem credenciais Turso/Vercel.

**Nesta entrega, os resultados acima são locais em Node.js 24.22.0. A matriz remota 22/24 e o job E2E ainda devem ser conferidos no PR final.**

- [Execuções do workflow](https://github.com/josepauloferreira/pi-ii-controle-jornada/actions/workflows/ci.yml).
- [Execução inicial histórica em Node 22/24](https://github.com/josepauloferreira/pi-ii-controle-jornada/actions/runs/39052232752).
- [Primeira execução histórica com os 3 E2E anteriores](https://github.com/josepauloferreira/pi-ii-controle-jornada/actions/runs/39053909867).

## Validação hospedada histórica

[VALIDACAO-PREVIEW.md](VALIDACAO-PREVIEW.md) registra 14 cenários de uma versão anterior: proteção Vercel, cadastro concorrente, sessão/CSRF/rate limiting, marcações, extras, persistência Turso, CSV/JSON, restauração, senha e persistência após redeploy. A evidência se refere aos commits e deployments daquele relatório; não atesta esta interface integrada.

[VALIDACAO-PRODUCAO.md](VALIDACAO-PRODUCAO.md) registra saúde, carregamento, cadastro inicializado e bloqueio de dados sem autenticação. Os fluxos completos com credenciais e registros reais de produção não foram repetidos nesta rodada.

## Limites e manutenção

- A automação de navegador usa somente Chromium local; não houve teste em Firefox/WebKit, leitor de tela real ou dispositivos físicos.
- Não há percentual instrumentado de cobertura de código ou garantia de acessibilidade completa.
- Não houve nova validação de rede Turso/Vercel, carga, disponibilidade contínua, recuperação de desastre ou homologação legal.
- Suítes de integração e E2E devem manter contas e dados fictícios em bases descartáveis.

Ao alterar rotas, atualizar o contrato compartilhado e verificar ambos os backends. Antes do PR, executar SQLite, cloud, unitários, E2E e build. Para publicação e credenciais, consultar [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md).
