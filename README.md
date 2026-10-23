# Dino Desk

Chamados do Departamento de TI da Prefeitura de Tijucas.

Sistema web de chamados do Departamento de TI da Prefeitura Municipal de Tijucas-SC. O nome junta o Dino,
mascote da cidade, com *desk*, o balcão de atendimento (como em Zendesk, Freshdesk e Movidesk).
Projeto Comunitário de Extensão Universitária (PCEU), Ciência da Computação, UNIVALI, 2026.

Os servidores abrem chamados pelo celular ou pelo computador e acompanham a **posição na fila**.
Os 3 técnicos do TI recebem tudo numa fila só, registram o que chega por WhatsApp, ligação ou corredor,
resolvem com causa e solução (que viram o **histórico**) e acompanham os indicadores no **painel**.

| Problema da AC2 | O que o sistema faz |
|---|---|
| 1. Solicitante espera resposta imediata porque não vê a fila | Senha com a posição na fila, status em 3 etapas, conversa com o TI, e-mail a cada mudança |
| 2. Sem fila nem prioridade | Fila única ordenada por prioridade e chegada; prioridade sugerida pelo impacto e ajustada pelo TI |
| 3. Sem centralização | Abertura pelo sistema, QR code colado perto dos computadores e **registro rápido** pelo técnico do que chega por outros canais |
| 4. Sem histórico | Resolver exige causa e solução; histórico pesquisável |

## Stack

| Parte | Tecnologia | Por quê |
|---|---|---|
| Backend | [PocketBase](https://pocketbase.io) 0.40.4 (um executável, SQLite) | Login, banco, arquivos, tempo real, regras de acesso e **painel admin prontos**. Roda num PC Windows sem instalar mais nada. Fácil de manter depois que o grupo sair. |
| Regras de negócio | Hooks em JavaScript (`backend/pb_hooks`) | Protocolo, posição na fila, fechamento exige solução, e-mails |
| Front | React + TypeScript + Vite + Tailwind CSS | Mobile first; o build vai para `backend/pb_public` e o próprio PocketBase serve |

Mais detalhes em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

## Estrutura

```
backend/
  pb_migrations/   coleções, campos e regras de acesso (versionadas)
  pb_hooks/        regras de negócio e rotas próprias (/api/fila, /api/painel...)
  pb_public/       front compilado (gerado pelo build, não vai pro Git)
  pb_data/         banco e arquivos (NUNCA vai pro Git)
frontend/src/
  pages/           telas do solicitante (MeusChamados, NovoChamado, Chamado)
  pages/ti/        telas do TI (Fila, Registrar, Historico, Painel, Usuarios, QrCodes)
  components/      peças reutilizadas (SenhaFila, LinhaDoTempo, PainelTecnico...)
  lib/             cliente do PocketBase, tipos, autenticação, formatação
ferramentas/       CLI e servidor MCP: dados de teste e operação do sistema por IA
redirecionamento/  página para o site da Prefeitura que leva ao servidor interno
scripts/           PowerShell: baixar, instalar no PC servidor, backup, pacote, atualizar
docs/              arquitetura, API, ferramentas de IA, implantação e backlog
AGENTS.md          manual para assistentes de IA (CLAUDE.md aponta para ele)
```

## Rodar no seu computador (Windows)

Pré-requisito: [Node.js 22+](https://nodejs.org).

### Jeito rápido: dois cliques em `iniciar.bat`

Na primeira vez ele instala as dependências, baixa o PocketBase e cria o superusuário de teste
(`admin@local.dev` / `SenhaForte123`). Depois abre duas janelas (PocketBase e front) e o navegador,
e mostra o endereço para abrir pelo celular.

- Editou `pb_hooks` ou criou migration? Rode `iniciar.bat` de novo: ele reinicia tudo.
- Para parar: `parar.bat` (ou feche as duas janelas).

### Tudo junto, com o app nativo: `iniciar-tudo.bat`

Faz o mesmo que o `iniciar.bat` e ainda abre o app nativo ([dinodesk-nativo](https://github.com/kauabetineli/dinodesk-nativo)),
que precisa estar clonado **ao lado** desta pasta (`C:\dev\chamados-tijucas` e `C:\dev\dinodesk-nativo`).
O PocketBase sobe ouvindo na rede (`0.0.0.0:8090`) para o celular alcançar, e uma terceira janela mostra o QR code
do Expo Go. O celular precisa estar no mesmo Wi-Fi do PC; se o Firewall perguntar, permita em "Redes privadas".
`parar.bat` para os três, e `reiniciar.bat backend` mantém o PocketBase na rede.

### Passo a passo manual (se preferir)

```powershell
# 1. baixar o PocketBase (uma vez)
powershell -ExecutionPolicy Bypass -File scripts\baixar-pocketbase.ps1

# 1b. opcional: ffmpeg, que comprime os vídeos enviados pelo celular
powershell -ExecutionPolicy Bypass -File scripts\baixar-ffmpeg.ps1

# 2. terminal 1: backend (cria o banco e aplica as migrations na primeira vez)
cd backend
.\pocketbase.exe superuser upsert admin@local.dev SenhaForte123
.\pocketbase.exe serve

# 3. terminal 2: front com recarga automática
cd frontend
npm install
npm run dev
```

- Sistema: http://localhost:5173 (pelo celular na mesma rede: `http://IP-do-seu-PC:5173`)
- Painel admin do PocketBase: http://127.0.0.1:8090/_/

Avisos no celular (opcional): copie `backend\config.exemplo.json` para `backend\config.json`, coloque o tópico do ntfy
e reinicie o PocketBase. Para o toque no aviso abrir o chamado, ajuste a URL em Settings > Application do painel admin.

Para testar como técnico: crie uma conta pelo sistema e, no painel admin, mude o campo `papel` dela para `tecnico`.
Depois disso, o próprio técnico cria contas na tela **Usuários**.

## Dados de teste e IA

O projeto vem pronto para uma IA trabalhar nele: [`AGENTS.md`](AGENTS.md) é o manual, e `ferramentas/` tem uma CLI e um
servidor MCP que criam usuários, abrem chamados com fotos e vídeos falsos, simulam o movimento da fila e apagam tudo depois.

```powershell
cd ferramentas; npm install; node configurar.mjs      # pergunta o superusuário e liga o MCP
node dino.mjs popular                                  # sistema cheio em segundos
```

Guia completo: [`docs/FERRAMENTAS-IA.md`](docs/FERRAMENTAS-IA.md). Rotas: [`docs/API.md`](docs/API.md).
Setores e categorias também são cadastrados pelo painel admin.

> No Windows o PocketBase **não** reinicia sozinho quando você edita `pb_hooks`. Pare (Ctrl+C) e rode `serve` de novo.

## Como trabalhar em grupo

- Uma branch por tarefa do [`docs/BACKLOG.md`](docs/BACKLOG.md), Pull Request para a `main`, alguém revisa.
- Mudou o banco? Crie uma **migration nova** em `backend/pb_migrations` (nunca edite uma que já foi para a `main`).
  Dá para criar pelo painel admin com o `serve` rodando: o PocketBase gera o arquivo da migration sozinho.
- Textos da interface: frases curtas, voz ativa, linguagem de quem não é de TI.
- Antes do PR: `npm run build` sem erros na pasta `frontend`.

## Implantação

Passo a passo para o PC servidor da Prefeitura em [`docs/IMPLANTACAO.md`](docs/IMPLANTACAO.md).
