/// <reference path="../pb_data/types.d.ts" />

// Contas só pelo TI (acabou o "Criar conta" público):
// - users.matricula: número da matrícula (até 8 dígitos), única; serve de login. E-mail vira opcional
//   (nem todo servidor tem e-mail). Login aceita matrícula OU e-mail.
// - users.admin: o administrador do TI (cria setores, pessoas, troca senhas, bloqueia contas).
// - users.trocar_senha: a conta foi criada/teve a senha trocada pelo TI; no primeiro acesso a pessoa
//   é obrigada a escolher a própria senha.
// - users.bloqueado: não consegue entrar (em vez de apagar a conta, que tem chamados ligados).
// - setores.ramal: o ramal do setor (o users.ramal continua como "ramal próprio", se for diferente).
// - O técnico mais antigo vira admin, se ainda não houver nenhum (para o sistema não ficar sem administrador).

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.add(new TextField({ name: "matricula", max: 8, pattern: "^[0-9]{1,8}$" }));
  users.fields.add(new BoolField({ name: "admin" }));
  users.fields.add(new BoolField({ name: "trocar_senha" }));
  users.fields.add(new BoolField({ name: "bloqueado" }));
  users.fields.getByName("email").required = false;
  users.addIndex("idx_users_matricula", true, "matricula", "matricula != ''");
  users.passwordAuth.identityFields = ["matricula", "email"];
  // ninguém cria conta sozinho: só o TI (rota /api/ti/usuarios) e o superusuário
  users.createRule = null;
  app.save(users);

  const setores = app.findCollectionByNameOrId("setores");
  setores.fields.add(new TextField({ name: "ramal", max: 20 }));
  app.save(setores);

  const admins = app.findRecordsByFilter("users", "admin = true", "", 1, 0);
  if (!admins.length) {
    const tecnicos = app.findRecordsByFilter("users", "papel = 'tecnico' && ficticio != true", "created", 1, 0);
    const primeiro = tecnicos[0] || app.findRecordsByFilter("users", "papel = 'tecnico'", "created", 1, 0)[0];
    if (primeiro) {
      primeiro.set("admin", true);
      app.save(primeiro);
    }
  }
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.passwordAuth.identityFields = ["email"];
  users.removeIndex("idx_users_matricula");
  for (const campo of ["matricula", "admin", "trocar_senha", "bloqueado"]) users.fields.removeByName(campo);
  users.fields.getByName("email").required = true;
  users.createRule = '@request.body.papel:isset = false || @request.body.papel = "" || @request.body.papel = "solicitante"';
  app.save(users);
  const setores = app.findCollectionByNameOrId("setores");
  setores.fields.removeByName("ramal");
  app.save(setores);
});
