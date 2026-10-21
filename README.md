# Meu Ponto

**Sistema de Controle de Jornada · Projeto Integrador em Computação II · UNIVESP · 2026**

[![CI — testes e build](https://github.com/josepauloferreira/pi-ii-controle-jornada/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/josepauloferreira/pi-ii-controle-jornada/actions/workflows/ci.yml)

Uma aplicação web de **acompanhamento individual da jornada em home office**. Permite registrar marcações de ponto, calcular horas trabalhadas e saldo, consultar o histórico e exportar os dados — em uma interface responsiva, com autenticação e persistência no servidor.

**[Acessar demonstração](https://pi-ii-controle-jornada.vercel.app)** · [Executar localmente](#executar-localmente) · [Arquitetura](#arquitetura-e-ambientes) · [Testes e qualidade](#testes-e-qualidade) · [Documentação](#documentação)

> Protótipo acadêmico de uso individual. Utilize dados fictícios na demonstração. A aplicação não é homologada como sistema oficial de controle de ponto.

## Funcionalidades

- **Registro de ponto:** entrada, pausa, retorno e saída, em sequência, com horário e data definidos pelo servidor. A jornada ativa pode ter começado no dia anterior.
- **Acompanhamento diário:** horas trabalhadas, jornada prevista congelada por dia e saldo; expedientes incompletos aparecem como “Em andamento”. Alterar a jornada das configurações preserva as cargas anteriores.
- **Histórico mensal e auditoria:** consulta, correção e exclusão justificadas (10–500 caracteres), incluindo batidas extras com descrição opcional. A auditoria continua consultável por data após excluir uma jornada. Extras não alteram automaticamente as horas trabalhadas.
- **Configurações pessoais:** nome de exibição, jornada diária e início da semana.
- **Exportação e backup:** histórico em CSV, backup JSON e restauração transacional mediante confirmação, com auditoria automática e sem justificativa digitada.
- **Acesso pessoal:** cadastro inicial de uma conta, login, logout e troca de senha com invalidação das sessões anteriores.

Todos os horários usam **24 horas**, no formato `HH:mm`. Por exemplo, `08:30` e `18:30`; ao digitar `1830`, o campo converte para `18:30`. Valores fora de `00:00` a `23:59` são rejeitados.

## Interface e navegação

A interface aplica o design system [Apple Light](DESIGN.md), com fonte do sistema, azul de interação, superfícies claras e composição responsiva. O frontend usa módulos ES para separar views, componentes, diálogos e acesso aos dados.

| Endereço | Fluxo |
| --- | --- |
| `/#/` | Apresentação pública com prévia identificada como ilustrativa. |
| `/#/acesso` | Login ou cadastro inicial, conforme a disponibilidade informada pela API. |
| `/#/visao-geral` | Estado da jornada, métricas, etapas e jornadas anteriores. |
| `/#/jornada` | Próxima marcação, horários, extras, correções e auditoria. |
| `/#/historico` | Filtro mensal, CSV, detalhes e consulta da auditoria por data. |
| `/#/configuracoes` | Jornada, preferências, senha, backup e migração local. |

As quatro views privadas exigem sessão. A navegação usa sidebar no desktop e barra inferior no mobile. Diálogos nativos mantêm o fundo inerte, contêm o foco de teclado, aceitam Escape quando disponíveis e retornam o foco ao fechar; cabeçalho e ações permanecem visíveis enquanto o corpo rola. Carregamento, falha e nova tentativa têm estados próprios; expirar a sessão fecha os diálogos e remove os dados privados da interface.

## Arquitetura e ambientes

O frontend usa **HTML, CSS, JavaScript e Vite**. A API é desenvolvida com **Node.js e Express**, com dois adaptadores de persistência que mantêm o mesmo contrato HTTP.

| Ambiente | Frontend | API | Persistência |
| --- | --- | --- | --- |
| Desenvolvimento local | Vite, porta `5173` | `backend/server.js`, porta `3000` | SQLite com `better-sqlite3` |
| Preview | Arquivos estáticos na Vercel | Vercel Function → `backend/cloud.cjs` | Turso libSQL exclusivo de testes |
| Produção | Arquivos estáticos na Vercel | Mesma Function | Turso libSQL e credenciais próprios |

Localmente, o Vite encaminha `/api` para o Express. Na Vercel, `api/index.js` recebe as chamadas da API e utiliza `@libsql/client/web` para acessar o Turso. Credenciais ficam exclusivamente no servidor; a Function não depende de um arquivo SQLite persistente.

**Os ambientes têm bancos independentes.** Registros, contas e configurações não são sincronizados automaticamente entre local, Preview e produção.

```mermaid
flowchart LR
  subgraph local["Desenvolvimento local"]
    vite["Vite · porta 5173"] -->|"/api"| express["Express · porta 3000"]
    express --> sqlite[("SQLite local")]
  end
  subgraph hosted["Preview e produção · Vercel"]
    frontend["Frontend estático · CDN"] -->|"/api"| function["Express · Vercel Function"]
    function --> turso[("Turso libSQL remoto")]
  end
```

A arquitetura preserva o mesmo **contrato HTTP** em desenvolvimento e na nuvem. As duas implementações são verificadas pelo conjunto compartilhado de testes de integração descrito em [TESTES.md](TESTES.md).

## Executar localmente

### Requisitos

- **Node.js 24 LTS**, recomendado; também é aceita a série 22 a partir de `22.12`.
- **npm** e **Git**.

Os comandos abaixo partem da raiz do repositório.

### 1. Obter o projeto e instalar as dependências

```bash
git clone https://github.com/josepauloferreira/pi-ii-controle-jornada.git
cd pi-ii-controle-jornada
npm ci
npm --prefix backend ci
```

Frontend e backend possuem lockfiles próprios. Use `npm ci` para reproduzir as versões versionadas. O backend local usa o módulo nativo `better-sqlite3`; se a instalação for bloqueada pela política de scripts do npm, consulte o [guia de instalação e deploy](DEPLOY-VERCEL.md#instalação-e-testes-reproduzíveis).

### 2. Iniciar a API

Em um terminal:

```bash
npm --prefix backend start
```

### 3. Iniciar a interface

Em outro terminal:

```bash
npm run dev
```

Abra **[http://localhost:5173](http://localhost:5173)**. Mantenha os dois processos em execução e encerre cada um com `Ctrl+C`.

A porta `3000` atende à API e à demonstração legada; a interface atual, com autenticação, está na porta `5173`. No GitHub Codespaces, abra a porta `5173` e mantenha ambas as portas como **Private**, inclusive durante o primeiro cadastro.

## Cadastro inicial e segurança

**Cada instalação admite uma única conta.** Quando seu banco ainda não tem conta, aparece **Criar conta**. Depois do cadastro, a tela oferece apenas **Entrar** e o backend bloqueia novos cadastros. A ausência do botão de cadastro em uma instalação já inicializada é o comportamento esperado.

O usuário deve ter de 3 a 40 caracteres, começar com uma letra e usar letras, números, ponto, hífen ou sublinhado. A senha exige pelo menos **12 caracteres**, com limite de 256 bytes. Não existem credenciais predefinidas, painel de administradores, múltiplos funcionários ou recuperação pública de senha.

- Senhas são armazenadas com **scrypt e salt aleatório**.
- Sessões ficam no banco; cookies usam `HttpOnly`, `SameSite=Strict` e `Secure` em HTTPS.
- Rotas de dados exigem autenticação, e operações de escrita também exigem o token **CSRF** da sessão.
- O login tem limite de tentativas. Na nuvem, o controle é compartilhado entre as instâncias da Function.
- A troca de senha invalida todas as sessões anteriores.

Quem acessa primeiro uma base vazia pode criar sua conta única. Mantenha o **Preview protegido por Vercel Authentication**. Em produção, faça o primeiro cadastro no deployment protegido antes de liberar o domínio público, conforme o [procedimento de publicação](DEPLOY-VERCEL.md).

## Dados e backups

### Armazenamento

O backend local cria `backend/dados/jornada.db`. Essa pasta é ignorada pelo Git e excluída dos uploads para a Vercel. Para usar outra base local, defina `MEU_PONTO_DB_PATH` com o caminho de um arquivo em uma pasta existente.

Na nuvem, registros, configurações, conta, sessões e limites de login ficam no Turso. Um redeploy não substitui o banco remoto. Mantenha cópias de segurança fora do deployment.

| Ação | Resultado |
| --- | --- |
| **Exportar CSV** | Baixa o histórico do mês selecionado para consulta em planilha. |
| **Fazer backup** | Baixa JSON v2 com registros, configurações e jornadas previstas dos dias presentes no arquivo. |
| **Restaurar backup** | Aceita backups legados/v1 e v2, substitui os registros e atualiza as configurações presentes, após revisar o arquivo e confirmar a substituição. |

Backups JSON **não incluem senhas, sessões nem o histórico de auditoria**. A exportação omite snapshots de jornada prevista sem registro correspondente. A restauração aceita `registros`, `configuracoes` e `jornadasPrevistas`, sendo os dois últimos opcionais; valida o conteúdo antes da escrita e aplica as alterações em transação. Uma falha causa rollback. Quando o arquivo fornece um snapshot em `jornadasPrevistas[data]`, sua carga substitui a armazenada no destino. Sem snapshot para a data, a carga existente é preservada; dias novos usam a configuração presente no backup ou, na ausência dela, a do destino. As cargas restauradas explicitamente continuam identificadas como importadas.

Restaurar não exige justificativa manual. SQLite e libSQL gravam automaticamente “Restauração de backup confirmada pelo usuário.” em cada jornada cujo registro foi criado, alterado ou removido, preservando valores anteriores e posteriores. Se apenas a carga prevista mudar, o evento automático também registra os minutos anteriores e restaurados. Faça um backup atual antes de restaurar e confira o ambiente de destino. O CSV não é um formato de restauração.

### Dados do protótipo antigo

Registros antigos do `localStorage` permanecem preservados no navegador. Quando encontra datas locais ausentes no servidor, a interface oferece uma migração **opcional**, sem substituir dias já existentes. Também é possível baixar uma cópia separada desses dados antigos. Informações de outro navegador ou endereço não são migradas automaticamente.

O cadastro de uma conta não apaga registros de jornada já existentes. A transferência entre ambientes é manual, por backup JSON, e deve ser autorizada pelo responsável pelos dados.

## Testes e qualidade

A aplicação tem testes de **integração HTTP** para SQLite e libSQL, **testes unitários de jornada e validação de backup** e uma suíte de **navegação E2E com Playwright**, sem utilizar Turso ou dados reais.

Depois de instalar as dependências, execute:

```bash
npm --prefix backend test   # Express + SQLite
npm run test:cloud          # Express + libSQL e entrypoint serverless
npm run test:unit           # Jornada e validação de backup
npm run build               # Build Vite
```

Para instalar e executar os testes reais de interface em Chromium, sem tocar nos bancos do usuário:

```bash
npm --prefix e2e ci
./e2e/node_modules/.bin/playwright install chromium
npm run test:e2e
```

| Camada | Verificação | Resultado registrado |
| --- | --- | --- |
| SQLite local | Integração HTTP e regras de jornada | **25 aprovados**, 0 falhas |
| libSQL / Vercel Function | Testes de integração, concorrência e contrato HTTP | **50 aprovados**, 0 falhas |
| Regras do frontend | `node:test` sobre jornada e backup | **15 testes unitários aprovados** |
| Interface local | Playwright + Chromium + SQLite temporário | **18 cenários E2E aprovados** |
| Frontend | `npm run build` | Build aprovado |
| Preview hospedado | HTTP e navegador, registrado em relatório anterior | **14 cenários históricos** |
| Produção | Smoke tests de disponibilidade e acesso | Evidências documentadas separadamente |

Os resultados locais foram registrados em **20/10/2026**, com **Node.js 24.22.0 e npm 11.19.1**, sem falhas; não são percentuais de cobertura. Os 18 cenários E2E incluem navegação, erros e recuperação, auditoria, backup, migração, expiração de sessão, troca de senha e cinco larguras. São distintos dos 14 cenários históricos hospedados na Vercel. Playwright utiliza SQLite descartável; a integração libSQL também usa arquivos locais temporários, sem conexão com Turso remoto.

A [CI do GitHub Actions](https://github.com/josepauloferreira/pi-ii-controle-jornada/actions/workflows/ci.yml) está configurada para integração, unitários e build em **Node.js 22 e 24**, com E2E em job Chromium separado. A execução remota desta entrega ainda deve ser conferida no PR; a [primeira execução com Playwright](https://github.com/josepauloferreira/pi-ii-controle-jornada/actions/runs/39053909867) é uma evidência histórica.

**[Estratégia e cobertura detalhadas](TESTES.md)** · [Como executar Playwright](e2e/README.md) · [Evidências do Preview](VALIDACAO-PREVIEW.md) · [Evidências da produção](VALIDACAO-PRODUCAO.md)

## Hospedagem e configuração

**Demonstração online:** [pi-ii-controle-jornada.vercel.app](https://pi-ii-controle-jornada.vercel.app). A instalação de produção já possui sua conta única; o acesso ao painel exige login.

O [Preview da branch de deploy](https://pi-ii-controle-jornada-git-feat-deploy-vercel-turso-ze17.vercel.app) exige acesso pela Vercel. Cada ambiente mantém sua própria conta única.

| Variável | Uso |
| --- | --- |
| `TURSO_DATABASE_URL` | URL libSQL do banco exclusivo do ambiente Vercel. |
| `TURSO_AUTH_TOKEN` | Token privado desse banco, armazenado como Secret na Vercel. |
| `MEU_PONTO_DB_PATH` | Opcional, somente no backend SQLite local. |

O desenvolvimento local padrão não exige credenciais Turso. O arquivo [.env.example](.env.example) documenta os nomes das variáveis, sem valores privados. Não use prefixo `VITE_` para segredos e não versione arquivos de ambiente, tokens ou cookies.

O projeto Vercel utiliza Node.js `24.x`, preset Vite, instalação `npm ci`, build `npm run build`, saída `dist` e região `iad1`. Preview usa `meu-ponto-pi2-preview`; produção usa `meu-ponto-pi2-prod`, com credenciais próprias e sem importação automática de dados.

Deployments de branches geram previews. O deploy automático da `main` está desabilitado para permitir uma publicação controlada de produção: gerar o deployment com `--target production --skip-domain`, inicializar a conta sob proteção e promover o deployment validado. Os comandos completos, a rotação de tokens e o processo de atualização estão em [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md).

## Estrutura do repositório

```text
.
├── index.html                 # Entrada HTML da aplicação
├── src/
│   ├── main.js                # Estado, rotas hash, autenticação e ações
│   ├── views/                 # Landing, acesso e quatro views privadas
│   ├── ui/                    # Componentes, SVGs e diálogos
│   ├── lib/                   # API, formatação, backup e migração local
│   ├── jornada.js             # Cálculos puros de jornada e saldo
│   ├── styles/tokens.css      # Tokens do sistema Apple Light
│   └── style.css              # Componentes e responsividade
├── api/index.js               # Entrada da Vercel Function
├── backend/
│   ├── server.js              # API Express local
│   ├── auth.js                # Autenticação local
│   ├── database.js            # Persistência SQLite local
│   ├── cloud.cjs              # API Express com Turso libSQL
│   ├── api-contract.cjs       # Contrato HTTP compartilhado pelos testes
│   └── *.test.*               # Testes de integração
├── tests/                     # Unitários de jornada e validação de backup
├── e2e/                       # Playwright com banco SQLite descartável
├── vite.config.js             # Configuração e proxy de desenvolvimento
├── vercel.json                # Build, região e roteamento de nuvem
├── .github/workflows/ci.yml  # CI em Node.js 22 e 24
├── DESIGN.md                  # Sistema visual e regras dos componentes
├── TESTES.md                  # Estratégia e matriz de testes
├── DEPLOY-VERCEL.md           # Instalação, ambientes e publicação
├── VALIDACAO-PREVIEW.md       # Evidências da validação executada
└── Projeto-PI-Ponto.html       # Protótipo original com armazenamento local
```

## API

Todas as rotas usam o prefixo `/api`. Dados de jornada exigem sessão autenticada; escritas autenticadas exigem o header `X-CSRF-Token`.

| Método | Rota | Finalidade |
| --- | --- | --- |
| `GET` | `/api/health` | Verificar disponibilidade; na nuvem, também verifica o banco. |
| `GET` | `/api/auth/status` | Consultar se o cadastro inicial está disponível. |
| `POST` | `/api/auth/register` | Criar a primeira e única conta. |
| `POST` | `/api/auth/login` | Iniciar sessão. |
| `GET` | `/api/auth/me` | Consultar a sessão autenticada. |
| `POST` | `/api/auth/logout` | Encerrar sessão. |
| `POST` | `/api/auth/password` | Alterar senha e invalidar sessões. |
| `GET` | `/api/registros` | Listar registros; aceita `?mes=AAAA-MM`. |
| `GET`, `PUT`, `DELETE` | `/api/registros/:data` | Consultar, corrigir ou excluir um dia em `AAAA-MM-DD`; escritas exigem justificativa de 10–500 caracteres. |
| `GET` | `/api/jornada/ativa` | Obter a data e o registro da jornada ativa definida pelo servidor. |
| `POST` | `/api/jornada/marcar` | Registrar a próxima etapa com horário do servidor; recebe `{}`, sem horário fornecido pelo cliente. |
| `GET` | `/api/jornada/previstas` | Consultar a carga prevista congelada de cada jornada. |
| `GET` | `/api/jornada/historico/:data` | Consultar origem e alterações auditadas, inclusive após excluir o registro. |
| `GET`, `PUT` | `/api/configuracoes` | Consultar ou atualizar configurações. |
| `PUT` | `/api/backup` | Restaurar registros e, opcionalmente, configurações e jornadas previstas, com auditoria automática e sem justificativa manual. |

## Documentação

- [DESIGN.md](DESIGN.md): tokens, tipografia, layout responsivo e componentes Apple Light.
- [TESTES.md](TESTES.md): integração, testes unitários, E2E, cobertura documentada, CI e limitações.
- [e2e/README.md](e2e/README.md): instalação e execução isolada dos testes de navegador com Playwright.
- [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md): instalação reproduzível, variáveis, proteção, atualizações e checklist de produção.
- [VALIDACAO-PREVIEW.md](VALIDACAO-PREVIEW.md): testes executados, persistência e limitações observadas no Preview.
- [VALIDACAO-PRODUCAO.md](VALIDACAO-PRODUCAO.md): publicação, separação dos bancos e verificações do domínio público.
- [Issues do projeto](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues): planejamento e acompanhamento das entregas.
- [Pull Requests](https://github.com/josepauloferreira/pi-ii-controle-jornada/pulls): histórico de implementação e revisão.

## Contexto acadêmico e colaboração

O projeto foi desenvolvido para o **Projeto Integrador em Computação II da UNIVESP**, com foco no acompanhamento individual de jornadas em home office. As entregas incluem organização com Vite, API Express/SQLite, integração do frontend, histórico, configurações, exportações, autenticação e horários em 24 horas.

Para contribuir, descreva o problema em uma issue, trabalhe em branch própria e abra um Pull Request com as verificações realizadas. Preserve o contrato dos dois backends e seus testes.

A execução dos testes e a hospedagem não comprovam homologação legal, disponibilidade contínua ou validação externa com a comunidade. Essas atividades e as evidências acadêmicas correspondentes devem ser registradas separadamente.
