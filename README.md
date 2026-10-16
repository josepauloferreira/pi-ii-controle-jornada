# Sistema de Controle de Jornada

Projeto Integrador em Computação II — UNIVESP (2026).

Aplicação web para registrar e acompanhar a jornada de trabalho em home office.

## Roadmap

- [x] [1. Organizar o frontend com Vite — #13](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues/13)
- [x] [2. Criar backend com Express e SQLite — #14](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues/14)
- [x] [3. Conectar o registro de ponto ao backend — #15](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues/15)
- [ ] [4. Conectar histórico, configurações e exportação — #16](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues/16)
- [ ] [5. Refinar a interface visual — #18](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues/18)

As etapas 1 e 2 podem ser desenvolvidas em paralelo. A etapa 3 depende das duas primeiras, e a etapa 4 depende da terceira.

**Já disponível:** API Express com banco SQLite e demonstração integrada em `backend/demo.html` ([PR #17](https://github.com/josepauloferreira/pi-ii-controle-jornada/pull/17)).

**Em andamento:** issue #16 — conectar histórico, configurações, exportação e restauração ao SQLite. Refinamento visual permanece na issue #18.


## O que o sistema faz

- Registra entrada, saída para almoço, retorno e saída.
- Mostra horas trabalhadas, jornada prevista e saldo do dia.
- Permite consultar, editar e excluir registros, inclusive batidas extras.
- Salva as configurações da jornada.
- Exporta histórico em CSV e faz backup em JSON.

O saldo só aparece depois que a jornada é concluída. Antes disso, mostra **"Em andamento"**.

## Tecnologias

- **Interface:** HTML, CSS e JavaScript com Vite, integrados à API Express.
- **Servidor:** Node.js + Express.
- **Banco de dados:** SQLite.

## Como executar o frontend com Vite

No Codespaces, abra um terminal **na raiz do repositório**:

```bash
npm install
npm run dev
```

Abra a porta **5173** na aba **Ports (Portas)**, mantendo a visibilidade como **Private**.

**Para bater ponto, também é necessário iniciar o backend Express na porta 3000** (veja abaixo). O Vite encaminha automaticamente chamadas `/api` para o Express, sem necessidade de publicar a porta 3000.

Os **registros de todos os dias** e as **configurações de jornada** são carregados e salvos no SQLite. O histórico local antigo fica preservado no navegador.

Se houver datas locais ausentes no banco, a interface oferece copiar **apenas os dias que ainda não existem** no SQLite; nunca sobrescreve registros do servidor automaticamente. O botão **Baixar backup dos dados antigos do navegador** permite salvar a cópia local separadamente. Se houver divergências, o banco continua sendo a fonte principal.

**Fazer backup** exporta o estado atual do SQLite para JSON. **Restaurar backup** substitui os registros do SQLite (e as configurações, quando presentes no arquivo), mediante confirmação. A restauração é transacional: backups inválidos são rejeitados sem alterar os dados existentes. **Exportar CSV** utiliza o histórico atual do banco.

Dados armazenados em outras origens do navegador não são compartilhados automaticamente; transfira-os por meio de um arquivo de backup JSON, se necessário.

## Como executar o backend com SQLite

No Codespaces, em outro terminal, partindo da raiz do repositório:

```bash
cd backend
npm install
npm start
```

Na aba **Ports**, mantenha a porta **3000** como **Private**. A interface Vite continua acessível pela porta **5173**.

A porta 3000 também abre a demonstração antiga em `backend/demo.html`, mas use a porta 5173 para testar o frontend Vite integrado.

Para parar o servidor, pressione `Ctrl+C` no terminal.

**Requisito:** Node.js 22.12 ou superior para usar o Vite e o backend.

## Arquivos principais

- `index.html`: página principal do frontend Vite.
- `src/style.css`: estilos da interface.
- `src/main.js`: funcionalidades do frontend.
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

Exemplo: com o servidor iniciado, acesse `http://localhost:3000/api/registros` no Codespaces para visualizar os registros em JSON. A restauração de backup utiliza `PUT /api/backup` com confirmação pela interface.

**Observação:** a versão inicial em `Projeto-PI-Ponto.html` e a demonstração integrada não compartilham dados automaticamente. O projeto é acadêmico e ainda não foi validado como sistema oficial de ponto.

## Como contribuir

Veja as tarefas do grupo na aba [Issues](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues). Avise qual tarefa fará e trabalhe em uma branch separada, sem modificar diretamente a `main`. Ao terminar, abra um Pull Request para o grupo revisar.
