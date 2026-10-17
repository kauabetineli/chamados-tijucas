/// <reference path="../pb_data/types.d.ts" />

// Avisos do TI: mural curto que todos veem (barra lateral no PC, topo de Meus chamados e da Fila no celular).
// Ex.: "Internet do Paço instável, já estamos vendo." Evita vários chamados sobre o mesmo problema.
// - tipo: "info" (comunicado) ou "problema" (algo fora do ar / em andamento);
// - ate: o aviso some sozinho depois desse horário (vazio = até alguém encerrar);
// - encerrar = mudar "ate" para agora (não se apaga: fica como registro do que aconteceu).
// Só técnicos publicam e encerram; o autor é sempre quem está logado.

const EH_TECNICO = '@request.auth.papel = "tecnico"';
const LOGADO = '@request.auth.id != ""';

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const avisos = new Collection({
    type: "base",
    name: "avisos",
    listRule: LOGADO,
    viewRule: LOGADO,
    createRule: `${EH_TECNICO} && @request.body.autor = @request.auth.id`,
    updateRule: `${EH_TECNICO} && (@request.body.autor:isset = false || @request.body.autor = autor)`,
    deleteRule: null,
    fields: [
      { name: "texto", type: "text", required: true, max: 240 },
      { name: "tipo", type: "select", required: true, maxSelect: 1, values: ["info", "problema"] },
      { name: "ate", type: "date" },
      { name: "autor", type: "relation", required: true, collectionId: users.id, maxSelect: 1 },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX idx_avisos_ate ON avisos (ate, created)"],
  });
  app.save(avisos);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("avisos"));
});
