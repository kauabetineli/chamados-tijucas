// "Também estou sem" num aviso do TI (usado por pb_hooks/avisos.pb.js).

function marcar(e, entrar) {
  const R = require(`${__hooks}/lib/regras.js`);
  if (!R.ehUsuario(e.auth)) throw new ForbiddenError("Entre no sistema.");
  let aviso;
  try { aviso = e.app.findRecordById("avisos", e.request.pathValue("id")); } catch (_) { throw new NotFoundError("Aviso não encontrado."); }
  const ate = aviso.getString("ate");
  if (ate && new Date(ate.replace(" ", "T")) < new Date()) throw new BadRequestError("Esse aviso já foi encerrado.");
  const lista = aviso.getStringSlice("tambem").filter((id) => id !== e.auth.id);
  if (entrar) lista.push(e.auth.id);
  aviso.set("tambem", lista);
  e.app.saveNoValidate(aviso);
  return e.json(200, { total: lista.length, eu: entrar });
}

module.exports = { marcar };
