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
| `users` (auth) | name, email, setor, papel (`solicitante`/`tecnico`), telefone | cada um vê a si; técnicos veem todos. Ninguém se promove a técnico (só pelo painel admin) |
| `setores` | nome, predio, ativo | leitura pública (tela de cadastro); edição só no painel admin |
| `categorias` | nome, icone, ordem, ativa | leitura para logados; edição só no painel admin |
| `chamados` | protocolo, descricao, categoria, solicitante / solicitante_nome, setor, local, impacto, prioridade, peso, status, origem, responsavel, registrado_por, anexos, diagnostico, solucao, confirmado, iniciado_em, resolvido_em | solicitante vê os seus; técnicos veem e alteram todos |
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
- **Indicadores** em `/api/painel/resumo`: total, resolvidos, tempo médio até começar e até resolver, por origem,
  categoria, setor e dia. O painel também exporta a planilha (CSV) do período: evidência para a AC4.
