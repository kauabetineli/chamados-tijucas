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
| `categorias` | nome, icone, ordem, ativa | leitura para logados; edição só no painel admin |
| `chamados` | protocolo, descricao, categoria, solicitante / solicitante_nome, setor (é o lugar do chamado; `local` ficou só como legado), impacto, prioridade, peso, status (aberto/em_andamento/aguardando/resolvido), aguardando_motivo, aguardando_desde, origem, responsavel, registrado_por, anexos, diagnostico, solucao, confirmado, avaliacao (bom/ruim), avaliacao_comentario, iniciado_em, resolvido_em | solicitante vê os seus; técnicos veem e alteram todos |
| `interacoes` | chamado, autor, tipo (comentario/status/prioridade/atribuicao/sistema), texto, interno | solicitante vê a linha do tempo dos seus chamados, sem as notas internas |

## Regras de negócio (backend/pb_hooks)

- **Abertura pelo solicitante:** o servidor força `solicitante` = quem está logado, `origem` = sistema, `status` = aberto
  e calcula a prioridade pelo impacto (só eu → normal; setor → alta; atendimento ao público → urgente).
- **Registro pelo técnico:** exige quem pediu (conta ou nome digitado), guarda a origem (WhatsApp, ligação, presencial)
  e permite registrar já resolvido (causa e solução opcionais).
- **Protocolo:** `ANO-NNNNN`, sequencial por ano.
- **Fila:** ordem = maior prioridade primeiro, depois quem abriu antes. A posição é calculada em `/api/fila/minhas-posicoes`.
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

Clicar num chamado (Fila, Todos os chamados, Histórico, Meus chamados) abre um **painel que sobe de baixo**
(`components/PainelChamado.tsx`) em vez de trocar de página, como no SoftDesk: dá para ir de um chamado a outro
com um clique. O chamado aberto fica no endereço (`?ver=<id>`, `lib/verChamado.tsx`), então o "voltar" do celular
fecha o painel. No PC a alça muda a altura (lembrada no aparelho) e a lista rola acima do painel; no celular é
uma folha quase da altura da tela que fecha arrastando para baixo. Ctrl+clique abre a página inteira.
Use `<LinkChamado id para>` em toda lista nova de chamados.

## Barra lateral e Avisos do TI

No PC o menu fica numa **barra lateral** (`components/BarraLateral.tsx`): ganha a altura que o topo ocupava (o painel
do chamado precisa dela) e mostra números ao vivo (Fila: aguardando e atrasados; servidor: em aberto). A pessoa
**arrasta a borda direita** para mudar a largura (200–380 px, duplo clique volta ao padrão; setas do teclado também),
e pode **recolher** para só ícones (começa recolhida em telas com menos de 1280 px). As duas escolhas ficam no aparelho.
A largura vai para `--largura-lateral`, usada pelo painel do chamado. No celular não há barra no topo: só a barra de baixo. Técnico: Fila, Registrar, Histórico e **Você** (o avatar;
lá dentro ficam Meus números, Painel, Pessoas e Configurações). Servidor: Meus chamados, Novo chamado e Você.

Na lateral fica o mural **Avisos do TI** (coleção `avisos`, migration `1760000008`): "Internet do Paço instável, já
estamos vendo". Serve para o servidor não abrir 10 chamados do mesmo problema (problema 1 do diagnóstico). O técnico
publica com prazo (1 h, 4 h, fim do dia, 3 dias ou até encerrar); o aviso some sozinho e fica registrado.
No celular o mural aparece no topo de Meus chamados e da Fila.

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

## Visões rápidas da Fila

`/ti?visao=atendendo|livres|espera` mostra só uma parte da Fila (os seus em atendimento, os livres na ordem da fila,
os seus em espera com "Resposta" primeiro). É a mesma tela, então voltar e salvar o link funcionam; `?ver=` continua
sendo o painel do chamado. Acesso: subitens de "Fila" na barra lateral (PC), abas no topo da Fila (celular) e, no
celular, tocar de novo no ícone Fila (a setinha indica) abre um menu com as visões. Visão e filtro por colega
(faixa Equipe) não se misturam: escolher um desliga o outro. Os números vêm de `lib/numeros.ts` (uma consulta só,
no Layout). Para o servidor, o "Meus chamados" mostra em destaque quantos chamados precisam dele (responder ou confirmar).

## Sinais das listas (Fila, Todos os chamados, Meus chamados)

A Fila mostrava a mesma informação de vários jeitos (barra colorida + etiqueta de prioridade, fundo amarelo para "é meu",
etiqueta "atendendo" dentro da seção "Você está atendendo", "atrasado" em vermelho em quase todo chamado) e a mesma cor
com vários sentidos. A revisão (estudo com Linear, Freshdesk, Help Scout e os guias de status do Carbon, da NN/g e do
GOV.UK) trocou isso por **um sinal = um significado, sempre no mesmo lugar**:

- **Lista enxuta**: as linhas ficam numa superfície só, com divisórias. Cada linha: ícone da categoria à esquerda ·
  o PROBLEMA como título (a maior letra) · embaixo, onde e quem, com o protocolo por último · à direita, a espera e com quem
  está. No PC (lg+) setor, espera e "com quem" viram colunas alinhadas, com cabeçalho; no celular a ação abre segurando a linha.
- **Prioridade**: etiqueta SÓ para Urgente (vermelha cheia) e Alta (âmbar, `--color-ambar`). Normal e Baixa não aparecem
  nas listas: a ordem da fila já diz isso (`EtiquetaPrioridade`; `sempre` para colunas e menus).
- **Espera** (`components/Espera.tsx`): "há 3 h", neutro. Fora do prazo (`META_ESPERA_HORAS`), o mesmo texto em vermelho com
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
