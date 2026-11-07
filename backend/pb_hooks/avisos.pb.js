/// <reference path="../pb_data/types.d.ts" />

// Avisos do TI: "Também estou sem" (migration 1760000016_avisos_tambem.js).
// POST /api/avisos/{id}/tambem  -> { total, eu: true }  (tocar de novo não conta duas vezes)
// DELETE /api/avisos/{id}/tambem -> desfaz.

routerAdd("POST", "/api/avisos/{id}/tambem", (e) => require(`${__hooks}/lib/tambem.js`).marcar(e, true), $apis.requireAuth("users"));
routerAdd("DELETE", "/api/avisos/{id}/tambem", (e) => require(`${__hooks}/lib/tambem.js`).marcar(e, false), $apis.requireAuth("users"));

// todos veem o total e se a própria pessoa já tocou; quem tocou (a lista) só o TI vê
onRecordEnrich((e) => {
  const quem = e.requestInfo ? e.requestInfo.auth : null;
  const lista = e.record.getStringSlice("tambem");
  e.record.withCustomData(true);
  e.record.set("tambem_total", lista.length);
  e.record.set("tambem_eu", !!quem && lista.indexOf(quem.id) >= 0);
  if (!quem || quem.collection().name !== "users" || quem.getString("papel") !== "tecnico") e.record.hide("tambem");
  e.next();
}, "avisos");
