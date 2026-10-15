# Sistema de Controle de Jornada

Projeto Integrador em Computação II — UNIVESP (2026).

Aplicação web para registrar e acompanhar a jornada de trabalho em home office.

## Roadmap

- [ ] [1. Organizar o frontend com Vite — #13](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues/13)
- [x] [2. Criar backend com Express e SQLite — #14](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues/14)
- [ ] [3. Conectar o registro de ponto ao backend — #15](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues/15)
- [ ] [4. Conectar histórico, configurações e exportação — #16](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues/16)

As etapas 1 e 2 podem ser desenvolvidas em paralelo. A etapa 3 depende das duas primeiras, e a etapa 4 depende da terceira.

**Já disponível:** API Express com banco SQLite e demonstração integrada em `backend/demo.html` ([PR #17](https://github.com/josepauloferreira/pi-ii-controle-jornada/pull/17)).

**Pendente:** integrar o frontend organizado com Vite e habilitar a restauração de backups JSON na demonstração.


## O que o sistema faz

- Registra entrada, saída para almoço, retorno e saída.
- Mostra horas trabalhadas, jornada prevista e saldo do dia.
- Permite consultar, editar e excluir registros, inclusive batidas extras.
- Salva as configurações da jornada.
- Exporta histórico em CSV e faz backup em JSON.

O saldo só aparece depois que a jornada é concluída. Antes disso, mostra **"Em andamento"**.

## Tecnologias

- **Interface:** HTML, CSS e JavaScript. A organização com Vite ainda é uma tarefa do grupo.
- **Servidor:** Node.js + Express.
- **Banco de dados:** SQLite.

## Como executar no GitHub Codespaces

1. Abra o repositório no Codespaces.
2. No terminal, entre na branch do backend e inicie o servidor:

```bash
git switch main
git pull
cd backend
npm install
npm start
```

3. Abra a aba **Ports (Portas)** do Codespaces e localize a porta **3000**.
4. Deixe a porta como **Private** e clique em **Open in Browser**.

A página aberta é a **demonstração do sistema conectada ao SQLite**. Não é preciso iniciar outro servidor para ver essa demonstração.

Para parar o servidor, pressione `Ctrl+C` no terminal.

**Requisito:** Node.js 22 ou superior.

## Arquivos principais

- `Projeto-PI-Ponto.html`: versão inicial, que salva os dados no navegador.
- `backend/demo.html`: demonstração da interface conectada ao banco de dados.
- `backend/server.js`: servidor Express e endereços da API.
- `backend/database.js`: criação das tabelas SQLite.
- `backend/dados/jornada.db`: banco criado automaticamente quando o servidor inicia.

**Atenção:** o arquivo `jornada.db` fica apenas no ambiente onde o backend está rodando, não é enviado ao GitHub. Se o Codespace for excluído, esses dados também poderão ser perdidos. Guarde cópias dos dados de que precisar.

## Endereços da API

| Método | Endereço | Para quê? |
| --- | --- | --- |
| GET | `/api/health` | Verificar se o servidor está funcionando |
| GET | `/api/registros` | Consultar todos os dias registrados |
| GET | `/api/registros/:data` | Consultar um dia (ex.: 2026-10-15) |
| PUT | `/api/registros/:data` | Criar ou atualizar um dia |
| DELETE | `/api/registros/:data` | Excluir um dia |
| GET | `/api/configuracoes` | Consultar configurações |
| PUT | `/api/configuracoes` | Salvar configurações |

Exemplo: com o servidor iniciado, acesse `http://localhost:3000/api/registros` no próprio Codespaces para visualizar os registros em JSON.

**Observação:** a versão inicial em `Projeto-PI-Ponto.html` e a demonstração integrada não compartilham dados automaticamente. O projeto é acadêmico e ainda não foi validado como sistema oficial de ponto.

## Como contribuir

Veja as tarefas do grupo na aba [Issues](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues). Avise qual tarefa fará e trabalhe em uma branch separada, sem modificar diretamente a `main`. Ao terminar, abra um Pull Request para o grupo revisar.
