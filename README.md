# Sistema de Controle de Jornada

Projeto Integrador em Computação II — UNIVESP (2026).

## Sobre o projeto

Estamos criando um sistema web simples para uma pessoa registrar e consultar sua jornada de trabalho em home office.

O sistema permite registrar **entrada, saída para almoço, retorno e saída**, além de consultar o histórico, editar registros e baixar os dados.

## Tecnologias

- **Frontend:** HTML, CSS e JavaScript com Vite.
- **Backend:** Node.js com Express.
- **Banco de dados:** SQLite.

## Como está hoje

Já temos uma primeira versão no arquivo [Projeto-PI-Ponto.html](./Projeto-PI-Ponto.html).

Para ver essa versão: baixe o repositório em **Code → Download ZIP**, extraia os arquivos e abra o HTML no navegador.

**Importante:** essa primeira versão guarda os dados no próprio navegador (`localStorage`). Vite, backend e SQLite **ainda serão implementados**. Se você já usou essa versão, faça um backup JSON antes de trocar de versão.

## Tarefas do grupo

Cada link abre uma tarefa com o que fazer e como saber que terminou.

1. [Organizar o frontend com Vite — #13](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues/13)
2. [Criar backend com Express e SQLite — #14](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues/14)
3. [Conectar o registro de ponto ao backend — #15](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues/15)
4. [Conectar histórico, configurações e exportação — #16](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues/16)

**Ordem:** tarefas 1 e 2 podem ser feitas ao mesmo tempo. Depois fazemos a 3 e, por último, a 4.

## Como ajudar

1. Abra uma **issue** (tarefa) e avise nos comentários que vai ajudar.
2. Combine com o grupo qual parte você fará, para ninguém trabalhar na mesma coisa sem saber.
3. Faça as alterações em uma **branch** (cópia de trabalho), sem alterar diretamente a `main`.
4. Abra um **pull request** (pedido para juntar suas alterações ao projeto) e explique o que fez.
5. Outra pessoa confere se está funcionando antes de juntar à `main`.

**Combinado:** vamos manter o projeto simples e aproveitar o código que já existe. Não colocar no GitHub bancos SQLite com dados reais, arquivos de backup ou informações pessoais.
