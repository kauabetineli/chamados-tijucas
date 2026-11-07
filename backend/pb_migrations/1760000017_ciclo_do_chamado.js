/// <reference path="../pb_data/types.d.ts" />

// Fim do ciclo do chamado (pesquisa de mercado, docs/ARQUITETURA.md "Fim do ciclo"):
// - chamados.confirmado_auto: o servidor não respondeu "Deu certo?" e o chamado foi considerado resolvido sozinho
//   depois de N dias úteis (config_ti.dados.dias_confirmar). Não conta como satisfação no Painel.
// - chamados.aviso: o chamado faz parte de um aviso de problema do TI ("internet fora do ar"). Ao encerrar o aviso,
//   o TI resolve todos os ligados de uma vez (POST /api/avisos/{id}/encerrar).
// - avisos.tipo ganha "resolvido": o recado de que o problema acabou ("A internet voltou"), que some sozinho.
// - respostas_prontas.acao: o que a resposta faz além de mandar o texto (pôr em espera, marcar resolvido).

migrate((app) => {
  const avisos = app.findCollectionByNameOrId("avisos");
  const tipo = avisos.fields.getByName("tipo");
  tipo.values = ["info", "problema", "resolvido"];
  app.save(avisos);

  const chamados = app.findCollectionByNameOrId("chamados");
  chamados.fields.add(new BoolField({ name: "confirmado_auto" }));
  chamados.fields.add(new RelationField({ name: "aviso", collectionId: avisos.id, maxSelect: 1, cascadeDelete: false }));
  app.save(chamados);

  const respostas = app.findCollectionByNameOrId("respostas_prontas");
  respostas.fields.add(new SelectField({ name: "acao", maxSelect: 1, values: ["espera_solicitante", "espera_peca", "espera_terceiro", "resolver"] }));
  app.save(respostas);
}, (app) => {
  const respostas = app.findCollectionByNameOrId("respostas_prontas");
  respostas.fields.removeByName("acao");
  app.save(respostas);
  const chamados = app.findCollectionByNameOrId("chamados");
  chamados.fields.removeByName("confirmado_auto");
  chamados.fields.removeByName("aviso");
  app.save(chamados);
  const avisos = app.findCollectionByNameOrId("avisos");
  avisos.fields.getByName("tipo").values = ["info", "problema"];
  app.save(avisos);
});
