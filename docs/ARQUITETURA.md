# Arquitetura e decisões

## Por que PocketBase + React

Critérios que decidiram a stack, em ordem de peso:

1. **Quem mantém depois:** o grupo sai em dezembro de 2026. Ficam 3 técnicos de suporte, não desenvolvedores.
   O sistema precisa ser um executável e uma pasta, com painel administrativo pronto
   (cadastrar setores, categorias, promover técnicos, configurar e-mail, backup) sem escrever código.
2. **Prazo:** cerca de 3 semanas de desenvolvimento (até 31/10).
3. **Onde roda:** um PC Windows da Prefeitura, acessado pelo IP na rede interna. Sem Docker, sem PHP.
4. **Dados ficam na Prefeitura** (LGPD): nada de banco em nuvem.

Alternativas avaliadas: React + FastAPI + PostgreSQL (duas linguagens e um banco para manter; painel admin à mão),
Next.js full-stack (mais peças e curva maior para o prazo), Laravel + Filament (exige PHP no grupo e no servidor),
Supabase/Firebase (dados fora da Prefeitura), GLPI/osTicket prontos (complexos para 3 pessoas, não são mobile first,
e o objetivo da AC2 é desenvolver).

Riscos aceitos: o PocketBase ainda é pré-1.0 (versão fixada em 0.40.4 e não atualizada durante o projeto);
SQLite atende com folga o volume esperado (dezenas de chamados por dia).

## Rede e acesso

```
QR code / link  →  site da Prefeitura (/dinodesk, página estática)  →  http://IP-do-PC-servidor  →  PocketBase
```

- O PC servidor fica na rede interna; só abre para quem está no Wi-Fi ou na rede da Prefeitura.
- Sem HTTPS (acesso por IP): o sistema funciona no navegador do celular, a câmera abre pelo campo de anexo,
  mas **não** dá para instalar como app (PWA) nem receber notificação push. Os avisos vão por e-mail.
- Se o TI conseguir um subdomínio do domínio da Prefeitura apontando para o IP interno, dá para emitir um certificado
  e ganhar HTTPS (melhoria pós-piloto).

## Modelo de dados

| Coleção | Campos principais | Quem vê / altera |
|---|---|---|
| `users` (auth) | name, email, setor, papel (`solicitante`/`tecnico`), ramal (da sala, cadastrado pelo TI) | cada um vê a si; técnicos veem todos. Ninguém se promove a técnico (só pelo painel admin) |
| `setores` | nome, predio, ativo | leitura pública (tela de cadastro); edição só no painel admin |
| `categorias` | nome, icone, ordem, ativa | leitura para logados; edição só no painel admin |
| `chamados` | protocolo, descricao, categoria, solicitante / solicitante_nome, setor (é o lugar do chamado; `local` ficou só como legado), impacto, prioridade, peso, status, origem, responsavel, registrado_por, anexos, diagnostico, solucao, confirmado, iniciado_em, resolvido_em | solicitante vê os seus; técnicos veem e alteram todos |
| `interacoes` | chamado, autor, tipo (comentario/status/prioridade/atribuicao/sistema), texto, interno | solicitante vê a linha do tempo dos seus chamados, sem as notas internas |

## Regras de negócio (backend/pb_hooks)

- **Abertura pelo solicitante:** o servidor força `solicitante` = quem está logado, `origem` = sistema, `status` = aberto
  e calcula a prioridade pelo impacto (só eu → normal; setor → alta; atendimento ao público → urgente).
- **Registro pelo técnico:** exige quem pediu (conta ou nome digitado), guarda a origem (WhatsApp, ligação, presencial)
  e permite registrar já resolvido, desde que com causa e solução.
- **Protocolo:** `ANO-NNNNN`, sequencial por ano.
- **Fila:** ordem = maior prioridade primeiro, depois quem abriu antes. A posição é calculada em `/api/fila/minhas-posicoes`.
- **Resolver exige causa e solução.** Datas de início e de resolução são preenchidas sozinhas (base dos indicadores).
- **Solicitante confirma ou reabre** (`/api/chamados/{id}/confirmar` e `/reabrir`).
- **Toda mudança vira registro** na linha do tempo; e-mail para o solicitante quando o atendimento começa, quando é resolvido
  e quando o TI responde (só se o SMTP estiver configurado no painel).
- **Vídeos:** até 250 MB por arquivo. A cada minuto, o servidor converte os vídeos novos para MP4 H.264 com no máximo
  1280 px (ffmpeg em `backend\bin`). Abrem em qualquer navegador (inclusive o HEVC do iPhone) e ficam cerca de 10x menores.
- **Avisos aos técnicos** pelo ntfy (app de notificação): chamado novo, mensagem do solicitante e reabertura.
  Funciona sem HTTPS porque quem entrega no celular é o servidor do ntfy. Tópico em `backend/config.json`
  (fora do Git); a mensagem leva só protocolo, categoria, setor e prioridade.
- **Indicadores** em `/api/painel/resumo`: total, resolvidos, tempo médio até começar e até resolver, por origem,
  categoria, setor e dia. O painel também exporta a planilha (CSV) do período: evidência para a AC4.

## Dados fictícios e ferramentas de IA

Para testar sem cadastro manual, `ferramentas/` tem uma CLI e um servidor MCP (Model Context Protocol)
que operam o sistema pela API, agindo "como" cada pessoa através da personificação do PocketBase. Assim os dados de
teste passam pelas mesmas regras dos hooks que o uso real. Tudo o que geram leva `ficticio = true`
(campo em `users` e `chamados`, migration `1760000003_ficticio.js`):

- não dispara ntfy nem e-mail (`pb_hooks/lib/avisos.js` e `regras.js`);
- aparece com a etiqueta "Teste" na interface;
- é apagado de uma vez por `limpar`;
- é **recusado pelo servidor** quando `config.json` diz `"ambiente": "producao"` (o instalador grava isso).

Só o superusuário consegue marcar uma conta como fictícia; um chamado herda a marca do solicitante e ela não muda depois.
Guia de uso: `docs/FERRAMENTAS-IA.md`. Manual para agentes: `AGENTS.md`.

## Contas criadas pelo TI

A tela **Usuários** (`/ti/usuarios`) usa rotas próprias (`pb_hooks/usuarios.pb.js`) porque o PocketBase esconde o
e-mail de outros usuários e não deixa um usuário comum criar contas de outro papel. O técnico cria a conta e recebe uma
senha provisória (`Dino` + 6 números, fácil de ditar por telefone), mostrada uma única vez; o mesmo vale para "Nova senha".

## O lugar do chamado é o setor

Não existe campo "local" na abertura: o lugar é o setor da conta de quem abre (e, no registro pelo TI, o setor
de quem pediu). O QR code virou um só para todos e apenas abre o formulário. O campo `local` continua no banco
só para não perder dados antigos; a interface não mostra nem preenche.

## Ramal, não celular

O cadastro guarda só o **ramal da sala**, preenchido pelo TI na tela Usuários (o servidor não edita).
Não há campo de celular nem atalho para ligar ou chamar no WhatsApp: o contato pessoal dos técnicos por WhatsApp
é um dos problemas do diagnóstico, e a conversa sobre o chamado acontece dentro do sistema.

## Desempenho

- **Banco (SQLite):** medido com 20 mil chamados, as consultas das telas levam de 0,04 s a 0,2 s, inclusive busca e
  página 400. Índices em `1760000000_esquema_inicial.js` (fila, solicitante, protocolo) e `1760000006_indices.js`
  (responsável, resolvidos, data, setor, autor das mensagens, papel dos usuários).
- **Paginação no banco:** as listas pedem só a página (`page`/`perPage`), via `src/lib/paginar.ts`.
- **Limite de conexões do navegador:** em HTTP/1.1 o navegador abre no máximo 6 conexões por endereço, e o tempo
  real (SSE) prende uma por aba. Com 6+ abas abertas, trocar de página levava 10–15 s esperando conexão livre.
  `src/lib/useRealtime.ts` solta a conexão da aba em segundo plano (após 5 s) e reconecta/recarrega ao voltar:
  o mesmo teste caiu para 0,2 s.
- **Cache curto:** categorias, setores e técnicos ficam 5 minutos na memória da aba (`src/lib/cache.ts`).
- **Cliques rápidos:** a tabela ignora respostas atrasadas de pedidos antigos e mantém a lista anterior,
  esmaecida, enquanto a nova página chega.
