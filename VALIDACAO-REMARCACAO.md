# Correção de entrada após exclusão auditada

Uma jornada excluída deixava sua evidência original em `marcacoes_servidor`, como previsto pela auditoria. Ao tentar registrar outra entrada no mesmo dia, a chave `(data,campo)` dessa evidência era tratada como duplicidade da jornada atual. O resultado era HTTP 409, sem nova projeção em Minha Jornada. A causa foi confirmada por consultas somente de leitura à produção e reproduzida com dados fictícios em banco descartável.

A correção preserva a primeira evidência e acrescenta cada nova marcação em `registro_auditoria`, com o estado anterior/posterior e o instante do servidor. A projeção atual é gravada normalmente após uma exclusão ou restauração que tenha removido o campo. Não há migração de schema, remoção de auditoria, mudança de payload ou restauração automática de registros excluídos.

No libSQL, leitura, validação e escrita agora participam da mesma transação de escrita. Duas requisições concorrentes não podem confirmar a mesma etapa. SQLite já utilizava transação. O intervalo mínimo consulta também as marcações novas da auditoria; a continuação noturna usa a última entrada automática, preservando a regra existente de 20 horas. Falha na auditoria desfaz a projeção e libera a transação. Restrições internas inesperadas deixam de ser rotuladas genericamente como duplicidade.

## Validação

- Build e diff check aprovados; 15 unitários, 58 cloud/libSQL e 33 SQLite.
- 8 casos com `@libsql/client/web` contra um daemon sqld local descartável, usando HTTP real. Comando: `MEU_PONTO_TEST_HTTP_DB=http://127.0.0.1:18089 npm run test:cloud:http`. A suíte aceita somente loopback HTTP e exige banco novo e descartável.
- Regressões: excluir jornada e registrar outra entrada; excluir pausa e remarcar; intervalo a partir da marcação nova; duas entradas simultâneas; restauração sem a jornada; rollback em erro; jornada noturna após uma entrada antiga excluída.
- Playwright integra a interface à API/SQLite temporário: excluir pelo diálogo, registrar novamente, conferir HTTP 201, Minha Jornada, reload e histórico original preservado. A captura do cenário acompanha os artefatos E2E da CI.
- Não foram feitas marcações fictícias, exclusões, restaurações, mudanças de sessão ou correções manuais no banco de produção. As tentativas do usuário produziram o 409 observado nos logs; a inspeção do banco utilizou apenas SELECTs de esquema e indicadores de existência.

Autenticação, CSRF, horários definidos pelo servidor, snapshot da jornada prevista e interface Apple Light permanecem com seus contratos existentes. A suíte HTTP local verifica o protocolo/driver, sem equivaler a teste de escrita na rede Turso de produção.
