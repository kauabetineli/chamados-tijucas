/// <reference path="../pb_data/types.d.ts" />

// Configurações do TI: automação dos chamados, equipe e ausências, e a configuração da fila.
// O motor fica em lib/automacao.js. Documentação das rotas: docs/API.md.

// ---------- automação: ler a versão em vigor e o histórico ----------
routerAdd("GET", "/api/ti/automacao", (e) => {
  const R = require(`${__hooks}/lib/regras.js`);
  const A = require(`${__hooks}/lib/automacao.js`);
  if (!e.hasSuperuserAuth() && !R.ehTecnico(e.auth)) throw new ForbiddenError("Somente o TI.");
  const versoes = e.app.findRecordsByFilter("automacao_versoes", "", "-created", 15, 0);
  const historico = versoes.filter(Boolean).map((v) => {
    let autor = "";
    if (v.getString("autor")) { try { autor = e.app.findRecordById("users", v.getString("autor")).getString("name"); } catch (_) {} }
    return { id: v.id, quando: v.getString("created"), autor, resumo: v.getString("resumo") };
  });
  return e.json(200, {
    versao: versoes.length && versoes[0] ? versoes[0].id : "",
    dados: A.lerAutomacao(e.app),
    historico,
  });
}, $apis.requireAuth());

// ---------- automação: salvar (cria uma versão nova) ----------
// Corpo: { dados, resumo, base } — base = id da versão que a tela abriu; se outra pessoa salvou depois, recusa.
routerAdd("POST", "/api/ti/automacao", (e) => {
  const R = require(`${__hooks}/lib/regras.js`);
  const A = require(`${__hooks}/lib/automacao.js`);
  if (!e.hasSuperuserAuth() && !R.ehAdmin(e.auth)) throw new ForbiddenError("Somente o administrador do TI muda a automação.");
  const b = e.requestInfo().body || {};
  const atual = e.app.findRecordsByFilter("automacao_versoes", "", "-created", 1, 0);
  if (b.base && atual.length && atual[0] && atual[0].id !== b.base) {
    throw new BadRequestError("Outra pessoa salvou a automação enquanto você editava. Recarregue a página para ver a versão nova.");
  }
  const dados = A.normalizarAutomacao(b.dados);
  const erros = A.validarAutomacao(dados);
  if (erros.length) throw new BadRequestError(erros.join(" "));
  const col = e.app.findCollectionByNameOrId("automacao_versoes");
  const v = new Record(col);
  v.set("dados", dados);
  if (!e.hasSuperuserAuth()) v.set("autor", e.auth.id);
  v.set("resumo", String(b.resumo || "Alterou as regras").slice(0, 300));
  e.app.save(v);
  return e.json(200, { versao: v.id, dados });
}, $apis.requireAuth());

// ---------- automação: testar um chamado de exemplo com os fluxos da tela (sem salvar nada) ----------
// Corpo: { dados, gatilho, chamado: { categoria, setor, impacto, prioridade, origem, texto, anexo, horario, responsavel }, giro }
// Roda TODOS os fluxos ligados do gatilho pedido, na ordem da lista, como o servidor faria.
routerAdd("POST", "/api/ti/automacao/testar", (e) => {
  const R = require(`${__hooks}/lib/regras.js`);
  const A = require(`${__hooks}/lib/automacao.js`);
  if (!e.hasSuperuserAuth() && !R.ehTecnico(e.auth)) throw new ForbiddenError("Somente o TI.");
  const b = e.requestInfo().body || {};
  const dados = A.normalizarAutomacao(b.dados);
  const gatilho = A.GATILHOS.indexOf(b.gatilho) >= 0 ? b.gatilho : "novo";
  const ch = b.chamado || {};
  const info = {
    categoria: String(ch.categoria || ""), setor: String(ch.setor || ""), impacto: String(ch.impacto || "so_eu"),
    prioridade: A.NIVEL[ch.prioridade] ? ch.prioridade : (R.PRIORIDADE_POR_IMPACTO[ch.impacto] || "normal"),
    origem: String(ch.origem || "sistema"), texto: String(ch.texto || ""), anexo: ch.anexo === "sim" ? "sim" : "nao",
    horario: ["expediente", "fora", "fim_semana"].indexOf(ch.horario) >= 0 ? ch.horario : "expediente",
    responsavel: ch.responsavel === "sim" ? "sim" : "nao",
  };
  const ctx = A.contexto(e.app);
  const giro = b.giro || {}; // a tela soma "abrir outro igual" sem mexer no contador real
  const r = A.executar(dados, gatilho, info, Object.assign({}, ctx, { giro: (k) => ctx.giro(k) + (parseInt(giro[k], 10) || 0) }), { podeAtribuir: true });
  const cfg = A.lerConfig(e.app);
  return e.json(200, {
    gatilho,
    prioridade: r.prioridade, prioridade_antes: info.prioridade,
    prazo_min: r.prazoMin || cfg.prazos[r.prioridade],
    pessoa: r.pessoa, pessoa_nome: ctx.nome(r.pessoa), regra: r.regraPessoa, giro_regra: r.giroUsado,
    devolver: r.devolver, efeitos: r.efeitos, fluxos: r.fluxos, traco: r.traco, conflitos: r.conflitos,
    erros: A.validarAutomacao(dados),
  });
}, $apis.requireAuth());

// ---------- equipe e ausências ----------
routerAdd("GET", "/api/ti/equipe", (e) => {
  const R = require(`${__hooks}/lib/regras.js`);
  const A = require(`${__hooks}/lib/automacao.js`);
  if (!e.hasSuperuserAuth() && !R.ehTecnico(e.auth)) throw new ForbiddenError("Somente o TI.");
  const ctx = A.contexto(e.app);
  const lista = Object.keys(ctx.tecnicos).map((id) => {
    const u = ctx.tecnicos[id];
    return {
      id, nome: u.getString("name"), admin: u.getBool("admin"), bloqueado: u.getBool("bloqueado"), ficticio: u.getBool("ficticio"),
      carga: ctx.carga[id] || 0,
      ausente_de: u.getString("ausente_de").slice(0, 10), ausente_ate: u.getString("ausente_ate").slice(0, 10),
      ausencia_motivo: u.getString("ausencia_motivo"), sem_automatico: u.getBool("sem_automatico"),
      ausente_hoje: A.ausenteHoje(u), disponivel: ctx.disponivel(id),
    };
  }).sort((a, b) => a.nome.localeCompare(b.nome));
  return e.json(200, { equipe: lista, destino_ausencia: A.lerConfig(e.app).destino_ausencia });
}, $apis.requireAuth());

// Corpo: { ausente_de, ausente_ate ("AAAA-MM-DD" ou ""), ausencia_motivo, sem_automatico }.
// O admin muda qualquer técnico; cada técnico pode marcar a própria ausência (não o "sem_automatico").
routerAdd("PATCH", "/api/ti/equipe/{id}", (e) => {
  const R = require(`${__hooks}/lib/regras.js`);
  const A = require(`${__hooks}/lib/automacao.js`);
  const superuser = e.hasSuperuserAuth();
  const admin = superuser || R.ehAdmin(e.auth);
  const id = e.request.pathValue("id");
  if (!admin && !(R.ehTecnico(e.auth) && e.auth.id === id)) throw new ForbiddenError("Só o administrador do TI muda a situação de outra pessoa.");
  let u;
  try { u = e.app.findRecordById("users", id); } catch (_) { throw new NotFoundError("Pessoa não encontrada."); }
  if (u.getString("papel") !== "tecnico") throw new BadRequestError("Ausência é só para técnicos.");
  const b = e.requestInfo().body || {};
  const data = (v) => {
    const s = String(v || "").trim();
    if (!s) return "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new BadRequestError("Data inválida.");
    return s + " 00:00:00.000Z";
  };
  const estavaAusente = A.ausenteHoje(u);
  if (b.ausente_de !== undefined) u.set("ausente_de", data(b.ausente_de));
  if (b.ausente_ate !== undefined) u.set("ausente_ate", data(b.ausente_ate));
  const de = u.getString("ausente_de").slice(0, 10), ate = u.getString("ausente_ate").slice(0, 10);
  if (de && ate && ate < de) throw new BadRequestError("A volta não pode ser antes do começo da ausência.");
  if (b.ausencia_motivo !== undefined) u.set("ausencia_motivo", String(b.ausencia_motivo || "").trim().slice(0, 120));
  if (b.sem_automatico !== undefined && admin) u.set("sem_automatico", b.sem_automatico === true);
  e.app.saveNoValidate(u);
  let devolvidos = 0;
  if (!estavaAusente && A.ausenteHoje(u) && A.lerConfig(e.app).destino_ausencia === "fila") devolvidos = A.devolverChamadosDe(e.app, u.id);
  return e.json(200, { ok: true, devolvidos, ausente_hoje: A.ausenteHoje(u) });
}, $apis.requireAuth());

// ---------- configuração da fila (coleção config_ti) ----------
// Só o admin altera (regra da coleção). Aqui: limpa o que veio e, se mudou a ordem, os prazos ou o horário,
// recalcula o prazo e o lugar na fila de todos os chamados não resolvidos.
onRecordUpdateRequest((e) => {
  const A = require(`${__hooks}/lib/automacao.js`);
  const antes = A.normalizarConfig(A.jsonCampo(e.record.original(), "dados"));
  const depois = A.normalizarConfig(A.jsonCampo(e.record, "dados"));
  e.record.set("chave", e.record.original().getString("chave"));
  e.record.set("dados", depois);
  e.next();
  const mudou = (k) => JSON.stringify(antes[k]) !== JSON.stringify(depois[k]);
  if (mudou("ordem_fila") || mudou("prazos") || mudou("horario")) A.recalcularFila(e.app, depois);
}, "config_ti");

// ---------- fluxos de tempo: a cada 5 minutos ----------
cronAdd("automacao-tempo", "*/5 * * * *", () => {
  try {
    require(`${__hooks}/lib/automacao.js`).rodarRegrasDeTempo($app);
  } catch (err) {
    $app.logger().warn("Falha nos fluxos de tempo", "erro", String(err));
  }
  // resolvido sem resposta há N dias úteis: considerado resolvido (lib/ciclo.js)
  try {
    require(`${__hooks}/lib/ciclo.js`).confirmarSozinho($app);
  } catch (err) {
    $app.logger().warn("Falha na confirmação automática", "erro", String(err));
  }
});

// ---------- categorias: o admin edita; "Outro" (protegida) sempre aparece ----------
onRecordUpdateRequest((e) => {
  const antes = e.record.original();
  if (antes.getBool("protegida")) { e.record.set("ativa", true); e.record.set("protegida", true); }
  if (!e.hasSuperuserAuth()) e.record.set("protegida", antes.getBool("protegida"));
  const limpar = (campo, max) => {
    const A = require(`${__hooks}/lib/automacao.js`);
    const v = A.jsonCampo(e.record, campo);
    e.record.set(campo, (Array.isArray(v) ? v : []).map((x) => String(x).trim().slice(0, 120)).filter(Boolean).slice(0, max));
  };
  limpar("sugestoes", 6);
  limpar("dicas", 8);
  if (!e.record.getString("nome").trim()) throw new BadRequestError("Dê um nome para a categoria.");
  e.next();
}, "categorias");

onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth()) e.record.set("protegida", false);
  if (!e.record.getString("icone")) e.record.set("icone", "circle-help");
  e.next();
}, "categorias");

// Roda os fluxos de tempo na hora (para testes e para as ferramentas; o cron faz isso a cada 5 minutos).
routerAdd("POST", "/api/ti/automacao/rodar-tempo", (e) => {
  if (!e.hasSuperuserAuth()) throw new ForbiddenError("Somente superusuário.");
  return e.json(200, {
    aplicadas: require(`${__hooks}/lib/automacao.js`).rodarRegrasDeTempo(e.app),
    confirmados: require(`${__hooks}/lib/ciclo.js`).confirmarSozinho(e.app),
  });
});
