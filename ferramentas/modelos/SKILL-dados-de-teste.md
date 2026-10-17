---
name: dados-de-teste
description: Gerar, simular ou apagar dados de teste no Dino Desk (usuários, setores e chamados fictícios com fotos e vídeos falsos), criar contas reais pelo TI ou mover chamados (iniciar, resolver, confirmar). Use quando pedirem para popular, encher, simular uso, testar fila/painel/histórico, criar usuários ou limpar dados de teste.
---

# Dados de teste no Dino Desk

Use as ferramentas prontas do projeto. **Não escreva scripts novos** nem chame a API na mão para isso.

- Com o servidor MCP `dino-desk` disponível: use as ferramentas dele (`info`, `popular`, `abrir_chamado`...).
- Sem MCP: rode a CLI `node ferramentas/dino.mjs <comando>` (mesmas operações; `--json` para saída estruturada).

## Passo a passo

1. **Confira o ambiente**: `info`. Se der erro de conexão, o PocketBase não está rodando (`cd backend && ./pocketbase serve`).
   Se faltar credencial, peça para rodar `node ferramentas/configurar.mjs` (pergunta o superusuário e grava `ferramentas/.env`).
   Se `ambiente` for `producao`, **pare**: dados fictícios são proibidos ali. Diga isso ao usuário.
2. **Escolha a operação** pelo pedido:
   - "encher / popular / quero ver as telas cheias" → `popular` (padrão: 10 servidores, 2 técnicos, 20 chamados com mídia).
   - "N usuários" → `criar_usuarios_ficticios` (`tecnicos` > 0 se forem atender chamados). Senha de todos: `Teste@1234`.
   - "um chamado de X" → `abrir_chamado` (categoria, impacto, `fotos`/`videos` para anexos falsos;
     `origem: "whatsapp"` + técnico para simular registro feito pelo TI).
   - "simular uso / deixar rodando" → `simular_rodadas` (N ações já). Para minutos seguidos: CLI `simular --minutos 10`
     (avise que ela fica rodando no terminal até acabar ou Ctrl+C).
   - "andar com o chamado" → `atender_chamado` com `iniciar`, `comentar`, `resolver`, `responder`, `confirmar` ou `reabrir`.
   - "conta para a Maria do RH" → `criar_usuario` com `ficticio: false`, nome e e-mail **reais informados pelo usuário**.
     Nunca invente e-mail para conta real. Entregue a `senha_provisoria` devolvida.
   - "limpar / apagar testes" → `limpar_ficticios` primeiro **sem** confirmar (mostra quantos), depois `confirmar: true`.
3. **Responda curto**: o que foi criado (totais de `info`), 1 ou 2 logins para testar
   (e-mail de um servidor e de um técnico fictício + `Teste@1234`) e onde olhar (Fila em `/ti`, Painel em `/ti/painel`).

## Bom saber

- Tudo fictício leva `ficticio = true`, e-mail `@teste.dinodesk` e a etiqueta "Teste" na interface; não dispara ntfy nem e-mail.
- Mídia falsa: prints de erro e fotos de equipamento desenhados em PNG e um vídeo de 4 s (`ferramentas/fixtures/video-teste.mp4`).
  O vídeo passa pela compressão do servidor (cron a cada minuto, precisa do ffmpeg em `backend/bin`).
- Abrir/atender acontece "como" a pessoa (personificação do PocketBase): valem as regras reais dos hooks
  (protocolo, prioridade pelo impacto, linha do tempo, responsável).
- Rotas HTTP usadas: `docs/API.md`. Código das operações: `ferramentas/lib/operacoes.mjs`.
