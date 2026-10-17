/// <reference path="../pb_data/types.d.ts" />

// Três coisas para o piloto:
// 1) situação "aguardando" no chamado (peça, resposta do solicitante ou terceiro/fornecedor):
//    sai da carga do técnico e da fila, mas continua com ele; "aguardando_motivo" diz o quê.
//    Quando o motivo é "solicitante" e ele responde, o chamado volta sozinho para "em_andamento" (hook).
// 2) avaliação do solicitante ao confirmar: "bom" (resolveu bem) ou "ruim", com comentário opcional.
// 3) respostas prontas editáveis pelo TI (coleção "respostas_prontas"), com as frases que já existiam.

const EH_TECNICO = '@request.auth.papel = "tecnico"';

const RESPOSTAS_INICIAIS = [
  "Estou indo até aí.",
  "Pode reiniciar o computador e me dizer se voltou?",
  "Consegue mandar uma foto da tela com o erro?",
  "Peça solicitada, aguardando entrega.",
  "Vou acessar remotamente, deixe o computador ligado.",
];

migrate((app) => {
  const chamados = app.findCollectionByNameOrId("chamados");
  const status = chamados.fields.getByName("status");
  status.values = ["aberto", "em_andamento", "aguardando", "resolvido"];
  chamados.fields.add(new SelectField({ name: "aguardando_motivo", maxSelect: 1, values: ["peca", "solicitante", "terceiro"] }));
  chamados.fields.add(new DateField({ name: "aguardando_desde" }));
  chamados.fields.add(new SelectField({ name: "avaliacao", maxSelect: 1, values: ["bom", "ruim"] }));
  chamados.fields.add(new TextField({ name: "avaliacao_comentario", max: 500 }));
  app.save(chamados);

  const respostas = new Collection({
    type: "base",
    name: "respostas_prontas",
    listRule: EH_TECNICO,
    viewRule: EH_TECNICO,
    createRule: EH_TECNICO,
    updateRule: EH_TECNICO,
    deleteRule: EH_TECNICO,
    fields: [
      { name: "texto", type: "text", required: true, max: 300 },
      { name: "ordem", type: "number", onlyInt: true },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
  });
  app.save(respostas);
  RESPOSTAS_INICIAIS.forEach((texto, i) => {
    const r = new Record(respostas);
    r.set("texto", texto);
    r.set("ordem", (i + 1) * 10);
    app.save(r);
  });
}, (app) => {
  app.delete(app.findCollectionByNameOrId("respostas_prontas"));
  const chamados = app.findCollectionByNameOrId("chamados");
  for (const c of ["aguardando_motivo", "aguardando_desde", "avaliacao", "avaliacao_comentario"]) chamados.fields.removeByName(c);
  chamados.fields.getByName("status").values = ["aberto", "em_andamento", "resolvido"];
  app.save(chamados);
});
