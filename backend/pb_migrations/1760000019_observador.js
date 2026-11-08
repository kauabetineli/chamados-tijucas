/// <reference path="../pb_data/types.d.ts" />

// Papel "observador": conta da EQUIPE DO DINO DESK (estudantes da extensão) que VÊ tudo o que o TI vê
// (fila, chamados com conversa e notas internas, painel, pessoas, configurações), mas não muda nada.
// Só o superusuário cria (painel /_/ ou ferramentas). O admin do TI vê a conta em Pessoas e setores e pode bloquear.
// Leitura: as regras abaixo. Escrita: as regras de criar/editar continuam só do técnico, e os hooks recusam o resto.

const TI = '@request.auth.papel = "tecnico"';
const LE = '(@request.auth.papel = "tecnico" || @request.auth.papel = "observador")';
const NAO_OBS = '@request.auth.papel != "observador"';

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const papel = users.fields.getByName("papel");
  papel.values = ["solicitante", "tecnico", "observador"];
  users.listRule = users.viewRule = `id = @request.auth.id || ${LE} || (papel = "tecnico" && @request.auth.id != "")`;
  app.save(users);

  const chamados = app.findCollectionByNameOrId("chamados");
  chamados.listRule = chamados.viewRule = `solicitante = @request.auth.id || ${LE}`;
  chamados.createRule = `@request.auth.id != "" && ${NAO_OBS}`;
  app.save(chamados);

  const inter = app.findCollectionByNameOrId("interacoes");
  inter.listRule = inter.viewRule = `(chamado.solicitante = @request.auth.id && interno = false) || ${LE}`;
  inter.createRule = `@request.auth.id != "" && ${NAO_OBS}`;
  app.save(inter);

  for (const nome of ["respostas_prontas", "automacao_versoes"]) {
    const c = app.findCollectionByNameOrId(nome);
    c.listRule = c.viewRule = LE;
    app.save(c);
  }
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.getByName("papel").values = ["solicitante", "tecnico"];
  users.listRule = users.viewRule = `id = @request.auth.id || ${TI} || (papel = "tecnico" && @request.auth.id != "")`;
  app.save(users);
  const chamados = app.findCollectionByNameOrId("chamados");
  chamados.listRule = chamados.viewRule = `solicitante = @request.auth.id || ${TI}`;
  chamados.createRule = '@request.auth.id != ""';
  app.save(chamados);
  const inter = app.findCollectionByNameOrId("interacoes");
  inter.listRule = inter.viewRule = `(chamado.solicitante = @request.auth.id && interno = false) || ${TI}`;
  inter.createRule = '@request.auth.id != ""';
  app.save(inter);
  for (const nome of ["respostas_prontas", "automacao_versoes"]) {
    const c = app.findCollectionByNameOrId(nome);
    c.listRule = c.viewRule = TI;
    app.save(c);
  }
});
