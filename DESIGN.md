---
name: Meu Ponto — Apple Light
description: Interface clara para acompanhar uma jornada individual.
colors:
  primary: "#0066CC"
  primary-hover: "#005BB5"
  primary-pressed: "#004F9E"
  primary-soft: "#EAF3FF"
  primary-soft-hover: "#DCEBFF"
  focus: "#0071E3"
  canvas: "#F5F5F7"
  surface: "#FFFFFF"
  surface-subtle: "#FAFAFC"
  text: "#1D1D1F"
  muted: "#515159"
  border: "#E5E5EA"
  control-border: "#86868B"
  success: "#17764F"
  success-soft: "#EAF5EE"
  danger: "#BD333C"
  danger-hover: "#A32630"
  danger-soft: "#FFF1F2"
typography:
  display:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "4.5rem"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  headline:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  body:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25
rounded:
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.25rem"
  pill: "9999px"
spacing:
  "1": "0.25rem"
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "6": "1.5rem"
  "8": "2rem"
  "12": "3rem"
  "16": "4rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "1.5rem"
---

# Meu Ponto — Design system Apple Light

## Overview

**Creative North Star: "Apple Light"**

Identidade aprovada e documentação atualizada em 20/10/2026. Priorizar a leitura dos horários, a próxima ação e o feedback confirmado pela API. O azul concentra a interação; superfícies claras, espaço e hierarquia organizam o restante. A família system-ui é uma escolha explícita do usuário, preservada nesta extensão do sistema.

O sistema agora atende à landing, ao acesso, às quatro views autenticadas e aos diálogos das 14 interfaces de referência aprovadas. O escopo restrito do primeiro PR de tokens é histórico. O código atual em [src/styles/tokens.css](src/styles/tokens.css), [src/style.css](src/style.css), [src/views/](src/views/) e [src/ui/](src/ui/) fundamenta estas regras.

**Key Characteristics:**

- Horários e durações com números tabulares; títulos e ações de leitura direta.
- Cards planos, azul de interação e cores de resultado com significado textual.
- Navegação persistente; ações de diálogos visíveis enquanto o conteúdo rola.

## Colors

### Primary

Azul principal em ações, links, seleção e etapas registradas. Seus estados de hover e pressionado escurecem o fundo; as superfícies suaves identificam seleção sem competir com a ação principal. O foco usa um azul próprio.

### Neutral

Canvas no fundo global, superfície branca em cards, campos e diálogos, superfície sutil em agrupamentos e cabeçalhos. Texto principal e secundário mantêm hierarquia. A borda decorativa separa regiões; o contorno de controle identifica campos e ações secundárias.

### Semântica e contraste

Verde indica resultado positivo ou jornada concluída. Vermelho indica erro, exclusão ou saldo negativo. Saldo zero e expediente pendente mantêm apresentação neutra. Desabilitados usam superfície de borda, texto secundário e contorno de controle, sem reduzir a opacidade do componente inteiro.

As combinações opacas mantidas do sistema aprovado alcançam: branco/azul principal (5,57:1), texto principal/canvas (15,46:1), texto secundário/canvas (7,22:1), contorno de controle/branco (3,62:1), foco/branco (4,70:1), vermelho/branco (5,67:1) e verde/branco (5,61:1). A borda decorativa sobre branco (1,26:1) não identifica sozinha um campo. Verificar novas combinações: texto comum exige 4,5:1; indicadores necessários ao controle, 3:1.

**The Semantic Color Rule.** Usar verde para resultados, azul para interação e texto para explicar todo estado.

## Typography

Uma família para toda a interface, definida no frontmatter e em `--font-family-ui`. Sem download de fontes nem redistribuição de SF Pro. Pesos regulares e semibold; horários, durações e células numéricas usam `tabular-nums`.

Display serve ao hero da landing e reduz para 2,75rem em telas até 620px. Headline serve aos títulos de view, reduzindo para 1,625rem nessa largura; o acesso também usa essa escala compacta. Title identifica seções e diálogos. Body serve a texto e campos, label a rótulos e botões; metadados usam 0,8125rem. Horários destacados usam 1,5rem e métricas chegam a 2,5rem, com redução responsiva. O relógio local usa a escala de horários e é identificado como local.

Tracking negativo fica em títulos e valores destacados. Descrições de página têm largura máxima de 70ch; o texto de apresentação da landing, 55ch. Não reduzir fonte de campos para acomodar conteúdo.

## Layout

Sidebar fixa de 16rem no desktop, com quatro destinos, e conteúdo com largura máxima de 80rem e padding de 2rem. Configurações limitam a leitura a 56rem; a landing usa contêiner de 70rem; o acesso organiza duas colunas até o limite de 65rem.

Breakpoints observados: 1200px reduz métricas e divide a timeline em duas colunas; 900px troca a sidebar pela navegação inferior de quatro itens; 620px empilha métricas, configurações e acesso, transforma a tabela em cartões e reduz gutters a 1rem. Até 360px, métricas do drawer ficam em linhas separadas para preservar palavras inteiras. As medidas de composição não criam novos tokens de espaçamento.

Cards usam padding da escala 6, reduzido para 4 no mobile. A navegação inferior e os avisos respeitam `safe-area-inset-bottom`; o conteúdo reserva espaço para a barra. Tabela desktop contém eventual rolagem horizontal no seu contêiner; a página não deve rolar lateralmente.

Diálogo central tem até 34rem; drawer lateral, até 36rem e altura total do viewport. No mobile, o drawer ocupa a largura disponível. Cabeçalho e ações permanecem na composição enquanto apenas o corpo rola; alturas usam `dvh`.

## Elevation & Depth

Cards e navegação usam bordas e diferenças tonais, sem sombra. Profundidade é reservada à sobreposição: diálogo (`0 12px 40px rgb(29 29 31 / 14%)`) e aviso (`0 4px 16px rgb(29 29 31 / 16%)`). O backdrop usa `rgb(29 29 31 / 40%)`. Camadas mantêm navegação abaixo dos diálogos e avisos, com skip link acessível.

## Shapes

Curvas discretas na escala do frontmatter: botões e campos usam md; cards, lg; diálogos centrais e acesso, xl. Indicadores de estado, avatares e pontos usam pill. Drawers têm laterais retas e borda de separação. Controles interativos têm alvo mínimo de 44px; checkboxes e radios fazem parte de rótulos clicáveis maiores.

## Components

### Buttons

Ação principal azul com texto branco; secundária branca com texto azul e contorno de controle; ação textual com fundo e borda transparentes. Exclusão dentro da confirmação usa vermelho sólido; ações de abrir exclusão usam texto e contorno vermelhos. Ícones têm alvo de 44px e nome acessível. Hover e pressionado mudam a cor sem deslocar o controle; as transições de cor e borda duram 120ms e é imediata com `prefers-reduced-motion`.

### Inputs / Fields

Fundo branco, texto principal e fonte de corpo, borda de controle, caret azul, placeholder legível e label associado. Foco visível externo de 3px, afastado 3px. Erros mantêm texto, alerta e possibilidade de nova tentativa. Rótulos permanecem acima dos campos, com exemplo de usuário válido. Botões de exibir senha têm nome e estado acessíveis e preservam valor/seleção. Criação e troca explicam o mínimo de 12 caracteres; login não impõe esse mínimo. Novas senhas recebem aviso não bloqueador acima de 256 bytes UTF-8; o servidor valida o limite. Erros locais são associados ao campo por `aria-describedby` e `aria-invalid`, com foco no primeiro erro. Horários aceitam normalização de quatro dígitos para `HH:mm` e validação real.

### Cards / Containers

Cards agrupam status, métricas, marcações, histórico e configurações. Métricas compartilham hierarquia de rótulo, valor e explicação; no mobile alinham rótulo e valor na mesma linha. Estados vazios explicam a ausência de registros. Carregamento mostra texto e blocos neutros; falha mostra mensagem e ação de tentar novamente.

### Navigation

Sidebar desktop e barra inferior mobile expõem os mesmos quatro destinos. A página atual usa fundo azul suave, texto azul e `aria-current="page"`. A troca de view atualiza título do documento e foco no título da tela. Skip link permite chegar ao conteúdo. Apenas mudanças entre as quatro rotas autenticadas ativam uma entrada CSS de opacidade de 90% a 100% em 180ms; o shell permanece estável. Renders de dados, relógio, filtros, autenticação e a mesma rota não ativam essa entrada. Movimento reduzido mantém a troca instantânea, sem animação. Não há snapshots de página nem dependência da View Transitions API.

### Diálogos, detalhes e auditoria

Usar o elemento nativo `dialog` com `showModal()`: o fundo fica inerte, Tab e Shift+Tab ficam no diálogo ativo, Escape fecha quando a operação permite e o foco retorna ao acionador ou ao título disponível. Diálogos empilhados retornam ao pai. Durante uma escrita, controles ficam bloqueados para impedir repetição. Detalhes e auditoria usam drawer; correção, extras, exclusão, senha e restauração usam diálogo central.

Correções e exclusões apresentam justificativa de 10–500 caracteres. Restauração apresenta arquivo, quantidade, aviso e confirmação explícita, sem justificativa digitada; a auditoria automática dos dois backends sustenta o feedback. A auditoria permanece consultável por data após excluir uma jornada. Avisos de sucesso só aparecem após resposta da API.

## Do's and Don'ts

### Do

- **Do** consumir tokens existentes e preservar a paleta, a família de fonte e a hierarquia aprovadas.
- **Do** manter alvos de 44px, foco visível, rótulos completos e ações dos diálogos acessíveis nas alturas menores.
- **Do** conferir 320/390/768/1024/1440px e alturas 600/667/900px com os mesmos estados e dados fictícios; executar as verificações de [TESTES.md](TESTES.md).
- **Do** representar carregamento, erro, vazio e saldo pendente a partir do estado real; identificar dados ilustrativos na landing.

### Don't

- **Don't** usar verde como variante genérica de ação ou comunicar estado apenas por cor.
- **Don't** remover foco ou trocar o contorno de campo pela borda decorativa de baixo contraste.
- **Don't** importar fontes proprietárias, navegação comercial ou scripts demonstrativos das referências; a implementação usa SVGs e componentes próprios.
- **Don't** acrescentar equipe, planos ou alegações legais ao produto individual, nem tratar viewports emulados como ensaio em dispositivo físico.
