// Fim do ciclo do chamado (migration 1760000017_ciclo_do_chamado.js).
// Atenção (PocketBase/goja): importe DENTRO do handler: const C = require(`${__hooks}/lib/ciclo.js`)

/** Data (texto do PocketBase) de N dias úteis atrás (segunda a sexta). */
function diasUteisAtras(n, agora) {
  const d = new Date(agora || Date.now());
  let faltam = n;
  while (faltam > 0) {
    d.setDate(d.getDate() - 1);
    const dia = d.getDay();
    if (dia !== 0 && dia !== 6) faltam--;
  }
  return d.toISOString().replace("T", " ");
}

/**
 * Resolvido sem resposta do servidor há N dias úteis: considerado resolvido (confirmado_auto).
 * Roda no cron dos fluxos de tempo. N vem de config_ti (dias_confirmar; 0 = desligado).
 */
function confirmarSozinho(app) {
  const A = require(`${__hooks}/lib/automacao.js`);
  const R = require(`${__hooks}/lib/regras.js`);
  const n = A.lerConfig(app).dias_confirmar;
  if (!n) return 0;
  const limite = diasUteisAtras(n);
  const lista = app.findRecordsByFilter(
    "chamados", "status = 'resolvido' && confirmado = false && resolvido_em != '' && resolvido_em <= {:l}",
    "resolvido_em", 200, 0, { l: limite },
  ).filter((c) => !!c);
  for (const c of lista) {
    c.set("confirmado", true);
    c.set("confirmado_auto", true);
    app.saveNoValidate(c);
    R.registrar(app, c.id, "", "sistema", `Considerado resolvido: sem resposta em ${n} ${n === 1 ? "dia útil" : "dias úteis"}.`, false);
  }
  return lista.length;
}

/**
 * Encerra um aviso do TI. Opcionalmente resolve os chamados ligados a ele (chamados.aviso) com a mesma mensagem
 * e publica um aviso "resolvido" para todos (quem disse "também estou com esse problema" vê na hora).
 */
function encerrarAviso(app, aviso, autorId, opcoes) {
  const R = require(`${__hooks}/lib/regras.js`);
  const mensagem = String(opcoes.mensagem || "").trim().slice(0, 240);
  aviso.set("ate", R.agora());
  app.save(aviso);

  let resolvidos = 0;
  if (opcoes.resolver) {
    const ligados = app.findRecordsByFilter("chamados", "aviso = {:a} && status != 'resolvido'", "created", 500, 0, { a: aviso.id })
      .filter((c) => !!c);
    for (const c of ligados) {
      const de = c.getString("status");
      c.set("status", "resolvido");
      if (c.getDateTime("iniciado_em").isZero()) c.set("iniciado_em", R.agora());
      c.set("resolvido_em", R.agora());
      c.set("confirmado", false);
      c.set("confirmado_auto", false);
      c.set("aguardando_motivo", "");
      c.set("aguardando_desde", "");
      if (!c.getString("responsavel")) c.set("responsavel", autorId);
      if (mensagem && !c.getString("solucao")) c.set("solucao", mensagem);
      app.saveNoValidate(c);
      R.registrar(app, c.id, autorId, "status", `Status: ${R.ROTULO_STATUS[de]} → ${R.ROTULO_STATUS.resolvido} (junto com o aviso do TI)`, false);
      if (mensagem) R.registrar(app, c.id, autorId, "comentario", mensagem, false);
      R.notificarSolicitante(app, c, "Seu chamado foi resolvido",
        mensagem || "O TI resolveu o problema do aviso. Abra o chamado para confirmar ou avisar se continua.");
      resolvidos++;
    }
  }

  let novo = "";
  if (mensagem) {
    const col = app.findCollectionByNameOrId("avisos");
    const r = new Record(col);
    r.set("texto", mensagem);
    r.set("tipo", "resolvido");
    r.set("autor", autorId);
    r.set("ate", new Date(Date.now() + 4 * 3600 * 1000).toISOString().replace("T", " "));
    app.save(r);
    novo = r.id;
  }
  return { resolvidos, aviso_resolvido: novo, pessoas: aviso.getStringSlice("tambem").length };
}

module.exports = { confirmarSozinho, encerrarAviso, diasUteisAtras };
