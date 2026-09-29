# Contribuindo

Este repositório é colaborativo. O objetivo do fluxo abaixo é evitar conflitos, preservar o histórico de cada integrante e manter a branch `main` estável.

## Fluxo de trabalho

1. Atualize sua cópia local:

```bash
git switch main
git pull
```

2. Crie uma branch para a sua alteração:

```bash
git switch -c feature/nome-da-funcionalidade
```

Outros prefixos permitidos:

- `fix/` — correção de bug
- `docs/` — documentação
- `chore/` — configuração ou manutenção

3. Faça commits pequenos e descritivos:

```bash
git add .
git commit -m "feat: adiciona registro de entrada"
```

4. Envie a branch:

```bash
git push -u origin feature/nome-da-funcionalidade
```

5. Abra um Pull Request para `main`.

## Regras do grupo

- Evite trabalhar diretamente na `main`.
- Antes de começar uma tarefa, execute `git pull` na `main`.
- Cada integrante deve realizar os próprios commits.
- Não envie código de outra pessoa usando sua autoria.
- Não faça commits gigantes quando a alteração puder ser separada.
- Não versione senhas, tokens, arquivos `.env`, RAs, e-mails pessoais ou documentos com assinaturas.
- Antes de abrir o Pull Request, teste a alteração localmente.

## Convenção de commits

Use mensagens curtas seguindo este padrão:

```text
tipo: descrição
```

Tipos mais comuns:

- `feat`: nova funcionalidade
- `fix`: correção
- `docs`: documentação
- `refactor`: alteração interna sem mudar comportamento
- `test`: testes
- `chore`: configuração/manutenção

Exemplos:

```text
feat: adiciona histórico de jornadas
fix: corrige cálculo de horas trabalhadas
docs: atualiza instruções de execução
```
