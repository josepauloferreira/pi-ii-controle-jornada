# Evidências de validação do Preview

Validação em 17/10/2026, exclusivamente com dados fictícios. Produção e merge aguardam aprovação expressa.

## Código e testes locais

Revisão funcional: `dd43de5d1981f40d6f2c318b4fd389b98001a3cd`, branch `feat/deploy-vercel-turso`.

Ambiente de testes: Node.js 24.22.0. Dependências reinstaladas com `npm ci` na raiz e no backend. Ambos os lockfiles estão versionados.

| Verificação executada | Resultado |
| --- | --- |
| `npm run test:cloud` | 41 aprovados, 0 falhas |
| `npm --prefix backend test` | 17 aprovados, 0 falhas |
| `npm run build` | Aprovado, Vite 7.3.7, saída `dist` |
| `npm audit` na raiz e no backend | 0 vulnerabilidades em ambos |
| `git diff --check` | Aprovado |
| Varredura de padrões de credenciais nos arquivos candidatos | Nenhum padrão de chave privada, JWT ou token GitHub/Vercel encontrado |

Os testes abrem somente bancos temporários. Cobrem contrato HTTP em SQLite e libSQL; cadastro concorrente em clientes independentes; sessão compartilhada; teto de 8 tentativas sob 16 logins concorrentes; login interrompido por mudança de senha; persistência após reiniciar cliente/aplicação; rollback após falha SQL no meio do backup; expiração; respostas e logs sem detalhes privados. O handler `api/index.js` foi exercitado por HTTP com URL original e destino da rewrite, incluindo query parameters.

## Validação hospedada

Preview validado inicialmente: [pi-ii-controle-jornada-ann7hoj0i-ze17.vercel.app](https://pi-ii-controle-jornada-ann7hoj0i-ze17.vercel.app), deployment `dpl_Htq5WrmpkczZwoJMo96Pyz7ZGAwN`, **READY**, ambiente **Preview**, runtime Node.js **24.x**, revisão funcional acima.

A automação usou API HTTP e Chromium headless com Playwright, autenticados por OIDC limitado à origem do Preview. Não foi removida a proteção da Vercel. Credenciais não foram impressas nem versionadas.

**14 cenários hospedados aprovados, 0 falhas:**

1. Acesso anônimo bloqueado por redirecionamento HTTP 302 à autenticação Vercel; `/api/health` autenticado retorna 200 e `{"status":"ok"}`.
2. Cadastro concorrente inicial: um HTTP 200 e um 409; segundo cadastro bloqueado.
3. Login incorreto rejeitado, login correto e sessão em requisições sucessivas.
4. CSRF rejeitado sem token, horários inválidos e backup inválido rejeitados.
5. Criação, edição, extras, histórico e filtros de mês com query string preservada.
6. Configurações persistidas e restauração do snapshot dos próprios dados fictícios.
7. Frontend Vite carregado, login pelo navegador e sessão/dados após reload.
8. Edição `1830` → `18:30` e inclusão de batida extra pelo navegador.
9. Downloads CSV e JSON com conferência do conteúdo.
10. Exclusão e restauração pelo seletor de arquivo do navegador.
11. Mudança de senha pelo navegador invalida a sessão independente da API; novo login funciona.
12. Logout pelo navegador e pela API.
13. O nono login incorreto do mesmo usuário/IP recebe HTTP 429.
14. Nenhum erro inesperado de console ou HTTP 5xx no fluxo de navegação.

Consulta independente por `turso db shell meu-ponto-pi2-preview` confirmou uma conta e o registro fictício `2026-10-17`, entrada `08:30`, saída `18:30`, duas extras, além das configurações fictícias. Nenhum hash, cookie ou sessão foi consultado nessa conferência.

Os logs iniciais contiveram dois avisos de depreciação Node.js `DEP0169` sobre `url.parse()`, classificados pela plataforma como stderr/error. Não eram falhas das rotas: as respostas e a navegação passaram. O aplicativo usa `new URL` no handler; não foram ocultados warnings nem alteradas dependências externas para silenciá-los. Monitore esses avisos em atualizações do runtime/Express/Vercel.

## Configuração e incidente de destino automático

Projeto existente: **ze17/pi-ii-controle-jornada**, preset Vite, raiz do repositório, `npm ci`, `npm run build`, `dist`, Node.js 24.x, região configurada `iad1`. Git vinculado ao repositório correto, branch de produção `main`.

Vercel Authentication / Standard Protection foi confirmada **antes** de publicar. As variáveis efetivas `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` estão somente em Preview na branch autorizada; o token está como Secret. O banco é `meu-ponto-pi2-preview`, libSQL em `aws-us-east-1`. Tokens antigos foram invalidados. Não há credenciais Turso em Production.

A primeira chamada `vercel deploy --scope ze17` foi promovida automaticamente pela CLI a Production por ser o primeiro deployment do projeto, apesar de não usar `--prod`. Não recebeu variáveis Production nem acesso ao Turso. O destino Production foi imediatamente **pausado pela API oficial**: `paused=true`, `autoAssignCustomDomains=false`; o domínio de produção retornou HTTP **503** após a contenção. A publicação seguinte usou `--target preview` explícito e foi confirmada como Preview. A pausa também bloqueou novos builds de Preview; por isso, o deployment de Production criado nesta sessão foi removido após conferir ID, projeto e commit, e os builds foram liberados somente depois de confirmar que não restava nenhum deployment Production. Bancos, registros e previews foram preservados. Esse incidente não representa aprovação de produção e não houve merge. Não existe versão de produção ativa; sua publicação continua dependendo de autorização expressa.

## Operação e limites

A conta fictícia de Preview tem senha aleatória, preservada somente em arquivo local privado (modo 600) dentro de `.vercel/`, excluído de Git e dos uploads. Não reutilize essa conta ou senha em Production. Os dados de teste permanecem no banco de Preview; nenhum banco existente foi excluído.

O plano gratuito e os serviços externos precisam de acompanhamento. O projeto continua sendo demonstração acadêmica. A validação de uma instância não certifica carga, disponibilidade ou homologação legal. A inicialização de conta em produção requer condições controladas e credenciais/banco separados, conforme o checklist de [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md).
