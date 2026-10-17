/// <reference path="../pb_data/types.d.ts" />

// "telefone" vira "ramal": o contato com o TI é pelo sistema, não pelo celular pessoal
// (o WhatsApp pessoal dos técnicos é justamente um dos problemas do diagnóstico).
// O ramal da sala é cadastrado pelo TI (tela Usuários); o próprio servidor não edita
// (hook em pb_hooks/usuarios.pb.js). Valores antigos são mantidos.

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const campo = users.fields.getByName("telefone");
  campo.name = "ramal";
  campo.max = 20;
  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  const campo = users.fields.getByName("ramal");
  campo.name = "telefone";
  campo.max = 30;
  app.save(users);
});
