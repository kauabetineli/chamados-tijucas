/// <reference path="../pb_data/types.d.ts" />

// Índices para as telas que filtram e ordenam muito (Todos os chamados, Histórico, Fila por técnico,
// "Nova resposta" do servidor). Com poucos chamados não faz diferença; com milhares, evita varrer a tabela.

migrate((app) => {
  const chamados = app.findCollectionByNameOrId("chamados");
  chamados.addIndex("idx_chamados_responsavel", false, "responsavel, status", "");
  chamados.addIndex("idx_chamados_resolvidos", false, "status, resolvido_em", "");
  chamados.addIndex("idx_chamados_criacao", false, "created", "");
  chamados.addIndex("idx_chamados_setor", false, "setor, created", "");
  app.save(chamados);

  const interacoes = app.findCollectionByNameOrId("interacoes");
  interacoes.addIndex("idx_interacoes_autor", false, "autor, created", "");
  app.save(interacoes);

  const users = app.findCollectionByNameOrId("users");
  users.addIndex("idx_users_papel", false, "papel, name", "");
  app.save(users);
}, (app) => {
  const chamados = app.findCollectionByNameOrId("chamados");
  for (const n of ["idx_chamados_responsavel", "idx_chamados_resolvidos", "idx_chamados_criacao", "idx_chamados_setor"]) chamados.removeIndex(n);
  app.save(chamados);
  const interacoes = app.findCollectionByNameOrId("interacoes");
  interacoes.removeIndex("idx_interacoes_autor");
  app.save(interacoes);
  const users = app.findCollectionByNameOrId("users");
  users.removeIndex("idx_users_papel");
  app.save(users);
});
