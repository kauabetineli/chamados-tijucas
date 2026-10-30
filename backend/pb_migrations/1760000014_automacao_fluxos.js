/// <reference path="../pb_data/types.d.ts" />

// A automação passou a ser feita de FLUXOS independentes (gatilho + blocos ligados), no lugar das etapas.
// Decisão do grupo: começar do zero. As versões antigas continuam no histórico, mas a versão em vigor fica vazia.
// O "se nenhum fluxo escolher alguém" (senao) é mantido.

const MARCA = "A automação passou a usar fluxos. As regras antigas não foram trazidas.";

migrate((app) => {
  let senao = { tipo: "livre", pessoa: "" };
  try {
    const v = app.findRecordsByFilter("automacao_versoes", "", "-created", 1, 0);
    if (v.length && v[0]) {
      const d = JSON.parse(toString(v[0].get("dados")) || "{}");
      if (d && d.senao && d.senao.tipo === "pessoa" && d.senao.pessoa) senao = { tipo: "pessoa", pessoa: String(d.senao.pessoa) };
    }
  } catch (_) {}
  const col = app.findCollectionByNameOrId("automacao_versoes");
  const r = new Record(col);
  r.set("dados", { fluxos: [], senao });
  r.set("resumo", MARCA);
  app.save(r);
}, (app) => {
  for (const r of app.findRecordsByFilter("automacao_versoes", "resumo = {:m}", "", 0, 0, { m: MARCA })) {
    if (r) app.delete(r);
  }
});
