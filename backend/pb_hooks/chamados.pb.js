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

  // fictício (dado de teste) = herdado do solicitante; nunca vem do corpo da requisição
  let ficticio = false;
  if (rec.getString("solicitante")) {
    try { ficticio = e.app.findRecordById("users", rec.getString("solicitante")).getBool("ficticio"); } catch (_) {}
  }
  rec.set("ficticio", ficticio);

  if (!superuser) rec.set("registrado_por", auth.id);
  rec.set("confirmado", false);
  rec.set("peso", R.pesoDe(rec.getString("prioridade")));
  rec.set("protocolo", R.proximoProtocolo(e.app));

  e.next();

  const quem = rec.getString("origem") === "sistema"
    ? "Chamado aberto pelo sistema."
    : `Chamado registrado pelo TI (origem: ${rec.getString("origem")}).`;
  R.registrar(e.app, rec.id, superuser ? "" : auth.id, "sistema", quem, false);

  // vídeo anexado: o servidor comprime em segundo plano (pb_hooks/videos.pb.js)
  const V = require(`${__hooks}/lib/videos.js`);
  if (V.videosPendentes(rec).length) {
    rec.set("midia_pendente", true);
    e.app.save(rec);
  }

  // aviso no celular dos técnicos (ntfy) quando um servidor abre chamado pelo sistema
  if (rec.getString("origem") === "sistema") {
    require(`${__hooks}/lib/avisos.js`).avisarTecnicos(e.app, rec, "Novo chamado");
  }
}, "chamados");

// ---------- atualizar chamado (somente técnicos, pela regra da coleção) ----------
onRecordUpdateRequest((e) => {
  const R = require(`${__hooks}/lib/regras.js`);
  const rec = e.record;
  const antes = rec.original();
  const auth = e.auth;
  const superuser = e.hasSuperuserAuth();

  // campos que não mudam depois da abertura
  for (const campo of ["protocolo", "registrado_por", "solicitante", "origem", "ficticio"]) {
    rec.set(campo, antes.get(campo));
  }

  rec.set("peso", R.pesoDe(rec.getString("prioridade")));

  const de = antes.getString("status");
  const para = rec.getString("status");

  if (para === "resolvido" && (!rec.getString("diagnostico").trim() || !rec.getString("solucao").trim())) {
    throw new BadRequestError("Para resolver, preencha o diagnóstico e a solução. Eles formam o histórico do TI.");
  }

  // aguardando: precisa dizer o quê; fora dele, o motivo some
  if (para === "aguardando") {
    if (!R.ROTULO_AGUARDANDO[rec.getString("aguardando_motivo")]) {
      throw new BadRequestError("Diga o que o chamado está aguardando: peça, resposta do solicitante ou terceiro.");
    }
    if (de !== "aguardando") rec.set("aguardando_desde", R.agora());
  } else {
    rec.set("aguardando_motivo", "");
    rec.set("aguardando_desde", "");
  }

  if (de !== para) {
    if (para === "em_andamento" || para === "aguardando") {
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
  const motivoAntes = antes.getString("aguardando_motivo"), motivo = rec.getString("aguardando_motivo");
  if (de !== para || (para === "aguardando" && motivoAntes !== motivo)) {
    const extra = para === "aguardando" ? ` (${R.ROTULO_AGUARDANDO[motivo]})` : "";
    R.registrar(e.app, rec.id, autor, "status", `Status: ${R.ROTULO_STATUS[de]} → ${R.ROTULO_STATUS[para]}${extra}`, false);
    if (para === "aguardando" && motivo === "solicitante") {
      R.notificarSolicitante(e.app, rec, "O TI precisa de uma resposta sua",
        "O atendimento do seu chamado está esperando uma resposta sua. Abra o chamado e responda por lá.");
    } else if (para === "em_andamento" && de !== "aguardando") {
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
  } else if (antes.getString("responsavel") && !rec.getString("responsavel")) {
    R.registrar(e.app, rec.id, autor, "atribuicao", "Devolvido para a fila, sem responsável", false);
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
  // mensagem pode ser só imagem (print), sem texto
  const temImagem = rec.getUnsavedFiles("anexos").length > 0;
  if (!rec.getString("texto").trim() && !temImagem) {
    throw new BadRequestError("Escreva a mensagem ou anexe uma imagem.");
  }
  rec.set("autor", auth.id);
  rec.set("tipo", "comentario");
  if (!tecnico) rec.set("interno", false);

  e.next();

  if (tecnico && !rec.getBool("interno")) {
    const texto = rec.getString("texto").trim();
    R.notificarSolicitante(e.app, chamado, "O TI respondeu seu chamado",
      texto ? `Mensagem do TI: “${texto}”${temImagem ? " (com imagem)" : ""}` : "O TI mandou uma imagem no seu chamado.");
  }
  if (!tecnico) {
    // estava esperando a resposta dele: volta sozinho para atendimento
    if (chamado.getString("status") === "aguardando" && chamado.getString("aguardando_motivo") === "solicitante") {
      chamado.set("status", "em_andamento");
      chamado.set("aguardando_motivo", "");
      chamado.set("aguardando_desde", "");
      e.app.save(chamado);
      R.registrar(e.app, chamado.id, "", "status", "Status: Em espera → Em andamento (o solicitante respondeu)", false);
    }
    require(`${__hooks}/lib/avisos.js`).avisarTecnicos(e.app, chamado, "Nova mensagem no chamado", "O solicitante respondeu.");
  }
}, "interacoes");
