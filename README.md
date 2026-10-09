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
| 3. Sem centralização | Abertura pelo sistema, QR code nas salas e **registro rápido** pelo técnico do que chega por outros canais |
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
  pages/ti/        telas do TI (Fila, Registrar, Historico, Painel, QrCodes)
  components/      peças reutilizadas (SenhaFila, LinhaDoTempo, PainelTecnico...)
  lib/             cliente do PocketBase, tipos, autenticação, formatação
redirecionamento/  página para o site da Prefeitura que leva ao servidor interno
scripts/           PowerShell: baixar, instalar no PC servidor, backup, pacote, atualizar
docs/              arquitetura, implantação e backlog
```

## Rodar no seu computador (Windows)

Pré-requisito: [Node.js 22+](https://nodejs.org).

```powershell
# 1. baixar o PocketBase (uma vez)
powershell -ExecutionPolicy Bypass -File scripts\baixar-pocketbase.ps1

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

Para testar como técnico: crie uma conta pelo sistema e, no painel admin, mude o campo `papel` dela para `tecnico`.
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
