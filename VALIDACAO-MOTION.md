# Meu Ponto — validação Apple Light Motion v3

Refinamento de 21/10/2026 sobre `main` em `53dae8d` (PR #34). O pacote Motion v3 foi lido integralmente, assim como o `DESIGN.md`, e a sequência de navegação de `REFERENCIA_NAVEGACAO.webm` foi examinada por frames. O pacote estava diretamente em `.design-references/`, sem a subpasta `motion/`. `DEMO.html` não foi incorporado ao produto.

## Resultado e decisões

- Entrada CSS de **180 ms**, com opacidade de **90% a 100%**, apenas entre duas rotas autenticadas distintas. Sem deslocamento, DOM duplicado, snapshots, timers de coreografia ou nova dependência. Sidebar e barra inferior mantêm geometria e seleção acessível.
- View Transitions foi avaliada pela documentação da plataforma e pelo roteamento atual: capturar snapshots e gerenciar trocas concorrentes acrescentaria complexidade sem benefício demonstrado. A entrada CSS atende à orientação visual e funciona sem essa API. Sem suporte à animação, a troca permanece instantânea; `prefers-reduced-motion` também a desativa, inclusive ao mudar a preferência durante o efeito.
- Renders de dados, relógio, filtros, salvar, mesma rota, acesso e expiração não ativam a entrada. Back/Forward, links diretos recarregados, navegação rápida e teclado são exercitados. Foco em título usa `preventScroll`; renders de dados preservam o controle identificado que já tinha foco.
- Hover/pressionamento usam cor, sem mover botões. Borda de campo e estados de controles usam **120 ms**; o outline permanece imediato. Seleção atual é identificada por texto, fundo e `aria-current`.
- Usuário com `Ex.: joao.silva`; rótulos permanentes; ajuda específica de confirmação; mínimo de 12 caracteres só para novas senhas. Mostrar/ocultar atualiza ícone, nome e estado acessível, preservando valor e seleção. Autocomplete de usuário/senha atual/nova senha foi mantido; a troca inclui identificação de usuário para gerenciadores.
- Erros locais e erros de senha identificáveis do servidor ficam associados ao campo, com foco adequado. Erros gerais de credencial/rede permanecem na região do formulário, sem atribuir incorreção arbitrária a um campo.
- Novas senhas têm aviso não bloqueador via `TextEncoder` acima de 256 bytes UTF-8. Não há truncamento por `maxlength`; a API continua validando o limite. Login não ganhou mínimo de 12 caracteres.
- Busy e textos de operação dependem da requisição real. Envios repetidos de acesso/configuração/senha são bloqueados durante a espera. Sucesso depende da resposta.
- Diálogos e drawers permanecem instantâneos. A revisão não demonstrou um problema que justificasse animá-los. `showModal`, Escape, foco contido/retorno, pilha e corpo rolável foram preservados.

A opacidade inicial foi limitada a 90% após cálculo da composição sobre o canvas aprovado: branco/azul do botão fica em aproximadamente **4,66:1**, e texto secundário/superfície em **6,05:1** nesse ponto. As cores do sistema não mudaram. Tempos e opacidade são decisões do produto, não valores oficiais da Apple.

## Verificações locais

| Verificação | Resultado |
| --- | --- |
| `npm run build` | aprovado |
| `npm run test:unit` | aprovado; 15 casos também confirmados sem isolamento de subprocessos |
| `npm run test:cloud` | 50 aprovados, libSQL em arquivos locais |
| `npm --prefix backend test` | 25 aprovados, SQLite temporário |
| `npm run test:e2e` | 30 aprovados, Chromium |
| `git diff --check` | aprovado |
| Detector Impeccable nos arquivos de UI alterados | `[]`, nenhuma ocorrência |
| Revisão adicional Chromium/Firefox com API local | aprovada nos dois navegadores |

Os 30 E2E incluem 18 fluxos funcionais anteriores, 10 novos cenários de movimento/formulários e 2 gravações com API real. Os 10 novos cenários usam respostas interceptadas e isoladas; os demais pertencem à suíte que integra Express e SQLite descartável, com interceptações pontuais de falha e virada de dia já documentadas. Cadastro de 11/12 caracteres, confirmação divergente, senha multibyte de 256/258 bytes, login com senha curta simulando legado, caret, Enter, busy real, foco, movimento reduzido dinâmico, relógio, salvar e expiração estão cobertos.

A revisão visual adicional produziu **60 PNGs** (login, quatro seções e erro de senha, em cinco larguras, nos dois navegadores), **120 observações de layout** (quatro seções × cinco larguras × três alturas × dois navegadores) e duas gravações curtas. Larguras: 320/390/768/1024/1440px; alturas: 600/667/900px, mais 390×844 no E2E. Não houve overflow de página, alvo visível menor que 44px nas amostras ou erro JavaScript inesperado. Os footers dos diálogos também foram conferidos em 600px. A inspeção visual preservou composição, hierarquia, superfícies e tipografia.

A revisão crítica usou a skill local Impeccable 4.7.0, o detector e inspeção das capturas/interações. Os refinamentos finais restringiram o fade para preservar contraste e mantiveram diálogos instantâneos. Não há pontuação ou alegação de conformidade completa baseada apenas no detector. A verificação de fluxo seguiu também a skill `vercel:verification`: navegador → API local → SQLite temporário → resposta → feedback.

## Evidências e reprodução

`npm run test:e2e` gera vídeos desktop/mobile e capturas das quatro seções em `e2e/test-results/`. A CI preserva esses arquivos, traces de falha e o relatório Playwright no artefato **`meu-ponto-e2e-evidencias`**, por 14 dias, sem versionar mídia ou referências. O job da CI usa Node.js 24; integração e build também rodam na matriz 22/24.

A rodada visual adicional e os vídeos curtos ficam localmente em `.design-references/motion-evidence/` na cópia de trabalho original, fora do Git. Os JSONs identificam viewport, rota, overflow, alvos, foco e erros observados. Uma cópia temporária fica em `/tmp/meu-ponto-motion-evidence/`.

## Limites da evidência

- Ambiente local: Node.js **26.11.1**, Playwright **1.64.1**. A matriz suportada 22/24 é verificada pela CI do PR; os resultados locais não a substituem.
- Chromium e Firefox foram exercitados; **WebKit não iniciou por bibliotecas de sistema ausentes**. Não houve instalação de pacotes do sistema.
- O ensaio de reflow equivalente a zoom 200% usa metade da largura CSS, até o mínimo de 320px. Não é um ensaio do controle de zoom da interface do navegador, nem de viewport CSS de 160px.
- Autocomplete, campos e preservação foram verificados; **autofill de credencial salva, gerenciador externo, VoiceOver/NVDA e dispositivos físicos não foram exercitados**.
- Não houve acesso a Turso remoto, dados reais, alteração de backend/API/CSRF/sessões/regras de jornada, merge ou deploy manual.

Referências técnicas: [MDN — startViewTransition](https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition), [MDN — prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion), [Apple — Motion](https://developer.apple.com/design/human-interface-guidelines/motion). Os critérios locais detalhados estão no pacote Motion v3 fornecido pelo usuário.
