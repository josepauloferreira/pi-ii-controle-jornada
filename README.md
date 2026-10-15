# Sistema de Controle de Jornada para Trabalho Remoto

Projeto Integrador em Computação II (PJI240) — UNIVESP, 2º semestre de 2026.

Protótipo de aplicação web para **uso individual** no registro e acompanhamento de jornadas em trabalho remoto. O projeto surgiu de uma necessidade identificada com a comunidade externa e evolui a partir da primeira interface entregue no Relatório Parcial.

> **Status: em desenvolvimento.** O sistema é um protótipo acadêmico, **não** um registrador eletrônico de ponto homologado ou uma solução com conformidade trabalhista comprovada. Não utilizar como único registro oficial de jornada nem publicar dados reais sem autorização e proteção de acesso.

## O que já existe

O arquivo [`Projeto-PI-Ponto.html`](./Projeto-PI-Ponto.html) reúne HTML, CSS e JavaScript, e pode ser aberto no navegador. Hoje ele utiliza **localStorage** (armazenamento apenas no navegador), não SQLite.

A interface já oferece: registro de entrada/intervalos/saída; batidas extras; resumo diário; configuração de jornada; histórico com edição e exclusão; exportação CSV; backup e restauração JSON. Essas funções precisam ser testadas durante a migração; a presença de uma tela não substitui teste.

**Importante:** antes de migrar ou testar dados existentes, gere um backup JSON pelo próprio protótipo. A aplicação migrada não deve apagar ou substituir silenciosamente registros antigos.

## Stack definida para a próxima etapa

| Camada | Escolha | Responsabilidade |
| --- | --- | --- |
| Frontend | Vite + JavaScript puro (Vanilla JS), HTML e CSS | Interface e interação com API |
| Backend | Node.js + Express | API HTTP, validação, regras e acesso a dados |
| Banco de dados | SQLite (driver Node a definir na implementação) | Persistir configurações, dias e batidas extras |
| Qualidade | Testes automatizados + GitHub Actions | Verificar regras, endpoints e build nas PRs |
| Versionamento | Git + GitHub | Issues, branches, revisão e integração |

**Vite não é um framework de interface nem um banco de dados.** Ele servirá à aplicação em JavaScript puro. O SQLite ficará no **servidor**, acessado somente pela API; o navegador não deve abrir o arquivo `.sqlite` diretamente.

## Arquitetura-alvo (ainda não implementada)

```text
navegador
   │  Vite / HTML / CSS / JavaScript
   ▼
frontend/          ← chama /api via HTTP/JSON
   │
   ▼
backend/           ← Node.js + Express (validação e persistência)
   │
   ▼
SQLite             ← arquivo local do servidor, fora do Git
```

Pastas previstas após os primeiros entregáveis:

```text
frontend/
  index.html
  src/
  package.json
backend/
  src/
  package.json
.github/
README.md
CONTRIBUTING.md
```

Esta é a **estrutura-alvo**, não a estrutura que já está na branch `main`. Evite criar módulos, camadas ou frameworks extras sem uma necessidade demonstrada.

### Execução

**Hoje:** abra `Projeto-PI-Ponto.html` no navegador. Os registros são exclusivos desse navegador e devem ser copiados com a funcionalidade de backup JSON.

**Após [E1](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues/1):** o frontend deverá iniciar a partir da pasta `frontend/` com `npm install` e `npm run dev`, e permitir `npm run build` (os comandos serão validados na PR correspondente).

**Após [E2](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues/2):** as instruções reais de iniciar a API e preparar o SQLite serão adicionadas nesta seção. Não há servidor ou banco configurado nesta versão.

## Contrato de dados de referência

Modelo **atual** do protótipo para um dia (a API deve manter compatibilidade ou documentar uma migração):

```json
{
  "entrada": "08:00",
  "saidaAlmoco": "12:00",
  "retornoAlmoco": "13:00",
  "saida": "17:00",
  "extras": [{ "horario": "18:00", "descricao": "Batida extra" }]
}
```

A data é representada por `AAAA-MM-DD` no horário local; os horários por `HH:mm`. Configurações atuais: `jornada` (`HH:mm`), `inicioSemana` (`"0"` ou `"1"`) e `nome` (texto). Os campos aceitam estados incompletos, que devem ser tratados explicitamente.

**Rotas propostas para E2** (sujeitas à validação nos testes e revisão da PR):

| Método | Rota | Propósito |
| --- | --- | --- |
| GET | `/api/health` | Verificar API |
| GET / PUT | `/api/configuracoes` | Consultar e atualizar configuração individual |
| GET | `/api/registros?mes=AAAA-MM` | Consultar histórico mensal |
| GET / PUT / DELETE | `/api/registros/:data` | Consultar, gravar e excluir registro diário |

Ao usar `PUT`, enviar o registro diário completo, inclusive batidas extras, evita proliferar endpoints sem necessidade. Os contratos finais e códigos de erro devem ser documentados em E2.

## Entregáveis e divisão de trabalho

Cada issue contém escopo, critérios de aceite e dependências. **Uma issue → uma branch → uma pull request revisável.** As dependências indicam ordem de integração, não a obrigação de todos trabalharem sequencialmente.

| Frente / entregável | Issue | Pré-requisitos |
| --- | --- | --- |
| Estruturar frontend com Vite | [E1 · #1](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues/1) | Nenhum |
| Criar API Express e SQLite | [E2 · #2](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues/2) | Nenhum (em paralelo com E1) |
| Isolar e testar cálculos | [E3 · #3](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues/3) | E1, preferencialmente |
| Integrar registro e preservar dados | [E4 · #5](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues/5) | E1 + E2 |
| Integrar histórico e batidas extras | [E5 · #6](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues/6) | E4 |
| Configurações e resumo | [E6 · #7](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues/7) | E2 + E3 + E4 |
| CSV e cópias JSON | [E7 · #11](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues/11) | E5 + E6 |
| Usabilidade e acessibilidade | [E8 · #8](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues/8) | E1; validar após integração |
| Build e testes em PRs (CI) | [E9 · #9](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues/9) | E1 + E2 |
| Feedback e evidências acadêmicas | [E10 · #4](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues/4) | Nenhum; começar já |
| Demonstração/hospedagem segura | [E11 · #10](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues/10) | E2 + E4 + E5 + E6 |

**Prioridade imediata:** E1 e E2, em paralelo; E10 desde já. E3 inicia depois que a estrutura de E1 estiver estável. E4 demonstra o primeiro fluxo completo navegando frontend → API → SQLite; depois integrar E5 e E6. E7/E8 e a preparação da demonstração fecham as entregas.

## Colaboração

Veja [CONTRIBUTING.md](./CONTRIBUTING.md) antes de começar. Fluxo mínimo:

1. Escolha uma issue **não atribuída**; comente o que fará e peça atribuição.
2. Crie uma branch a partir da `main` atualizada, por exemplo `feat/issue-5-registro-api`.
3. Altere apenas o escopo combinado; entregue código e os testes pertinentes.
4. Abra pull request vinculando a issue (`Closes #N`) com evidência de execução.
5. Aguarde revisão de outro integrante antes de fazer merge na `main`.

Evite trabalhar simultaneamente nas mesmas funções sem combinar antes. Não comite `node_modules/`, `.env`, arquivos `.sqlite` e seus arquivos auxiliares, nem cópias de dados reais de colaboradores.

## Critérios gerais de conclusão

Uma entrega só está pronta quando cumpre os critérios da issue, é verificável por outra pessoa, não quebra os fluxos anteriores e sua PR explica o que mudou, como testar e eventuais limitações. Marcar uma tarefa como concluída sem execução verificável não conta como entrega.

## Limites e decisões em aberto

- O produto é inicialmente **individual**, não um sistema multiempresa ou multiusuário.
- A hospedagem ainda não foi escolhida. SQLite em hospedagem sem disco persistente perde dados em reinícios ou deploys; verificar E11.
- O funcionamento **offline** é propriedade do protótipo atual com `localStorage`, não promessa da versão cliente-servidor. Preservar dados e definir o comportamento sem rede antes de remover o armazenamento antigo.
- Os registros podem ser editados/excluídos no protótipo. Isso não demonstra trilha de auditoria nem atendimento às exigências legais de ponto eletrônico.
- Casos ambíguos (batidas extras, jornada noturna, horários incompletos, ajustes manuais) serão validados com a comunidade antes de receber novas regras de negócio.

## Contexto acadêmico

O relatório parcial da equipe descreve a empresa participante e a primeira versão da interface. O Relatório Final da UNIVESP deve demonstrar a **solução inicial**, o **feedback da comunidade** e a **solução final**, com evidências reais. Acompanhamento na [E10 · #4](https://github.com/josepauloferreira/pi-ii-controle-jornada/issues/4). Documentos com identificadores pessoais, autorizações e depoimentos não devem ser publicados no repositório sem consentimento.

