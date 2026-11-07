// Automação dos chamados (tela "Configurações do TI" > "Automação dos chamados").
//
// FLUXOS independentes, como jobs: cada fluxo começa num GATILHO e segue um desenho de blocos ligados (um DAG).
//   gatilhos: "novo" (chamado chegando), "reaberto" (quem pediu reabriu) e, conferidos a cada 5 minutos,
//             "sem_inicio" (ninguém começou em X min), "vencido" (passou do prazo), "espera" (quem pediu não respondeu em X min)
//   blocos:   "inicio" (um por fluxo, é o gatilho), "cond" (pergunta: saídas "sim" e "nao"), "acao" (faz algo: saída "segue")
// Um bloco roda depois que TODOS os blocos que apontam para ele foram decididos, e só se pelo menos uma ligação
// que chega nele estiver ativa (como o "one_success" do Airflow). Bloco sem ligação chegando nunca roda.
// Ciclos são recusados ao salvar (validarAutomacao).
//
// Vários fluxos com o mesmo gatilho rodam um depois do outro, na ordem da lista, sobre o mesmo chamado. Conflitos:
//   responsável: o PRIMEIRO fluxo que escolher uma pessoa disponível trava a escolha (os seguintes são ignorados e o teste avisa);
//   prioridade: vale a MAIOR que os fluxos definirem; prazo: vale o MENOR. Avisos, respostas e notas somam.
// "senao": chamado novo que nenhum fluxo mandou para alguém fica livre na fila ou vai para uma pessoa.
//
// Formato (JSON salvo em automacao_versoes.dados):
//   { fluxos: [fluxo], senao: { tipo: "livre"|"pessoa", pessoa } }
//   fluxo   = { id, nome, ativo, gatilho, minutos, nos: [no], ligacoes: [{ id, de, saida: "sim"|"nao"|"segue", para }] }
//   no      = { id, tipo: "inicio"|"cond"|"acao", x, y, cond?: { campo, op, valores }, acao?: { tipo, valor, pessoas, modo } }
//   campos: categoria (id), setor (id), impacto, prioridade, origem, texto (palavras), anexo, horario, responsavel (sim|nao)
//   ops: "e" | "nao_e" | "contem" | "nao_contem"
//   ações: prioridade, prazo (minutos), subir, atribuir (id), rodizio (pessoas, modo: sequencia|carga), devolver,
//          avisar (equipe|responsavel|id), resposta (texto), nota (texto). Quais valem em cada gatilho: ACOES_POR_GATILHO.
//
// O MESMO motor responde a rota de teste (POST /api/ti/automacao/testar): a tela mostra exatamente o que o servidor faria.
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
  // resolvido sem resposta do servidor: considerado resolvido depois de N dias úteis (0 = nunca)
  dias_confirmar: 3,
};
const AUTOMACAO_VAZIA = { fluxos: [], senao: { tipo: "livre", pessoa: "" } };

const GATILHOS = ["novo", "reaberto", "sem_inicio", "vencido", "espera"];
const GATILHOS_TEMPO = ["sem_inicio", "vencido", "espera"];
const CAMPOS = ["categoria", "setor", "impacto", "prioridade", "origem", "texto", "anexo", "horario", "responsavel"];
const OPS = ["e", "nao_e", "contem", "nao_contem"];
const NO_TEMPO = ["prioridade", "subir", "atribuir", "rodizio", "devolver", "avisar", "resposta", "nota"];
const ACOES_POR_GATILHO = {
  novo: ["prioridade", "prazo", "subir", "atribuir", "rodizio", "avisar", "resposta", "nota"],
  reaberto: ["prioridade", "subir", "atribuir", "rodizio", "avisar", "resposta", "nota"],
  sem_inicio: NO_TEMPO, vencido: NO_TEMPO, espera: NO_TEMPO,
};
const ROTULO_GATILHO = {
  novo: "Chamado novo", reaberto: "Chamado reaberto", sem_inicio: "Ninguém começou o atendimento",
  vencido: "Passou do prazo", espera: "Quem pediu não respondeu",
};
const LIMITES = { fluxos: 40, nos: 60, ligacoes: 120 };

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
  if (d.dias_confirmar !== undefined) { const n = parseInt(d.dias_confirmar, 10); if (n >= 0 && n <= 30) c.dias_confirmar = n; }
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

// ---------- limpeza do que veio da tela (nunca confia no corpo da requisição) ----------

function lista(v) { return Array.isArray(v) ? v : []; }
function txt(v, max) { return v === undefined || v === null ? "" : String(v).slice(0, max); }
function num(v) { const n = Math.round(Number(v)); return isFinite(n) ? Math.max(-100000, Math.min(100000, n)) : 0; }
function novoId() { return "n" + Math.random().toString(36).slice(2, 10); }

function normalizarAutomacao(bruto) {
  const d = jsonDe(bruto) || {};
  const s = d.senao || {};
  const vistos = {};
  const fluxos = [];
  for (const f of lista(d.fluxos).slice(0, LIMITES.fluxos)) {
    const n = normalizarFluxo(f);
    if (!n || vistos[n.id]) continue;
    vistos[n.id] = true;
    fluxos.push(n);
  }
  return {
    fluxos,
    senao: { tipo: s.tipo === "pessoa" && s.pessoa ? "pessoa" : "livre", pessoa: s.tipo === "pessoa" ? txt(s.pessoa, 40) : "" },
  };
}

function normalizarFluxo(f) {
  if (!f || typeof f !== "object") return null;
  const gatilho = GATILHOS.indexOf(f.gatilho) >= 0 ? f.gatilho : "novo";
  const ids = {};
  const nos = [];
  for (const n of lista(f.nos).slice(0, LIMITES.nos)) {
    if (!n || typeof n !== "object" || ["inicio", "cond", "acao"].indexOf(n.tipo) < 0) continue;
    const id = n.tipo === "inicio" ? "inicio" : txt(n.id, 40) || novoId();
    if (ids[id]) continue;
    const out = { id, tipo: n.tipo, x: num(n.x), y: num(n.y) };
    if (n.tipo === "cond") {
      const c = n.cond || {};
      const campo = CAMPOS.indexOf(c.campo) >= 0 ? c.campo : "categoria";
      const opOk = campo === "texto" ? ["contem", "nao_contem"] : ["e", "nao_e"];
      out.cond = {
        campo,
        op: opOk.indexOf(c.op) >= 0 ? c.op : opOk[0],
        valores: lista(c.valores).map((v) => txt(v, 80).trim()).filter(Boolean).slice(0, 30),
      };
    }
    if (n.tipo === "acao") {
      const a = n.acao || {};
      out.acao = {
        tipo: txt(a.tipo, 20), valor: txt(a.valor, 500),
        pessoas: lista(a.pessoas).map((p) => txt(p, 40)).filter(Boolean).slice(0, 30),
        modo: a.modo === "sequencia" ? "sequencia" : "carga",
      };
    }
    ids[id] = n.tipo;
    nos.push(out);
  }
  if (!ids.inicio) { nos.unshift({ id: "inicio", tipo: "inicio", x: 0, y: 0 }); ids.inicio = "inicio"; }
  const ligacoes = [];
  const usadas = {};
  for (const l of lista(f.ligacoes).slice(0, LIMITES.ligacoes)) {
    if (!l) continue;
    const de = txt(l.de, 40), para = txt(l.para, 40);
    if (!ids[de] || !ids[para] || de === para || para === "inicio") continue;
    const saida = ids[de] === "cond" ? (l.saida === "nao" ? "nao" : "sim") : "segue";
    const k = de + ">" + saida + ">" + para;
    if (usadas[k]) continue;
    usadas[k] = true;
    ligacoes.push({ id: txt(l.id, 40) || novoId(), de, saida, para });
  }
  return {
    id: txt(f.id, 40) || novoId(),
    nome: txt(f.nome, 120).trim(),
    ativo: f.ativo !== false,
    gatilho,
    minutos: gatilho === "sem_inicio" || gatilho === "espera" ? Math.max(5, parseInt(f.minutos, 10) || 30) : 0,
    nos, ligacoes,
  };
}

/** Ordem em que os blocos rodam (cada um depois de todos os que apontam para ele). null = tem ciclo. */
function ordemTopologica(f) {
  const entra = {}; const saem = {};
  f.nos.forEach((n) => { entra[n.id] = 0; saem[n.id] = []; });
  f.ligacoes.forEach((l) => { entra[l.para]++; saem[l.de].push(l.para); });
  const fila = f.nos.filter((n) => entra[n.id] === 0).map((n) => n.id);
  const ordem = [];
  while (fila.length) {
    const id = fila.shift();
    ordem.push(id);
    for (const p of saem[id]) { entra[p]--; if (entra[p] === 0) fila.push(p); }
  }
  return ordem.length === f.nos.length ? ordem : null;
}

const nomeFluxo = (f) => f.nome || "Fluxo sem nome";

/** Erros que impedem salvar (a tela mostra os mesmos antes). */
function validarAutomacao(auto) {
  const erros = [];
  for (const f of auto.fluxos) {
    if (!ordemTopologica(f)) erros.push("O fluxo “" + nomeFluxo(f) + "” tem um caminho que volta para trás. Tire uma das ligações.");
    for (const n of f.nos) {
      if (n.tipo === "acao" && ACOES_POR_GATILHO[f.gatilho].indexOf(n.acao.tipo) < 0) {
        erros.push("No fluxo “" + nomeFluxo(f) + "”, uma ação não vale para o gatilho “" + ROTULO_GATILHO[f.gatilho] + "”.");
      }
    }
  }
  return erros;
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

function avaliarCondicao(c, info) {
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
}

/**
 * Roda os fluxos ligados de um gatilho sobre um chamado, na ordem da lista.
 * info: { categoria, setor, impacto, prioridade, origem, texto, anexo: "sim"|"nao", horario, responsavel: "sim"|"nao" }
 * ctx:  { disponivel(id) -> bool, carga: { id: n }, giro(chave) -> n, nome(id) -> texto }
 * op:   { podeAtribuir }  (false quando quem registrou já escolheu o responsável)
 * Devolve { prioridade, regraPrio, prazoMin, pessoa, regraPessoa, giroUsado, devolver, regraDevolver, efeitos,
 *           fluxos: { [id]: { status: { [no]: "sim"|"nao"|"ignorada" }, ativas: [ligação] } }, traco, conflitos }
 */
function executar(auto, gatilho, info, ctx, op) {
  const nome = (id) => (ctx.nome ? ctx.nome(id) : id) || "alguém";
  const prio0 = NIVEL[info.prioridade] ? info.prioridade : "normal";
  const est = {
    prioridade: prio0, prioDefinida: false, regraPrio: "", prazoMin: 0, pessoa: "", regraPessoa: "", giroUsado: "",
    devolver: false, regraDevolver: "", efeitos: [], traco: [], conflitos: [],
  };
  const val = Object.assign({}, info, { prioridade: prio0 });
  const permitidas = ACOES_POR_GATILHO[gatilho] || [];
  const fluxos = {};
  est.traco.push({ texto: "Começa com prioridade " + prio0 + "." });

  for (const f of auto.fluxos) {
    if (f.gatilho !== gatilho) continue;
    const res = { status: {}, ativas: [] };
    fluxos[f.id] = res;
    if (!f.ativo) continue;
    const ordem = ordemTopologica(f);
    if (!ordem) { est.traco.push({ fluxo: f.id, texto: nomeFluxo(f) + ": tem um ciclo e não rodou." }); continue; }
    const porId = {}; f.nos.forEach((n) => { porId[n.id] = n; });
    const ativa = {};
    for (const id of ordem) {
      const n = porId[id];
      const alcancado = n.tipo === "inicio" || f.ligacoes.some((l) => l.para === id && ativa[l.id]);
      if (!alcancado) continue;
      let saida = "segue";
      if (n.tipo === "inicio") res.status[id] = "sim";
      else if (n.tipo === "cond") { saida = avaliarCondicao(n.cond, val) ? "sim" : "nao"; res.status[id] = saida; }
      else res.status[id] = aplicarAcao(n, f, est, val, ctx, permitidas, op, nome);
      for (const l of f.ligacoes) {
        if (l.de !== id) continue;
        ativa[l.id] = l.saida === saida;
        if (ativa[l.id]) res.ativas.push(l.id);
      }
    }
  }

  if (gatilho === "novo" && op.podeAtribuir && !est.pessoa) {
    if (auto.senao.tipo === "pessoa" && ctx.disponivel(auto.senao.pessoa)) {
      est.pessoa = auto.senao.pessoa; est.regraPessoa = "Se nenhum fluxo escolher alguém";
      est.traco.push({ texto: "Nenhum fluxo escolheu alguém: vai para " + nome(est.pessoa) + "." });
    } else {
      est.traco.push({ texto: "Nenhum fluxo escolheu alguém: fica livre na fila." });
    }
  }
  return {
    prioridade: est.prioridade, regraPrio: est.regraPrio, prazoMin: est.prazoMin, pessoa: est.pessoa, regraPessoa: est.regraPessoa,
    giroUsado: est.giroUsado, devolver: est.devolver && !est.pessoa, regraDevolver: est.regraDevolver,
    efeitos: est.efeitos, fluxos, traco: est.traco, conflitos: est.conflitos,
  };
}

function aplicarAcao(n, f, est, val, ctx, permitidas, op, nome) {
  const a = n.acao;
  const quem = nomeFluxo(f);
  const anotar = (texto) => est.traco.push({ fluxo: f.id, no: n.id, texto: quem + ": " + texto });
  const conflito = (texto) => { est.conflitos.push({ fluxo: f.id, no: n.id, texto: quem + ": " + texto }); anotar(texto); return "ignorada"; };
  if (permitidas.indexOf(a.tipo) < 0) { anotar("esta ação não vale para este gatilho."); return "ignorada"; }

  const definirPrio = (p) => {
    if (est.prioDefinida && NIVEL[p] < NIVEL[est.prioridade]) {
      return conflito("quis prioridade " + p + ", mas “" + est.regraPrio + "” já definiu " + est.prioridade + " (vale a maior).");
    }
    est.prioridade = p; est.prioDefinida = true; est.regraPrio = quem; val.prioridade = p;
    anotar("prioridade " + p + ".");
    return "sim";
  };
  const escolher = (p, giro) => {
    if (!op.podeAtribuir) { anotar("quem registrou já escolheu o responsável."); return "ignorada"; }
    if (est.pessoa) return conflito("quis mandar para " + nome(p) + ", mas “" + est.regraPessoa + "” já tinha escolhido " + nome(est.pessoa) + ".");
    est.pessoa = p; est.regraPessoa = quem; est.giroUsado = giro || ""; val.responsavel = "sim";
    anotar("vai para " + nome(p) + ".");
    return "sim";
  };

  switch (a.tipo) {
    case "prioridade":
      return NIVEL[a.valor] ? definirPrio(a.valor) : "ignorada";
    case "subir":
      return definirPrio(PRIO_DO_NIVEL[Math.min(4, (NIVEL[val.prioridade] || 2) + 1)]);
    case "prazo": {
      const m = parseInt(a.valor, 10);
      if (!(m > 0)) return "ignorada";
      if (est.prazoMin && m > est.prazoMin) return conflito("quis prazo de " + m + " min, mas já há um prazo menor (vale o menor).");
      est.prazoMin = m; anotar("prazo de " + m + " min.");
      return "sim";
    }
    case "atribuir":
      if (!ctx.disponivel(a.valor)) { anotar(nome(a.valor) + " não está disponível."); return "ignorada"; }
      return escolher(a.valor);
    case "rodizio": {
      const disp = (a.pessoas || []).filter((p) => ctx.disponivel(p));
      if (!disp.length) { anotar("ninguém da divisão está disponível."); return "ignorada"; }
      if (a.modo === "sequencia") {
        const chave = "rodizio-" + f.id + "-" + n.id;
        return escolher(disp[(ctx.giro(chave) || 0) % disp.length], chave);
      }
      const ord = disp.slice().sort((x, y) => (ctx.carga[x] || 0) - (ctx.carga[y] || 0));
      return escolher(ord[0]);
    }
    case "devolver":
      est.devolver = true; est.regraDevolver = quem; val.responsavel = "nao";
      anotar("volta para a fila, sem responsável.");
      return "sim";
    case "avisar": case "resposta": case "nota":
      if (a.tipo !== "avisar" && !String(a.valor || "").trim()) { anotar("mensagem vazia."); return "ignorada"; }
      est.efeitos.push({ tipo: a.tipo, valor: a.tipo === "avisar" ? a.valor || "equipe" : a.valor, regra: quem });
      anotar(a.tipo === "avisar" ? "avisa no celular." : a.tipo === "resposta" ? "responde a quem pediu." : "deixa uma nota interna.");
      return "sim";
  }
  return "ignorada";
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
  return Object.assign({
    categoria: rec.getString("categoria"),
    setor: rec.getString("setor"),
    impacto: rec.getString("impacto"),
    prioridade: rec.getString("prioridade") || "normal",
    origem: rec.getString("origem"),
    texto: rec.getString("descricao"),
    anexo: rec.getStringSlice("anexos").length ? "sim" : "nao",
    horario: "expediente",
    responsavel: rec.getString("responsavel") ? "sim" : "nao",
  }, extra || {});
}

/**
 * Chamado sendo aberto (antes de salvar): roda os fluxos "Chamado novo" e devolve os efeitos para depois de salvo.
 * `podeAtribuir` = false quando quem registrou já escolheu o responsável.
 */
function aplicarNaAbertura(app, rec, podeAtribuir) {
  const cfg = lerConfig(app);
  const auto = lerAutomacao(app);
  const info = infoDoChamado(rec, { horario: situacaoHorario(new Date(), cfg.horario) });
  const ctx = contexto(app);
  const r = executar(auto, "novo", info, ctx, { podeAtribuir });
  if (r.prioridade !== rec.getString("prioridade")) rec.set("prioridade", r.prioridade);
  rec.set("peso", PESO[r.prioridade] || 2);
  if (r.prazoMin) rec.set("prazo_regra_min", r.prazoMin);
  const atribuiu = podeAtribuir && !!r.pessoa;
  if (atribuiu) rec.set("responsavel", r.pessoa);
  if (atribuiu && r.giroUsado) somarContador(app, r.giroUsado);
  return { cfg, resultado: r, atribuiu, nomePessoa: ctx.nome(r.pessoa), prioAntes: info.prioridade };
}

/** Depois de salvo: prazo/ordem, linha do tempo, avisos. */
function depoisDaAbertura(app, rec, aplicado) {
  const R = require(`${__hooks}/lib/regras.js`);
  calcularPrazoEOrdem(rec, aplicado.cfg);
  app.saveNoValidate(rec);
  const r = aplicado.resultado;
  if (r.prioridade !== aplicado.prioAntes) {
    R.registrar(app, rec.id, "", "prioridade", "Prioridade definida pelo fluxo “" + (r.regraPrio || "do TI") + "”: " + R.ROTULO_PRIORIDADE[r.prioridade] + ".", true);
  }
  if (aplicado.atribuiu) {
    R.registrar(app, rec.id, "", "atribuicao", "Responsável: " + (aplicado.nomePessoa || "técnico"), false);
    R.registrar(app, rec.id, "", "sistema", "Encaminhado pelo fluxo “" + (r.regraPessoa || "do TI") + "”.", true);
  }
  aplicarEfeitos(app, rec, r.efeitos);
}

/** Chamado que já existe (reaberto ou fluxo de tempo): aplica o resultado de executar() e salva. */
function aplicarNoChamado(app, c, r, cfg, ctx) {
  const R = require(`${__hooks}/lib/regras.js`);
  const antes = c.getString("prioridade") || "normal";
  if (r.prioridade !== antes) {
    c.set("prioridade", r.prioridade); c.set("peso", PESO[r.prioridade] || 2);
    R.registrar(app, c.id, "", "prioridade", "Prioridade: " + R.ROTULO_PRIORIDADE[antes] + " → " + R.ROTULO_PRIORIDADE[r.prioridade] + " (fluxo “" + (r.regraPrio || "do TI") + "”)", true);
  }
  if (r.pessoa && r.pessoa !== c.getString("responsavel")) {
    c.set("responsavel", r.pessoa);
    if (r.giroUsado) somarContador(app, r.giroUsado);
    R.registrar(app, c.id, "", "atribuicao", "Responsável: " + (ctx.nome(r.pessoa) || "técnico") + " (fluxo “" + (r.regraPessoa || "do TI") + "”)", false);
  } else if (r.devolver && c.getString("responsavel")) {
    c.set("responsavel", "");
    if (c.getString("status") !== "aberto") { c.set("status", "aberto"); c.set("aguardando_motivo", ""); c.set("aguardando_desde", ""); }
    R.registrar(app, c.id, "", "atribuicao", "Devolvido para a fila, sem responsável (fluxo “" + (r.regraDevolver || "do TI") + "”)", false);
  }
  calcularPrazoEOrdem(c, cfg);
  app.saveNoValidate(c);
  aplicarEfeitos(app, c, r.efeitos);
}

/** Depois que quem pediu reabre o chamado: roda os fluxos "Chamado reaberto". */
function aplicarNaReabertura(app, c) {
  const auto = lerAutomacao(app);
  if (!auto.fluxos.some((f) => f.ativo && f.gatilho === "reaberto")) return;
  const cfg = lerConfig(app);
  const ctx = contexto(app);
  const r = executar(auto, "reaberto", infoDoChamado(c, { horario: situacaoHorario(new Date(), cfg.horario) }), ctx, { podeAtribuir: true });
  aplicarNoChamado(app, c, r, cfg, ctx);
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

// ---------- fluxos de tempo (cron a cada 5 minutos) ----------
// Cada fluxo de tempo age no máximo UMA vez em cada chamado: quando pelo menos uma ação dele rodou,
// o id do fluxo entra em chamados.regras_tempo. Se nenhuma ação rodou (as perguntas disseram "não"), ele confere de novo depois.

function rodarRegrasDeTempo(app) {
  const auto = lerAutomacao(app);
  const fluxos = auto.fluxos.filter((f) => f.ativo && GATILHOS_TEMPO.indexOf(f.gatilho) >= 0 && f.ligacoes.length);
  if (!fluxos.length) return 0;
  const cfg = lerConfig(app);
  const ctx = contexto(app);
  const agora = new Date();
  let feitos = 0;
  for (const f of fluxos) {
    const limite = textoData(new Date(agora.getTime() - (f.minutos || 0) * 60000));
    let filtro, params;
    if (f.gatilho === "sem_inicio") { filtro = "status = 'aberto' && created <= {:l}"; params = { l: limite }; }
    else if (f.gatilho === "vencido") { filtro = "status = 'aberto' && prazo_em != '' && prazo_em <= {:l}"; params = { l: textoData(agora) }; }
    else { filtro = "status = 'aguardando' && aguardando_motivo = 'solicitante' && aguardando_desde != '' && aguardando_desde <= {:l}"; params = { l: limite }; }
    const so = { fluxos: [f], senao: AUTOMACAO_VAZIA.senao };
    for (const c of app.findRecordsByFilter("chamados", filtro, "created", 200, 0, params)) {
      if (!c) continue;
      const feitas = jsonCampo(c, "regras_tempo") || [];
      if (feitas.indexOf(f.id) >= 0) continue;
      const r = executar(so, f.gatilho, infoDoChamado(c, { horario: situacaoHorario(agora, cfg.horario) }), ctx, { podeAtribuir: true });
      const agiu = f.nos.some((n) => n.tipo === "acao" && r.fluxos[f.id].status[n.id] === "sim");
      if (!agiu) continue;
      feitas.push(f.id);
      c.set("regras_tempo", feitas);
      aplicarNoChamado(app, c, r, cfg, ctx);
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
  NIVEL, CONFIG_PADRAO, AUTOMACAO_VAZIA, CAMPOS, GATILHOS, ACOES_POR_GATILHO,
  lerConfig, normalizarConfig, lerAutomacao, normalizarAutomacao, validarAutomacao, ordemTopologica, jsonCampo,
  situacaoHorario, somarMinutos, calcularPrazoEOrdem, recalcularFila,
  avaliarCondicao, executar, contexto, ausenteHoje, infoDoChamado,
  aplicarNaAbertura, depoisDaAbertura, aplicarNaReabertura, aplicarEfeitos, rodarRegrasDeTempo, devolverChamadosDe,
};
