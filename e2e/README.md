# E2E local com Playwright

A suíte integra o frontend Vite à API Express/SQLite local, usando conta e dados fictícios. Em **20/10/2026**, os **18 cenários passaram** com **Node.js 24.22.0, npm 11.19.1 e Playwright 1.64.1**, sem acessar Turso ou produção.

## Motion v3 — 21/10/2026

A execução padrão agora inclui **30 testes**: os 18 cenários de integração documentados abaixo, 10 novos cenários de movimento/formulários em `tests/motion.spec.mjs` (respostas interceptadas) e 2 capturas de navegação com API/SQLite real descartável. As gravações desktop/mobile e os PNGs ficam em `test-results/`; a CI os preserva no artefato `meu-ponto-e2e-evidencias` por 14 dias. Os vídeos usam apenas credenciais fictícias. Resultados e limites em [VALIDACAO-MOTION.md](../VALIDACAO-MOTION.md).

## Como executar

Requisitos: Node.js 22.12+ ou 24.x, npm e Chromium instalado pelo Playwright. Na raiz:

```bash
npm ci
npm --prefix backend ci
npm --prefix e2e ci
./e2e/node_modules/.bin/playwright install chromium
npm run test:e2e
```

Em Linux CI, quando forem necessárias as bibliotecas do sistema:

```bash
./e2e/node_modules/.bin/playwright install --with-deps chromium
```

O runner `run.mjs` cria um SQLite temporário fora do repositório, define `E2E_DB_PATH` e inicia Vite (`127.0.0.1:5173`) e Express (`127.0.0.1:3000`). Ao terminar, encerra os servidores e descarta o banco. Mantenha essas portas livres; a configuração recusa a execução sem o caminho fornecido pelo runner e não reutiliza servidores existentes nem o banco pessoal de `backend/dados`.

Os testes em `tests/jornada.spec.mjs` rodam em série, com um worker e sem retries automáticos. Os casos compartilham o banco do runner; mudanças de senha e dados se referem exclusivamente à conta fictícia. Mantenha o destino local configurado, sem apontar a suíte para Turso, Preview ou produção.

## Matriz dos 18 cenários

| Caso | Comportamento verificado |
| --- | --- |
| 1 | Landing, cadastro e confirmação de senha, marcação, correção `1830 → 18:30`, extra, downloads CSV/JSON, reload, logout e login. |
| 2 | Mobile 320×600, detalhes/auditoria empilhados, Tab/Shift+Tab, Escape, retorno de foco e footer visível. |
| 3 | Restauração v1 com confirmação, sem justificativa manual, auditoria automática e carga histórica congelada. |
| 4 | JSON inválido, restauração cancelada, configurações e erro de senha atual incorreta. |
| 5 | Cancelamento e confirmação de exclusão justificada; auditoria do dia excluído inclusive por consulta de data. |
| 6 | Carregamento, erro 503 simulado e nova tentativa bem-sucedida. |
| 7 | Data ativa retornada pela API após concluir a jornada de ontem; interceptações simulam a virada. |
| 8 | Editar/excluir extras sem alterar horas; exclusão de etapa exige corrigir a ordem antes de marcar novamente. |
| 9 | Erro 503 ao salvar correção preserva formulário/dados; repetir a ação recupera o fluxo e o foco. |
| 10 | Backup exportado após exclusões omite snapshots órfãos e pode ser restaurado. |
| 11 | Migração de dias locais ausentes preserva conflitos, configurações existentes e localStorage; download da cópia antiga. |
| 12 | Sessão encerrada externamente recebe 401 na escrita, fecha diálogos e remove os dados privados da tela. |
| 13 | 320×600: modais de extras/senha com foco contido, Escape e retorno; ações com 44px e página sem overflow. |
| 14 | Mesmas verificações em 390×600. |
| 15 | Mesmas verificações em 768×600. |
| 16 | Mesmas verificações em 1024×600. |
| 17 | Mesmas verificações em 1440×600. |
| 18 | Troca de senha real na API local, sessão encerrada, senha antiga rejeitada e novo login. |

Erros e virada de dia usam interceptações controladas do Playwright. A troca de senha atua na API e no SQLite descartável. Os 18 casos atuais substituem a suíte anterior de 3 casos e permanecem distintos dos 14 cenários hospedados históricos em [VALIDACAO-PREVIEW.md](../VALIDACAO-PREVIEW.md).

## Depuração

```bash
npm --prefix e2e test -- --headed
npm --prefix e2e test -- --grep "cadastro"
```

As flags seguem para a CLI Playwright. Como a suíte é serial e compartilha o banco criado no primeiro caso, filtros que isolam casos posteriores podem precisar de preparação equivalente; o filtro de cadastro acima inclui a criação inicial. Traces e screenshots de falhas ficam em `e2e/test-results/`, ignorados pelo Git. Use somente dados fictícios nesses arquivos.

## CI e limites

O job Chromium do [workflow](../.github/workflows/ci.yml) usa Node.js 24. A matriz de integração/unitários/build usa Node.js 22 e 24. A execução remota desta entrega ainda deve ser conferida no PR final; o resultado de 18 casos acima é local.

A suíte não mede cobertura completa, não testa Firefox/WebKit, leitor de tela real, dispositivos físicos, proteção Vercel ou conexão Turso remota. As capturas e medições visuais adicionais de 20/10/2026 são uma rodada local separada, descrita em [TESTES.md](../TESTES.md), e não aumentam a contagem dos E2E versionados.
