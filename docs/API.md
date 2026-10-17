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
| `users` | a própria conta; técnicos veem todas (sem e-mail: use `/api/ti/usuarios`) | **ninguém** (só admin do TI pela rota `/api/ti/usuarios`) | só a própria senha | superusuário |
| `setores`, `categorias` | todos | superusuário (setor: admin do TI por `/api/ti/setores`) | idem | superusuário |

### Abrir chamado (multipart)

`POST /api/collections/chamados/records` com `categoria`, `impacto` (`so_eu`|`setor`|`publico`), `descricao`,
e até 5 arquivos em `anexos` (imagem ou vídeo, 250 MB cada).

O hook (`pb_hooks/chamados.pb.js`) completa o resto:
- **servidor**: solicitante = quem está logado, origem `sistema`, prioridade pelo impacto (`so_eu` → normal, `setor` → alta, `publico` → urgente);
- **técnico** (registro de pedido de fora): manda também `solicitante` (id) ou `solicitante_nome`, `origem`
  (`whatsapp`|`ligacao`|`presencial`) e pode mandar `status: "resolvido"` com `diagnostico` e `solucao`;
- sempre: protocolo `AAAA-NNNNN`, setor do solicitante, `ficticio` copiado do solicitante, linha do tempo e aviso ntfy.

### Mudar status (técnico)

`PATCH /api/collections/chamados/records/{id}` com `{ "status": "em_andamento" }` ou
`{ "status": "resolvido", "diagnostico": "...", "solucao": "..." }` (os dois são obrigatórios para resolver).
O hook marca horários, define o responsável e registra a mudança na linha do tempo.

### Comentar

`POST /api/collections/interacoes/records` com `{ chamado, texto, interno }` (JSON) ou multipart com até 4 imagens em `anexos`
(15 MB cada). A mensagem pode ser só imagem. `interno: true` só o TI vê.

## Rotas próprias (`backend/pb_hooks`)

| Método | Rota | Quem | Faz |
|---|---|---|---|
| GET | `/api/fila/minhas-posicoes` | usuário | posição na fila de cada chamado aberto do usuário |
| POST | `/api/chamados/{id}/confirmar` | solicitante do chamado | confirma que o problema foi resolvido |
| POST | `/api/chamados/{id}/reabrir` | solicitante do chamado | `{ motivo }` volta o chamado para a fila |
| GET | `/api/chamados/semelhantes?categoria=ID` | usuário | chamados em aberto da mesma categoria no setor (evita duplicado) |
| GET | `/api/painel/resumo?dias=30` | técnico | indicadores do painel |
| GET | `/api/sistema/info` | qualquer logado | `ambiente` (teste/producao), ntfy/SMTP ligados e totais, inclusive fictícios |
| GET | `/api/ti/usuarios?q=&papel=&setor=&ocultar_teste=1&pagina=1&por_pagina=25` | técnico | lista pessoas (matrícula, e-mail, setor e ramal do setor), paginada no banco (`por_pagina=0` = todos) → `{ itens, total, pagina, por_pagina }` |
| POST | `/api/ti/usuarios` | **admin do TI** | `{ nome, matricula, setor?, papel?, admin?, email?, ramal? }` → `{ usuario, senha_provisoria }` (a pessoa troca no 1º acesso) |
| PATCH | `/api/ti/usuarios/{id}` | **admin do TI** | `{ nome?, matricula?, email?, setor?, ramal?, papel?, admin?, bloqueado? }` → `{ usuario }`. Sempre sobra 1 admin ativo; ninguém tira o próprio admin |
| POST | `/api/ti/usuarios/{id}/senha` | **admin do TI** | gera nova senha provisória e marca `trocar_senha` → `{ usuario, senha_provisoria }` |
| GET | `/api/ti/setores` | técnico | todos os setores com `pessoas` (quantas contas) → `{ itens }` |
| POST | `/api/ti/setores` | **admin do TI** | `{ nome, predio?, ramal? }`; se o nome já existe, devolve o existente (`criado: false`) |
| PATCH | `/api/ti/setores/{id}` | **admin do TI** | `{ nome?, predio?, ramal?, ativo? }` (setor inativo some da escolha; não se apaga) |

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
