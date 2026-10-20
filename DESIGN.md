# Meu Ponto — Design system Apple Light

Direção aprovada em 20/10/2026. Este documento define a identidade visual do Meu Ponto, uma aplicação web individual de controle de jornada. Os tokens estão em `src/styles/tokens.css`; os componentes atuais os consomem em `src/style.css`.

## Princípios e escopo

Priorizar leitura dos horários, identificação da próxima ação, feedback verdadeiro e consistência. A inspiração Apple está na paleta clara, na hierarquia, no espaço e na discrição dos componentes. A composição das 14 interfaces aprovadas permanece como referência para as próximas entregas.

O PR 1 aplica esses fundamentos à interface existente: não cria landing, views, sidebar, navegação ou modais. Mantém IDs, handlers, estados, autenticação, API, persistência e cálculos. A interface continua sendo uma página com ponto, resumo, histórico e configurações. Os modais existentes recebem somente estilos.

Não importar páginas de marketing, navegação da Apple Store, fotografias, fontes proprietárias, scripts demonstrativos ou Tailwind CDN. Conteúdo e estados dependem das funcionalidades reais do aplicativo.

## Cores

| Token | Valor | Papel |
| --- | --- | --- |
| `--color-canvas` | `#F5F5F7` | Fundo global |
| `--color-surface` | `#FFFFFF` | Cartões, campos e diálogos |
| `--color-surface-subtle` | `#FAFAFC` | Cabeçalhos de tabela e agrupamentos discretos |
| `--color-text` | `#1D1D1F` | Texto principal |
| `--color-muted` | `#515159` | Texto secundário, ajuda e placeholders |
| `--color-border` | `#E5E5EA` | Divisórias e bordas decorativas |
| `--color-control-border` | `#86868B` | Contorno dos controles |
| `--color-primary` | `#0066CC` | Ação principal, links e interação |
| `--color-primary-hover` | `#005BB5` | Hover de ação principal |
| `--color-primary-pressed` | `#004F9E` | Ação principal pressionada |
| `--color-primary-soft` | `#EAF3FF` | Seleção, controles de extras e realces |
| `--color-primary-soft-hover` | `#DCEBFF` | Hover de ações secundárias e seleção de texto |
| `--color-focus` | `#0071E3` | Indicador de foco |
| `--color-success` | `#17764F` | Resultado positivo, como saldo positivo |
| `--color-danger` | `#BD333C` | Erro, exclusão e saldo negativo |

Verde tem somente papel semântico. Backup, navegação e ações comuns usam azul ou superfícies neutras. Saldo zero e saldo pendente não recebem aparência de sucesso definitivo.

As variantes destrutivas usam vermelho em texto e contorno, sobre `--color-danger-soft`; seus estados são `--color-danger-soft-hover` e `--color-danger-soft-pressed`. Controles desabilitados usam superfície neutra, texto legível e cursor apropriado, sem reduzir a opacidade do componente inteiro. Avisos temporários usam texto branco sobre `--color-notice-surface`.

### Contraste

Combinações calculadas para cores opacas:

| Combinação | Contraste |
| --- | --- |
| Branco / azul principal | 5,57:1 |
| Azul principal / canvas | 5,11:1 |
| Texto principal / canvas | 15,46:1 |
| Texto secundário / canvas | 7,22:1 |
| Contorno de controle / branco | 3,62:1 |
| Contorno de controle / canvas | 3,33:1 |
| Foco / branco | 4,70:1 |
| Foco / canvas | 4,31:1 |
| Vermelho / branco | 5,67:1 |
| Verde / branco | 5,61:1 |

Texto comum deve alcançar 4,5:1; indicadores e contornos necessários à identificação do controle, 3:1. A divisória `#E5E5EA` tem 1,26:1 sobre branco e não deve ser usada como único indicador do limite de um campo. Verificar novamente cada combinação ao criar uma variante ou superfície.

## Tipografia

Uma fonte principal: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. Não há download de fontes nem redistribuição de SF Pro. Horários, durações e células numéricas usam `font-variant-numeric: tabular-nums` na mesma família.

| Papel | Token | Tamanho |
| --- | --- | --- |
| Corpo e campos | `--font-size-body` | 16px |
| Rótulos e botões | `--font-size-label` | 14px |
| Metadados e ações compactas | `--font-size-caption` | 13px |
| Seções e diálogos | `--font-size-section` | 20px |
| Título mobile | `--font-size-title-mobile` | 26px |
| Título desktop | `--font-size-title` | 32px |
| Horários destacados | `--font-size-time` | 24px |
| Relógio | `--font-size-clock` | Até 40px |

Tamanhos em `rem`, relativos à preferência de fonte do navegador. Pesos 400 e 600. Entrelinha 1,5 no corpo; 1,25 em controles e dados; 1,2 em títulos. Tracking de -0,025em somente em títulos e valores destacados. Não usar letras pequenas ou fontes decorativas para sugerir precisão inexistente.

## Geometria e espaçamento

- Escala `--space-1/2/3/4/6/8/12/16`: 4/8/12/16/24/32/48/64px.
- Raios `--radius-sm/md/lg/xl`: 8/12/16/20px. `--radius-pill` fica reservado a indicadores em futuras composições.
- Controles: mínimo de 44px de altura e botões com mínimo de 44px de largura, para mouse, teclado e toque. Não reduzir as ações da tabela abaixo desse limite.
- Cards: padding de 24px no desktop e 16px no mobile. Diálogos: 24px, com 16px nas laterais em telas pequenas.
- Conteúdo: até 1120px; gutters de 24px no desktop e 16px no mobile.
- Formulário de acesso: até 416px; diálogos existentes: até 544px; lista interna de extras: até 256px de altura, com rolagem própria.

As larguras dos componentes têm tokens `--size-*`. As proporções de colunas, as frações do grid e os breakpoints existentes são medidas de composição, não novos tokens de espaçamento. Os breakpoints 980/800/720/560/360px permanecem para preservar o comportamento atual. Não reorganizar as telas neste PR.

## Componentes e estados

**Botões.** `.btn`, `.btn-ponto` e `.extras-count` compartilham geometria, tipografia e estados. `.btn-azul` e `.btn-ponto` usam a ação azul; `.btn-secundario` usa superfície branca, texto azul e borda de controle; `.btn-vermelho` identifica destruição. As propriedades locais `--button-*` selecionam a variante e sempre derivam dos tokens semânticos.

**Campos.** Fundo branco, texto principal, borda de controle e fonte de 16px. Placeholder legível, caret azul e foco externo visível. Preservar labels e atributos existentes; o estilo não substitui validação real.

**Cards e tabela.** Superfícies brancas com borda decorativa e raio de 16px, sem sombra. Na apresentação tabular, largura mínima de 896px (`--size-table-min`) para acomodar as nove colunas, datas e ações de 44px. A rolagem horizontal fica contida no contêiner de tabela já existente; não deve atingir a página inteira. Manter a transformação existente de tabela em cartões até 720px, sem essa largura mínima. Cores de saldo acompanham os resultados calculados pelo aplicativo.

**Diálogos e avisos existentes.** Overlay neutro; superfície branca; sombra discreta somente para sobreposição. Respeitar a altura disponível e permitir rolagem. O PR 1 não modifica abertura, fechamento, Escape, contenção ou retorno de foco. As lacunas de gerenciamento de foco identificadas no diagnóstico continuam pendentes para uma entrega funcional específica.

**Foco.** Contorno de 3px em `--color-focus`, afastado 3px, usando `:focus-visible`. Não substituir o contorno por mudança sutil de fundo nem removê-lo para polimento visual.

**Hover e pressionado.** Transições de cor e borda em 160ms; não deslocar o controle. Com `prefers-reduced-motion: reduce`, a transição é imediata e a rolagem suave é desativada.

**Vazio, carregando, desabilitado e erro.** Preservar os textos e estados atuais. Desabilitado é visualmente distinto e legível. Erros usam a cor semântica, mantendo o conteúdo textual. Sucesso continua dependendo da resposta da API; CSS não cria feedback nem muda regras.

## Verificação e manutenção

Validar o build e as suítes unitária, cloud, SQLite e E2E em Node 24. A CI também verifica Node 22. Usar somente bancos temporários e dados fictícios nas capturas.

Conferir larguras 320/390/768/1024/1440px e alturas 600/667/900px: foco, contraste, alvos de toque, quebra de texto, rolagem dos diálogos e ausência de overflow lateral involuntário. Comparar antes/depois com os mesmos estados e dados. Viewports emulados não substituem ensaio em dispositivo físico.

Novos componentes devem consumir os tokens existentes. Acrescentar um token apenas quando representar um papel reutilizável; não transformar cada ajuste isolado em um novo tom ou dimensão. A restauração sem justificativa digitada permanece fora deste PR e depende de alteração conjunta dos dois adaptadores e testes, com auditoria automática preservada.
