/// <reference path="../pb_data/types.d.ts" />

// Rotas próprias do sistema (além da API automática do PocketBase).

// Posição na fila dos chamados abertos do usuário logado.
// "a_frente" = quantos chamados abertos serão atendidos antes deste
// (maior prioridade primeiro; mesma prioridade, quem abriu antes).
routerAdd("GET", "/api/fila/minhas-posicoes", (e) => {
  const meus = e.app.findRecordsByFilter(
    "chamados", "solicitante = {:u} && status = 'aberto'", "created", 0, 0, { u: e.auth.id },
  );
  const totalAberto = e.app.countRecords("chamados", $dbx.hashExp({ status: "aberto" }));
  const itens = {};
  for (const c of meus) {
    if (!c) continue;
    const aFrente = e.app.countRecords("chamados", $dbx.exp(
      "status = 'aberto' AND (peso > {:peso} OR (peso = {:peso} AND created < {:criado}))",
      { peso: c.getInt("peso"), criado: c.getString("created") },
    ));
    itens[c.id] = { a_frente: aFrente, posicao: aFrente + 1 };
  }
  return e.json(200, { total_aberto: totalAberto, itens });
}, $apis.requireAuth("users"));

// Solicitante confirma que o problema foi resolvido.
routerAdd("POST", "/api/chamados/{id}/confirmar", (e) => {
  const R = require(`${__hooks}/lib/regras.js`);
  const c = e.app.findRecordById("chamados", e.request.pathValue("id"));
  if (c.getString("solicitante") !== e.auth.id) throw new ForbiddenError("Este chamado não é seu.");
  if (c.getString("status") !== "resolvido") throw new BadRequestError("O chamado ainda não foi resolvido.");
  c.set("confirmado", true);
  e.app.save(c);
  R.registrar(e.app, c.id, e.auth.id, "sistema", "Solicitante confirmou que o problema foi resolvido.", false);
  return e.json(200, { ok: true });
}, $apis.requireAuth("users"));

// Solicitante avisa que o problema continua: o chamado volta para a fila.
routerAdd("POST", "/api/chamados/{id}/reabrir", (e) => {
  const R = require(`${__hooks}/lib/regras.js`);
  const body = e.requestInfo().body || {};
  const motivo = String(body.motivo || "").trim();
  if (!motivo) throw new BadRequestError("Conte o que continua acontecendo.");
  const c = e.app.findRecordById("chamados", e.request.pathValue("id"));
  if (c.getString("solicitante") !== e.auth.id) throw new ForbiddenError("Este chamado não é seu.");
  if (c.getString("status") !== "resolvido") throw new BadRequestError("Só é possível reabrir um chamado resolvido.");
  c.set("status", "aberto");
  c.set("resolvido_em", "");
  c.set("confirmado", false);
  e.app.save(c);
  R.registrar(e.app, c.id, e.auth.id, "status", "Status: Resolvido → Aberto (reaberto pelo solicitante)", false);
  R.registrar(e.app, c.id, e.auth.id, "comentario", motivo, false);
  require(`${__hooks}/lib/avisos.js`).avisarTecnicos(e.app, c, "Chamado reaberto", "O solicitante disse que o problema continua.");
  return e.json(200, { ok: true });
}, $apis.requireAuth("users"));

// Indicadores para o painel do TI (e para as evidências do projeto).
// ?dias=30 (padrão) define o período.
routerAdd("GET", "/api/painel/resumo", (e) => {
  const R = require(`${__hooks}/lib/regras.js`);
  if (!e.hasSuperuserAuth() && !R.ehTecnico(e.auth)) throw new ForbiddenError("Somente o TI.");

  let dias = parseInt(e.request.url.query().get("dias"), 10);
  if (!(dias > 0 && dias <= 366)) dias = 30;
  const desde = new Date(Date.now() - dias * 86400000).toISOString().replace("T", " ");

  const db = e.app.db();
  const agrupar = (coluna, juncao) => {
    const rows = arrayOf(new DynamicModel({ chave: "", total: 0 }));
    db.newQuery(
      `SELECT ${coluna} AS chave, COUNT(*) AS total FROM chamados c ${juncao || ""}
       WHERE c.created >= {:desde} GROUP BY chave ORDER BY total DESC`,
    ).bind({ desde }).all(rows);
    return rows.map((r) => ({ chave: r.chave, total: r.total }));
  };

  const porDia = arrayOf(new DynamicModel({ dia: "", total: 0 }));
  db.newQuery(
    `SELECT date(created, '-3 hours') AS dia, COUNT(*) AS total FROM chamados
     WHERE created >= {:desde} GROUP BY dia ORDER BY dia`,
  ).bind({ desde }).all(porDia);

  const tempos = new DynamicModel({ resolvidos: 0, horas_resolucao: -0, horas_inicio: -0 });
  db.newQuery(
    `SELECT COUNT(*) AS resolvidos,
       COALESCE(AVG((julianday(resolvido_em) - julianday(created)) * 24), 0) AS horas_resolucao,
       COALESCE(AVG((julianday(iniciado_em) - julianday(created)) * 24), 0) AS horas_inicio
     FROM chamados WHERE status = 'resolvido' AND resolvido_em != '' AND created >= {:desde}`,
  ).bind({ desde }).one(tempos);

  const total = e.app.countRecords("chamados", $dbx.exp("created >= {:desde}", { desde }));

  return e.json(200, {
    dias,
    total,
    agora: {
      aberto: e.app.countRecords("chamados", $dbx.hashExp({ status: "aberto" })),
      em_andamento: e.app.countRecords("chamados", $dbx.hashExp({ status: "em_andamento" })),
    },
    resolvidos: tempos.resolvidos,
    horas_media_resolucao: Math.round(tempos.horas_resolucao * 1000) / 1000,
    horas_media_inicio: Math.round(tempos.horas_inicio * 1000) / 1000,
    por_origem: agrupar("c.origem"),
    por_categoria: agrupar("COALESCE(k.nome, 'Sem categoria')", "LEFT JOIN categorias k ON k.id = c.categoria"),
    por_setor: agrupar("COALESCE(s.nome, 'Sem setor')", "LEFT JOIN setores s ON s.id = c.setor"),
    por_dia: porDia.map((r) => ({ dia: r.dia, total: r.total })),
  });
}, $apis.requireAuth());

// Chamados em aberto da mesma categoria no setor de quem está abrindo (ou dele mesmo).
// Usado para avisar "já existe um chamado sobre isso" e evitar duplicados.
// Devolve só protocolo, status e data: nada de descrição de colegas.
routerAdd("GET", "/api/chamados/semelhantes", (e) => {
  const categoria = e.request.url.query().get("categoria");
  if (!categoria) return e.json(200, { itens: [] });
  const setor = e.auth.getString("setor");
  const dono = setor ? "(setor = {:s} || solicitante = {:u})" : "solicitante = {:u}";
  const lista = e.app.findRecordsByFilter(
    "chamados", `status != 'resolvido' && categoria = {:c} && ${dono}`, "-created", 5, 0,
    { c: categoria, s: setor, u: e.auth.id },
  );
  return e.json(200, {
    itens: lista.filter((r) => !!r).map((r) => ({
      id: r.id,
      protocolo: r.getString("protocolo"),
      status: r.getString("status"),
      created: r.getString("created"),
      meu: r.getString("solicitante") === e.auth.id,
    })),
  });
}, $apis.requireAuth("users"));
