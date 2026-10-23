# Ajustes de formatação Apple Light

Revisão aprovada após comparação visual em 23/10/2026, baseada na [Taste Skill](https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/SKILL.md). Foram preservados paleta, fonte system-ui, estrutura das telas e regras de jornada.

## Alterações

- Botão de exibir senha com fundo transparente em todos os estados, alvo de 44px dentro do campo e foco visível interno. Mostrar/ocultar preserva valor e seleção.
- Ações de corrigir e excluir marcações na mesma linha no celular, com nomes acessíveis específicos por etapa; alinhamento pela base dos cards.
- Status do resumo mobile inteiro, valores na linha dos rótulos e descrições usando a largura disponível.
- Cabeçalhos e valores numéricos alinhados à direita na tabela desktop; lista mobile à esquerda.
- Melhor encaixe do relógio local, cabeçalhos dos diálogos e opções de correção.

## Validação local do conjunto final

Executada em Node.js 24.19.0, com dependências dos lockfiles:

- `npm run build`: aprovado.
- `npm run test:unit`: 15 testes aprovados.
- `npm --prefix backend test`: 33 testes aprovados.
- `npm run test:cloud`: 58 testes aprovados, com libSQL em arquivos temporários.
- Suíte completa Playwright: 31 testes aprovados, incluindo login, senha, operações auditadas, downloads, navegação por teclado e movimento reduzido.
- `git diff --check`: aprovado.

O Playwright usou o runner existente, SQLite descartável e uma configuração externa ao repositório para selecionar `/usr/bin/chromium`, sem alterar os cenários versionados. Na CI, a configuração original instala seu próprio Chromium.

Foram comparadas as quatro telas internas em 320, 390, 768, 1024 e 1440px. Não houve erro JavaScript não tratado ou rolagem horizontal nas capturas. O botão de senha foi medido em estado normal, hover e foco nas cinco larguras: 44px, contido com 1px de margem e fundo transparente. O inspetor Taste não encontrou falhas ou avisos nos snapshots das quatro telas internas em 1440, 768 e 390px.

As capturas usam os mesmos dados fictícios nas duas versões. A altura de Minha Jornada passou de 2007 para 1920px a 390px e de 2216 para 2079px a 320px; no desktop de 1440px, permaneceu em 1280px. Esses números descrevem somente o estado comparado, não todas as combinações de registros.

A verificação usa viewports emulados, não aparelhos físicos. Não houve escrita em produção ou mudança no backend. A publicação na Vercel segue o fluxo separado em [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md); o deploy automático da `main` permanece desabilitado.
