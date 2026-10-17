# Deploy: Vercel + Turso (libSQL)

Esta alternativa publica o frontend Vite como arquivos estáticos da Vercel e encaminha a API Express para uma Vercel Function. Somente a produção usa Turso: **o desenvolvimento local continua com o backend `backend/server.js` e SQLite em `backend/dados/jornada.db`**.

> Este é um protótipo acadêmico de conta única, não homologado para ponto eletrônico oficial nem para processamento público de informações pessoais sensíveis. Use dados fictícios na demonstração.

## Arquitetura

| Ambiente | Frontend | API | Banco |
| --- | --- | --- | --- |
| Desenvolvimento | `npm run dev` (Vite, 5173) | `npm --prefix backend start` (Express, 3000) | `better-sqlite3` local |
| Vercel | `dist/` no CDN | `api/index.js` → `backend/cloud.cjs` | Turso libSQL remoto |

Ambas as APIs usam as mesmas rotas e tabelas para `registros`, `configuracoes`, `conta` e `sessoes_conta`. A implementação remota adiciona `login_tentativas` ao banco para compartilhar os limites de login entre funções serverless. Os dados **não sincronizam automaticamente** entre local e nuvem.

## 1. Banco de dados no Turso

A implementação utiliza **libSQL** (cliente `@libsql/client/web`), não o novo motor Turso Database. Se usar a CLI:

```bash
turso auth login
turso db create meu-ponto-pi2
turso db show --url meu-ponto-pi2
turso db tokens create meu-ponto-pi2
```

**Importante:** crie o banco libSQL padrão; não use `--tursodb`. Guarde os dois resultados em local seguro:

- `TURSO_DATABASE_URL`: URL libSQL do banco.
- `TURSO_AUTH_TOKEN`: token privado de acesso.

Não coloque o token no GitHub, no frontend, no README nem em variáveis com prefixo `VITE_`. O backend cria as tabelas automaticamente na primeira requisição válida. Crie **outro banco, com outro token**, caso queira testar Preview Deployments.

Referência: [Guia oficial Turso](https://docs.turso.tech/quickstart).

## 2. Validar o código no computador ou Codespaces

Na raiz do repositório, atualize para a branch de deploy e execute:

```bash
npm install
npm --prefix backend install
npm --prefix backend test
npm run test:cloud
npm run build
```

O `test:cloud` usa **um arquivo libSQL SQLite temporário** como substituto de testes do Turso; verifica cadastro concorrente, sessão, CSRF, registros, restauração de backup, alteração de senha, logout e limite de login. Ele **não comprova** a conexão real com o Turso, a compilação de Functions ou o roteamento da Vercel. É necessário testá-los em um Preview Deploy antes de usar produção.

Para continuar usando o sistema local, execute o comando conhecido do README: o backend local usa somente SQLite, independentemente das variáveis do Turso.

## 3. Configurar um projeto Vercel

1. Em [vercel.com/new](https://vercel.com/new), importe o repositório `josepauloferreira/pi-ii-controle-jornada`.
2. Use a **raiz do repositório**, preset **Vite**, `npm run build` e pasta de saída **`dist`**.
3. A configuração `vercel.json` roteia `/api/*` à função `api/index.js` e mantém os demais caminhos no frontend compilado.
4. Para validação inicial, publique a branch do PR como um deployment de preview, com um **banco Turso exclusivo de testes** e proteção de acesso.
5. Na Vercel, em **Project Settings → Environment Variables**, configure `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` no ambiente adequado.
6. Execute o deployment, verifique os logs e acesse `https://SEU-SITE.vercel.app/api/health`. A resposta esperada é `{"status":"ok"}`.
7. Valide a página inicial, cadastro, login, logout, mudança de senha, registros em `HH:mm`, CSV e backup. Teste um redeploy para verificar se a conta e os registros persistem.

**Atenção:** variáveis de **Production** devem apontar para um banco separado das variáveis de **Preview**. Nunca permita que PRs não confiáveis ou previews públicos acessem o banco de produção. Não habilite compartilhamento público de uma instalação sem conta inicial: quem acessar primeiro poderá registrar a conta única.

## 4. Importar os registros antigos

O SQLite local não é enviado à Vercel. Para migrar os dados da jornada:

1. No sistema local, acesse sua conta e faça **Fazer backup** (JSON).
2. No endereço hospedado, crie a conta única própria do novo banco.
3. Use a função **Restaurar backup** e selecione o arquivo JSON.
4. Confira o histórico, extras e configurações.

**Atenção:** a restauração substitui todos os registros do banco de destino. O backup de jornada **não inclui senhas, cookies ou sessões**. Preserve uma cópia do arquivo antes de importar.

## 5. Segurança e limitações

- As funções da Vercel não podem depender de um banco em arquivo gravável entre requisições. O Turso persiste os registros, a conta, as sessões e os limites de login remotamente.
- Nunca comite credenciais; arquivos `.env` e `.vercel/` são ignorados.
- Cadastros iniciais permanecem acessíveis até existir uma conta: proteja o preview, gere a conta imediatamente e não divulgue o link antes disso.
- Use HTTPS e não exponha a senha ou o token em logs. Limite o acesso ao painel e monitore o consumo dos planos gratuitos.
- Mantenha backups externos: a Vercel e o banco são serviços diferentes e a disponibilidade gratuita pode mudar.
- O código local e o código em nuvem têm implementações próprias das rotas. Uma alteração futura no comportamento da API deve atualizar **ambas** e seus testes.
- O merge de código não cria automaticamente contas Vercel/Turso, bancos, tokens, variáveis ou um endereço público.

## Documentação de referência

- [Vercel: Vite](https://vercel.com/docs/frameworks/frontend/vite)
- [Vercel: Functions](https://vercel.com/docs/functions/runtimes/node-js)
- [Vercel: rewrites](https://vercel.com/docs/routing/rewrites)
- [Turso: início rápido](https://docs.turso.tech/quickstart)
- [libSQL client: transações e batch](https://tursodatabase.github.io/libsql-client-ts/interfaces/Client.html)
