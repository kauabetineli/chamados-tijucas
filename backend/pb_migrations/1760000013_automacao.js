/// <reference path="../pb_data/types.d.ts" />

// Configurações do TI, editadas pelo ADMINISTRADOR na tela "Configurações do TI" (nada fixo no código):
//
// 1) config_ti: um registro só ("geral") com a ordem da fila, os prazos por prioridade, o horário de
//    atendimento, se quem abre o chamado pode subir a prioridade e o que fazer com os chamados de quem fica ausente.
// 2) automacao_versoes: as regras de automação (etapas 1 a 4). Cada "Salvar" cria uma versão nova;
//    a mais recente é a que vale. Assim existe histórico de quem mudou o quê, e dá para voltar atrás.
// 3) categorias: sugestões ("O que pode ter acontecido") e perguntas ("O que ajuda o TI") saem do código e
//    vão para o banco; "Outro" fica protegida (sempre aparece). O admin do TI passa a editar as categorias.
// 4) users: ausência (de/até, motivo) e "não recebe chamados automáticos".
// 5) chamados: prazo_em (prazo para começar), ordem_fila (chave da ordem), prioridade escolhida por quem pediu,
//    motivo da urgência, prazo dado por regra e as regras de tempo que já agiram no chamado.

const LOGADO = '@request.auth.id != ""';
const EH_TECNICO = '@request.auth.papel = "tecnico"';
const EH_ADMIN = '@request.auth.papel = "tecnico" && @request.auth.admin = true';

// os textos que estavam em frontend/src/features/novo-chamado/sugestoes.ts
const SUGESTOES = {
  Computador: ["Não liga", "Está muito lento", "Trava ou reinicia sozinho", "Tela preta ou sem imagem"],
  Impressora: ["Não imprime", "Papel enroscado", "Sem tinta ou toner", "Impressão falhada ou borrada"],
  "Internet ou rede": ["Sem internet", "Internet muito lenta", "Wi-Fi não conecta", "A conexão cai toda hora"],
  "Sistema ou programa": ["Não abre", "Aparece uma mensagem de erro", "Preciso instalar um programa", "Está muito lento"],
  "Senha ou acesso": ["Esqueci a senha", "Senha bloqueada", "Preciso de acesso a um sistema ou pasta"],
  "E-mail": ["Não recebo e-mails", "Não consigo enviar e-mails", "Caixa de entrada cheia"],
  Telefone: ["Ramal sem linha", "Chiado ou ruído na ligação", "Não recebe ligações"],
};
const DICAS = {
  Computador: ["Aparece alguma mensagem na tela?", "Já tentou reiniciar?", "Desde quando acontece?"],
  Impressora: ["Qual impressora (sala ou número na etiqueta)?", "Aparece alguma luz ou mensagem no visor?", "Outras pessoas conseguem imprimir nela?"],
  "Internet ou rede": ["Mais alguém do setor está sem internet?", "É no cabo ou no Wi-Fi?", "Desde que horas?"],
  "Sistema ou programa": ["Qual o nome do sistema?", "Qual mensagem de erro aparece?", "Funcionava antes? Desde quando parou?"],
  "Senha ou acesso": ["Qual sistema ou pasta?", "Aparece alguma mensagem ao entrar?"],
  "E-mail": ["Qual endereço de e-mail?", "Aparece alguma mensagem de erro?", "É no celular, no computador ou nos dois?"],
  Telefone: ["Qual o número do ramal?", "É só para fazer ou também para receber ligações?"],
};
const DICAS_GERAIS = ["O que aparece na tela?", "Desde quando acontece?", "Já tentou alguma coisa?"];

// Padrões: os prazos são os que estavam no código (frontend/src/lib/fila.ts), em minutos.
// O horário de atendimento começa DESLIGADO (prazo em horas corridas) até o TI informar o horário real.
const CONFIG_PADRAO = {
  ordem_fila: "prazo",
  prazos: { urgente: 60, alta: 240, normal: 1440, baixa: 4320 },
  servidor_prioridade: false,
  teto_prioridade: "urgente",
  pedir_motivo_urgente: true,
  marcar_escolhida: true,
  horario: { ativo: false, dias: [1, 2, 3, 4, 5], inicio: "08:00", fim: "17:00" },
  destino_ausencia: "fica",
};
const AUTOMACAO_VAZIA = { ajustes: [], quem: [], senao: { tipo: "livre" }, tempo: [] };

migrate((app) => {
  // ---------- config_ti ----------
  const config = new Collection({
    type: "base",
    name: "config_ti",
    listRule: LOGADO,
    viewRule: LOGADO,
    createRule: null,
    updateRule: EH_ADMIN,
    deleteRule: null,
    fields: [
      { name: "chave", type: "text", required: true, max: 40 },
      { name: "dados", type: "json", maxSize: 200000 },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_config_ti_chave ON config_ti (chave)"],
  });
  app.save(config);
  const geral = new Record(config);
  geral.set("chave", "geral");
  geral.set("dados", CONFIG_PADRAO);
  app.save(geral);

  // ---------- automacao_versoes ----------
  const versoes = new Collection({
    type: "base",
    name: "automacao_versoes",
    listRule: EH_TECNICO,
    viewRule: EH_TECNICO,
    createRule: null, // só pela rota POST /api/ti/automacao (valida e registra o autor)
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "dados", type: "json", maxSize: 2000000 },
      { name: "autor", type: "relation", collectionId: app.findCollectionByNameOrId("users").id, maxSelect: 1 },
      { name: "resumo", type: "text", max: 300 },
      { name: "created", type: "autodate", onCreate: true },
    ],
    indexes: ["CREATE INDEX idx_automacao_created ON automacao_versoes (created)"],
  });
  app.save(versoes);
  const v1 = new Record(versoes);
  v1.set("dados", AUTOMACAO_VAZIA);
  v1.set("resumo", "Versão inicial, sem regras");
  app.save(v1);

  // ---------- categorias ----------
  const categorias = app.findCollectionByNameOrId("categorias");
  categorias.fields.add(new JSONField({ name: "sugestoes", maxSize: 20000 }));
  categorias.fields.add(new JSONField({ name: "dicas", maxSize: 20000 }));
  categorias.fields.add(new BoolField({ name: "protegida" }));
  categorias.createRule = EH_ADMIN;
  categorias.updateRule = EH_ADMIN;
  categorias.deleteRule = null; // ocultar (ativa = false) em vez de apagar: o histórico continua
  app.save(categorias);
  for (const cat of app.findAllRecords("categorias")) {
    const nome = cat.getString("nome");
    cat.set("sugestoes", SUGESTOES[nome] || []);
    cat.set("dicas", DICAS[nome] || DICAS_GERAIS);
    if (nome === "Outro") { cat.set("protegida", true); cat.set("ativa", true); }
    app.save(cat);
  }

  // ---------- users ----------
  const users = app.findCollectionByNameOrId("users");
  users.fields.add(new DateField({ name: "ausente_de" }));
  users.fields.add(new DateField({ name: "ausente_ate" }));
  users.fields.add(new TextField({ name: "ausencia_motivo", max: 120 }));
  users.fields.add(new BoolField({ name: "sem_automatico" })); // true = as regras não mandam chamados para esta pessoa
  app.save(users);

  // ---------- chamados ----------
  const chamados = app.findCollectionByNameOrId("chamados");
  chamados.fields.add(new DateField({ name: "prazo_em" }));
  chamados.fields.add(new NumberField({ name: "prazo_regra_min", onlyInt: true }));
  chamados.fields.add(new NumberField({ name: "ordem_fila" }));
  chamados.fields.add(new BoolField({ name: "prioridade_escolhida" }));
  chamados.fields.add(new TextField({ name: "motivo_urgencia", max: 200 }));
  chamados.fields.add(new JSONField({ name: "regras_tempo", maxSize: 20000 }));
  chamados.indexes = [...chamados.indexes, "CREATE INDEX idx_chamados_ordem_fila ON chamados (status, ordem_fila)"];
  app.save(chamados);

  // chamados que já existem: prazo e ordem calculados com os padrões
  // (mesma conta de lib/automacao.js, com o horário desligado: prazo em minutos corridos; modo "prazo")
  for (const c of app.findRecordsByFilter("chamados", "status != 'resolvido'", "", 0, 0)) {
    if (!c) continue;
    const criado = new Date(c.getString("created").replace(" ", "T"));
    const min = CONFIG_PADRAO.prazos[c.getString("prioridade")] || CONFIG_PADRAO.prazos.normal;
    const prazo = new Date(criado.getTime() + min * 60000);
    c.set("prazo_em", prazo.toISOString().replace("T", " "));
    c.set("ordem_fila", Math.floor(prazo.getTime() / 1000));
    app.saveNoValidate(c);
  }
}, (app) => {
  for (const nome of ["config_ti", "automacao_versoes"]) {
    try { app.delete(app.findCollectionByNameOrId(nome)); } catch (_) {}
  }
  const categorias = app.findCollectionByNameOrId("categorias");
  for (const c of ["sugestoes", "dicas", "protegida"]) categorias.fields.removeByName(c);
  categorias.createRule = null;
  categorias.updateRule = null;
  app.save(categorias);
  const users = app.findCollectionByNameOrId("users");
  for (const c of ["ausente_de", "ausente_ate", "ausencia_motivo", "sem_automatico"]) users.fields.removeByName(c);
  app.save(users);
  const chamados = app.findCollectionByNameOrId("chamados");
  for (const c of ["prazo_em", "prazo_regra_min", "ordem_fila", "prioridade_escolhida", "motivo_urgencia", "regras_tempo"]) chamados.fields.removeByName(c);
  chamados.indexes = chamados.indexes.filter((i) => !i.includes("idx_chamados_ordem_fila"));
  app.save(chamados);
});
