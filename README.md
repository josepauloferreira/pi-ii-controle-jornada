# Sistema de Controle de Jornada

Projeto Integrador em Computação II — UNIVESP (2026).

Aplicação web para registrar e acompanhar a jornada de trabalho em home office. Trata-se de um **protótipo acadêmico de uso individual**, com interface responsiva, API Express e persistência em SQLite.

## Estado do projeto e roadmap

As entregas planejadas para o software foram integradas à branch `main`:

- [x] [1. Organizar o frontend com Vite — #13](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues/13)
- [x] [2. Criar backend com Express e SQLite — #14](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues/14)
- [x] [3. Conectar o registro de ponto ao backend — #15](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues/15)
- [x] [4. Conectar histórico, configurações e exportação — #16](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues/16)
- [x] [5. Refinar a interface visual — #18](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues/18) ([PR #23](https://github.com/josepauloferreira/pi-ii-controle-jornada/pull/23))
- [x] [6. Cadastro e login de conta única — #22](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues/22) ([PR #24](https://github.com/josepauloferreira/pi-ii-controle-jornada/pull/24))
- [x] Padronizar os campos de horário em 24 horas ([PR #25](https://github.com/josepauloferreira/pi-ii-controle-jornada/pull/25))

A implementação concluída no repositório **não significa homologação como sistema oficial de controle de ponto**, nem substitui a validação externa e as entregas acadêmicas.

## Funcionalidades

- Registrar entrada, saída para almoço, retorno e saída do expediente.
- Consultar horas trabalhadas, jornada prevista e saldo diário. Enquanto o expediente está incompleto, o saldo mostra **"Em andamento"**.
- Consultar o histórico por mês, editar ou excluir registros e gerenciar batidas extras.
- Configurar nome de exibição, jornada diária e início da semana.
- Exportar histórico em CSV, baixar backup JSON e restaurar dados mediante confirmação.
- Criar uma única conta pessoal, entrar, sair e trocar a própria senha.

**Horários em 24 horas:** os campos de configuração, edição de registros e batidas extras usam `HH:mm`, sem AM/PM (por exemplo, `08:30` e `18:30`). É possível digitar `1830`; o campo converte para `18:30`. Valores fora de `00:00` a `23:59` são inválidos. O relógio também é exibido em 24 horas. A gravação dos horários continua usando o formato `HH:mm` no SQLite.

## Tecnologias

- **Frontend:** HTML, CSS, JavaScript puro e Vite (sem React).
- **Backend:** Node.js e Express.
- **Persistência:** SQLite com `better-sqlite3` no desenvolvimento; Turso libSQL remoto na Vercel.
- **Autenticação:** conta única, hash de senha `scrypt`, sessões no banco e cookie de sessão.

**Requisito:** Node.js 24 LTS (ou 22.12+) e npm. Para os comandos abaixo, use um terminal na **raiz do repositório**.

## Instalação e execução

### 1. Instalar dependências

O frontend e o backend têm `package.json` separados. Instale ambos:

~~~bash
npm ci
npm --prefix backend ci
~~~

### 2. Iniciar frontend e backend com um comando (Linux / Codespaces)

~~~bash
node backend/server.js & BACKEND_PID=$!; trap 'kill "$BACKEND_PID" 2>/dev/null' EXIT; npm run dev
~~~

Este comando inicia o **Express na porta 3000** e o **Vite na porta 5173** na mesma sessão de terminal Bash/zsh. Para encerrar, pressione `Ctrl+C`. Abra a interface em **http://localhost:5173**.

O Vite encaminha as chamadas `/api` para `http://127.0.0.1:3000`. O endereço da porta **3000** apresenta a demonstração legada (`backend/demo.html`), **não** a interface principal com tela de autenticação.

No **GitHub Codespaces**, abra a aplicação pela porta **5173** e mantenha as portas **5173 e 3000 como Private**, especialmente antes de criar a primeira conta.

### Alternativa: dois terminais

Na raiz do repositório, execute em terminais diferentes:

**Terminal 1 — backend**
~~~bash
npm --prefix backend start
~~~

**Terminal 2 — frontend**
~~~bash
npm run dev
~~~

> A aplicação precisa dos dois servidores para consultar e salvar registros. Não é necessário publicar a porta do backend.

## Cadastro inicial, login e segurança

No primeiro acesso, aparece **Criar conta**. Escolha um nome de usuário e uma senha de pelo menos **12 caracteres**; não há senha ou usuário predefinidos. Após a criação da primeira conta, o backend bloqueia novos cadastros e a tela passa a oferecer somente **Entrar**.

A conta é pessoal e única: **não existe painel de administradores, múltiplos funcionários ou recuperação pública de senha**. Após entrar, é possível sair ou alterar a senha. A alteração invalida sessões anteriores.

- Senhas são armazenadas como hash `scrypt` com salt aleatório, não em texto simples.
- As sessões ficam no SQLite; o navegador recebe cookie `HttpOnly` e `SameSite=Strict`, com `Secure` quando a requisição chega por HTTPS.
- Histórico, registros, configurações e restauração de backups exigem login. Operações de escrita também verificam o token CSRF da sessão.
- Há limitação de tentativas de login.

**Importante:** quem primeiro acessar uma instância ainda sem conta pode registrar a conta única. **Não exponha publicamente uma instalação vazia**; no Preview, mantenha Vercel Authentication ativa. Este protótipo não deve ser tratado como serviço pronto para dados pessoais sensíveis.

## Banco de dados, histórico antigo e backups

O arquivo padrão é `backend/dados/jornada.db`, criado automaticamente pelo backend. A pasta `backend/dados/` está no `.gitignore` e **não é enviada ao GitHub**. Excluir o ambiente onde o backend roda pode significar perder seus dados; mantenha backups fora desse ambiente.

O cadastro da conta **não apaga nem transfere os registros anteriores** das tabelas de jornada. As tabelas de conta e sessões são adicionais.

- O SQLite é a fonte principal dos registros e das configurações.
- Registros antigos no `localStorage` continuam preservados no navegador. Se houver dias locais ausentes no SQLite, a interface oferece migração **opcional** somente dessas datas, sem substituir registros já existentes no servidor.
- É possível baixar separadamente os dados antigos do navegador. Dados de origens diferentes (como outro navegador ou endereço) não são migrados automaticamente.
- **Fazer backup** gera JSON dos dados atuais do SQLite; **Exportar CSV** usa o histórico persistido.
- **Restaurar backup** substitui todos os registros do SQLite e, se houver configurações no arquivo, também as configurações, mediante confirmação. A operação é transacional, e arquivos inválidos são rejeitados sem substituir os dados.

Antes de realizar testes manuais que envolvam criação de conta, troca de senha ou restauração, faça uma cópia do banco existente ou utilize uma base de testes. Para executar o backend com outra base, defina `MEU_PONTO_DB_PATH` apontando para um arquivo SQLite em uma pasta existente.

## Testes e verificação

Na raiz do repositório, depois de instalar as dependências:

~~~bash
npm --prefix backend test
npm run test:cloud
npm run build
~~~

O teste automatizado do backend usa um **SQLite temporário**, sem modificar `backend/dados/jornada.db`. As suítes local e libSQL compartilham testes do contrato HTTP de registros, horários, extras, configurações e backups. A suíte de nuvem verifica persistência entre clientes, limite concorrente de login e rollback de restauração após falha SQL. O teste original cobre cadastro concorrente de conta única, login, autorização de rotas, CSRF, preservação de registro antigo, troca de senha, logout e limite de tentativas.

O build do frontend usa `vite build` e gera a pasta `dist/`, ignorada pelo Git. Os testes automatizados e o build foram executados e aprovados durante a integração da autenticação. **Não há workflow de CI configurado no repositório**; novas alterações precisam ser verificadas novamente.

A versão com horários de 24 horas exige também conferência visual nos navegadores utilizados, incluindo digitação de `1830` → `18:30`, edição de batidas e login.

## Estrutura principal

~~~text
.
├── index.html                # Interface atual do Vite
├── src/
│   ├── main.js               # Fluxos de interface e chamadas à API
│   └── style.css             # Estilos e responsividade
├── vite.config.js            # Proxy /api → backend
├── package.json              # Frontend
├── backend/
│   ├── server.js             # Servidor Express e rotas da API
│   ├── auth.js               # Cadastro, login e sessões
│   ├── auth.test.js          # Teste de integração da autenticação
│   ├── database.js           # Tabelas do SQLite
│   ├── demo.html             # Demonstração antiga
│   └── package.json          # Backend
└── Projeto-PI-Ponto.html     # Protótipo original com armazenamento local
~~~

## Endereços da API

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/api/health` | Estado básico do servidor |
| GET | `/api/auth/status` | Verificar disponibilidade do cadastro inicial |
| POST | `/api/auth/register` | Criar a conta única na primeira visita |
| POST | `/api/auth/login` | Entrar |
| GET | `/api/auth/me` | Consultar a sessão |
| POST | `/api/auth/logout` | Encerrar a sessão |
| POST | `/api/auth/password` | Alterar senha da conta |
| GET | `/api/registros` | Listar registros (aceita filtro `?mes=AAAA-MM`) |
| GET | `/api/registros/:data` | Consultar um dia (`AAAA-MM-DD`) |
| PUT | `/api/registros/:data` | Criar ou atualizar um dia |
| DELETE | `/api/registros/:data` | Excluir um dia |
| GET | `/api/configuracoes` | Consultar configurações |
| PUT | `/api/configuracoes` | Atualizar configurações |
| PUT | `/api/backup` | Restaurar registros e configurações |

As rotas de dados exigem sessão autenticada. As operações de escrita exigem também confirmação CSRF.

## Hospedagem com Vercel e Turso

O projeto oferece uma implantação com **frontend Vite na Vercel, API Express serverless e banco Turso libSQL remoto**. O backend SQLite local permanece disponível, sem mudanças no fluxo de desenvolvimento. Consulte **[DEPLOY-VERCEL.md](DEPLOY-VERCEL.md)** para instalar, testar e configurar a hospedagem e **[VALIDACAO-PREVIEW.md](VALIDACAO-PREVIEW.md)** para os resultados realmente executados.

O Preview exige **Vercel Authentication / Standard Protection** antes do cadastro inicial e usa o banco separado `meu-ponto-pi2-preview`. Não associe previews ao banco de produção. A publicação em produção e o merge dependem de aprovação expressa. Consulte o guia para variáveis, atualizações, backups e checklist de produção.

## Colaboração e limitações

Para contribuir, escolha uma [issue](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues), trabalhe em branch própria e abra um Pull Request para revisão, em vez de editar a `main` diretamente.

Este projeto é uma **demonstração acadêmica voltada ao uso individual**, não um produto homologado para controle legal de ponto. A implantação em hospedagem permanente, a validação externa com a comunidade e as evidências para o Relatório Final devem ser tratadas separadamente; **não são resultados já comprovados pelo código**.
