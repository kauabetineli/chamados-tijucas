# API do Dino Desk

Base: `http://<servidor>/api` (no desenvolvimento, `http://127.0.0.1:8090/api`).
Autenticação: header `Authorization: <token>` (sem "Bearer"). Erros vêm como
`{ "status": 400, "message": "texto legível", "data": { "campo": { "code", "message" } } }`.

Quem é quem:
- **servidor**: usuário com `papel = "solicitante"` (ou vazio);
- **técnico**: usuário com `papel = "tecnico"`;
- **superusuário**: conta do painel `/_/` (só para administração e para as ferramentas de teste).

## Login

| Método | Rota | Corpo | Observação |
|---|---|---|---|
| POST | `/api/collections/users/auth-with-password` | `{ identity, password }` | `identity` = **matrícula** ou e-mail; devolve `{ token, record }`. Conta bloqueada → 403 |
| PATCH | `/api/collections/users/records/{id}` | `{ oldPassword, password, passwordConfirm }` | a própria pessoa troca a senha (zera `trocar_senha`; a sessão cai, entre de novo). Só a senha muda por aqui |
| POST | `/api/collections/_superusers/auth-with-password` | `{ identity, password }` | superusuário |
| POST | `/api/collections/users/impersonate/{id}` | `{ duration: 3600 }` | **só superusuário**: token de um usuário sem a senha dele (usado pelas ferramentas) |

## Coleções (API automática do PocketBase)

Padrão: `GET /api/collections/{c}/records?filter=...&sort=...&expand=...&page=1&perPage=50`,
`GET|PATCH|DELETE /api/collections/{c}/records/{id}`, `POST /api/collections/{c}/records` (JSON ou multipart).

| Coleção | Ver/listar | Criar | Editar | Apagar |
|---|---|---|---|---|
| `chamados` | o próprio solicitante; técnicos veem todos | qualquer logado | técnicos | superusuário |
| `interacoes` | solicitante vê as não internas do seu chamado; técnicos veem todas | logado (hook confere se pode) | ninguém | ninguém |
| `users` | a própria conta e as contas de técnicos (para o servidor, só nome, papel e setor; filtrar por matrícula, ramal etc. dá 403); técnicos veem todas (sem e-mail: use `/api/ti/usuarios`) | **ninguém** (só admin do TI pela rota `/api/ti/usuarios`) | só a própria senha | superusuário |
| `respostas_prontas` | técnicos (`sort=ordem,created`) | técnicos | técnicos | técnicos |
| `avisos` | qualquer logado (o front filtra `ate = "" \|\| ate > agora`) | técnico, com `autor` = ele mesmo | técnico (encerrar = `ate` vira agora) | ninguém |
| `setores` | todos | superusuário (admin do TI por `/api/ti/setores`) | idem | superusuário |
| `categorias` | todos | **admin do TI** (Configurações do TI > Categorias) | **admin do TI** (hook limpa `sugestoes` ≤ 6 e `dicas` ≤ 8; `protegida` = "Outro", sempre ativa) | ninguém (ocultar = `ativa: false`) |
| `config_ti` | logado (registro `chave = "geral"`, campo `dados`) | ninguém | **admin do TI** (o hook normaliza; se mudou ordem, prazos ou horário, recalcula `prazo_em`/`ordem_fila` de todos os não resolvidos) | ninguém |
| `automacao_versoes` | técnicos | só pela rota `POST /api/ti/automacao` | ninguém | ninguém |

### Abrir chamado (multipart)

`POST /api/collections/chamados/records` com `categoria`, `impacto` (`so_eu`|`setor`|`publico`), `descricao`,
e até 5 arquivos em `anexos` (imagem ou vídeo, 250 MB cada).

O hook (`pb_hooks/chamados.pb.js`) completa o resto:
- **servidor**: solicitante = quem está logado, origem `sistema`, prioridade pelo impacto (`so_eu` → normal, `setor` → alta, `publico` → urgente).
  Se `config_ti.servidor_prioridade` estiver ligado, aceita `prioridade` (não `baixa`) até `max(teto_prioridade, sugerida)`
  e marca `prioridade_escolhida`; subir para Urgente acima da sugerida exige `motivo_urgencia` quando `pedir_motivo_urgente` (400 sem ele);
- **técnico** (registro de pedido de fora): manda também `solicitante` (id) ou `solicitante_nome` (os dois podem faltar se vier `setor`), `origem`
  (`whatsapp`|`ligacao`|`presencial`) e pode mandar `status: "resolvido"` (com `diagnostico` e `solucao` opcionais);
- sempre: protocolo `AAAA-NNNNN`, setor do solicitante, `ficticio` copiado do solicitante, linha do tempo e aviso ntfy;
- automação (fluxos com gatilho "Chamado novo" de `automacao_versoes`, a versão mais nova): prioridade, prazo, responsável, avisos, resposta automática
  (comentário sem `autor`) e nota interna; depois `prazo_em` (em horário de atendimento, se ligado) e `ordem_fila`.

### Mudar status (técnico)

`PATCH /api/collections/chamados/records/{id}` com `{ "status": "em_andamento" }` ou
`{ "status": "resolvido", "diagnostico": "...", "solucao": "..." }` (os dois são OPCIONAIS: só `{ "status": "resolvido" }` também resolve; preenchidos, vão para o Histórico e as soluções parecidas).
O hook marca horários, define o responsável e registra a mudança na linha do tempo.

**Em espera:** `{ "status": "aguardando", "aguardando_motivo": "peca" | "solicitante" | "terceiro" }` (motivo obrigatório; 400 sem ele).
O hook grava `aguardando_desde`; o chamado continua com o responsável, mas sai da fila e da carga dele.
Com motivo `solicitante`, quem pediu é avisado e, quando ele comenta, o chamado volta sozinho para `em_andamento`.
Qualquer outro status limpa o motivo. De `aguardando` dá para retomar (`em_andamento`) ou resolver direto.

### Comentar

`POST /api/collections/interacoes/records` com `{ chamado, texto, interno }` (JSON) ou multipart com até 4 imagens em `anexos`
(15 MB cada). A mensagem pode ser só imagem. `interno: true` só o TI vê.

## Rotas próprias (`backend/pb_hooks`)

| Método | Rota | Quem | Faz |
|---|---|---|---|
| GET | `/api/fila/minhas-posicoes` | usuário | posição na fila de cada chamado aberto do usuário (pela `ordem_fila`) |
| POST | `/api/chamados/{id}/confirmar` | solicitante do chamado | confirma que o problema foi resolvido; opcional `{ avaliacao: "bom"\|"ruim", comentario }` (avaliação do atendimento, vai para a linha do tempo) |
| POST | `/api/chamados/{id}/reabrir` | solicitante do chamado | `{ motivo }` volta o chamado para a fila e roda os fluxos "Chamado reaberto" da automação |
| GET | `/api/chamados/semelhantes?categoria=ID` | usuário | chamados em aberto da mesma categoria no setor (evita duplicado) |
| GET | `/api/painel/resumo?dias=30` | técnico | indicadores do painel: totais, tempos, por origem/categoria/setor/dia/técnico, `agora` (aberto, em_andamento, aguardando) e `avaliacao` (bom, ruim, confirmados) |
| GET | `/api/painel/tecnico?ano=2026&tecnico=ID` | técnico (outro técnico: só **admin do TI**) | "Meus números": `hoje`, `semana` (7 dias), `mes` (cada um `{ resolvidos, horas_media, iniciados, bom, ruim }`), `agora`, `anos` e `por_mes` com os 12 meses (zerados inclusive). Datas no fuso de Brasília |
| GET | `/api/chamados/{id}/solucoes-parecidas` | técnico | até 5 resolvidos da mesma categoria com solução, os de descrição mais parecida primeiro → `{ total, itens: [{ id, protocolo, descricao, diagnostico, solucao, resolvido_em }] }` |
| POST | `/api/feedback` | usuário | "Sua opinião" sobre o SISTEMA (não é chamado): `{ tipo: "problema"\|"ideia"\|"elogio"\|"nota", texto, tela?, nota? (0–5) }`. O servidor grava quem, papel, setor e `ficticio`; até 30 por pessoa por dia. Só contas com `equipe_projeto` leem (coleção `feedbacks`) |
| POST | `/api/avisos/{id}/tambem` | usuário | "Também estou com esse problema" num aviso do TI em vigor → `{ total, eu: true }` (tocar de novo não conta duas vezes) |
| DELETE | `/api/avisos/{id}/tambem` | usuário | desfaz → `{ total, eu: false }`. Nos avisos, todos recebem `tambem_total` e `tambem_eu`; a lista `tambem` (quem tocou) só o TI recebe |
| GET | `/api/sistema/info` | qualquer logado | `ambiente` (teste/producao), ntfy/SMTP ligados e totais, inclusive fictícios |
| GET | `/api/ti/usuarios?q=&papel=&setor=&ocultar_teste=1&pagina=1&por_pagina=25` | técnico | lista pessoas (matrícula, e-mail, setor e ramal do setor), paginada no banco (`por_pagina=0` = todos) → `{ itens, total, pagina, por_pagina }` |
| POST | `/api/ti/usuarios` | **admin do TI** | `{ nome, matricula, setor?, papel?, admin?, email?, ramal? }` → `{ usuario, senha_provisoria }` (a pessoa troca no 1º acesso) |
| PATCH | `/api/ti/usuarios/{id}` | **admin do TI** | `{ nome?, matricula?, email?, setor?, ramal?, papel?, admin?, bloqueado? }` → `{ usuario }`. Sempre sobra 1 admin ativo; ninguém tira o próprio admin |
| POST | `/api/ti/usuarios/{id}/senha` | **admin do TI** | gera nova senha provisória e marca `trocar_senha` → `{ usuario, senha_provisoria }` |
| GET | `/api/ti/setores` | técnico | todos os setores com `pessoas` (quantas contas) → `{ itens }` |
| POST | `/api/ti/setores` | **admin do TI** | `{ nome, predio?, ramal? }`; se o nome já existe, devolve o existente (`criado: false`) |
| PATCH | `/api/ti/setores/{id}` | **admin do TI** | `{ nome?, predio?, ramal?, ativo? }` (setor inativo some da escolha; não se apaga) |
| GET | `/api/ti/automacao` | técnico | fluxos em vigor → `{ versao, dados: { fluxos, senao }, historico: [{ id, quando, autor, resumo }] }` (15 últimas). Formato de um fluxo: topo de `backend/pb_hooks/lib/automacao.js` |
| POST | `/api/ti/automacao` | **admin do TI** | `{ dados, resumo, base }` cria uma versão nova (o servidor limpa os fluxos e recusa ciclos ou ação que não vale para o gatilho, 400). `base` = versão aberta na tela; se outra pessoa salvou depois, 400 |
| POST | `/api/ti/automacao/testar` | técnico | `{ dados, gatilho, chamado: { categoria, setor, impacto, prioridade, origem, texto, anexo, horario, responsavel }, giro }` → `{ gatilho, prioridade, prioridade_antes, prazo_min, pessoa, pessoa_nome, regra, giro_regra, devolver, efeitos, fluxos: { [id]: { status: { [bloco]: sim/nao/ignorada }, ativas: [ligação] } }, traco, conflitos, erros }` (roda todos os fluxos ligados do gatilho; nada é salvo) |
| POST | `/api/ti/automacao/rodar-tempo` | superusuário | roda os fluxos de tempo agora (o cron `automacao-tempo` roda a cada 5 min) → `{ aplicadas }` |
| GET | `/api/ti/equipe` | técnico | técnicos com `carga`, ausência (`ausente_de`, `ausente_ate`, `ausencia_motivo`, `ausente_hoje`), `sem_automatico`, `disponivel` → `{ equipe, destino_ausencia }` |
| PATCH | `/api/ti/equipe/{id}` | **admin do TI**, ou o próprio técnico (menos `sem_automatico`) | `{ ausente_de?, ausente_ate? ("AAAA-MM-DD" ou ""), ausencia_motivo?, sem_automatico? }` → `{ ok, devolvidos, ausente_hoje }`. Com `destino_ausencia = "fila"`, ficar ausente hoje devolve os chamados abertos da pessoa para a fila |

Somente o **superusuário** pode mandar `ficticio: true` ou `senha` fixa em `/api/ti/usuarios`; em produção o servidor recusa fictício.
Senha provisória: aleatória em 3 blocos (`k7Pm-x4Qz-9Rta`), mostrada uma única vez. Enquanto `trocar_senha = true`,
o servidor recusa abrir chamado e comentar.

## Exemplo rápido (curl)

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:8090/api/collections/users/auth-with-password \
  -H 'content-type: application/json' -d '{"identity":"12345","password":"..."}' | jq -r .token)

curl -s -X POST http://127.0.0.1:8090/api/ti/usuarios -H "Authorization: $TOKEN" \
  -H 'content-type: application/json' -d '{"nome":"Maria Souza","matricula":"23456","papel":"solicitante"}'
```

Para gerar dados de teste em volume, **não** monte chamadas na mão: use `ferramentas/` (ver `docs/FERRAMENTAS-IA.md`).

## Paginação

Listas grandes buscam **só a página pedida** no banco: `GET /api/collections/{c}/records?page=2&perPage=25`
(o front usa `src/lib/paginar.ts` e o componente `Paginacao`, com 10/25/50/100/Todos por página, lembrando a escolha no aparelho).
A Fila do TI é a exceção: carrega todos os chamados em aberto (precisa deles para numerar a posição e contar a carga da equipe)
e só pagina a exibição.
