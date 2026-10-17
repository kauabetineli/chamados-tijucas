/// <reference path="../pb_data/types.d.ts" />

// Quem pediu precisa ver o NOME do técnico que está com o chamado ("Responsável no TI", "Hugo está cuidando...",
// autor das mensagens do TI na conversa). Antes, o servidor só via a própria conta e o expand vinha vazio ("—").
// Agora qualquer pessoa logada vê as contas de técnicos; os dados internos (matrícula, ramal, admin...)
// são escondidos para quem não é do TI pelo hook onRecordEnrich em pb_hooks/usuarios.pb.js.

const EH_TECNICO = '@request.auth.papel = "tecnico"';
const NOVA = `id = @request.auth.id || ${EH_TECNICO} || (papel = "tecnico" && @request.auth.id != "")`;
const ANTIGA = `id = @request.auth.id || ${EH_TECNICO}`;

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.listRule = NOVA;
  users.viewRule = NOVA;
  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.listRule = ANTIGA;
  users.viewRule = ANTIGA;
  app.save(users);
});
