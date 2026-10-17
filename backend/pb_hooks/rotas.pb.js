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

// Solicitante confirma que o problema foi resolvido e avalia o atendimento.
// Corpo (opcional): { avaliacao: "bom" | "ruim", comentario }. A avaliação é evidência de satisfação (Painel).
routerAdd("POST", "/api/chamados/{id}/confirmar", (e) => {
  const R = require(`${__hooks}/lib/regras.js`);
  const b = e.requestInfo().body || {};
  const c = e.app.findRecordById("chamados", e.request.pathValue("id"));
  if (c.getString("solicitante") !== e.auth.id) throw new ForbiddenError("Este chamado não é seu.");
  if (c.getString("status") !== "resolvido") throw new BadRequestError("O chamado ainda não foi resolvido.");
  const avaliacao = b.avaliacao === "bom" || b.avaliacao === "ruim" ? b.avaliacao : "";
  const comentario = String(b.comentario || "").trim().slice(0, 500);
  c.set("confirmado", true);
  if (avaliacao) c.set("avaliacao", avaliacao);
  if (comentario) c.set("avaliacao_comentario", comentario);
  e.app.save(c);
  const nota = avaliacao === "bom" ? " Avaliou o atendimento: 👍 bom." : avaliacao === "ruim" ? " Avaliou o atendimento: 👎 ruim." : "";
  R.registrar(e.app, c.id, e.auth.id, "sistema", `Solicitante confirmou que o problema foi resolvido.${nota}`, false);
  if (comentario) R.registrar(e.app, c.id, e.auth.id, "comentario", comentario, false);
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

  // avaliação dos solicitantes (chamados confirmados no período)
  const aval = new DynamicModel({ bom: 0, ruim: 0, confirmados: 0 });
  db.newQuery(
    `SELECT COALESCE(SUM(avaliacao = 'bom'), 0) AS bom, COALESCE(SUM(avaliacao = 'ruim'), 0) AS ruim, COUNT(*) AS confirmados
     FROM chamados WHERE status = 'resolvido' AND confirmado = 1 AND resolvido_em >= {:desde}`,
  ).bind({ desde }).one(aval);

  // quem resolveu (período)
  const porTecnico = arrayOf(new DynamicModel({ chave: "", total: 0 }));
  db.newQuery(
    `SELECT COALESCE(u.name, 'Sem responsável') AS chave, COUNT(*) AS total FROM chamados c
     LEFT JOIN users u ON u.id = c.responsavel
     WHERE c.status = 'resolvido' AND c.resolvido_em >= {:desde} GROUP BY chave ORDER BY total DESC`,
  ).bind({ desde }).all(porTecnico);

  return e.json(200, {
    dias,
    total,
    agora: {
      aberto: e.app.countRecords("chamados", $dbx.hashExp({ status: "aberto" })),
      em_andamento: e.app.countRecords("chamados", $dbx.hashExp({ status: "em_andamento" })),
      aguardando: e.app.countRecords("chamados", $dbx.hashExp({ status: "aguardando" })),
    },
    avaliacao: { bom: aval.bom, ruim: aval.ruim, confirmados: aval.confirmados },
    por_tecnico: porTecnico.map((r) => ({ chave: r.chave, total: r.total })),
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

// Números de UM técnico: hoje, últimos 7 dias, mês atual e os 12 meses de um ano (meses sem nada aparecem com 0).
// ?ano=2026  &tecnico=id (só o admin do TI vê os de outro técnico; padrão = quem está logado)
routerAdd("GET", "/api/painel/tecnico", (e) => {
  const R = require(`${__hooks}/lib/regras.js`);
  if (!e.hasSuperuserAuth() && !R.ehTecnico(e.auth)) throw new ForbiddenError("Somente o TI.");
  const q = e.request.url.query();
  let tecnico = q.get("tecnico") || (e.auth ? e.auth.id : "");
  if (tecnico !== (e.auth && e.auth.id) && !e.hasSuperuserAuth() && !R.ehAdmin(e.auth)) {
    throw new ForbiddenError("Só o administrador do TI vê os números de outro técnico.");
  }
  const agoraAno = new Date().getFullYear();
  let ano = parseInt(q.get("ano"), 10);
  if (!(ano >= 2020 && ano <= agoraAno + 1)) ano = agoraAno;
  const db = e.app.db();

  // datas no fuso de Brasília (UTC-3) para "hoje" e "mês"
  const local = (col) => `datetime(${col}, '-3 hours')`;
  const periodo = (onde) => {
    const m = new DynamicModel({ resolvidos: 0, horas: -0, iniciados: 0, bom: 0, ruim: 0 });
    db.newQuery(
      `SELECT
         COALESCE(SUM(status = 'resolvido' AND ${onde("resolvido_em")}), 0) AS resolvidos,
         COALESCE(AVG(CASE WHEN status = 'resolvido' AND ${onde("resolvido_em")}
                   THEN (julianday(resolvido_em) - julianday(created)) * 24 END), 0) AS horas,
         COALESCE(SUM(iniciado_em != '' AND ${onde("iniciado_em")}), 0) AS iniciados,
         COALESCE(SUM(avaliacao = 'bom' AND ${onde("resolvido_em")}), 0) AS bom,
         COALESCE(SUM(avaliacao = 'ruim' AND ${onde("resolvido_em")}), 0) AS ruim
       FROM chamados WHERE responsavel = {:t}`,
    ).bind({ t: tecnico }).one(m);
    return { resolvidos: m.resolvidos, horas_media: Math.round(m.horas * 100) / 100, iniciados: m.iniciados, bom: m.bom, ruim: m.ruim };
  };
  const hoje = periodo((c) => `date(${local(c)}) = date('now', '-3 hours')`);
  const semana = periodo((c) => `${local(c)} >= datetime('now', '-3 hours', '-6 days', 'start of day')`);
  const mes = periodo((c) => `strftime('%Y-%m', ${local(c)}) = strftime('%Y-%m', 'now', '-3 hours')`);

  // mês a mês do ano escolhido: resolvidos (com tempo médio e avaliações) e atendimentos iniciados
  const meses = arrayOf(new DynamicModel({ mes: "", resolvidos: 0, horas: -0, bom: 0, ruim: 0 }));
  db.newQuery(
    `SELECT strftime('%m', ${local("resolvido_em")}) AS mes, COUNT(*) AS resolvidos,
       COALESCE(AVG((julianday(resolvido_em) - julianday(created)) * 24), 0) AS horas,
       COALESCE(SUM(avaliacao = 'bom'), 0) AS bom, COALESCE(SUM(avaliacao = 'ruim'), 0) AS ruim
     FROM chamados WHERE responsavel = {:t} AND status = 'resolvido' AND strftime('%Y', ${local("resolvido_em")}) = {:ano}
     GROUP BY mes`,
  ).bind({ t: tecnico, ano: String(ano) }).all(meses);
  const iniciadosMes = arrayOf(new DynamicModel({ mes: "", total: 0 }));
  db.newQuery(
    `SELECT strftime('%m', ${local("iniciado_em")}) AS mes, COUNT(*) AS total
     FROM chamados WHERE responsavel = {:t} AND iniciado_em != '' AND strftime('%Y', ${local("iniciado_em")}) = {:ano}
     GROUP BY mes`,
  ).bind({ t: tecnico, ano: String(ano) }).all(iniciadosMes);
  const porMes = Array.from({ length: 12 }, (_, i) => {
    const m = meses.find((x) => parseInt(x.mes, 10) === i + 1);
    const ini = iniciadosMes.find((x) => parseInt(x.mes, 10) === i + 1);
    return {
      mes: i + 1,
      resolvidos: m ? m.resolvidos : 0,
      horas_media: m ? Math.round(m.horas * 100) / 100 : 0,
      bom: m ? m.bom : 0,
      ruim: m ? m.ruim : 0,
      iniciados: ini ? ini.total : 0,
    };
  });

  // anos com algum chamado resolvido por ele (para o seletor), sempre com o ano atual
  const anosRows = arrayOf(new DynamicModel({ ano: "" }));
  db.newQuery(
    `SELECT DISTINCT strftime('%Y', ${local("resolvido_em")}) AS ano FROM chamados
     WHERE responsavel = {:t} AND resolvido_em != '' ORDER BY ano DESC`,
  ).bind({ t: tecnico }).all(anosRows);
  const anos = Array.from(new Set([agoraAno, ...anosRows.map((r) => parseInt(r.ano, 10)).filter((n) => n > 2000)])).sort((a, b) => b - a);

  return e.json(200, {
    tecnico,
    ano,
    anos,
    hoje, semana, mes,
    agora: {
      atendendo: e.app.countRecords("chamados", $dbx.hashExp({ responsavel: tecnico, status: "em_andamento" })),
      aguardando: e.app.countRecords("chamados", $dbx.hashExp({ responsavel: tecnico, status: "aguardando" })),
      na_fila: e.app.countRecords("chamados", $dbx.hashExp({ responsavel: tecnico, status: "aberto" })),
    },
    por_mes: porMes,
  });
}, $apis.requireAuth());

// "Como chamados assim já foram resolvidos": resolvidos da mesma categoria, os mais parecidos primeiro
// (palavras em comum na descrição) e, empatando, os mais recentes. Só para o TI.
routerAdd("GET", "/api/chamados/{id}/solucoes-parecidas", (e) => {
  const R = require(`${__hooks}/lib/regras.js`);
  if (!e.hasSuperuserAuth() && !R.ehTecnico(e.auth)) throw new ForbiddenError("Somente o TI.");
  const c = e.app.findRecordById("chamados", e.request.pathValue("id"));
  const candidatos = e.app.findRecordsByFilter(
    "chamados", "status = 'resolvido' && categoria = {:cat} && id != {:id} && solucao != ''", "-resolvido_em", 60, 0,
    { cat: c.getString("categoria"), id: c.id },
  ).filter((r) => !!r);
  // palavras comuns que não dizem nada sobre o problema (já sem acento; as de até 3 letras já ficam de fora)
  const COMUNS = new Set(("para pela pelo pelos pelas como esta estao esse essa isso este isto aqui quando desde "
    + "hoje ontem agora mais muito muita pouco tudo todo toda todos todas nada fica ficou consigo consegue "
    + "preciso precisa favor alguem algum alguma outro outra mesmo mesma sempre ainda depois antes porque "
    + "entao tambem nosso nossa minha meus minhas dele dela seus suas onde qual quais sera seria").split(" "));
  const palavras = (t) => new Set(String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !COMUNS.has(w)));
  const base = palavras(c.getString("descricao"));
  const total = candidatos.length;
  const itens = candidatos
    .map((r, i) => {
      let comum = 0;
      for (const w of palavras(r.getString("descricao"))) if (base.has(w)) comum++;
      return { r, nota: comum * 100 - i };
    })
    .sort((a, b) => b.nota - a.nota)
    .slice(0, 5)
    .map(({ r }) => ({
      id: r.id,
      protocolo: r.getString("protocolo"),
      descricao: r.getString("descricao"),
      diagnostico: r.getString("diagnostico"),
      solucao: r.getString("solucao"),
      resolvido_em: r.getString("resolvido_em"),
    }));
  return e.json(200, { total, itens });
}, $apis.requireAuth());
