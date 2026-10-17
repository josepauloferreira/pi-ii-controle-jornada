# Deploy: Vercel + Turso libSQL

O desenvolvimento local continua com Express e SQLite (`better-sqlite3`). Preview e Production usam uma Function Express e Turso libSQL remoto. Os bancos não sincronizam automaticamente. Use somente dados fictícios nesta demonstração acadêmica.

## Ambientes e arquitetura

| Ambiente | Frontend | API | Banco e credenciais |
| --- | --- | --- | --- |
| Local | Vite, porta 5173 | `backend/server.js`, porta 3000 | SQLite em `backend/dados/jornada.db`; não usa Turso |
| Preview | `dist/` na CDN Vercel | `api/index.js` → `backend/cloud.cjs` | `meu-ponto-pi2-preview`, variáveis Preview da branch |
| Production | A publicar somente após aprovação | Mesma Function | Banco separado `meu-ponto-pi2-prod`, token exclusivo Production |

O projeto existente é **ze17/pi-ii-controle-jornada**, ID `prj_63EqU9qanGHdPO7gBb7RTtHZoVsD`, vinculado a `josepauloferreira/pi-ii-controle-jornada`. Não crie outro projeto.

Configuração: preset **Vite**, raiz do repositório (Root Directory automático/vazio na API, exibido como `.` na CLI), Node.js **24.x**, instalação `npm ci`, build `npm run build`, saída `dist`, Function em **iad1**, próxima do Turso `aws-us-east-1`. A API da Vercel rejeita `--root-directory .`; use `--auto-detect root-directory` para a raiz.

`vercel.json` encaminha `/api/:path*` para `/api/index?apiPath=:path*`. O handler aceita a URL original do Express e reconstrói o caminho se receber o destino da rewrite. Os demais query parameters são preservados. Arquivos estáticos são servidos pela CDN. O cliente remoto `@libsql/client/web` usa HTTP, sem SQLite local nem binários nativos na Function.

## Instalação e testes reproduzíveis

Use Node.js 24 LTS (também há compatibilidade local declarada com 22.12+):

```bash
npm ci
npm --prefix backend ci
npm run test:cloud
npm --prefix backend test
npm run build
```

Os dois lockfiles devem ser versionados. O backend local precisa permitir a instalação do módulo nativo `better-sqlite3`. No npm 12, se a política bloquear scripts, autorize somente os pacotes necessários: `npm rebuild --allow-scripts=esbuild esbuild` e `npm --prefix backend rebuild --allow-scripts=better-sqlite3 better-sqlite3`.

Versões verificadas nesta implementação: Node.js 24.22.0, Vite 7.3.7, Express 5.3.0, `@libsql/client` 0.18.0, `better-sqlite3` 13.0.3, Vercel CLI 64.5.0 e Turso CLI 1.0.34. As versões efetivas de dependências estão nos lockfiles; não atualize sem repetir os testes.

`test:cloud` testa libSQL em arquivos temporários, com clientes e aplicações independentes. Cobre contrato HTTP, cadastro concorrente, cookies, CSRF, login, sessões compartilhadas, limite concorrente de login, troca de senha concorrente, horários, registros, extras, histórico, configurações, persistência após recriar aplicação, backups inválidos e rollback com falha SQL no meio da restauração. O teste local executa o mesmo contrato HTTP, além da suíte original. Nenhum deles abre o banco do usuário ou de produção.

## Vinculação e proteção antes de publicar

Os comandos abaixo foram verificados com Vercel CLI 64.5.0. `npx vercel@64.5.0` pode ser usado como prefixo quando a CLI não estiver no PATH.

```bash
vercel whoami
vercel project inspect pi-ii-controle-jornada --scope ze17
vercel project protection pi-ii-controle-jornada --scope ze17
```

A pasta `.vercel/project.json` deve indicar o projeto acima. Somente se estiver desvinculada:

```bash
vercel link --project pi-ii-controle-jornada --scope ze17 --yes
```

Configuração do projeto existente:

```bash
vercel project update pi-ii-controle-jornada --scope ze17 \
  --framework vite --build-command 'npm run build' --output-directory dist \
  --install-command 'npm ci' --auto-detect root-directory --node-version 24.x --yes
```

**Antes de qualquer Preview**, confirme Vercel Authentication / Standard Protection (`ssoProtection.deploymentType = all_except_custom_domains`). No painel: **Project Settings → Deployment Protection → Vercel Authentication → Standard Protection**. A proteção cobre os previews; não assuma que cobrirá os domínios públicos de produção.

Para testar por HTTP, use `vercel curl /api/health --deployment https://URL-EXATA --scope ze17`. Para navegador automatizado, obtenha um token OIDC de desenvolvimento com `vercel project token pi-ii-controle-jornada --scope ze17` capturando a saída somente em memória e envie `x-vercel-trusted-oidc-idp-token` exclusivamente para a origem do Preview. Nunca imprima o token, cookies ou headers de autenticação e não desative a proteção.

Referências: [acesso protegido](https://vercel.com/docs/cli/curl), [Standard Protection](https://vercel.com/docs/deployment-protection).

## Variáveis do servidor

| Nome | Ambiente | Valor esperado |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | Preview, branch `feat/deploy-vercel-turso` | URL do banco `meu-ponto-pi2-preview` |
| `TURSO_AUTH_TOKEN` | Preview, mesma branch, Secret | Token exclusivo desse banco |
| As mesmas duas chaves | Production, somente após aprovação | URL e token exclusivos de `meu-ponto-pi2-prod` |

O arquivo `.env.example` contém apenas nomes vazios. Não prefixe credenciais com `VITE_`. As variáveis são lidas exclusivamente por `backend/cloud.cjs`. `.env*`, `.vercel/` e os arquivos SQLite são excluídos de uploads e/ou ignorados pelo Git.

Inspeção sem revelar valores:

```bash
turso db show meu-ponto-pi2-preview
vercel env ls preview feat/deploy-vercel-turso --scope ze17
vercel env ls production --scope ze17
```

Variáveis por branch exigem que o projeto tenha vínculo Git. Caso necessário, conecte **o projeto existente**:

```bash
vercel git connect https://github.com/josepauloferreira/pi-ii-controle-jornada.git \
  --scope ze17 --project pi-ii-controle-jornada --yes
```

Cadastre a URL pelo prompt privado da CLI:

```bash
vercel env add TURSO_DATABASE_URL preview --git-branch feat/deploy-vercel-turso --scope ze17
```

Para um token ausente ou inválido, transferência direta sem imprimir ou gravar o segredo:

```bash
# Não usar set -x. O token vai somente pelo pipe para stdin da Vercel.
turso db tokens create meu-ponto-pi2-preview --expiration 90d | \
  vercel env add TURSO_AUTH_TOKEN preview --git-branch feat/deploy-vercel-turso \
    --sensitive --scope ze17
```

A rotação realizada durante a preparação invalidou os tokens anteriores do banco de Preview; não reutilize o token exposto. O token atual expira em 90 dias. Para uma próxima rotação, use `turso db tokens invalidate meu-ponto-pi2-preview --yes`, substitua a variável por `vercel env update ...` e publique novo Preview. Faça isso de maneira coordenada: invalidar tokens interrompe os deployments anteriores até receberem credenciais novas. Nunca use `--group` nem credenciais de produção para o Preview.

## Atualizações e validação hospedada

Na branch autorizada, após testes e revisão de segredos:

```bash
git status --short
npm run test:cloud
npm --prefix backend test
npm run build
# Faça commit antes de publicar, para identificar precisamente a revisão.
vercel deploy --target preview --scope ze17
vercel inspect https://URL-EXATA --scope ze17
vercel curl /api/health --deployment https://URL-EXATA --scope ze17
```

Aguarde **READY**. Use `--target preview` explicitamente; a CLI pode atribuir o primeiro deployment de um projeto a Production quando o destino não é especificado. Não use `--prod` para Preview. Pushes de branches também podem gerar previews pela integração Git. Confirme commit e branch no deployment. Mantenha a branch de produção em `main` e não faça merge sem aprovação.

Valide frontend, cadastro inicial/segundo cadastro, login, logout, CSRF, mudança de senha, registros em `HH:mm`, edição, extras, exclusão, histórico com filtro de mês, configurações, download CSV e JSON, restauração e persistência após recarregar e redeploy. Uma requisição sem autenticação Vercel deve receber a proteção, inclusive em `/api/health`. Consulte os logs para erros inesperados. Testes libSQL locais não comprovam o transporte remoto nem o roteamento; registre essas evidências separadamente.

## Persistência, segurança e backups

O schema é criado com `CREATE TABLE IF NOT EXISTS` e valores padrão por `INSERT OR IGNORE`, em batch de escrita. A chave de conta `id=1` impede cadastros múltiplos. Sessões, expirações e limites de tentativas ficam no Turso, compartilhados entre instâncias. A reserva de tentativa é atômica antes de verificar senha. A sessão só é criada se o hash validado ainda for o atual; mudar a senha e invalidar sessões é uma transação. Cookies HTTPS têm `Secure`, `HttpOnly` e `SameSite=Strict`; escritas autenticadas exigem CSRF.

No aplicativo, **Fazer backup** baixa JSON com registros e configurações, sem senha, cookie ou sessões. **Exportar CSV** gera o histórico filtrado para leitura, não para restauração. Guarde os arquivos fora do deployment.

**Restaurar backup substitui todos os registros do destino** e as configurações presentes no arquivo. Faça backup antes e confirme o banco de destino. A API valida o arquivo inteiro antes da escrita e aplica exclusão, inserções e configurações em uma transação; falhas causam rollback. Não importe dados locais ou de outro banco sem autorização. Migração entre local e nuvem é manual por JSON, nunca automática.

Erros retornam mensagens genéricas e os logs remotos não imprimem objetos de transporte que possam conter segredos. As implementações de persistência permanecem separadas para preservar o fluxo SQLite; o contrato HTTP é testado em ambas, evitando uma refatoração extensa.

## Checklist de produção — aguardar aprovação expressa

- [ ] PR revisado, merge e publicação expressamente aprovados.
- [ ] Criar `meu-ponto-pi2-prod` como libSQL, sem copiar dados de outro banco.
- [ ] Configurar URL e token próprios somente em Production.
- [ ] Conferir repositório vinculado e branch de produção `main`.
- [ ] Inicializar a conta sob condições controladas: o primeiro visitante de uma base vazia pode cadastrá-la.
- [ ] Publicar com HTTPS e validar autenticação, CSRF e cookies.
- [ ] Conferir conta e registros após redeploy; testar backup e recuperação com dados fictícios.
- [ ] Manter a demonstração sem dados pessoais reais e monitorar limites gratuitos.

Não existe banco de produção criado por este fluxo de Preview. O deployment atribuído automaticamente a Production no primeiro uso da CLI foi contido e removido, e não existe versão Production ativa; consulte [VALIDACAO-PREVIEW.md](VALIDACAO-PREVIEW.md). Merge, credenciais Production e publicação de produção são etapas posteriores sujeitas à autorização.

Referências: [Vite na Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Functions Node.js](https://vercel.com/docs/functions/runtimes/node-js), [rewrites](https://vercel.com/docs/rewrites), [Turso](https://docs.turso.tech/quickstart), [transações libSQL](https://tursodatabase.github.io/libsql-client-ts/interfaces/Client.html).
