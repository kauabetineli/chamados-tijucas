/// <reference path="../pb_data/types.d.ts" />

// Feedback do sistema ("Sua opinião"): problemas, ideias e elogios sobre o PRÓPRIO Dino Desk, enviados por
// qualquer pessoa logada (TI ou servidor). Não é chamado: vai para a EQUIPE DO PROJETO (estudantes da extensão),
// que lê na área "Feedback" e marca a situação. Serve de evidência para os relatórios da extensão.
//
// users.equipe_projeto: marca as contas da equipe do projeto. Só o superusuário muda (painel /_/ ou ferramentas);
// nem o admin do TI mexe nela (hook em usuarios.pb.js).
//
// feedbacks: criado SÓ pela rota POST /api/feedback (preenche autor, papel, setor e ficticio no servidor).
// Lê e muda a situação: quem tem equipe_projeto. Ninguém apaga pela API.

const EQUIPE = '@request.auth.equipe_projeto = true';

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.add(new BoolField({ name: "equipe_projeto" }));
  app.save(users);

  const setores = app.findCollectionByNameOrId("setores");
  const col = new Collection({
    type: "base",
    name: "feedbacks",
    listRule: EQUIPE,
    viewRule: EQUIPE,
    createRule: null,
    updateRule: EQUIPE,
    deleteRule: null,
    fields: [
      { name: "autor", type: "relation", collectionId: users.id, maxSelect: 1, cascadeDelete: false },
      { name: "tipo", type: "select", required: true, maxSelect: 1, values: ["problema", "ideia", "elogio", "nota"] },
      { name: "texto", type: "text", max: 2000 },
      { name: "tela", type: "text", max: 120 },
      { name: "nota", type: "number", min: 0, max: 5, onlyInt: true },
      { name: "papel", type: "text", max: 20 },
      { name: "setor", type: "relation", collectionId: setores.id, maxSelect: 1, cascadeDelete: false },
      { name: "situacao", type: "select", required: true, maxSelect: 1, values: ["novo", "visto", "resolvido", "melhoria"] },
      { name: "anotacao", type: "text", max: 1000 },
      { name: "ficticio", type: "bool" },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX idx_feedbacks_created ON feedbacks (created)"],
  });
  app.save(col);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("feedbacks"));
  const users = app.findCollectionByNameOrId("users");
  users.fields.removeByName("equipe_projeto");
  app.save(users);
});
