/// <reference path="../pb_data/types.d.ts" />

// Dados iniciais. As categorias são uma sugestão para o piloto:
// o TI pode renomear, desativar ou criar outras no painel (/_/).
// Os setores reais da Prefeitura devem ser cadastrados pelo TI no painel.

const CATEGORIAS = [
  { nome: "Computador", icone: "monitor" },
  { nome: "Impressora", icone: "printer" },
  { nome: "Internet ou rede", icone: "wifi" },
  { nome: "Sistema ou programa", icone: "app-window" },
  { nome: "Senha ou acesso", icone: "key-round" },
  { nome: "E-mail", icone: "mail" },
  { nome: "Telefone", icone: "phone" },
  { nome: "Outro", icone: "circle-help" },
];

migrate((app) => {
  const categorias = app.findCollectionByNameOrId("categorias");
  CATEGORIAS.forEach((c, i) => {
    const r = new Record(categorias);
    r.set("nome", c.nome);
    r.set("icone", c.icone);
    r.set("ordem", (i + 1) * 10);
    r.set("ativa", true);
    app.save(r);
  });

  const setores = app.findCollectionByNameOrId("setores");
  const ti = new Record(setores);
  ti.set("nome", "Departamento de TI");
  ti.set("ativo", true);
  app.save(ti);
}, (app) => {
  for (const nome of ["categorias", "setores"]) {
    const col = app.findCollectionByNameOrId(nome);
    for (const r of app.findRecordsByFilter(col, "", "", 0, 0)) app.delete(r);
  }
});
