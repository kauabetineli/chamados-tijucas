# AGENTS.md — manual para assistentes de IA

Manual para qualquer agente de código (Claude Code, Cursor, Copilot, Codex...) trabalhar no **Dino Desk**.
Humanos também podem ler: é o resumo mais curto do projeto.

## O que é

Sistema de chamados do Departamento de TI da Prefeitura de Tijucas-SC, feito por estudantes da UNIVALI
(projeto de extensão). Servidores abrem chamados pelo celular ou PC; 3 técnicos atendem numa fila única,
registram pedidos de WhatsApp/ligação/corredor e fecham o chamado, com causa + solução opcionais (quando preenchidas, viram histórico).
Público: gente que **não é de TI**. Tudo em **português do Brasil**.

## Mapa do código

```
backend/                     PocketBase 0.40.4 (um executável + SQLite)
  pb_migrations/             esquema do banco, em ordem numérica. NUNCA edite uma que já foi para a main: crie outra.
  pb_hooks/
    chamados.pb.js           abrir/atualizar chamado, comentários (protocolo, prioridade, histórico, avisos)
    rotas.pb.js              /api/fila, /api/chamados/{id}/confirmar|reabrir|solucoes-parecidas, /api/painel/resumo|tecnico, /api/chamados/semelhantes
    automacao.pb.js          Configurações do TI: /api/ti/automacao(/testar), /api/ti/equipe, config_ti, cron dos fluxos de tempo
    usuarios.pb.js           /api/sistema/info, /api/ti/usuarios, /api/ti/setores; protege o campo "ficticio"
    videos.pb.js             cron que comprime vídeos com ffmpeg
    feedback.pb.js           "Sua opinião": POST /api/feedback (só a equipe do projeto lê)
    avisos.pb.js             "Também estou com esse problema" nos avisos do TI (/api/avisos/{id}/tambem)
    lib/                     regras.js, automacao.js (motor dos fluxos e da fila), avisos.js (ntfy), config.js, usuarios.js, videos.js
  config.json                (fora do Git) ambiente, ntfy. Modelo: config.exemplo.json
frontend/src/                React 19 + Vite + TypeScript + Tailwind v4 (tokens em index.css)
  pages/                     telas do servidor (MeusChamados, NovoChamado, Chamado)
  pages/ti/                  telas do TI (Fila, TodosChamados = tabela com filtros, Registrar, Historico = "Soluções", Painel, Usuarios, QrCodes)
  pages/projeto/             Feedback do sistema (só contas com equipe_projeto)
  features/novo-chamado/     abertura de chamado em ETAPAS modulares (etapas.tsx); celular = passo a passo, PC = painel
  features/configuracoes/    Configurações do TI (só admin, /ti/configuracoes): Automação (editor de fluxos em fluxo/, React Flow), Equipe, Categorias, Fila e atendimento
  components/                peças reutilizadas (CabecalhoPagina, Layout, BarraLateral, BarraTopo, PainelChamado = gaveta do chamado, MuralAvisos, Colunas, Opiniao...)
  lib/pb.ts                  cliente PocketBase, TIPOS das coleções, mensagemErro()
ferramentas/                 CLI + servidor MCP para gerar dados de teste e operar o sistema (ver abaixo)
scripts/                     PowerShell de instalação/backup/atualização no PC servidor (ASCII + CRLF)
docs/                        ARQUITETURA, API, FERRAMENTAS-IA, IMPLANTACAO, DADOS-TESTE, BACKLOG
```

## Branches (o que está em produção e o que está em desenvolvimento)

- `main` = **produção**: só o que está (ou vai agora) instalado no PC do Setor de TI. Não se desenvolve direto nela.
- `develop` = **desenvolvimento**: todo trabalho novo entra aqui (commits direto ou branches curtas saindo dela).
- Para instalar: merge da `develop` na `main` → `scripts\gerar-pacote.ps1` (só gera na `main` limpa e grava o commit
  em `VERSAO.txt` dentro do zip) → instala → tag `prod-AAAA-MM-DD` no commit instalado. A última tag `prod-*` é o que
  roda na Prefeitura. Correção urgente em produção: commit na `main`, gera o pacote e depois merge da `main` na `develop`.

## Comandos

```bash
# Windows, tudo de uma vez (instala, sobe PocketBase + front, abre o navegador; rodar de novo = reiniciar)
iniciar.bat            # parar.bat para parar
iniciar-tudo.bat       # o mesmo + PocketBase na rede + app nativo (Expo) de ..\dinodesk-nativo
reiniciar.bat          # reinicia os dois sem abrir outra aba; "reiniciar.bat backend" ou "reiniciar.bat front" para um só
# backend (Linux/macOS: ./pocketbase; Windows: .\pocketbase.exe)
cd backend && ./pocketbase serve                       # http://127.0.0.1:8090  admin: /_/
# front com recarga
cd frontend && npm install && npm run dev               # http://localhost:5173 (proxy para 8090)
# checagem obrigatória antes de entregar mudança no front
cd frontend && npm run build                            # tsc + vite; saída em backend/pb_public
# ferramentas de dados de teste
cd ferramentas && npm install && node dino.mjs ajuda
```

Banco descartável para testar sem sujar o seu: `./pocketbase serve --dir /tmp/pb_teste`
(e `./pocketbase superuser upsert admin@local.dev SenhaForte123 --dir /tmp/pb_teste` antes).
Com `--dir` fora de `backend/`, passe também `--hooksDir ./pb_hooks --migrationsDir ./pb_migrations`.

## Ferramentas para IA (use em vez de escrever scripts avulsos)

Servidor MCP `dino-desk` (configurado em `.mcp.json`) e CLI `node ferramentas/dino.mjs` com as MESMAS operações.
Credenciais do superusuário em `ferramentas/.env`. Primeira vez: `cd ferramentas && npm install && node configurar.mjs`
(cria `.env`, `.mcp.json` e a skill a partir de `ferramentas/modelos/`).

| Pedido do humano | Ferramenta MCP | CLI |
|---|---|---|
| "como está o sistema?" | `info` | `info` |
| "cria 15 usuários de teste" | `criar_usuarios_ficticios` | `usuarios:ficticios --quantidade 15 --tecnicos 2` |
| "cria a conta da Maria do RH" (REAL) | `criar_usuario` com `ficticio: false` | `usuario:criar --nome ... --matricula 12345 --setor RH --real` |
| "abre um chamado de impressora com foto" | `abrir_chamado` | `chamado:abrir --categoria Impressora --fotos 1` |
| "enche o sistema para eu ver as telas" | `popular` | `popular --chamados 30` |
| "simula o movimento" | `simular_rodadas` | `simular --minutos 10` (contínuo) |
| "resolve o 2026-00012" | `atender_chamado` | `chamado:atender --chamado 2026-00012 --acao resolver` |
| "apaga os dados de teste" | `limpar_ficticios` (`confirmar: true`) | `limpar --confirmar` |

Receita detalhada: `.claude/skills/dados-de-teste/SKILL.md`. Rotas HTTP: `docs/API.md`.

## Regras de ouro

1. **Dado fictício** (`ficticio = true` em users e chamados, e-mail `@teste.dinodesk`) é o ÚNICO tipo de dado que você
   gera para teste. Ele não dispara ntfy nem e-mail, aparece com a etiqueta "Teste" e `limpar` apaga tudo de uma vez.
   O servidor recusa dado fictício quando `config.json` tem `"ambiente": "producao"` (o instalador marca isso). Não contorne.
2. Conta **real** só quando o humano pedir explicitamente uma pessoa real. Mostre a senha provisória devolvida.
3. Mudou o banco? **Migration nova** em `backend/pb_migrations` (`<timestamp>_descricao.js`) com `migrate(up, down)`.
4. Hooks do PocketBase (JSVM/goja): `require(`${__hooks}/lib/x.js`)` **dentro** do handler, nunca no topo.
   Não há `async`/`fetch`: use `$http.send`, `$os`, `$security`, `$dbx`. Filtros com parâmetros: `"campo = {:v}", { v }`.
5. No Windows o PocketBase **não recarrega** `pb_hooks` sozinho: depois de editar, `reiniciar.bat backend`.
6. Tailwind v4: depois de criar arquivos novos com classes novas, o `npm run dev` aberto pode não gerar as classes: `reiniciar.bat front`.
7. Interface: frases curtas, voz ativa, sem jargão ("chamado", não "ticket"). Mobile first; alvo de toque >= 48 px.
   **Voz com o servidor**: o sistema fala como o Setor de TI, na 1ª pessoa do plural ("Recebemos o seu chamado",
   "Precisamos de uma resposta sua", "Atendemos na ordem da fila"), também nos e-mails. Rótulos que só dizem quem é
   quem continuam com "TI" ("Avisos do TI", "Escreva para o TI", "Mensagem do TI"). Nas telas do TI não se usa "nós".
8. Sem HTTPS (o servidor é um PC na rede, acessado por IP): nada de PWA, push, câmera via getUserMedia ou clipboard garantido.
   Foto/vídeo pelo celular usam `<input type="file" capture>`.
9. Segredos fora do Git: `backend/config.json`, `ferramentas/.env`, `backend/pb_data/`. O tópico do ntfy é segredo.
10. Antes de dizer que terminou uma mudança no front: `npm run build` sem erros.
11. **Toda tela nasce com tema claro E escuro.** Use só os tokens de cor (lista no topo de `frontend/src/index.css`):
    `bg-fundo` (página), `bg-superficie` (cartões/campos), `text-tinta` / `text-tinta-2`, `border-linha` / `ring-linha`,
    `text-acento` / `ring-acento` (destaque e links), `text-ok`, `text-alerta`, fundos suaves `bg-mar-50`, `bg-campo-50`,
    `bg-brasa-50`, `bg-sol-50`, preenchimentos de botão `bg-mar-700` / `bg-campo-700` com `text-white`, e `bg-noite` /
    `text-noite` para escuro fixo. Nunca `bg-white`, `bg-black`, `text-black`, `text-mar-700` ou hexadecimal no componente.
    O `npm run build` roda `scripts/verificar-tema.mjs` e **falha** se achar cor fixa. Exceção consciente: comentário
    `tema-fixo` na linha (ou até 2 acima). Confira a tela nos dois temas (botão de tema no topo, ou o tema do aparelho).
12. **Confirmação de ação = aviso rápido**: `avisar("2026-00012 agora está com Hugo.")` (`frontend/src/lib/avisos.ts`).
    Some sozinho no canto da tela, sem botão para fechar obrigatório. Não crie faixas de aviso fixas na página.
    Erro de formulário continua perto do campo (`role="alert"`); erro de ação rápida: `avisar(msg, { tipo: "erro" })`.
    Mudança simples e reversível (prioridade, começar, pôr em espera): aviso com **Desfazer** (`acao`). O que tira o chamado
    de alguém ou passa para outra pessoa (passar, devolver, deixar livre, reabrir): **confirmação** numa faixa dentro do painel
    (ver `PainelTecnico.tsx`), sem janela por cima.
13. **Página nova começa com `CabecalhoPagina`** (abas sublinhadas com `AbasPagina`) e **escolhe um dos 3 moldes**
    em `lib/moldes.ts`: *lista* (lista + detalhe fixo ao lado em tela larga), *painel* (largura toda, grade que ganha
    colunas) ou *formulário* (largura de leitura, centralizado). A largura vem do Layout: não ponha `max-w`/`mx-auto`
    no contêiner da página. Tela larga = classe `larga:` (1600 px) e `useTelaLarga()`.
    **Seta de voltar** (`voltar` no `CabecalhoPagina`) só em página que fica dentro de outra (Você → Painel, Painel →
    QR code); nunca nas abas da barra de baixo nem em Todos os chamados. Por padrão só no celular; `sempre: true` quando
    nem no PC há outro caminho de volta.
14. **Ajuda que a maioria não precisa ler vai num "i"**, não em texto fixo embaixo do campo: `RotuloComDica` /
    `Dica` (`components/Dica.tsx`), com `aria-describedby={idDaDica(id)}` no campo. Erro e aviso continuam visíveis na tela.
15. **Carregando = esqueleto**, nunca só o texto "Carregando...": use `components/Esqueleto.tsx` (`EsqueletoCartoes`,
    `EsqueletoLinhas`, `EsqueletoTabela`, `EsqueletoChamado`, `EsqueletoConversa` ou `Bloco` para montar um novo)
    no formato do que vai aparecer. Números que ainda não chegaram não aparecem como "0".
16. **Sinais das listas**: um sinal = um significado (docs/ARQUITETURA.md, "Sinais das listas"). Prioridade só com
    `EtiquetaPrioridade` (aparece para Urgente e Alta), espera com `Espera`, situação com `SeloStatus`, "teste" com
    `MarcaTeste`. Não crie pílula nova nem use cor de prioridade para outra coisa.

15. **Celular**: escolher entre poucas opções com ícone (pessoa, prioridade) = `components/Escolha.tsx`: no PC é uma
    lista logo abaixo da pílula; no celular vira uma FOLHA que sobe de baixo, acima da barra de navegação. Janelas
    (`PainelRapido`) também sobem de baixo no celular. Nada de linha inteira para um botão só: junte na faixa que já existe.

## Modelo de dados (resumo)

- `users` (auth): name, **matricula** (login, até 8 dígitos, única), email (opcional), setor → setores,
  papel (`solicitante` | `tecnico` | `observador` = equipe do Dino Desk, vê tudo o que o TI vê e não muda nada; só o superusuário cria), admin (admin do TI), ramal (próprio, opcional), trocar_senha, bloqueado, ficticio,
  ausente_de/ausente_ate/ausencia_motivo e sem_automatico (técnicos; só o TI vê), equipe_projeto (vê o Feedback do sistema; só o superusuário marca).
  **Não há cadastro público**: só o admin do TI cria contas (`POST /api/ti/usuarios`); a pessoa só troca a própria senha.
  O PocketBase ESCONDE o e-mail de outros usuários; o TI usa `GET /api/ti/usuarios`. O servidor vê as contas de técnicos
  (nome do responsável e de quem respondeu), sem matrícula, ramal e marcas internas (hook `onRecordEnrich` em usuarios.pb.js).
- `setores`: nome, predio, ramal (do setor), ativo (desativar em vez de apagar). `categorias`: nome, icone (lucide, lista em
  `components/Icone.tsx`; aparece em quadrado colorido pelo `IconeApp.tsx`, com desenho próprio nas 8 iniciais), ordem, ativa, sugestoes, dicas, protegida ("Outro"). Tudo editável pelo admin do TI.
- `config_ti` (registro "geral"): ordem da fila, prazos por prioridade, prioridade escolhida pelo servidor, horário, destino
  das ausências. `automacao_versoes`: fluxos da automação (a versão mais nova vale). **Nada disso fica chumbado no código:**
  leia com `lib/configTI.ts` (front) ou `lib/automacao.js` (hooks).
- `chamados`: protocolo (2026-00001), descricao, categoria, solicitante | solicitante_nome, setor (o lugar do chamado; `local` é legado e não é usado),
  impacto (`so_eu`|`setor`|`publico`) → prioridade (`normal`|`alta`|`urgente`, `baixa` só pelo TI), peso,
  prazo_em, ordem_fila (a Fila ordena por `ordem_fila,created`), prioridade_escolhida, motivo_urgencia,
  status (`aberto`|`em_andamento`|`aguardando`|`resolvido`), aguardando_motivo (`peca`|`solicitante`|`terceiro`), aguardando_desde, origem (`sistema`|`whatsapp`|`ligacao`|`presencial`),
  responsavel, registrado_por, anexos (até 5, 250 MB), diagnostico, solucao, confirmado, avaliacao (`bom`|`ruim`), avaliacao_comentario,
  midia_pendente, ficticio, confirmado_auto (confirmado sozinho após `dias_confirmar` dias úteis), aviso (→ avisos: chamado ligado a um problema geral). "aguardando" = em espera: continua com o responsável, fora da fila e da carga.
- `avisos`: mural "Avisos do TI" (texto, tipo `info`|`problema`|`resolvido`, ate = some sozinho depois, autor). Técnico publica e
  encerra (encerrar = `ate` vira agora; não se apaga). Aparece na barra lateral (PC) e no topo de Meus chamados/Fila (celular).
  `tambem` = quem tocou em "Também estou com esse problema" (só o TI vê a lista; todos recebem `tambem_total`/`tambem_eu`).
- `feedbacks`: "Sua opinião" sobre o sistema (tipo, texto, tela, nota, imagem = print opcional, papel, setor, situacao). Grava só por `POST /api/feedback`;
  só usuários com `equipe_projeto = true` (marcado pelo superusuário em `/_/`) leem e mudam a situação.
- `respostas_prontas`: texto, ordem, acao (opcional: ao enviar, põe em espera ou resolve). Frases do TI, editáveis por qualquer técnico (só o TI lê).
- `interacoes`: chamado, autor (vazio = mensagem automática de uma regra), tipo (`comentario`|`status`|`prioridade`|`atribuicao`|`sistema`), texto, interno,
  anexos (até 4 imagens por mensagem; mensagem pode ser só imagem).

Detalhes e o porquê das decisões: `docs/ARQUITETURA.md`.
