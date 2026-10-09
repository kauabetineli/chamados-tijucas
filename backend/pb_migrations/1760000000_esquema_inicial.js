/// <reference path="../pb_data/types.d.ts" />

// Esquema inicial do Sistema de Chamados do Departamento de TI.
// Coleções: setores, categorias, users (estendida), chamados, interacoes.
//
// Papéis (campo users.papel):
//   - "solicitante" (padrão): abre e acompanha os próprios chamados
//   - "tecnico": vê a fila inteira, atende, registra chamados em nome de outros
// A administração (setores, categorias, promover técnicos, backup, e-mail)
// é feita no painel do PocketBase (/_/) pelos superusuários do TI.

const EH_TECNICO = '@request.auth.papel = "tecnico"';
const LOGADO = '@request.auth.id != ""';

migrate((app) => {
  // ---------- setores ----------
  const setores = new Collection({
    type: "base",
    name: "setores",
    // lista pública: o formulário de cadastro precisa mostrar os setores
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "nome", type: "text", required: true, max: 120, presentable: true },
      { name: "predio", type: "text", max: 120 },
      { name: "ativo", type: "bool" },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_setores_nome ON setores (nome)"],
  });
  app.save(setores);

  // ---------- categorias ----------
  const categorias = new Collection({
    type: "base",
    name: "categorias",
    listRule: LOGADO,
    viewRule: LOGADO,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "nome", type: "text", required: true, max: 80, presentable: true },
      // nome de um ícone do lucide (https://lucide.dev/icons), ex.: "printer"
      { name: "icone", type: "text", max: 40 },
      { name: "ordem", type: "number", onlyInt: true },
      { name: "ativa", type: "bool" },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_categorias_nome ON categorias (nome)"],
  });
  app.save(categorias);

  // ---------- users (coleção de autenticação padrão) ----------
  const users = app.findCollectionByNameOrId("users");
  users.fields.add(new RelationField({
    name: "setor",
    collectionId: setores.id,
    maxSelect: 1,
    cascadeDelete: false,
  }));
  users.fields.add(new SelectField({
    name: "papel",
    values: ["solicitante", "tecnico"],
    maxSelect: 1,
  }));
  users.fields.add(new TextField({ name: "telefone", max: 30 }));
  // o próprio usuário e os técnicos (para o "registrar em nome de")
  users.listRule = `id = @request.auth.id || ${EH_TECNICO}`;
  users.viewRule = `id = @request.auth.id || ${EH_TECNICO}`;
  // cadastro aberto, mas ninguém se cadastra como técnico
  users.createRule = '@request.body.papel:isset = false || @request.body.papel = "" || @request.body.papel = "solicitante"';
  // o usuário edita o próprio perfil, mas não o papel
  users.updateRule = "id = @request.auth.id && @request.body.papel:isset = false";
  users.deleteRule = null;
  app.save(users);

  // ---------- chamados ----------
  const chamados = new Collection({
    type: "base",
    name: "chamados",
    listRule: `solicitante = @request.auth.id || ${EH_TECNICO}`,
    viewRule: `solicitante = @request.auth.id || ${EH_TECNICO}`,
    // qualquer usuário logado abre chamado; o hook completa e valida os campos
    createRule: LOGADO,
    // só técnicos alteram pela API; o solicitante usa as rotas /confirmar e /reabrir
    updateRule: EH_TECNICO,
    deleteRule: null,
    fields: [
      { name: "protocolo", type: "text", max: 20, presentable: true },
      { name: "descricao", type: "text", required: true, max: 4000 },
      { name: "categoria", type: "relation", collectionId: categorias.id, maxSelect: 1, required: true },
      { name: "solicitante", type: "relation", collectionId: users.id, maxSelect: 1 },
      // quando o técnico registra para alguém sem conta (corredor, ligação)
      { name: "solicitante_nome", type: "text", max: 120 },
      { name: "setor", type: "relation", collectionId: setores.id, maxSelect: 1 },
      { name: "local", type: "text", max: 160 },
      { name: "impacto", type: "select", values: ["so_eu", "setor", "publico"], maxSelect: 1, required: true },
      { name: "prioridade", type: "select", values: ["baixa", "normal", "alta", "urgente"], maxSelect: 1 },
      // peso numérico da prioridade, mantido pelo hook, para ordenar a fila
      { name: "peso", type: "number", onlyInt: true, hidden: false },
      { name: "status", type: "select", values: ["aberto", "em_andamento", "resolvido"], maxSelect: 1 },
      { name: "origem", type: "select", values: ["sistema", "whatsapp", "ligacao", "presencial"], maxSelect: 1 },
      { name: "responsavel", type: "relation", collectionId: users.id, maxSelect: 1 },
      { name: "registrado_por", type: "relation", collectionId: users.id, maxSelect: 1 },
      {
        name: "anexos",
        type: "file",
        maxSelect: 5,
        maxSize: 30 * 1024 * 1024,
        mimeTypes: [
          "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
          "video/mp4", "video/quicktime", "video/webm", "video/3gpp",
        ],
        thumbs: ["200x200", "800x0"],
      },
      { name: "diagnostico", type: "text", max: 4000 },
      { name: "solucao", type: "text", max: 4000 },
      { name: "confirmado", type: "bool" },
      { name: "iniciado_em", type: "date" },
      { name: "resolvido_em", type: "date" },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_chamados_protocolo ON chamados (protocolo) WHERE protocolo != ''",
      "CREATE INDEX idx_chamados_fila ON chamados (status, peso, created)",
      "CREATE INDEX idx_chamados_solicitante ON chamados (solicitante)",
    ],
  });
  app.save(chamados);

  // ---------- interacoes (linha do tempo do chamado) ----------
  const interacoes = new Collection({
    type: "base",
    name: "interacoes",
    // o solicitante vê a linha do tempo do próprio chamado, menos as notas internas
    listRule: `(chamado.solicitante = @request.auth.id && interno = false) || ${EH_TECNICO}`,
    viewRule: `(chamado.solicitante = @request.auth.id && interno = false) || ${EH_TECNICO}`,
    // comentários: o hook confere autor, tipo e permissão
    createRule: LOGADO,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "chamado", type: "relation", collectionId: chamados.id, maxSelect: 1, required: true, cascadeDelete: true },
      { name: "autor", type: "relation", collectionId: users.id, maxSelect: 1 },
      { name: "tipo", type: "select", values: ["comentario", "status", "prioridade", "atribuicao", "sistema"], maxSelect: 1, required: true },
      { name: "texto", type: "text", max: 4000 },
      // nota interna do TI, invisível para o solicitante
      { name: "interno", type: "bool" },
      { name: "created", type: "autodate", onCreate: true },
    ],
    indexes: ["CREATE INDEX idx_interacoes_chamado ON interacoes (chamado, created)"],
  });
  app.save(interacoes);
}, (app) => {
  for (const nome of ["interacoes", "chamados", "categorias", "setores"]) {
    try { app.delete(app.findCollectionByNameOrId(nome)); } catch (_) {}
  }
  const users = app.findCollectionByNameOrId("users");
  for (const campo of ["setor", "papel", "telefone"]) users.fields.removeByName(campo);
  app.save(users);
});
