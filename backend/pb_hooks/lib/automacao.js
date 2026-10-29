// Automação dos chamados (tela "Configurações do TI" > "Automação dos chamados").
//
// O caminho de um chamado novo:
//   1. "ajustes": TODAS as regras que combinarem são aplicadas (prioridade: vale a maior; prazo: vale o menor;
//      avisos, respostas automáticas e notas internas somam).
//   2. "quem": de cima para baixo, vale a PRIMEIRA regra que escolher uma pessoa disponível. Blocos agrupam regras:
//      as de dentro só são verificadas se o chamado combinar com o bloco; o rodapé do bloco diz o que fazer se
//      nenhuma de dentro servir (continuar para baixo, deixar livre ou mandar para alguém).
//   3. "senao": se ninguém foi escolhido (inclusive porque a pessoa está ausente).
//   4. "tempo": vigia os chamados abertos (cron a cada 5 min). Cada regra age no máximo UMA vez por chamado.
//
// As regras ficam em automacao_versoes (a versão mais recente vale). O MESMO motor responde a rota de teste
// (POST /api/ti/automacao/testar), então o "Testar" da tela mostra exatamente o que o servidor faria.
//
// Formato (JSON):
//   regra = { id, nome, ativa, conds: [{ campo, op, valores: [] }], acoes: [{ tipo, valor?, pessoas?, modo? }] }
//   bloco = { tipo: "bloco", id, nome, ativa, conds, senao: { tipo: "continua"|"livre"|"pessoa", pessoa? }, regras: [regra] }
//   regra de tempo = regra + { gatilho: "sem_inicio"|"vencido"|"espera", minutos }
//   campos: categoria (id), setor (id), impacto, prioridade, origem, texto (palavras), anexo, horario, reaberto
//   ops: "e" | "nao_e" | "contem" | "nao_contem"
//   ações: prioridade, prazo (minutos), avisar (equipe|responsavel|id), resposta (texto), nota (texto),
//          atribuir (id), rodizio (pessoas, modo: sequencia|carga), subir, devolver
//
// Atenção (PocketBase/goja): importe DENTRO do handler: const A = require(`${__hooks}/lib/automacao.js`)

const NIVEL = { baixa: 1, normal: 2, alta: 3, urgente: 4 };
const PRIO_DO_NIVEL = { 1: "baixa", 2: "normal", 3: "alta", 4: "urgente" };
const PESO = { baixa: 1, normal: 2, alta: 3, urgente: 4 };

const CONFIG_PADRAO = {
  ordem_fila: "prazo",
  prazos: { urgente: 60, alta: 240, normal: 1440, baixa: 4320 },
  servidor_prioridade: false,
  teto_prioridade: "urgente",
  pedir_motivo_urgente: true,
  marcar_escolhida: true,
  horario: { ativo: false, dias: [1, 2, 3, 4, 5], inicio: "08:00", fim: "17:00" },
  destino_ausencia: "fica",
};
const AUTOMACAO_VAZIA = { ajustes: [], quem: [], senao: { tipo: "livre" }, tempo: [] };

const CAMPOS = ["categoria", "setor", "impacto", "prioridade", "origem", "texto", "anexo", "horario", "reaberto"];
const ACOES_POR_ETAPA = {
  ajustes: ["prioridade", "prazo", "avisar", "resposta", "nota"],
  quem: ["atribuir", "rodizio", "avisar", "nota"],
  tempo: ["avisar", "subir", "devolver", "resposta", "nota"],
};
const GATILHOS = ["sem_inicio", "vencido", "espera"];

// ---------- leitura ----------

function lerConfig(app) {
  try {
    const r = app.findFirstRecordByData("config_ti", "chave", "geral");
    return normalizarConfig(jsonCampo(r, "dados"));
  } catch (_) {
    return JSON.parse(JSON.stringify(CONFIG_PADRAO));
  }
}

function normalizarConfig(bruto) {
  const d = jsonDe(bruto) || {};
  const c = JSON.parse(JSON.stringify(CONFIG_PADRAO));
  if (["prazo", "prioridade", "chegada"].indexOf(d.ordem_fila) >= 0) c.ordem_fila = d.ordem_fila;
  if (d.prazos) for (const p of Object.keys(c.prazos)) { const v = parseInt(d.prazos[p], 10); if (v > 0) c.prazos[p] = v; }
  c.servidor_prioridade = !!d.servidor_prioridade;
  if (d.teto_prioridade === "alta" || d.teto_prioridade === "urgente") c.teto_prioridade = d.teto_prioridade;
  if (d.pedir_motivo_urgente === false) c.pedir_motivo_urgente = false;
  if (d.marcar_escolhida === false) c.marcar_escolhida = false;
  if (d.horario) {
    c.horario.ativo = !!d.horario.ativo;
    if (Array.isArray(d.horario.dias)) c.horario.dias = d.horario.dias.map((x) => parseInt(x, 10)).filter((x) => x >= 0 && x <= 6);
    if (/^\d\d:\d\d$/.test(d.horario.inicio || "")) c.horario.inicio = d.horario.inicio;
    if (/^\d\d:\d\d$/.test(d.horario.fim || "")) c.horario.fim = d.horario.fim;
  }
  if (d.destino_ausencia === "fila") c.destino_ausencia = "fila";
  return c;
}

function lerAutomacao(app) {
  try {
    const v = app.findRecordsByFilter("automacao_versoes", "", "-created", 1, 0);
    if (v.length && v[0]) return normalizarAutomacao(jsonCampo(v[0], "dados"));
  } catch (_) {}
  return JSON.parse(JSON.stringify(AUTOMACAO_VAZIA));
}

function jsonDe(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "string") { try { return JSON.parse(v); } catch (_) { return null; } }
  // goja entrega types.JSONRaw como bytes; passar por string normaliza
  try { return JSON.parse(JSON.stringify(v)); } catch (_) { return null; }
}

function jsonCampo(rec, campo) {
  const raw = rec.get(campo);
  if (raw === null || raw === undefined) return null;
  try { return JSON.parse(toString(raw)); } catch (_) { return jsonDe(raw); }
}

// valida e limpa o que veio da tela (nunca confia no corpo da requisição)
function normalizarAutomacao(bruto) {
  const d = jsonDe(bruto) || {};
  const regra = (r, etapa) => {
    if (!r || typeof r !== "object") return null;
    const out = {
      id: String(r.id || "").slice(0, 40) || novoId(),
      nome: String(r.nome || "").slice(0, 120),
      ativa: r.ativa !== false,
      conds: (Array.isArray(r.conds) ? r.conds : []).map((c) => ({
        campo: CAMPOS.indexOf(c && c.campo) >= 0 ? c.campo : "",
        op: ["e", "nao_e", "contem", "nao_contem"].indexOf(c && c.op) >= 0 ? c.op : "e",
        valores: (Array.isArray(c && c.valores) ? c.valores : []).map((v) => String(v).slice(0, 80)).slice(0, 30),
      })).filter((c) => c.campo),
      acoes: (Array.isArray(r.acoes) ? r.acoes : []).map((a) => ({
        tipo: String((a && a.tipo) || ""),
        valor: a && a.valor !== undefined ? String(a.valor).slice(0, 500) : "",
        pessoas: Array.isArray(a && a.pessoas) ? a.pessoas.map(String).slice(0, 30) : undefined,
        modo: a && a.modo === "sequencia" ? "sequencia" : "carga",
      })).filter((a) => ACOES_POR_ETAPA[etapa].indexOf(a.tipo) >= 0).slice(0, 10),
    };
    if (etapa === "tempo") {
      out.gatilho = GATILHOS.indexOf(r.gatilho) >= 0 ? r.gatilho : "sem_inicio";
      out.minutos = Math.max(0, parseInt(r.minutos, 10) || 0);
    }
    return out;
  };
  const quem = (Array.isArray(d.quem) ? d.quem : []).map((it) => {
    if (it && it.tipo === "bloco") {
      const b = regra(Object.assign({}, it, { acoes: [] }), "quem");
      const s = it.senao || {};
      b.tipo = "bloco";
      b.senao = { tipo: ["continua", "livre", "pessoa"].indexOf(s.tipo) >= 0 ? s.tipo : "continua", pessoa: s.pessoa ? String(s.pessoa) : "" };
      b.regras = (Array.isArray(it.regras) ? it.regras : []).map((r) => regra(r, "quem")).filter(Boolean);
      delete b.acoes;
      return b;
    }
    return regra(it, "quem");
  }).filter(Boolean);
  const s = d.senao || {};
  return {
    ajustes: (Array.isArray(d.ajustes) ? d.ajustes : []).map((r) => regra(r, "ajustes")).filter(Boolean),
    quem,
    senao: { tipo: s.tipo === "pessoa" && s.pessoa ? "pessoa" : "livre", pessoa: s.tipo === "pessoa" ? String(s.pessoa || "") : "" },
    tempo: (Array.isArray(d.tempo) ? d.tempo : []).map((r) => regra(r, "tempo")).filter(Boolean),
  };
}

function novoId() {
  return "r" + Math.random().toString(36).slice(2, 10);
}

// ---------- horário e prazo ----------

function hm(s) { const p = String(s).split(":"); return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0); }

/** "expediente" | "fora" | "fim_semana" no momento `d` (hora local do servidor). */
function situacaoHorario(d, horario) {
  const dia = d.getDay();
  const fimDeSemana = dia === 0 || dia === 6;
  if (!horario || !horario.ativo) return fimDeSemana ? "fim_semana" : "expediente";
  if (horario.dias.indexOf(dia) < 0) return fimDeSemana ? "fim_semana" : "fora";
  const m = d.getHours() * 60 + d.getMinutes();
  return m >= hm(horario.inicio) && m < hm(horario.fim) ? "expediente" : "fora";
}

/** Soma `min` minutos contando só o horário de atendimento (desligado = minutos corridos). */
function somarMinutos(inicio, min, horario) {
  if (!horario || !horario.ativo || !horario.dias.length || hm(horario.fim) <= hm(horario.inicio)) {
    return new Date(inicio.getTime() + min * 60000);
  }
  let t = new Date(inicio.getTime());
  let resta = min;
  for (let i = 0; i < 400 && resta > 0; i++) {
    const ini = new Date(t.getTime()); ini.setHours(0, hm(horario.inicio), 0, 0);
    const fim = new Date(t.getTime()); fim.setHours(0, hm(horario.fim), 0, 0);
    if (horario.dias.indexOf(t.getDay()) < 0 || t >= fim) {
      t = new Date(ini.getTime() + 86400000); // próximo dia, na abertura
      continue;
    }
    if (t < ini) t = ini;
    const livre = (fim.getTime() - t.getTime()) / 60000;
    if (resta <= livre) return new Date(t.getTime() + resta * 60000);
    resta -= livre;
    t = new Date(ini.getTime() + 86400000);
  }
  return t;
}

function dataDe(s) {
  if (!s) return null;
  const d = new Date(String(s).replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
}
function textoData(d) { return d.toISOString().replace("T", " "); }

/** Calcula prazo_em (prazo para começar) e ordem_fila (chave da ordem) do chamado. Não salva. */
function calcularPrazoEOrdem(rec, cfg) {
  const criado = dataDe(rec.getString("created")) || new Date();
  const prio = rec.getString("prioridade") || "normal";
  const min = rec.getInt("prazo_regra_min") > 0 ? rec.getInt("prazo_regra_min") : (cfg.prazos[prio] || cfg.prazos.normal);
  const prazo = somarMinutos(criado, min, cfg.horario);
  rec.set("prazo_em", textoData(prazo));
  rec.set("ordem_fila", chaveOrdem(cfg.ordem_fila, prazo, criado, prio));
}

function chaveOrdem(modo, prazo, criado, prio) {
  const seg = (d) => Math.floor(d.getTime() / 1000);
  if (modo === "chegada") return seg(criado);
  if (modo === "prioridade") return (5 - (PESO[prio] || 2)) * 1e10 + seg(criado);
  return seg(prazo);
}

/** Depois de mudar a ordem, os prazos ou o horário: recalcula todos os chamados não resolvidos. */
function recalcularFila(app, cfg) {
  let n = 0;
  for (const c of app.findRecordsByFilter("chamados", "status != 'resolvido'", "", 0, 0)) {
    if (!c) continue;
    calcularPrazoEOrdem(c, cfg);
    app.saveNoValidate(c);
    n++;
  }
  return n;
}

// ---------- o motor ----------

function combina(regra, info) {
  return (regra.conds || []).every((c) => {
    const vals = c.valores || [];
    if (c.campo === "texto") {
      if (!vals.length) return true;
      const t = String(info.texto || "").toLowerCase();
      const tem = vals.some((w) => w && t.indexOf(String(w).toLowerCase()) >= 0);
      return c.op === "nao_contem" ? !tem : tem;
    }
    const v = String(info[c.campo] === undefined ? "" : info[c.campo]);
    const esta = vals.indexOf(v) >= 0;
    return c.op === "nao_e" ? !esta : esta;
  });
}

/**
 * Aplica as etapas 1 a 3 a um chamado que está chegando.
 * info: { categoria, setor, impacto, prioridade, origem, texto, anexo: "sim"|"nao", horario, reaberto: "sim"|"nao" }
 * ctx:  { disponivel(id) -> bool, carga: { id: n }, giro(regraId) -> n, nome(id) -> texto }
 * Devolve { prioridade, prazoMin, pessoa, regraPessoa, giroUsado, efeitos: [{ tipo, valor, regra }], status, traco }
 */
function avaliarChegada(auto, info, ctx) {
  const status = {}; const traco = []; const efeitos = [];
  const nome = (id) => (ctx.nome ? ctx.nome(id) : id) || "alguém";
  const prio0 = info.prioridade || "normal";
  let prio = prio0; let prazoMin = 0;
  traco.push({ etapa: 0, texto: "Começa com prioridade " + prio0 + "." });

  for (const r of auto.ajustes) {
    if (!r.ativa) { status[r.id] = "off"; continue; }
    const ok = combina(r, info); // a etapa 1 olha a prioridade de entrada: a ordem das regras não importa
    status[r.id] = ok ? "sim" : "nao";
    if (!ok) continue;
    const feitos = [];
    for (const a of r.acoes) {
      if (a.tipo === "prioridade" && NIVEL[a.valor] > NIVEL[prio]) { prio = a.valor; }
      if (a.tipo === "prioridade") feitos.push("prioridade " + a.valor);
      if (a.tipo === "prazo") { const m = parseInt(a.valor, 10); if (m > 0 && (!prazoMin || m < prazoMin)) prazoMin = m; feitos.push("prazo " + m + " min"); }
      if (a.tipo === "avisar" || a.tipo === "resposta" || a.tipo === "nota") { efeitos.push({ tipo: a.tipo, valor: a.valor, regra: r.nome }); feitos.push(a.tipo); }
    }
    traco.push({ etapa: 1, regra: r.id, texto: (r.nome || "Regra") + ": " + feitos.join(", ") + "." });
  }

  const val = Object.assign({}, info, { prioridade: prio });
  let pessoa = ""; let regraPessoa = ""; let decidido = false; let usarSenao = true; let giroUsado = "";
  const pular = (r) => { status[r.id] = r.ativa ? "pulada" : "off"; };
  const escolher = (r) => {
    const e = escolherPessoa(r);
    if (e) for (const a of r.acoes) if (a.tipo === "avisar" || a.tipo === "nota") efeitos.push({ tipo: a.tipo, valor: a.valor, regra: r.nome });
    return e;
  };
  const escolherPessoa = (r) => {
    for (const a of r.acoes) {
      if (a.tipo === "atribuir") {
        if (ctx.disponivel(a.valor)) return { p: a.valor };
        traco.push({ etapa: 2, regra: r.id, texto: nome(a.valor) + " não está disponível; a regra foi pulada." });
      }
      if (a.tipo === "rodizio") {
        const disp = (a.pessoas || []).filter((p) => ctx.disponivel(p));
        if (!disp.length) { traco.push({ etapa: 2, regra: r.id, texto: "Ninguém da divisão está disponível." }); continue; }
        if (a.modo === "sequencia") { const g = ctx.giro(r.id) || 0; return { p: disp[g % disp.length], giro: r.id }; }
        const ord = disp.slice().sort((x, y) => (ctx.carga[x] || 0) - (ctx.carga[y] || 0));
        return { p: ord[0] };
      }
    }
    return null;
  };
  for (const it of auto.quem) {
    if (decidido) { pular(it); if (it.tipo === "bloco") it.regras.forEach(pular); continue; }
    if (!it.ativa) { status[it.id] = "off"; if (it.tipo === "bloco") it.regras.forEach(pular); continue; }
    if (it.tipo === "bloco") {
      const ok = combina(it, val); status[it.id] = ok ? "sim" : "nao";
      if (!ok) { it.regras.forEach(pular); continue; }
      for (const r of it.regras) {
        if (decidido || !r.ativa) { pular(r); continue; }
        const okr = combina(r, val); status[r.id] = okr ? "sim" : "nao";
        if (!okr) continue;
        const e = escolher(r);
        if (e) { pessoa = e.p; regraPessoa = r.nome || it.nome; giroUsado = e.giro || ""; decidido = true; traco.push({ etapa: 2, regra: r.id, texto: (r.nome || "Regra") + ": vai para " + nome(pessoa) + "." }); }
      }
      if (!decidido && it.senao.tipo !== "continua") {
        decidido = true; usarSenao = false; status["fim:" + it.id] = "sim";
        if (it.senao.tipo === "pessoa" && ctx.disponivel(it.senao.pessoa)) { pessoa = it.senao.pessoa; regraPessoa = it.nome; }
        traco.push({ etapa: 2, regra: it.id, texto: "Bloco " + (it.nome || "") + ": nenhuma regra de dentro serviu; " + (pessoa ? "vai para " + nome(pessoa) : "fica livre") + "." });
      }
    } else {
      const ok = combina(it, val); status[it.id] = ok ? "sim" : "nao";
      if (!ok) continue;
      const e = escolher(it);
      if (e) { pessoa = e.p; regraPessoa = it.nome; giroUsado = e.giro || ""; decidido = true; traco.push({ etapa: 2, regra: it.id, texto: (it.nome || "Regra") + ": vai para " + nome(pessoa) + "." }); }
    }
  }
  // (avisos/notas de uma regra da etapa 2 só entram se foi ela que escolheu a pessoa)
  const ef = efeitos;
  if (!decidido && usarSenao) {
    status.senao = "sim";
    if (auto.senao.tipo === "pessoa" && ctx.disponivel(auto.senao.pessoa)) { pessoa = auto.senao.pessoa; regraPessoa = "Se ninguém foi escolhido"; }
    traco.push({ etapa: 3, texto: pessoa ? "Ninguém foi escolhido: vai para " + nome(pessoa) + "." : "Ninguém foi escolhido: fica livre na fila." });
  }
  return { prioridade: prio, prazoMin, pessoa, regraPessoa, giroUsado, efeitos: ef, status, traco };
}

// ---------- contexto real (banco) ----------

function hojeTexto() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

function ausenteHoje(u) {
  const de = u.getString("ausente_de").slice(0, 10), ate = u.getString("ausente_ate").slice(0, 10);
  if (!de && !ate) return false;
  const hoje = hojeTexto();
  return (!de || de <= hoje) && (!ate || hoje <= ate);
}

function contexto(app) {
  const tecnicos = {};
  for (const u of app.findRecordsByFilter("users", "papel = 'tecnico'", "", 0, 0)) {
    if (u) tecnicos[u.id] = u;
  }
  const carga = {};
  const rows = arrayOf(new DynamicModel({ responsavel: "", total: 0 }));
  app.db().newQuery("SELECT responsavel, COUNT(*) AS total FROM chamados WHERE status IN ('aberto','em_andamento') AND responsavel != '' GROUP BY responsavel").all(rows);
  for (const r of rows) carga[r.responsavel] = r.total;
  return {
    tecnicos,
    carga,
    disponivel: (id) => { const u = tecnicos[id]; return !!u && !u.getBool("bloqueado") && !u.getBool("sem_automatico") && !ausenteHoje(u); },
    nome: (id) => (tecnicos[id] ? tecnicos[id].getString("name") : ""),
    giro: (regraId) => lerContador(app, "rodizio-" + regraId),
  };
}

function lerContador(app, nome) {
  try {
    const r = new DynamicModel({ valor: 0 });
    app.db().newQuery("SELECT valor FROM dd_contadores WHERE nome = {:n}").bind({ n: nome }).one(r);
    return r.valor;
  } catch (_) { return 0; }
}
function somarContador(app, nome) {
  try {
    app.db().newQuery("INSERT INTO dd_contadores (nome, valor) VALUES ({:n}, 1) ON CONFLICT(nome) DO UPDATE SET valor = valor + 1").bind({ n: nome }).execute();
  } catch (_) {}
}

function infoDoChamado(rec, extra) {
  const criado = dataDe(rec.getString("created")) || new Date();
  return Object.assign({
    categoria: rec.getString("categoria"),
    setor: rec.getString("setor"),
    impacto: rec.getString("impacto"),
    prioridade: rec.getString("prioridade") || "normal",
    origem: rec.getString("origem"),
    texto: rec.getString("descricao"),
    anexo: rec.getStringSlice("anexos").length ? "sim" : "nao",
    horario: "expediente",
    reaberto: "nao",
    _criado: criado,
  }, extra || {});
}

/**
 * Chamado sendo aberto (antes de salvar): aplica as etapas 1 a 3 e devolve os efeitos para depois de salvo.
 * `podeAtribuir` = false quando quem registrou já escolheu o responsável.
 */
function aplicarNaAbertura(app, rec, podeAtribuir) {
  const cfg = lerConfig(app);
  const auto = lerAutomacao(app);
  const info = infoDoChamado(rec, { horario: situacaoHorario(new Date(), cfg.horario) });
  const ctx = contexto(app);
  const r = avaliarChegada(auto, info, ctx);
  if (r.prioridade !== rec.getString("prioridade")) rec.set("prioridade", r.prioridade);
  rec.set("peso", PESO[r.prioridade] || 2);
  if (r.prazoMin) rec.set("prazo_regra_min", r.prazoMin);
  const atribuiu = podeAtribuir && !!r.pessoa;
  if (atribuiu) rec.set("responsavel", r.pessoa);
  if (atribuiu && r.giroUsado) somarContador(app, "rodizio-" + r.giroUsado);
  return { cfg, resultado: r, atribuiu, nomePessoa: ctx.nome(r.pessoa), prioAntes: info.prioridade };
}

/** Depois de salvo: prazo/ordem, linha do tempo, avisos. */
function depoisDaAbertura(app, rec, aplicado) {
  const R = require(`${__hooks}/lib/regras.js`);
  calcularPrazoEOrdem(rec, aplicado.cfg);
  app.saveNoValidate(rec);
  const r = aplicado.resultado;
  if (r.prioridade !== aplicado.prioAntes) {
    R.registrar(app, rec.id, "", "prioridade", "Prioridade definida pela automação do TI: " + R.ROTULO_PRIORIDADE[r.prioridade] + ".", true);
  }
  if (aplicado.atribuiu) {
    R.registrar(app, rec.id, "", "atribuicao", "Responsável: " + (aplicado.nomePessoa || "técnico"), false);
    R.registrar(app, rec.id, "", "sistema", "Encaminhado pela regra \u201c" + (r.regraPessoa || "automação") + "\u201d.", true);
  }
  aplicarEfeitos(app, rec, r.efeitos);
}

function aplicarEfeitos(app, rec, efeitos) {
  const R = require(`${__hooks}/lib/regras.js`);
  const avisos = require(`${__hooks}/lib/avisos.js`);
  for (const ef of efeitos) {
    if (ef.tipo === "resposta" && ef.valor) {
      R.registrar(app, rec.id, "", "comentario", ef.valor, false);
      R.notificarSolicitante(app, rec, "O TI respondeu seu chamado", "Mensagem do TI: \u201c" + ef.valor + "\u201d");
    }
    if (ef.tipo === "nota" && ef.valor) R.registrar(app, rec.id, "", "comentario", ef.valor, true);
    if (ef.tipo === "avisar") {
      let para = "toda a equipe";
      if (ef.valor === "responsavel") para = "quem está com o chamado";
      else if (ef.valor && ef.valor !== "equipe") { try { para = app.findRecordById("users", ef.valor).getString("name"); } catch (_) {} }
      avisos.avisarTecnicos(app, rec, "Atenção: " + (ef.regra || "regra do TI"), "Para " + para + ".");
    }
  }
}

// ---------- etapa 4: com o passar do tempo ----------

function rodarRegrasDeTempo(app) {
  const auto = lerAutomacao(app);
  const regras = auto.tempo.filter((r) => r.ativa && r.acoes.length);
  if (!regras.length) return 0;
  const cfg = lerConfig(app);
  const R = require(`${__hooks}/lib/regras.js`);
  const agora = new Date();
  let feitos = 0;
  for (const r of regras) {
    const limite = textoData(new Date(agora.getTime() - (r.minutos || 0) * 60000));
    let filtro, params;
    if (r.gatilho === "sem_inicio") { filtro = "status = 'aberto' && created <= {:l}"; params = { l: limite }; }
    else if (r.gatilho === "vencido") { filtro = "status = 'aberto' && prazo_em != '' && prazo_em <= {:l}"; params = { l: textoData(agora) }; }
    else { filtro = "status = 'aguardando' && aguardando_motivo = 'solicitante' && aguardando_desde != '' && aguardando_desde <= {:l}"; params = { l: limite }; }
    for (const c of app.findRecordsByFilter("chamados", filtro, "created", 200, 0, params)) {
      if (!c) continue;
      const feitas = jsonCampo(c, "regras_tempo") || [];
      if (feitas.indexOf(r.id) >= 0) continue;
      if (!combina(r, infoDoChamado(c))) continue;
      const efeitos = [];
      for (const a of r.acoes) {
        if (a.tipo === "subir") {
          const n = Math.min(4, (NIVEL[c.getString("prioridade")] || 2) + 1);
          if (PRIO_DO_NIVEL[n] !== c.getString("prioridade")) {
            const antes = c.getString("prioridade");
            c.set("prioridade", PRIO_DO_NIVEL[n]); c.set("peso", PESO[PRIO_DO_NIVEL[n]]);
            R.registrar(app, c.id, "", "prioridade", "Prioridade: " + R.ROTULO_PRIORIDADE[antes] + " → " + R.ROTULO_PRIORIDADE[PRIO_DO_NIVEL[n]] + " (regra \u201c" + (r.nome || "do TI") + "\u201d)", true);
          }
        } else if (a.tipo === "devolver") {
          if (c.getString("responsavel")) {
            c.set("responsavel", "");
            if (c.getString("status") !== "aberto") { c.set("status", "aberto"); c.set("aguardando_motivo", ""); c.set("aguardando_desde", ""); }
            R.registrar(app, c.id, "", "atribuicao", "Devolvido para a fila, sem responsável (regra \u201c" + (r.nome || "do TI") + "\u201d)", false);
          }
        } else efeitos.push({ tipo: a.tipo, valor: a.valor, regra: r.nome });
      }
      feitas.push(r.id);
      c.set("regras_tempo", feitas);
      calcularPrazoEOrdem(c, cfg);
      app.saveNoValidate(c);
      aplicarEfeitos(app, c, efeitos);
      feitos++;
    }
  }
  return feitos;
}

// ---------- ausências ----------

/** Destino "fila": quem fica ausente hoje devolve para a fila os chamados que estavam com ele. */
function devolverChamadosDe(app, usuarioId) {
  const R = require(`${__hooks}/lib/regras.js`);
  const cfg = lerConfig(app);
  let n = 0;
  for (const c of app.findRecordsByFilter("chamados", "responsavel = {:u} && (status = 'aberto' || status = 'em_andamento')", "", 0, 0, { u: usuarioId })) {
    if (!c) continue;
    c.set("responsavel", "");
    c.set("status", "aberto");
    calcularPrazoEOrdem(c, cfg);
    app.saveNoValidate(c);
    R.registrar(app, c.id, "", "atribuicao", "Devolvido para a fila: o responsável está ausente.", false);
    n++;
  }
  return n;
}

module.exports = {
  NIVEL, CONFIG_PADRAO, AUTOMACAO_VAZIA, CAMPOS, ACOES_POR_ETAPA,
  lerConfig, normalizarConfig, lerAutomacao, normalizarAutomacao, jsonCampo,
  situacaoHorario, somarMinutos, calcularPrazoEOrdem, recalcularFila,
  combina, avaliarChegada, contexto, ausenteHoje, infoDoChamado,
  aplicarNaAbertura, depoisDaAbertura, aplicarEfeitos, rodarRegrasDeTempo, devolverChamadosDe,
};
