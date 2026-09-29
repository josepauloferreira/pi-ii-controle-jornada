# Guia de contribuição para o grupo

Este guia foi escrito para quem nunca trabalhou com Git ou GitHub.

Você não precisa entender Git profundamente para contribuir com o projeto. O fluxo do grupo será sempre o mesmo:

```text
atualizar o projeto
      ↓
criar uma branch
      ↓
fazer sua alteração
      ↓
criar um commit
      ↓
enviar a branch
      ↓
abrir um Pull Request
      ↓
integrar na main
```

A branch `main` representa a versão estável do projeto. Ela está protegida e não deve ser usada diretamente para desenvolver funcionalidades.

---

## 1. Antes da primeira contribuição

### 1.1 Crie uma conta no GitHub

Acesse o GitHub e crie uma conta, caso ainda não tenha.

Depois, envie seu **nome de usuário do GitHub** para o responsável pelo repositório.

### 1.2 Aceite o convite

Você receberá um convite para colaborar no repositório.

Aceite o convite antes de tentar enviar alterações.

### 1.3 Instale o GitHub Desktop

Para quem está começando, recomendamos usar o **GitHub Desktop**.

Ele permite fazer as operações principais do Git usando uma interface gráfica.

Depois de instalar:

1. abra o GitHub Desktop;
2. entre com sua conta do GitHub;
3. autorize o aplicativo, caso solicitado.

---

## 2. Clonar o projeto

Você só precisa fazer esta etapa uma vez em cada computador.

No GitHub Desktop:

1. clique em **File → Clone repository**;
2. abra a aba **GitHub.com**;
3. selecione o repositório `pi-ii-controle-jornada`;
4. escolha onde deseja salvar o projeto no computador;
5. clique em **Clone**.

Agora existe uma cópia local do projeto no seu computador.

---

## 3. Antes de começar qualquer tarefa

Sempre comece pela branch `main`.

No GitHub Desktop:

1. em **Current branch**, selecione `main`;
2. clique em **Fetch origin**;
3. se aparecer **Pull origin**, clique nele.

Isso atualiza sua cópia com as alterações feitas pelo restante do grupo.

---

## 4. Criar uma branch para sua tarefa

Nunca desenvolva diretamente na `main`.

No GitHub Desktop:

1. clique em **Current branch**;
2. clique em **New branch**;
3. dê um nome relacionado à sua tarefa;
4. crie a branch a partir da `main`.

Exemplos:

```text
feature/historico-jornadas
feature/registro-ponto
fix/calculo-horas
docs/atualiza-readme
```

Use:

- `feature/` para uma nova funcionalidade;
- `fix/` para uma correção;
- `docs/` para documentação;
- `chore/` para configuração ou manutenção.

---

## 5. Fazer sua alteração

Com sua branch selecionada, abra o projeto no editor utilizado pelo grupo e faça sua tarefa normalmente.

O GitHub Desktop mostrará automaticamente os arquivos modificados.

Antes de continuar:

- confira se alterou apenas o necessário;
- execute o sistema e teste sua alteração, quando aplicável;
- nunca coloque senhas, tokens ou arquivos `.env` no repositório;
- não adicione documentos contendo RAs, e-mails pessoais ou assinaturas.

---

## 6. Criar um commit

Um **commit** é um registro de uma alteração no projeto.

No GitHub Desktop:

1. confira os arquivos modificados;
2. no campo **Summary**, escreva uma descrição curta;
3. clique em **Commit to [nome-da-branch]**.

Exemplos de mensagens:

```text
feat: adiciona histórico de jornadas
fix: corrige cálculo de horas trabalhadas
docs: atualiza instruções de execução
```

Você pode fazer mais de um commit na mesma branch.

Prefira commits pequenos e relacionados à tarefa realizada.

---

## 7. Enviar sua branch para o GitHub

Depois do commit:

1. clique em **Publish branch** na primeira vez;
2. nas próximas alterações da mesma branch, use **Push origin**.

Isso envia seus commits para o GitHub.

A alteração ainda **não entrou na `main`**.

---

## 8. Abrir um Pull Request

Um **Pull Request (PR)** é um pedido para integrar sua branch à `main`.

Depois de publicar a branch:

1. clique em **Create Pull Request** no GitHub Desktop;
2. o navegador abrirá o GitHub;
3. confirme:
   - **base:** `main`
   - **compare:** sua branch;
4. escreva um título curto;
5. explique o que foi alterado;
6. explique como testar, quando aplicável;
7. clique em **Create pull request**.

Exemplo de título:

```text
feat: adiciona histórico de jornadas
```

A `main` está protegida, portanto as alterações devem entrar por Pull Request.

---

## 9. Depois que o Pull Request for integrado

Não continue reutilizando a branch antiga para outra tarefa.

Para começar uma nova atividade:

1. volte para `main`;
2. faça **Fetch origin** e **Pull origin**, se aparecer;
3. crie uma nova branch;
4. repita o fluxo.

---

## Resumo do fluxo

Para toda nova tarefa:

```text
main atualizada
      ↓
nova branch
      ↓
alteração
      ↓
commit
      ↓
push
      ↓
Pull Request
      ↓
merge na main
```

---

## Se ocorrer um conflito

Não tente apagar arquivos ou sobrescrever alterações para "fazer funcionar".

Pare e peça ajuda no grupo.

Conflitos são normais quando duas pessoas alteram a mesma parte de um arquivo.

---

## Glossário rápido

**Repositório**  
O projeto armazenado no GitHub.

**Clone**  
Uma cópia do repositório no seu computador.

**Branch**  
Uma linha de trabalho separada da versão principal.

**main**  
Branch que representa a versão estável do projeto.

**Commit**  
Registro de uma alteração feita no projeto.

**Push**  
Envio dos commits do seu computador para o GitHub.

**Pull**  
Atualização da sua cópia local com alterações do GitHub.

**Pull Request**  
Pedido para integrar as alterações de uma branch à `main`.

**Merge**  
Integração das alterações aprovadas na `main`.

---

## Regra principal

> Para cada tarefa: atualize a `main`, crie uma nova branch, faça seus commits, envie a branch e abra um Pull Request.
