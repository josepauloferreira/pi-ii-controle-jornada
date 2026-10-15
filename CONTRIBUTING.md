# Como contribuir

Este projeto é desenvolvido por integrantes do Projeto Integrador em Computação II (UNIVESP). Nosso objetivo é integrar pequenas entregas verificáveis, mantendo o sistema sempre testável.

## Antes de começar

1. Leia o [README](./README.md) e abra a [lista de issues](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues).
2. Escolha uma issue cujo pré-requisito esteja concluído ou combine com o responsável a interface entre as tarefas.
3. Comente na issue o que pretende entregar e solicite atribuição, evitando trabalho duplicado.
4. Não inicie refatorações extensas ou introduza novas bibliotecas sem combinar com o grupo.

## Fluxo de branches

Use a `main` como base. Nunca desenvolva diretamente nela.

```bash
git switch main
git pull --ff-only
git switch -c feat/issue-5-registro-api
# faça alterações e testes
git add .
git commit -m "feat: integrar registro de ponto com a api"
git push -u origin feat/issue-5-registro-api
```

Abra uma pull request para `main` e cite a issue relacionada, por exemplo `Closes #5`. Para correções, use `fix/issue-N-descricao`; para documentação, `docs/issue-N-descricao`. Se precisar dividir uma tarefa grande, discuta na issue antes.

## Tamanho de uma entrega

- Uma issue e uma responsabilidade por PR, sempre que possível.
- Preserve o comportamento do frontend atual salvo mudanças explicitamente solicitadas.
- Antes de alterar o formato JSON ou qualquer rota de API, alinhe o contrato com as issues dependentes.
- Não renomeie todo o projeto ou reformate arquivos não relacionados ao objetivo da PR.
- Dependências que ainda não estão implementadas devem ser descritas como futuras, não como funcionalidades prontas.

## O que enviar na PR

Inclua: link da issue, resumo das mudanças, instruções precisas para testar, resultado real dos testes, captura quando houver alteração visual, riscos (por exemplo migração de registros) e pendências. Um outro integrante deve conseguir verificar sem depender de conversas privadas.

**Critérios gerais:** sem erro relevante no console; testes/build existentes executados; histórico, registros e backups preservados quando afetados; dados pessoais não incluídos. Se algo não foi testado, declare explicitamente.

## Acordos técnicos

- Frontend: Vite + HTML/CSS + JavaScript puro, sem React.
- Backend: Node.js + Express, separado em `backend/`.
- Banco: SQLite no servidor, nunca exposto diretamente ao frontend.
- Não adicionar microserviços, ORM, autenticação improvisada ou infraestrutura complexa sem necessidade validada.
- Sanitizar entradas no backend e usar consultas parametrizadas.
- Separar lógica testável de interações com DOM e banco.
- Preferir interfaces simples e acessíveis a funcionalidades extras.

**Privacidade e dados:** nunca incluir `.env`, `node_modules`, arquivos `.sqlite`/`.db`, conversas privadas, dados de jornada reais, nomes/identificadores de terceiros ou backups particulares em commits, prints e fixtures. Use dados fictícios.

**Restrições de uso:** o projeto é acadêmico. Não anunciar conformidade com a Portaria 671/2021 ou uso como folha oficial de ponto sem validação técnica/jurídica específica.

## Revisão e integração

Uma pessoa diferente de quem escreveu a PR revisa a entrega, verifica os critérios da issue e solicita correções quando necessário. Resolva conflitos antes de integrar. Após o merge, feche a issue correspondente (automaticamente com `Closes #N` quando aplicável). Registre decisões importantes na própria issue/PR para que integrantes ausentes possam acompanhar.
