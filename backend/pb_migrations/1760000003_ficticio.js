/// <reference path="../pb_data/types.d.ts" />

// Marca de dado FICTÍCIO (gerado para teste pelas ferramentas de IA/CLI em ferramentas/).
// - users.ficticio: conta de teste. Só superusuário marca (hook em pb_hooks/usuarios.pb.js).
// - chamados.ficticio: copiado do solicitante na abertura (pb_hooks/chamados.pb.js).
// Dado fictício não dispara ntfy nem e-mail, aparece com a etiqueta "Teste" e é
// apagado por `node ferramentas/dino.mjs limpar`.
// Contas antigas de teste (@teste.dinodesk, criadas por scripts/dados-teste.mjs) são marcadas aqui.

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.add(new BoolField({ name: "ficticio" }));
  app.save(users);

  const chamados = app.findCollectionByNameOrId("chamados");
  chamados.fields.add(new BoolField({ name: "ficticio" }));
  chamados.addIndex("idx_chamados_ficticio", false, "ficticio", "");
  app.save(chamados);

  app.db().newQuery("UPDATE users SET ficticio = 1 WHERE email LIKE '%@teste.dinodesk'").execute();
  app.db().newQuery(
    "UPDATE chamados SET ficticio = 1 WHERE solicitante IN (SELECT id FROM users WHERE ficticio = 1)",
  ).execute();
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.removeByName("ficticio");
  app.save(users);
  const chamados = app.findCollectionByNameOrId("chamados");
  chamados.removeIndex("idx_chamados_ficticio");
  chamados.fields.removeByName("ficticio");
  app.save(chamados);
});
