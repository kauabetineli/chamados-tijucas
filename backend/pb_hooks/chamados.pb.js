/// <reference path="../pb_data/types.d.ts" />

// Regras de abertura e atualização de chamados e comentários.

// ---------- abrir chamado ----------
onRecordCreateRequest((e) => {
  const R = require(`${__hooks}/lib/regras.js`);
  const rec = e.record;
  const auth = e.auth;
  const superuser = e.hasSuperuserAuth();
  const tecnico = superuser || R.ehTecnico(auth);

  if (!rec.getString("descricao").trim()) {
    throw new BadRequestError("Descreva o problema.");
  }

  if (!tecnico) {
    // solicitante: abre sempre em nome próprio, pelo sistema
    rec.set("solicitante", auth.id);
    rec.set("solicitante_nome", "");
    rec.set("origem", "sistema");
    rec.set("responsavel", "");
    rec.set("prioridade", R.PRIORIDADE_POR_IMPACTO[rec.getString("impacto")] || "normal");
    rec.set("status", "aberto");
  } else {
    // técnico: registra o que chegou por WhatsApp, ligação ou corredor
    if (!rec.getString("solicitante") && !rec.getString("solicitante_nome").trim()) {
      throw new BadRequestError("Informe quem pediu o atendimento.");
    }
    if (!rec.getString("origem")) rec.set("origem", "presencial");
    if (!rec.getString("prioridade")) {
      rec.set("prioridade", R.PRIORIDADE_POR_IMPACTO[rec.getString("impacto")] || "normal");
    }
    const status = rec.getString("status") || "aberto";
    rec.set("status", status);
    // permite registrar um atendimento já resolvido na hora (entra no histórico)
    if (status === "resolvido") {
      if (!rec.getString("diagnostico").trim() || !rec.getString("solucao").trim()) {
        throw new BadRequestError("Para registrar como resolvido, preencha o diagnóstico e a solução.");
      }
      rec.set("iniciado_em", R.agora());
      rec.set("resolvido_em", R.agora());
    } else if (status === "em_andamento") {
      rec.set("iniciado_em", R.agora());
    }
    if (status !== "aberto" && !rec.getString("responsavel") && !superuser) {
      rec.set("responsavel", auth.id);
    }
  }

  // setor padrão = setor de quem pediu
  if (!rec.getString("setor") && rec.getString("solicitante")) {
    try {
      const sol = e.app.findRecordById("users", rec.getString("solicitante"));
      if (sol.getString("setor")) rec.set("setor", sol.getString("setor"));
    } catch (_) {}
  }

  if (!superuser) rec.set("registrado_por", auth.id);
  rec.set("confirmado", false);
  rec.set("peso", R.pesoDe(rec.getString("prioridade")));
  rec.set("protocolo", R.proximoProtocolo(e.app));

  e.next();

  const quem = rec.getString("origem") === "sistema"
    ? "Chamado aberto pelo sistema."
    : `Chamado registrado pelo TI (origem: ${rec.getString("origem")}).`;
  R.registrar(e.app, rec.id, superuser ? "" : auth.id, "sistema", quem, false);
}, "chamados");

// ---------- atualizar chamado (somente técnicos, pela regra da coleção) ----------
onRecordUpdateRequest((e) => {
  const R = require(`${__hooks}/lib/regras.js`);
  const rec = e.record;
  const antes = rec.original();
  const auth = e.auth;
  const superuser = e.hasSuperuserAuth();

  // campos que não mudam depois da abertura
  for (const campo of ["protocolo", "registrado_por", "solicitante", "origem"]) {
    rec.set(campo, antes.get(campo));
  }

  rec.set("peso", R.pesoDe(rec.getString("prioridade")));

  const de = antes.getString("status");
  const para = rec.getString("status");

  if (para === "resolvido" && (!rec.getString("diagnostico").trim() || !rec.getString("solucao").trim())) {
    throw new BadRequestError("Para resolver, preencha o diagnóstico e a solução. Eles formam o histórico do TI.");
  }

  if (de !== para) {
    if (para === "em_andamento") {
      if (rec.getDateTime("iniciado_em").isZero()) rec.set("iniciado_em", R.agora());
      rec.set("resolvido_em", "");
    }
    if (para === "resolvido") {
      if (rec.getDateTime("iniciado_em").isZero()) rec.set("iniciado_em", R.agora());
      rec.set("resolvido_em", R.agora());
      rec.set("confirmado", false);
    }
    if (para === "aberto") {
      rec.set("resolvido_em", "");
      rec.set("confirmado", false);
    }
    if (para !== "aberto" && !rec.getString("responsavel") && !superuser) {
      rec.set("responsavel", auth.id);
    }
  }

  e.next();

  const autor = superuser ? "" : auth.id;
  if (de !== para) {
    R.registrar(e.app, rec.id, autor, "status", `Status: ${R.ROTULO_STATUS[de]} → ${R.ROTULO_STATUS[para]}`, false);
    if (para === "em_andamento") {
      R.notificarSolicitante(e.app, rec, "Seu chamado está em atendimento", "Um técnico do TI começou a atender o seu chamado.");
    } else if (para === "resolvido") {
      R.notificarSolicitante(e.app, rec, "Seu chamado foi resolvido",
        "O TI marcou o seu chamado como resolvido. Abra o chamado para confirmar ou avisar se o problema continua.");
    }
  }
  if (antes.getString("prioridade") !== rec.getString("prioridade")) {
    R.registrar(e.app, rec.id, autor, "prioridade",
      `Prioridade: ${R.ROTULO_PRIORIDADE[antes.getString("prioridade")] || "-"} → ${R.ROTULO_PRIORIDADE[rec.getString("prioridade")]}`, true);
  }
  if (antes.getString("responsavel") !== rec.getString("responsavel") && rec.getString("responsavel")) {
    let nome = "";
    try { nome = e.app.findRecordById("users", rec.getString("responsavel")).getString("name"); } catch (_) {}
    R.registrar(e.app, rec.id, autor, "atribuicao", `Responsável: ${nome || "técnico"}`, false);
  }
}, "chamados");

// ---------- comentários ----------
onRecordCreateRequest((e) => {
  const R = require(`${__hooks}/lib/regras.js`);
  if (e.hasSuperuserAuth()) return e.next();

  const auth = e.auth;
  const rec = e.record;
  let chamado;
  try {
    chamado = e.app.findRecordById("chamados", rec.getString("chamado"));
  } catch (_) {
    throw new NotFoundError("Chamado não encontrado.");
  }
  const tecnico = R.ehTecnico(auth);
  if (!tecnico && chamado.getString("solicitante") !== auth.id) {
    throw new ForbiddenError("Você só pode comentar nos seus chamados.");
  }
  if (!rec.getString("texto").trim()) {
    throw new BadRequestError("Escreva a mensagem.");
  }
  rec.set("autor", auth.id);
  rec.set("tipo", "comentario");
  if (!tecnico) rec.set("interno", false);

  e.next();

  if (tecnico && !rec.getBool("interno")) {
    R.notificarSolicitante(e.app, chamado, "O TI respondeu seu chamado", `Mensagem do TI: “${rec.getString("texto")}”`);
  }
}, "interacoes");
