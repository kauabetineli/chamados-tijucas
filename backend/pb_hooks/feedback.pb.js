/// <reference path="../pb_data/types.d.ts" />

// "Sua opinião": feedback sobre o sistema, para a equipe do projeto (ver migration 1760000015_feedback.js).
// POST /api/feedback { tipo: problema|ideia|elogio|nota, texto, tela, nota (0 a 5) } (JSON ou multipart com "imagem")
// O servidor preenche quem enviou, o papel, o setor e se é dado de teste. Limite: 30 por pessoa por dia.

routerAdd("POST", "/api/feedback", (e) => {
  const R = require(`${__hooks}/lib/regras.js`);
  if (!R.ehUsuario(e.auth)) throw new ForbiddenError("Entre no sistema para enviar sua opinião.");
  const b = e.requestInfo().body || {};
  const tipo = ["problema", "ideia", "elogio", "nota"].indexOf(b.tipo) >= 0 ? b.tipo : "";
  if (!tipo) throw new BadRequestError("Escolha sobre o que é a sua opinião.");
  const texto = String(b.texto || "").trim().slice(0, 2000);
  const nota = Math.max(0, Math.min(5, parseInt(b.nota, 10) || 0));
  if (tipo !== "nota" && texto.length < 3) throw new BadRequestError("Escreva o que aconteceu ou o que você pensou.");
  if (tipo === "nota" && !nota) throw new BadRequestError("Escolha uma nota de 1 a 5.");

  const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString().replace("T", " ");
  const hoje = e.app.countRecords("feedbacks", $dbx.exp("autor = {:a} AND created >= {:d}", { a: e.auth.id, d: desde }));
  if (hoje >= 30) throw new BadRequestError("Você já mandou muitas opiniões hoje. Obrigado! Tente amanhã.");

  const r = new Record(e.app.findCollectionByNameOrId("feedbacks"));
  r.set("autor", e.auth.id);
  r.set("tipo", tipo);
  r.set("texto", texto);
  r.set("tela", String(b.tela || "").slice(0, 120));
  r.set("nota", nota);
  r.set("papel", e.auth.getString("papel"));
  r.set("setor", e.auth.getString("setor"));
  r.set("situacao", "novo");
  r.set("ficticio", e.auth.getBool("ficticio"));
  // print opcional (multipart): o tamanho e o tipo são conferidos pelo campo (migration 1760000018)
  try {
    const arquivos = e.findUploadedFiles("imagem");
    if (arquivos && arquivos.length) r.set("imagem", arquivos[0]);
  } catch (_) { /* sem arquivo (JSON) */ }
  e.app.save(r);
  return e.json(200, { ok: true });
}, $apis.requireAuth("users"));

// a lista da equipe vem com o nome de quem mandou (as regras normais esconderiam o autor de outras contas)
onRecordEnrich((e) => {
  const quem = e.requestInfo ? e.requestInfo.auth : null;
  if (quem && quem.collection().name === "users" && quem.getBool("equipe_projeto")) {
    const id = e.record.getString("autor");
    if (id) {
      try {
        e.record.withCustomData(true);
        e.record.set("autor_nome", e.app.findRecordById("users", id).getString("name"));
      } catch (_) {}
    }
  }
  e.next();
}, "feedbacks");
