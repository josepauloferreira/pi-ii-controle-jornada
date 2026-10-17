# Publicação e validação de produção

Registro de 17/10/2026. O responsável aprovou o merge e a publicação, e criou sua própria conta diretamente no aplicativo, escolhendo a senha sem compartilhá-la com a automação.

## Publicação

- **Endereço público:** https://pi-ii-controle-jornada.vercel.app
- **Projeto existente:** `ze17/pi-ii-controle-jornada`.
- **Branch de produção:** `main`.
- **Revisão da primeira publicação:** `a44af34066a44cdfe7169d7cc7652bce76ee20d7`, merge do [PR #27](https://github.com/josepauloferreira/pi-ii-controle-jornada/pull/27).
- **Deployment inicial:** `dpl_DqbMgT8BG1Bxktk6QXZjEwnoVxAY`, status `READY`, Node.js `24.x`, região configurada `iad1`.
- **Banco:** `meu-ponto-pi2-prod`, libSQL em `aws-us-east-1`, separado de `meu-ponto-pi2-preview`.

As variáveis `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` foram cadastradas exclusivamente em Production, com token próprio desse banco e expiração de 90 dias. Nenhuma conta, sessão, senha ou registro foi copiado do Preview. Segredos não foram impressos nem versionados.

## Inicialização controlada

O deployment foi criado com `--target production --skip-domain`. A URL gerada foi verificada como protegida por Vercel Authentication, enquanto o domínio principal permanecia indisponível. A API respondeu ao health e o navegador exibiu o formulário de cadastro sem erros de página.

Na primeira tentativa de promoção, a contagem ainda não mostrava uma conta e a sequência de comandos prosseguiu indevidamente. Os dois aliases públicos foram retirados imediatamente, preservando o deployment protegido e todos os dados. Depois, o banco confirmou uma conta e uma sessão; a API informou `cadastroDisponivel=false`. A promoção final foi executada somente após essas verificações passarem no mesmo processo.

O cadastro foi feito pelo responsável; a automação não criou conta fictícia em Production e não consultou a senha ou seu hash. O Preview continua separado e protegido.

O deploy automático da `main` está desabilitado em `vercel.json`. Assim, novos merges não publicam uma versão sem a etapa de deployment, validação e promoção descrita em [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md).

## Verificações executadas

| Verificação | Resultado |
| --- | --- |
| `npm run test:cloud` | 41 testes aprovados, 0 falhas, banco temporário. |
| `npm --prefix backend test` | 17 testes aprovados, 0 falhas, banco temporário. |
| `npm run build` | Aprovado, Vite 7.3.7, saída `dist`. |
| Dry run da configuração Vercel | Aprovado. |
| Frontend público | HTTPS 200. |
| `/api/health` público | HTTPS 200, `{"status":"ok"}`. |
| `/api/auth/status` | `cadastroDisponivel=false`. |
| `/api/registros` sem sessão | HTTP 401. |
| Novo cadastro depois da conta inicial | HTTP 409. |
| Conta e sessão no banco Production | Existência confirmada por contagem, sem consultar dados privados. |

A suíte de 14 cenários com login, CSRF, registros, histórico, extras, configurações, downloads e restauração foi executada no Preview com dados fictícios; os detalhes estão em [VALIDACAO-PREVIEW.md](VALIDACAO-PREVIEW.md). Esses testes não foram repetidos utilizando a senha pessoal do responsável ou seus dados na produção. Ensaios de restauração devem continuar em ambiente de testes.

## Operação

O banco remoto é a fonte dos dados de produção. Atualizações devem manter as mesmas variáveis Production e seguir o fluxo de publicação controlada. O JSON de backup inclui registros e configurações, sem credenciais ou sessões; a restauração substitui os dados do destino e exige cópia prévia e confirmação.

A demonstração deve usar apenas dados fictícios. Monitore consumo dos planos gratuitos, expiração dos tokens e avisos conhecidos do runtime. A hospedagem e os testes não constituem homologação legal nem garantia de disponibilidade contínua.
