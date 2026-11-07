/// <reference path="../pb_data/types.d.ts" />

// "Também estou sem": no Novo chamado o servidor vê o aviso de problema do TI e, em vez de abrir mais um chamado
// repetido, toca em "Também estou sem". Quem tocou fica em "tambem" (só o TI vê a lista; o servidor vê o total).
// Gravado por POST /api/avisos/{id}/tambem (pb_hooks/avisos.pb.js), nunca direto pela API.

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const avisos = app.findCollectionByNameOrId("avisos");
  avisos.fields.add(new RelationField({ name: "tambem", collectionId: users.id, maxSelect: 9999, cascadeDelete: false }));
  // técnico continua editando o aviso, mas não mexe na lista de quem também está sem
  avisos.updateRule = '@request.auth.papel = "tecnico" && (@request.body.autor:isset = false || @request.body.autor = autor) && @request.body.tambem:isset = false';
  app.save(avisos);
}, (app) => {
  const avisos = app.findCollectionByNameOrId("avisos");
  avisos.fields.removeByName("tambem");
  avisos.updateRule = '@request.auth.papel = "tecnico" && (@request.body.autor:isset = false || @request.body.autor = autor)';
  app.save(avisos);
});
