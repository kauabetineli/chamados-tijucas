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
  e ganhar HTTPS (melhoria pós-piloto). **Limitação conhecida:** sem HTTPS, senha e conversa passam sem criptografia
  na rede interna. Aceito para o piloto; registrar na AC4 e decidir com o Departamento de TI.
- **Limite de tentativas de login** (migration 0011): 10 por minuto por endereço de rede; depois, o servidor responde 429
  ("Muitas tentativas seguidas. Espere um minuto"). O próprio PC servidor (127.0.0.1) fica de fora (ferramentas, painel).
  Se um dia todos acessarem por um proxy (um IP só), revise em Settings > Rate limits.
- **Protocolo sem repetir** (migration 0012): o número sai da tabela `dd_contadores` numa instrução só (soma e devolve).
  Antes era "último + 1" em dois passos, e dois chamados no mesmo instante podiam colidir no índice único.

## Modelo de dados

| Coleção | Campos principais | Quem vê / altera |
|---|---|---|
| `users` (auth) | name, matricula (login, única), email (opcional), setor, papel (`solicitante`/`tecnico`), admin, ramal (próprio, opcional), trocar_senha, bloqueado | cada um vê a si; técnicos veem todos. Só o admin do TI cria e edita (rotas `/api/ti/usuarios`); a pessoa só troca a própria senha |
| `setores` | nome, predio, ramal, ativo | leitura pública; criação e edição pelo admin do TI (`/api/ti/setores`) |
| `categorias` | nome, icone (nome Lucide, lista em `components/Icone.tsx`), ordem, ativa, sugestoes (≤ 6), dicas, protegida ("Outro") | leitura para logados; criação e edição pelo admin do TI (Configurações do TI > Categorias); não se apaga, oculta |
| `config_ti` | chave ("geral"), dados (ordem_fila, prazos, servidor_prioridade, teto_prioridade, pedir_motivo_urgente, marcar_escolhida, horario, destino_ausencia) | leitura para logados; edição pelo admin do TI |
| `automacao_versoes` | dados (fluxos, senao), autor, resumo | técnicos leem; versão nova só pela rota do admin. A mais nova vale |
| `chamados` | protocolo, descricao, categoria, solicitante / solicitante_nome, setor (é o lugar do chamado; `local` ficou só como legado), impacto, prioridade, peso, prazo_em, prazo_regra_min, ordem_fila, prioridade_escolhida, motivo_urgencia, regras_tempo, status (aberto/em_andamento/aguardando/resolvido), aguardando_motivo, aguardando_desde, origem, responsavel, registrado_por, anexos, diagnostico, solucao, confirmado, avaliacao (bom/ruim), avaliacao_comentario, iniciado_em, resolvido_em | solicitante vê os seus; técnicos veem e alteram todos |
| `interacoes` | chamado, autor, tipo (comentario/status/prioridade/atribuicao/sistema), texto, interno | solicitante vê a linha do tempo dos seus chamados, sem as notas internas |

## Regras de negócio (backend/pb_hooks)

- **Abertura pelo solicitante:** o servidor força `solicitante` = quem está logado, `origem` = sistema, `status` = aberto
  e calcula a prioridade pelo impacto (só eu → normal; setor → alta; atendimento ao público → urgente).
- **Registro pelo técnico:** exige quem pediu (conta ou nome digitado), guarda a origem (WhatsApp, ligação, presencial)
  e permite registrar já resolvido (causa e solução opcionais).
- **Protocolo:** `ANO-NNNNN`, sequencial por ano.
- **Fila:** a ordem é o número `ordem_fila` de cada chamado, calculado no servidor conforme Configurações do TI > Fila e
  atendimento: **pelo prazo** (padrão; `prazo_em` em segundos), **prioridade, depois chegada** ou **ordem de chegada**.
  `prazo_em` = abertura + prazo da prioridade (ou o de uma regra), contado só no horário de atendimento quando ele está ligado.
  Mudar a ordem, os prazos ou o horário recalcula todos os não resolvidos. Fila (`sort=ordem_fila,created`) e
  `/api/fila/minhas-posicoes` usam a mesma ordem.
- **Automação (Configurações do TI):** motor em `pb_hooks/lib/automacao.js`, só no servidor (a tela "Testar" chama
  `/api/ti/automacao/testar`, então mostra exatamente o que vai acontecer). A automação é feita de **fluxos independentes**
  (como jobs/DAGs): cada fluxo começa num **gatilho** (`novo`, `reaberto`, e os de tempo `sem_inicio`, `vencido`, `espera`,
  conferidos pelo cron a cada 5 min) e segue **blocos ligados**: perguntas (saídas Sim/Não) e ações. Um bloco roda depois de
  todos os que apontam para ele e só se alguma ligação que chega nele estiver ativa; ciclos são recusados ao salvar.
  Fluxos do mesmo gatilho rodam na ordem da lista. **Conflitos (regra fixa):** o primeiro fluxo que escolher uma pessoa
  disponível trava o responsável; na prioridade vale a maior; no prazo, o menor; avisos, respostas e notas somam.
  "Se nenhum fluxo escolher alguém" (só chamado novo): livre ou uma pessoa. Fluxo de tempo age uma vez por chamado (quando
  alguma ação dele rodou; guardado em `regras_tempo`). Pessoa ausente ou fora dos automáticos é pulada. Cada salvamento é
  uma versão (`automacao_versoes`), com histórico. Nada de regra fica no código. Editor: `features/configuracoes/fluxo/`
  (React Flow `@xyflow/react`, cores pelos tokens em `index.css`).
- **Ausências:** `users.ausente_de/ate` (o fim encerra sozinho), `sem_automatico`. O admin marca em Equipe e ausências;
  cada técnico marca a própria no Perfil. `destino_ausencia` decide se os chamados da pessoa ficam com ela ou voltam à fila.
- **Causa e solução são opcionais ao resolver** (desde 18/10/2026). Rotina que o TI já sabe resolver fecha sem texto;
  o técnico liga "Guardar causa e solução no Histórico" quando vale registrar, e aí os dois campos são obrigatórios na tela.
  O Histórico mostra por padrão só os que têm registro (caixa "Só os que têm causa e solução registradas"). Ele começa
  pela pergunta "Que tipo de problema?" (categorias com o número de soluções de cada uma) ou pela busca, em vez de uma
  lista longa; "Ver todos os resolvidos" abre a lista inteira. No cartão a solução vem em destaque e textos longos são
  encurtados (o chamado completo abre ao tocar). Datas de início e de resolução são preenchidas sozinhas (base dos indicadores).
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

## Contas criadas só pelo administrador do TI

Não existe "criar conta" público: se o sistema for para a internet, ninguém de fora se cadastra.
- **Administrador do TI** (`users.admin`, só para técnicos): na tela **Pessoas e setores** (`/ti/usuarios`) cria e edita
  setores (com o **ramal do setor**) e contas, gera senha provisória e bloqueia acesso. Os outros técnicos só consultam.
  O sistema nunca fica sem admin ativo: ninguém tira o próprio admin nem se bloqueia, e o último admin não pode ser removido.
  A migration `1760000007` promove o técnico mais antigo a admin, se não houver nenhum.
- **Login pela matrícula** (até 8 dígitos, única). O e-mail é opcional (nem todo servidor tem); quem tem pode entrar com ele
  e recebe os avisos por e-mail.
- **Senha provisória aleatória** (`k7Pm-x4Qz-9Rta`, sem caracteres que confundem), mostrada uma única vez, com bilhete
  para imprimir. No primeiro acesso a pessoa é **obrigada** a criar a própria senha (`users.trocar_senha`): o front mostra
  só a tela "Crie a sua senha" e o servidor recusa abrir chamado ou comentar até trocar. A senha nova não pode ser igual
  à provisória.
- **Bloquear** em vez de apagar (`users.bloqueado`): a pessoa não entra mais, as sessões abertas caem e os chamados ficam
  no histórico. Setor também é desativado, não apagado.
- A própria pessoa só troca a senha: nome, setor, matrícula, papel e ramal são do admin (hook em `usuarios.pb.js`).

## Ver o chamado sem sair da lista

Clicar num chamado (Fila, Todos os chamados, Soluções, Meus chamados) abre o chamado **ao lado da lista**
(`components/PainelChamado.tsx`) em vez de trocar de página. O chamado aberto fica no endereço (`?ver=<id>`,
`lib/verChamado.tsx`), então o "voltar" fecha o painel. Ctrl+clique abre a página inteira.
- **PC: gaveta à direita** (600 px; a borda esquerda muda a largura, lembrada no aparelho). O conteúdo da página encolhe
  ao lado dela (`--largura-painel`, classe `.conteudo` em `index.css`), então nada fica por baixo. **↑ ↓ (ou K e J)**
  passam para o chamado de cima/de baixo da lista que está na tela (`chamadosNaTela()` lê os `data-ver-chamado` na ordem).
  Formato compacto (`DetalheChamado gaveta`): protocolo e situação no topo fixo, dados em duas colunas, ações do técnico
  numa linha (`PainelTecnico linha`) e abas **Conversa / Fotos e vídeos / Soluções parecidas**.
- **Celular:** folha quase da altura da tela que fecha arrastando para baixo (o layout de página, numa coluna).
Use `<LinkChamado id para>` em toda lista nova de chamados (é ele que marca `data-ver-chamado`).

A Fila tem colunas (Protocolo, Problema, Quem pediu, Setor, Esperando, Com) que aparecem **conforme a largura da lista**
(container queries `@2xl`…`@5xl`, não a largura da tela): com a gaveta aberta a lista fica estreita e volta ao formato
de cartão, sem rolar para o lado.

## Moldes de página (o espaço das telas largas)

Toda página é de um de 3 moldes (`lib/moldes.ts`, escolhido pela rota no Layout). É o que decide o que fazer com o
espaço que sobra num monitor largo, em vez de cada tela ter a sua largura (e um vazio à direita). Base: os "layouts
canônicos" do Material Design (lista e detalhe, painel de apoio, feed) e o limite de 50 a 75 caracteres por linha
para texto (Baymard).

- **Lista + detalhe** (Fila, Todos os chamados, Soluções, Pessoas e setores, Feedback): a lista ocupa o que sobra e,
  em **tela larga (1600 px+)**, o item escolhido fica **fixo à direita**. Nos chamados é a própria gaveta
  (`PainelChamado`), que deixa de abrir por cima; sem nada clicado ela mostra o padrão da página
  (`definirPadraoDoPainel`: Fila = seu próximo, Soluções = a mais recente). Em Pessoas e Feedback a janela
  (`PainelRapido fixo`) vira a coluna ao lado. Abaixo de 1600 px tudo funciona como antes.
- **Painel** (Painel, Automação): largura toda; a grade ganha colunas (números e piloto lado a lado, gráficos em 4).
- **Formulário com apoio** (o resto: Registrar, Novo chamado, Configurações, Perfil, telas do servidor): largura de
  leitura e **centralizado** na área; a coluna de apoio (Registrados hoje, O que ajuda o TI, prévia) fica ao lado.

Tela larga no CSS é a classe `larga:` (`--breakpoint-larga: 100rem` = 1600 px; em media query o rem vale 16 px) e
no código `useTelaLarga()`. Os dois usam o mesmo valor.

## Cabeçalho das páginas

Toda página começa com `CabecalhoPagina` (`components/CabecalhoPagina.tsx`): o título fica sempre na mesma altura,
ações à direita e abas sublinhadas embaixo (`AbasPagina`). A largura vem do molde da página (acima). Texto e ícones usam tamanhos inteiros (a base é 17 px: ver
o topo de `index.css`); vermelho só onde há algo a fazer (fora do prazo, Urgente).

## Barra lateral (TI), barra do topo (servidor) e Avisos do TI

No PC o **técnico** tem a **barra lateral** (`components/BarraLateral.tsx`): o botão **Registrar pedido** no topo e três
grupos, **Atendimento** (Fila com os subitens Comigo, Livres, Em espera e Fora do prazo; Todos os chamados), **Consulta**
(Soluções, Painel) e **Administração** (só o admin: Pessoas e setores, Configurações). A Fila mostra um número só; o
vermelho fica no subitem "Fora do prazo" (`/ti?filtro=prazo`). Em espera ganha um ponto azul quando alguém respondeu.
A pessoa **arrasta a borda direita** para mudar a largura (200–380 px, duplo clique volta ao padrão) e pode **recolher**
para só ícones. O **servidor** usa poucas telas: no PC tem uma **barra no topo** (`components/BarraTopo.tsx`) com Meus
chamados, Histórico, Novo chamado e o avatar, e o conteúdo ganha a largura toda (com avisos e "Como funciona" à direita).
No celular não há barra no topo, só a de baixo. Técnico: Fila, Registrar, Soluções e **Você**; servidor: Início,
Novo chamado (botão redondo no meio) e Você.

**Avisos do TI** (coleção `avisos`, migrations `1760000008` e `1760000016`): "Internet do Paço fora do ar, já estamos
vendo". Serve para o servidor não abrir 10 chamados do mesmo problema (problema 1 do diagnóstico). Na lateral é uma
linha só: **Avisar todos** abre modelos prontos (Internet fora do ar, Sistema parado, Impressoras, Manutenção programada
ou escrever outro) que já trazem texto e tipo; o trecho `[entre colchetes]` vem selecionado para completar, e o prazo é
um toque (1 h, 2 h, fim do dia, 3 dias, até encerrar). Com aviso no ar, a linha fica colorida com "some em…" e
"Resolvido, encerrar". No **Novo chamado** o servidor vê os avisos de problema ("O TI já sabe") e pode tocar em
**Também estou com esse problema** (`POST /api/avisos/{id}/tambem`): o TI vê o número na hora, em vez de dez chamados
repetidos. No celular o mural aparece no topo de Meus chamados e da Fila.

## Sua opinião (feedback do sistema)

Para a equipe do projeto (extensão) saber o que melhorar no piloto, sem misturar com os chamados ao TI: botão
**Sua opinião** no canto do PC (e item em Você no celular), com "Algo não funcionou / Tenho uma ideia / Quero elogiar",
nota de 1 a 5 opcional e a tela em que a pessoa estava. Depois de confirmar um chamado, no máximo uma vez a cada 30 dias,
um aviso rápido convida a dar nota. Grava em `feedbacks` por `POST /api/feedback`. Só quem tem `equipe_projeto = true`
em `users` (marcado pelo superusuário em `/_/`) vê a área **Feedback** (`/projeto/feedback`): contadores, filtros,
situação de cada item (novo, visto, resolvido, virou melhoria) e planilha CSV.

## Conversa do chamado

Mensagens e mudanças ficam juntas, com pesos diferentes (`components/LinhaDoTempo.tsx`): mudanças seguidas do mesmo dia
viram **uma linha fina** centralizada; mensagens são balões com o rosto de quem escreveu (o de quem pediu à esquerda, o
do TI à direita) e a data aparece uma vez por dia. O técnico tem o filtro **Só mensagens** e escolhe no campo **Para
<nome>** ou **Nota interna** (amarela, só o TI vê). Depois de abrir um chamado, o servidor vê a tela **Chamado enviado!**
com o Dino, a posição na fila e o que acontece em seguida.

## Tabela de Todos os chamados

Cada técnico ajusta a tabela do seu jeito (`components/Colunas.tsx`, guardado neste navegador): arrastar a borda do
título muda a largura (cada coluna tem um mínimo), duplo clique ajusta ao texto mais longo da tela, e o menu
**Colunas** mostra/esconde colunas (inclusive Setor separado), troca a densidade e tem "Voltar ao padrão".

## Jeito de aplicativo no celular

- Sem zoom de pinça na tela (`viewport` + `touch-action: pan-x pan-y`; no iPhone, `gesturestart` cancelado em
  `lib/jeitoDeApp.ts`). As fotos têm zoom próprio (Visualizador). Para quem enxerga pouco: **Meu perfil > Tamanho do texto**
  (Normal/Grande/Maior, `html[data-texto]`, tudo em rem). No PC o zoom do navegador continua.
- Sem "puxar para atualizar" nem efeito elástico (`overscroll-behavior: none`): o sistema já se atualiza em tempo real.
- Teclado encolhe a tela (`interactive-widget=resizes-content`) em vez de cobrir o botão de baixo.
  Com o teclado aberto (campo em foco + tela encolhida, `lib/teclado.ts`) a barra de baixo some, como no app nativo,
  e o campo focado é rolado para ficar acima do rodapé fixo de enviar (`html[data-teclado]` com `scroll-padding-bottom`).
  Na conversa, a rolagem leva também o botão Enviar à vista.
- Faixas que rolam para o lado usam a classe `sem-barra`; áreas internas têm barra fina na cor do tema.
- Enter do teclado: `enterKeyHint` ("Próximo", "Ir", "Buscar") e `irParaProximo` passa para o campo seguinte.
- Segurar botão/link/foto não abre o menu do navegador (só no toque). No PC, arrastar link/foto para outra aba continua
  (o TI usa para ver anexos maiores).

## Conta só de leitura (observador)

`users.papel = "observador"` é a conta da equipe do Dino Desk (estudantes da extensão) para acompanhar o piloto.
Decisão do grupo: vê **tudo** o que o TI vê, inclusive notas internas, e o TI da Prefeitura enxerga essas contas.

- **Servidor:** regras de leitura com `(papel = "tecnico" || papel = "observador")` (migration 1760000019);
  criar chamado ou mensagem recusa `papel = "observador"`; rotas GET do TI usam `R.veComoTI`, as de escrita
  continuam `R.ehTecnico`/`R.ehAdmin`. Cria a conta o superusuário ou um admin do TI que também tem `equipe_projeto`
  (`R.geraObservador`; no front, `geraObservador`); o admin do TI da Prefeitura só bloqueia ou desbloqueia
  (não edita nem troca a senha). Não entra na Equipe, na divisão automática, nas cargas nem nos avisos.
- **Front:** `veComoTI(usuario)` decide o que se VÊ (rotas e menus do TI); `ehTecnico` decide o que se FAZ.
  Na Fila: sem "Comigo", "Seu próximo", "Em espera", atribuir, "⋮" e arrastar; "Com a equipe" já vem aberto.
  No chamado: painel do técnico travado (`<fieldset disabled>`) e, no lugar da caixa de mensagem, "Conta só de
  leitura". Configurações: tudo travado. Barra lateral: selo "Só leitura" no lugar de "Registrar pedido".

## Vídeo pelo celular e modo de diagnóstico

No Android, gravar vídeo abre o app da câmera e o navegador pode descartar a aba para liberar memória; ao voltar,
a página recarrega do zero. Por isso o rascunho do chamado guarda o texto no `sessionStorage` e as fotos/vídeos no
IndexedDB (`lib/rascunhoAnexos.ts`, expira em 24 h, apagado ao enviar). Ao recarregar, aparece "Seu anexo foi recuperado."

Para investigar problema no celular sem cabo USB: abra qualquer página com `?diagnostico=1`. Aparece um console
flutuante (Eruda, carregado do jsDelivr: precisa de internet) com as linhas `[página]` (recarregou? foi para segundo
plano?), `[anexos]` (nome, tipo e tamanho do que chegou) e `[envio]` (início, resposta, queda). Fica ligado naquele
navegador até abrir com `?diagnostico=0` (`lib/diagnostico.ts`).

## Raias da Fila

Sem visão nem filtro, a Fila responde "o que eu faço agora?" e mostra pouco de uma vez (como o "Agora / Depois" do
Front e o botão Play do Zendesk), nesta ordem:
**Comigo** (em atendimento e reservados para você; "N em espera" vira uma linha recolhida no fim da mesma caixa),
**Seu próximo** (cartão com Começar e Passar à vista) e **Depois dele** (só os 3 primeiros livres, com "Pegar" ao
passar o mouse; "Ver os N livres" abre a visão Livres). "Com a equipe N" abre o que está com colegas.
As linhas não são tabela: ícone, problema e embaixo "quem pediu, setor" + protocolo pequeno; a espera à direita.
Sem coluna de dono onde ele é óbvio (Comigo = você, Livres = ninguém); o "⋮" aparece ao passar o mouse (no celular,
segurar o dedo na linha). A faixa da Equipe fica atrás do botão "Equipe" e aparece sozinha ao arrastar um chamado.

## Visões rápidas da Fila

`/ti?visao=atendendo|livres|espera` mostra só uma parte da Fila (os seus em atendimento, os livres na ordem da fila,
os seus em espera com "Resposta" primeiro). É a mesma tela, então voltar e salvar o link funcionam; `?ver=` continua
sendo o painel do chamado. Acesso: subitens de "Fila" na barra lateral (PC), abas no topo da Fila (celular) e, no
celular, tocar de novo no ícone Fila (a setinha indica) abre um menu com as visões. Visão e filtro por colega
(faixa Equipe) não se misturam: escolher um desliga o outro. Os números vêm de `lib/numeros.ts` (uma consulta só,
no Layout). Para o servidor, o "Meus chamados" mostra em destaque quantos chamados precisam dele (responder ou confirmar).

## Revisão de usabilidade (outubro de 2026)

Percorremos os fluxos do servidor (entrar, abrir, acompanhar, confirmar) e do técnico (pegar, atender, esperar,
resolver, registrar, criar contas) no celular e no PC. O que mudou e por quê:

- **O TI vê quando quem pediu responde.** A Fila marca "Nova mensagem" no chamado quando o solicitante escreveu depois
  da última vez que o técnico abriu (mesma lógica do "Nova resposta do TI" do servidor, `lib/visto.ts`). Antes o
  técnico só descobria a resposta abrindo o chamado.
- **Toda ação do painel do técnico confirma** com aviso rápido (começar, espera, devolver, resolver, reabrir,
  prioridade, responsável). Antes prioridade e responsável mudavam sem retorno nenhum.
- **"Começar" fica com quem tocou.** No chamado de um colega o botão vira "Assumir e começar" (antes começava
  "em andamento" no nome do colega).
- **Celular, página do chamado (TI):** o painel Atendimento vem logo depois dos dados; "Como chamados desse tipo foram
  resolvidos" desce para depois dele.
- **Senha com "Mostrar"** (`CampoSenha`): a senha provisória é digitada olhando o bilhete; sem ver, a pessoa erra.
- **Novo chamado, passo 2:** "Continuar" não fica apagado sem explicação; tocado sem descrição, diz o que falta e
  leva até a caixa.
- **Servidor precisa de setor:** criar conta de servidor sem setor gerava chamado sem lugar. Agora é obrigatório.
- **Coluna "Tempo"** na Fila (era "Espera", mas em atendimento conta desde o início).

## Sinais das listas (Fila, Todos os chamados, Meus chamados)

A Fila mostrava a mesma informação de vários jeitos (barra colorida + etiqueta de prioridade, fundo amarelo para "é meu",
etiqueta "atendendo" dentro da seção "Você está atendendo", "atrasado" em vermelho em quase todo chamado) e a mesma cor
com vários sentidos. A revisão (estudo com Linear, Freshdesk, Help Scout e os guias de status do Carbon, da NN/g e do
GOV.UK) trocou isso por **um sinal = um significado, sempre no mesmo lugar**:

- **Lista enxuta**: as linhas ficam numa superfície só, com divisórias. Cada linha: ícone da categoria à esquerda ·
  o PROBLEMA como título (a maior letra) · embaixo, onde e quem, com o protocolo por último · à direita, a espera e com quem
  está. No PC (lg+) setor, espera e "com quem" viram colunas alinhadas, com cabeçalho; no celular a ação abre segurando a linha.
- **Prioridade**: etiqueta SÓ para Urgente (vermelha cheia) e Alta (âmbar, `--color-ambar`). Normal e Baixa não aparecem
  nas listas: a ordem da fila já diz isso (`EtiquetaPrioridade`; `sempre` para colunas e menus). Quando quem pediu
  escolheu a prioridade (e o admin ligou "mostrar na Fila"), a própria etiqueta ganha um ícone de pessoa, com o motivo no
  `title`: não é um sinal novo, é um detalhe da prioridade.
- **Espera** (`components/Espera.tsx`): "há 3 h", neutro. Fora do prazo (`prazo_em`; `META_ESPERA_HORAS` só para chamado antigo sem prazo), o mesmo texto em vermelho com
  relógio, sem a palavra "atrasado". O total vira um filtro no topo da Fila ("3 fora do prazo").
- **Situação**: na Fila a seção já diz; nas listas misturadas, ícone + texto sem fundo (`SeloStatus`).
- **Com quem**: avatar; círculo tracejado = livre; "você" com anel azul.
- **Cores**: vermelho = ação agora (Urgente, fora do prazo); âmbar = Alta; azul = você e o que dá para tocar;
  verde = resolvido; amarelo forte (sol) só na "senha" da fila do servidor.
- **Cabeçalho curto no celular**: números numa linha, abas, a Equipe recolhida atrás do botão "Equipe" e os Avisos do TI
  numa linha só quando não há aviso.

## Em espera, avaliação, respostas prontas e números (piloto)

- **Em espera** (`status = "aguardando"`, migration 0009): o técnico não consegue avançar porque falta uma **peça**, uma
  **resposta de quem pediu** ou um **terceiro/fornecedor**. O chamado continua com ele (seção "Seus em espera" da Fila),
  mas sai da fila e da carga, para a equipe não achar que ele está ocupado. Para quem pediu, aparece como atendimento
  ("aguardando peça..."); quando o motivo é a resposta dele, a tela destaca "O TI precisa de uma resposta sua" e, ao
  responder, o chamado volta sozinho para "Em andamento". Evita o "fechar e abrir outro" que apagaria o histórico.
- **Avaliação**: ao confirmar que deu certo, a pessoa marca "Bom" ou "Poderia ser melhor" e pode comentar (opcional;
  "Só confirmar" pula). Vira o indicador de satisfação do Painel.
- **Respostas prontas** (coleção `respostas_prontas`): a equipe cria, corrige, reordena e apaga as frases pelo próprio
  sistema ("Editar" ao lado das respostas, nas ações rápidas e na conversa). Uma lista só para todos os técnicos.
- **Soluções parecidas**: no chamado aberto, o técnico vê como chamados resolvidos da mesma categoria foram resolvidos,
  os de descrição mais parecida primeiro (palavras em comum). É o histórico trabalhando para quem atende agora.
- **Painel**: aba "Equipe" com o bloco **Piloto** (% aberto pelo próprio servidor e satisfação) e "Resolvidos por técnico";
  aba "Meus números" com hoje, 7 dias, mês e o ano mês a mês (meses sem nada aparecem com zero). O admin do TI pode
  escolher outro técnico.
- **Registrar pedido** usa o mesmo desenho do Novo chamado no PC (uma coluna numerada, anexo no rodapé da caixa de texto,
  botão que gruda embaixo; peças em `components/FormularioPassos.tsx`) e mostra à direita o que o técnico registrou hoje.

## Fim do ciclo do chamado (novembro de 2026)

Ideias tiradas dos sistemas de chamados de mercado (fechamento automático, incidente-pai, macros), no tamanho do TI de Tijucas:

- **Resolvido sem resposta.** O chamado resolvido espera a confirmação de quem pediu. Se ninguém responde em
  `dias_confirmar` dias úteis (padrão 3; 0 = nunca; Configurações > Fila e atendimento), o cron dos fluxos de tempo
  (`lib/ciclo.js`, `confirmarSozinho`) marca `confirmado` e `confirmado_auto` e deixa uma mensagem automática.
  A tela de quem pediu mostra quantos dias faltam. Na satisfação do Painel, esses não contam como "confirmados por quem pediu".
- **Chamado parado não vira urgente sozinho.** Os fluxos de tempo (sem início, vencido) sobem a prioridade no
  máximo até `teto_tempo` (padrão Alta; Configurações > Fila e atendimento). Urgente fica para o impacto informado
  e para o TI: senão, com o tempo, quase tudo ficava vermelho e o sinal perdia o sentido.
- **Aviso que resolve os ligados.** No chamado, o técnico liga o pedido a um aviso de problema em vigor
  ("É este problema"). Ao encerrar o aviso ("Resolvido, encerrar"), pode resolver de uma vez todos os chamados ligados
  e publicar um aviso "resolvido" (verde, some em 4 h). Rota `POST /api/avisos/{id}/encerrar`.
- **Resposta pronta com ação.** Cada resposta pronta pode, ao ser enviada, pôr o chamado em espera (peça, resposta
  de quem pediu, terceiro) ou resolver. O chip "Ao enviar: …" aparece antes de mandar; "Só mandar" desfaz.
- **Contexto para o técnico.** Na gaveta: miniaturas das fotos logo abaixo da descrição e "Fulano abriu mais N chamados
  nos últimos 30 dias" (com o tipo mais comum), para notar problema que se repete.
- **Meta do piloto.** No Painel, a meta da AC2 (50% dos pedidos registrados no sistema) compara o total do período com
  a contagem manual da equipe, digitada ali e guardada só naquele navegador.

## Perfil

Clicar no próprio nome (topo) abre `/perfil`: dados que o TI cadastrou (matrícula, setor, ramal, e-mail),
números rápidos (do servidor: em aberto/resolvidos; do técnico: atendendo/resolvidos) e trocar a senha.
O servidor tem também a aba **Histórico** em Meus chamados, com busca, quem atendeu e a solução.

## O lugar do chamado é o setor

Não existe campo "local" na abertura: o lugar é o setor da conta de quem abre (e, no registro pelo TI, o setor
de quem pediu). O QR code virou um só para todos e apenas abre o formulário. O campo `local` continua no banco
só para não perder dados antigos; a interface não mostra nem preenche.

## Ramal, não celular

O **ramal é do setor** (cadastrado pelo admin do TI). Se a pessoa tiver um ramal diferente, o admin preenche o
"ramal próprio" dela, que tem preferência. O servidor não edita.
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
