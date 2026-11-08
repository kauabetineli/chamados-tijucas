/// <reference path="../pb_data/types.d.ts" />

// Avisos do TI: "Também estou sem" (migration 1760000016_avisos_tambem.js).
// POST /api/avisos/{id}/tambem  -> { total, eu: true }  (tocar de novo não conta duas vezes)
// DELETE /api/avisos/{id}/tambem -> desfaz.

routerAdd("POST", "/api/avisos/{id}/tambem", (e) => require(`${__hooks}/lib/tambem.js`).marcar(e, true), $apis.requireAuth("users"));
// Técnico encerra um aviso: { resolver: bool, mensagem } -> { resolvidos, aviso_resolvido, pessoas }
// resolver = resolve também os chamados ligados ao aviso; mensagem = aviso "resolvido" para todos (some em 4 h).
routerAdd("POST", "/api/avisos/{id}/encerrar", (e) => {
  const R = require(`${__hooks}/lib/regras.js`);
  if (!R.ehTecnico(e.auth)) throw new ForbiddenError("Só o TI encerra avisos.");
  let aviso;
  try { aviso = e.app.findRecordById("avisos", e.request.pathValue("id")); } catch (_) { throw new NotFoundError("Aviso não encontrado."); }
  const b = e.requestInfo().body || {};
  let r;
  e.app.runInTransaction((tx) => {
    r = require(`${__hooks}/lib/ciclo.js`).encerrarAviso(tx, aviso, e.auth.id, { resolver: !!b.resolver, mensagem: b.mensagem });
  });
  return e.json(200, r);
}, $apis.requireAuth("users"));

routerAdd("DELETE", "/api/avisos/{id}/tambem", (e) => require(`${__hooks}/lib/tambem.js`).marcar(e, false), $apis.requireAuth("users"));

// todos veem o total e se a própria pessoa já tocou; quem tocou (a lista) só o TI vê
onRecordEnrich((e) => {
  const quem = e.requestInfo ? e.requestInfo.auth : null;
  const lista = e.record.getStringSlice("tambem");
  e.record.withCustomData(true);
  e.record.set("tambem_total", lista.length);
  e.record.set("tambem_eu", !!quem && lista.indexOf(quem.id) >= 0);
  if (!quem || quem.collection().name !== "users" || ["tecnico", "observador"].indexOf(quem.getString("papel")) < 0) e.record.hide("tambem");
  e.next();
}, "avisos");
