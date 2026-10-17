# Ferramentas para IA e dados de teste

O Dino Desk vem com um "kit" para uma IA (ou você, pelo terminal) operar o sistema sem decorar a API:
criar usuários e setores, abrir chamados com fotos e vídeos falsos, andar com eles na fila,
simular um dia de trabalho e apagar tudo depois.

É o mesmo padrão usado hoje no mercado para dar ferramentas a assistentes de IA:

| Peça | Arquivo | Para quê |
|---|---|---|
| Manual do projeto | `AGENTS.md` (+ `CLAUDE.md`) | O agente lê ao abrir o projeto: mapa do código, comandos, regras |
| Servidor MCP | `ferramentas/mcp.mjs` + `.mcp.json` | Ferramentas prontas que a IA chama (Model Context Protocol) |
| CLI | `ferramentas/dino.mjs` | As mesmas operações no terminal, para humanos, scripts e IAs sem MCP |
| Skill | `.claude/skills/dados-de-teste/SKILL.md` | Receita de quando e como usar cada ferramenta |
| Configurador | `ferramentas/configurar.mjs` | Cria `ferramentas/.env`, `.mcp.json` e a skill (modelos em `ferramentas/modelos/`) |
| Referência da API | `docs/API.md` | Rotas HTTP, permissões e exemplos |

## Instalar (uma vez)

Pré-requisito: Node.js 20 ou mais novo, e o PocketBase rodando.

```powershell
cd ferramentas
npm install
node configurar.mjs         # pergunta o e-mail e a senha do SUPERUSUÁRIO (o do painel /_/)
node dino.mjs info          # deve mostrar "ambiente": "teste" e os totais
```

## Usar pelo terminal

```powershell
node dino.mjs ajuda                                   # todos os comandos
node dino.mjs popular                                 # 10 servidores, 2 técnicos, 20 chamados em vários estados
node dino.mjs usuarios:ficticios --quantidade 30 --tecnicos 3
node dino.mjs chamado:abrir --categoria Impressora --impacto publico --fotos 2 --videos 1
node dino.mjs chamado:atender --chamado 2026-00012 --acao resolver
node dino.mjs simular --minutos 15 --intervalo 5      # fica gerando movimento; Ctrl+C para parar
node dino.mjs limpar                                  # mostra quanto apagaria
node dino.mjs limpar --confirmar                      # apaga todos os dados fictícios
```

Todos os usuários fictícios entram com a senha **`Teste@1234`**. Os e-mails aparecem no `popular`
e em `node dino.mjs usuarios --ficticios sim`.

Dica: deixe o `simular` rodando num terminal e abra o sistema como técnico em outro navegador.
A fila vai mudando sozinha, como num dia de trabalho.

## Usar com o Claude Code

Abra o Claude Code na pasta do projeto. Ele lê o `CLAUDE.md` e o `.mcp.json` e pergunta se pode ligar o servidor
`dino-desk`: aceite. Depois é só pedir em português, por exemplo:

- "Popula o sistema com 40 chamados, alguns com vídeo."
- "Cria 5 técnicos e 20 servidores de teste na Saúde e na Educação."
- "Simula 30 ações e me diz como ficou a fila."
- "Cria a conta real da Maria Souza, maria.souza@tijucas.sc.gov.br, setor Protocolo."
- "Apaga todos os dados de teste."

## Usar com o Claude Desktop (ou outro app com MCP)

No Claude Desktop: Configurações → Desenvolvedor → Editar configuração, e acrescente:

```json
{
  "mcpServers": {
    "dino-desk": {
      "command": "node",
      "args": ["C:\\dev\\chamados-tijucas\\ferramentas\\mcp.mjs"]
    }
  }
}
```

Reinicie o app. As credenciais vêm de `ferramentas\.env`.

## Ferramentas do servidor MCP

| Ferramenta | O que faz |
|---|---|
| `info` | ambiente, totais (e quantos são fictícios), se ntfy/e-mail estão ligados |
| `listar_setores`, `listar_categorias`, `listar_usuarios`, `listar_chamados` | consultas |
| `criar_setor` | cria setor (ou devolve o existente) |
| `criar_usuario` | fictício por padrão; `ficticio: false` cria conta real com senha provisória |
| `criar_usuarios_ficticios` | vários de uma vez, espalhados pelos setores |
| `abrir_chamado` | como um servidor, ou registro do TI (WhatsApp/ligação/presencial), com fotos e vídeos falsos |
| `atender_chamado` | iniciar, comentar, resolver, responder, confirmar, reabrir |
| `popular` | usuários + chamados em estados variados |
| `simular_rodadas` | N ações aleatórias como num dia de trabalho |
| `limpar_ficticios` | apaga chamados e usuários fictícios (pede `confirmar: true`) |

## Segurança: dado fictício nunca vira dado real

- Tudo que as ferramentas criam leva `ficticio = true` e e-mail `@teste.dinodesk`.
- Dado fictício **não** manda aviso no ntfy nem e-mail (para testar o aviso de propósito: `"avisar_ficticios": true` no `backend/config.json`).
- Na interface aparece a etiqueta **Teste**; na tela Usuários dá para esconder as contas de teste.
- `limpar` apaga só o que é fictício. Dados reais nunca são tocados.
- No PC servidor da Prefeitura, o instalador grava `"ambiente": "producao"` no `config.json` e o próprio servidor
  **recusa** criar qualquer dado fictício, mesmo que alguém rode as ferramentas apontando para ele.
- `ferramentas/.env` tem a senha do superusuário: fica fora do Git. Não use a senha de produção no seu PC.

## Como funciona por dentro

As ferramentas entram como superusuário e, para agir como uma pessoa (abrir, comentar, resolver),
pedem ao PocketBase um token daquela pessoa (personificação). Assim tudo passa pelas mesmas regras dos hooks
que valem para quem usa o sistema: protocolo, prioridade, responsável, linha do tempo, compressão de vídeo.

As fotos falsas são desenhadas na hora em PNG (prints de erro e fotos de monitor/impressora, cada uma diferente).
O vídeo é um clipe de 4 segundos em `ferramentas/fixtures/video-teste.mp4`.

Para criar uma ferramenta nova: escreva a operação em `ferramentas/lib/operacoes.mjs` e exponha nos dois lugares,
`dino.mjs` (comando) e `mcp.mjs` (ferramenta), com uma descrição clara: é ela que a IA lê para decidir quando usar.
