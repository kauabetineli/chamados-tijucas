# Backlog

Prazos (AC2): desenvolvimento até **31/10**; testes, implantação e capacitação **01–14/11**; piloto **17–20/11**
com o TI e pelo menos 2 setores, meta de **50% dos chamados registrados no sistema**.

## Já feito na base inicial

- [x] Contas criadas só pelo admin do TI: login pela matrícula, senha provisória trocada no 1º acesso, bloqueio
- [x] Setores com ramal, gerenciados pelo admin do TI (tela Pessoas e setores)
- [x] Abrir chamado: categoria, descrição, impacto, foto/vídeo (o lugar é o setor da conta) pela câmera (fotos são reduzidas antes do envio)
- [x] Meus chamados com a **senha da fila** (posição em tempo real)
- [x] Detalhe do chamado: etapas, conversa com o TI, confirmar ou reabrir
- [x] Fila do TI (todos / comigo / sem responsável), atualização em tempo real
- [x] Atender, priorizar, atribuir, devolver para a fila, resolver (causa + solução obrigatórias), reabrir
- [x] Notas internas do TI
- [x] Registro rápido de pedido por WhatsApp, ligação ou presencial (inclusive já resolvido)
- [x] Histórico de soluções com busca
- [x] Painel com indicadores e exportação da planilha (CSV)
- [x] Etiquetas com QR code para abrir chamado
- [x] E-mail ao solicitante (atendimento iniciado, resolvido, resposta do TI)
- [x] Scripts de instalação no PC Windows, backup, pacote e atualização
- [x] Página de redirecionamento para o site da Prefeitura

## A fazer antes do piloto

| Tarefa | Sugestão de dupla |
|---|---|
| Testar com os 3 técnicos: o fluxo da fila e do registro rápido cabe no dia a dia deles? | Todo o grupo, com o Kauã fazendo a ponte |
| Cadastrar setores reais e revisar categorias com o TI | Dupla de implantação |
| Testar o redirecionamento no celular, de verdade, no Wi-Fi da Prefeitura (Android e iPhone) | Dupla de implantação |
| "Esqueci minha senha": hoje o TI redefine no painel. Avaliar o fluxo por e-mail do PocketBase | Dupla de backend |
| Revisão de acessibilidade e textos com alguém que não é de TI | Dupla de UX |
| Roteiro de capacitação dos 3 técnicos (até 14/11) e cartaz/QR para os setores do piloto | Dupla de documentação |
| Plano de coleta para a AC4: contagem manual × registros do sistema durante o piloto | Dupla de documentação |

## Desejáveis (se der tempo)

- [x] Avaliação depois do atendimento (👍/👎), indicador para a AC5
- [x] Respostas prontas para o TI, editáveis pela equipe
- [ ] Aviso sonoro na fila quando chega chamado novo (opcional, começa desligado: o ntfy já avisa no celular)
- [x] Anexar foto também nos comentários
- [x] Tela de perfil
- [x] Situação "Em espera" (peça, resposta, terceiro) e "Enviar e aguardar resposta"
- [x] "Precisa de você" em Meus chamados; "Outro pedido da mesma pessoa" no Registrar
- [x] Limite de tentativas de login; protocolo sem colisão
- [ ] Encerrar sozinho resolvidos não confirmados após 7 dias (sem nota; Painel separa confirmação real da automática)
- [ ] Resolver em lote os chamados de uma mesma queda (ligados a um aviso do mural)

## Depois do piloto (trabalhos futuros)

- HTTPS com subdomínio da Prefeitura → app instalável (PWA) e notificação push
- Base de conhecimento aberta aos servidores (FAQ a partir do histórico)
- Metas de tempo por prioridade (SLA)
- Inventário de equipamentos ligado aos chamados
- Integração com WhatsApp (API oficial tem custo e aprovação)

## Ideias do grupo e da Prefeitura

<!-- Colem aqui as ideias novas antes de virar tarefa -->

### Decididas: não fazer por enquanto

- **Mover chamado de posição na fila à mão** (adiada em 17/10). A fila segue a regra fixa "prioridade, depois chegada"
  (objetivo específico da AC2). Mexer livremente traria de volta a ordem "na memória" (problema 2 do diagnóstico),
  faria a senha do solicitante pular sem explicação (problema 1) e abriria espaço para favorecimento sem registro.
  Os casos reais já se resolvem com prioridade, começar qualquer chamado (o "Seu próximo" é sugestão) e, a fazer,
  "Aguardando" e lembrete. **Se o piloto mostrar necessidade:** ação "Passar à frente" só pelo menu ⋮, com motivo
  obrigatório, registro na linha do tempo e contagem no Painel.
