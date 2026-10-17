// Operações de alto nível do Dino Desk, usadas pela CLI (dino.mjs) e pelo servidor MCP (mcp.mjs).
// Cada operação recebe (dino, parametros, log) e devolve um objeto simples (JSON).
// `log` recebe mensagens de progresso legíveis; a CLI imprime, o MCP junta na resposta.
//
// Regras:
// - Tudo que é criado aqui é FICTÍCIO por padrão (users.ficticio = true, e-mail @teste.dinodesk).
// - O servidor recusa dado fictício quando config.json tem "ambiente": "producao".
// - Abrir/atender chamado acontece "como" o usuário (personificação), então os hooks
//   aplicam as mesmas regras do uso real: protocolo, prioridade, histórico, compressão de vídeo.

import { aspas, ErroDino } from "./cliente.mjs";
import {
  chance, comentarioSolicitante, comentarioTI, DOMINIO_TESTE, impactoFalso,
  pessoaFalsa, problemaFalso, ramalFalso, SETORES, sortear,
} from "./dados-falsos.mjs";
import { arquivoFalso } from "./midia.mjs";

const silencio = () => {};
const SETOR_TI = "Departamento de TI";

// ---------- consultas básicas ----------

export async function info(dino) {
  const i = await dino.req("GET", "/api/sistema/info");
  return { url: dino.url, ...i };
}

async function exigirAmbienteDeTeste(dino) {
  const i = await dino.req("GET", "/api/sistema/info");
  if (i.ambiente === "producao") {
    throw new ErroDino("Este servidor está em PRODUÇÃO (config.json → \"ambiente\": \"producao\"). Dados fictícios não são permitidos aqui.");
  }
}

export async function listarSetores(dino) {
  const s = await dino.todos("setores", { ordem: "nome", campos: "id,nome,predio,ativo" });
  return { total: s.length, setores: s };
}

export async function listarCategorias(dino) {
  const c = await dino.todos("categorias", { filtro: "ativa = true", ordem: "ordem,nome", campos: "id,nome,icone" });
  return { total: c.length, categorias: c };
}

export async function listarUsuarios(dino, { ficticios, papel, busca, limite = 50 } = {}) {
  const f = [];
  if (ficticios !== undefined) f.push(`ficticio = ${ficticios ? "true" : "false"}`);
  if (papel) f.push(`papel = ${aspas(papel)}`);
  if (busca) f.push(`(name ~ ${aspas(busca)} || email ~ ${aspas(busca)} || matricula ~ ${aspas(busca)})`);
  const u = await dino.todos("users", { filtro: f.join(" && "), ordem: "name", expand: "setor" });
  return {
    total: u.length,
    usuarios: u.slice(0, limite).map((x) => ({
      id: x.id, nome: x.name, matricula: x.matricula || "", email: x.email, papel: x.papel || "solicitante", admin: !!x.admin,
      setor: x.expand?.setor?.nome || "", ramal: x.ramal || x.expand?.setor?.ramal || "", ficticio: !!x.ficticio,
    })),
  };
}

// ---------- resolução de referências (aceita id, nome, e-mail ou protocolo) ----------

async function acharSetor(dino, ref, { criar = true, ramal = "" } = {}) {
  if (!ref) return null;
  const porId = await dino.todos("setores", { filtro: `id = ${aspas(ref)} || nome = ${aspas(ref)}` });
  if (porId[0]) return porId[0];
  if (!criar) throw new ErroDino(`Setor "${ref}" não encontrado.`);
  const predio = SETORES.find(([n]) => n === ref)?.[1] || "";
  return (await dino.req("POST", "/api/ti/setores", { corpo: { nome: ref, predio, ramal } })).setor;
}

async function acharUsuario(dino, ref) {
  const u = await dino.todos("users", { filtro: `id = ${aspas(ref)} || email = ${aspas(ref)} || matricula = ${aspas(ref)}` });
  if (!u[0]) throw new ErroDino(`Usuário "${ref}" não encontrado (use id, matrícula ou e-mail).`);
  return u[0];
}

async function acharCategoria(dino, ref) {
  const todas = (await listarCategorias(dino)).categorias;
  if (!ref) return sortear(todas);
  const alvo = String(ref).toLowerCase();
  const c = todas.find((x) => x.id === ref || x.nome.toLowerCase() === alvo) ||
    todas.find((x) => x.nome.toLowerCase().includes(alvo));
  if (!c) throw new ErroDino(`Categoria "${ref}" não existe. Opções: ${todas.map((x) => x.nome).join(", ")}.`);
  return c;
}

async function acharChamado(dino, ref) {
  const c = await dino.todos("chamados", { filtro: `id = ${aspas(ref)} || protocolo = ${aspas(ref)}`, expand: "categoria" });
  if (!c[0]) throw new ErroDino(`Chamado "${ref}" não encontrado (use id ou protocolo, ex.: 2026-00012).`);
  return c[0];
}

async function tecnicoFicticio(dino, ref) {
  if (ref) return acharUsuario(dino, ref);
  const t = await dino.todos("users", { filtro: 'papel = "tecnico" && ficticio = true' });
  if (!t.length) throw new ErroDino("Não há técnico fictício. Crie com criar_usuarios_ficticios (tecnicos >= 1) ou informe o técnico.");
  return sortear(t);
}

// ---------- criação ----------

export async function criarSetor(dino, { nome, predio = "", ramal = "" }) {
  return dino.req("POST", "/api/ti/setores", { corpo: { nome, predio, ramal } });
}

/**
 * Cria um usuário. Fictício por padrão (ficticio: false cria uma conta REAL).
 * A MATRÍCULA é o login (até 8 dígitos); e-mail é opcional.
 * Sem senha, o servidor gera uma provisória aleatória (senha_provisoria) e a pessoa troca no primeiro acesso.
 */
export async function criarUsuario(dino, { nome, matricula, email, setor, papel = "solicitante", admin = false, ramal, senha, ficticio = true }, log = silencio) {
  if (ficticio) {
    await exigirAmbienteDeTeste(dino);
    const p = pessoaFalsa();
    nome ||= p.nome;
    email ||= p.email;
    matricula ||= p.matricula;
  }
  if (!nome || !matricula) throw new ErroDino("Informe nome e matrícula (só números, até 8 dígitos).");
  // setor criado agora para dado de teste ganha um ramal fictício; para conta real, o admin preenche depois
  const s = await acharSetor(dino, setor || (papel === "tecnico" ? SETOR_TI : ""), { ramal: ficticio ? ramalFalso() : "" });
  const r = await dino.req("POST", "/api/ti/usuarios", {
    corpo: { nome, matricula: String(matricula), email: email || "", setor: s?.id || "", papel, admin, ramal, senha, ficticio },
  });
  log(`+ ${ficticio ? "usuário fictício" : "usuário"}: ${r.usuario.nome} (mat. ${r.usuario.matricula}) (${r.usuario.papel}${r.usuario.admin ? ", admin" : ""}${r.usuario.setor_nome ? ", " + r.usuario.setor_nome : ""})`);
  return r;
}

/** Cria vários usuários fictícios espalhados pelos setores (cria os setores que faltarem). */
export async function criarUsuariosFicticios(dino, { quantidade = 10, tecnicos = 0, setores, senha = "Teste@1234" } = {}, log = silencio) {
  await exigirAmbienteDeTeste(dino);
  const nomes = setores?.length ? setores : SETORES.map(([n]) => n);
  for (const n of nomes) await acharSetor(dino, n);
  const criados = [];
  for (let i = 0; i < quantidade; i++) {
    criados.push((await criarUsuario(dino, { setor: nomes[i % nomes.length], senha, ficticio: true }, log)).usuario);
  }
  for (let i = 0; i < tecnicos; i++) {
    criados.push((await criarUsuario(dino, { papel: "tecnico", senha, ficticio: true }, log)).usuario);
  }
  return { criados: criados.length, senha_de_todos: senha, usuarios: criados };
}

/**
 * Abre um chamado COMO o solicitante (origem "sistema"), ou registra um pedido COMO técnico
 * (origem whatsapp/ligacao/presencial). Anexos falsos: fotos (prints/fotos PNG) e vídeos (mp4 de 4 s).
 */
export async function abrirChamado(dino, {
  solicitante, categoria, impacto, descricao, fotos = 0, videos = 0, origem = "sistema", tecnico,
} = {}, log = silencio) {
  let sol;
  if (solicitante) sol = await acharUsuario(dino, solicitante);
  else {
    const pool = await dino.todos("users", { filtro: 'ficticio = true && papel != "tecnico"' });
    if (!pool.length) throw new ErroDino("Não há solicitante fictício. Crie com criar_usuarios_ficticios ou informe o solicitante.");
    sol = sortear(pool);
  }
  const cat = await acharCategoria(dino, categoria);
  const prob = problemaFalso(cat.nome);

  const form = new FormData();
  form.append("categoria", cat.id);
  form.append("impacto", impacto || impactoFalso());
  form.append("descricao", descricao || prob.descricao);
  for (let i = 1; i <= Math.min(fotos, 5); i++) form.append("anexos", arquivoFalso(chance(0.6) ? "print" : "foto", i));
  for (let i = 1; i <= Math.min(videos, 5 - Math.min(fotos, 5)); i++) form.append("anexos", arquivoFalso("video", i));

  let como = sol.id;
  if (origem !== "sistema") {
    const tec = await tecnicoFicticio(dino, tecnico);
    form.append("solicitante", sol.id);
    form.append("origem", origem);
    como = tec.id;
  }
  const c = await dino.req("POST", "/api/collections/chamados/records", { form, como });
  log(`+ chamado ${c.protocolo}: ${cat.nome}, ${c.prioridade}, por ${sol.name}${origem !== "sistema" ? ` (registrado pelo TI, ${origem})` : ""}${c.anexos?.length ? `, ${c.anexos.length} anexo(s)` : ""}`);
  return {
    id: c.id, protocolo: c.protocolo, status: c.status, prioridade: c.prioridade,
    categoria: cat.nome, solicitante: sol.email, origem: c.origem, anexos: c.anexos?.length || 0, ficticio: c.ficticio,
  };
}

/**
 * Ações sobre um chamado.
 * acao: "iniciar" | "comentar" | "resolver" (técnico) | "responder" | "confirmar" | "reabrir" (solicitante)
 */
export async function atenderChamado(dino, { chamado, acao, tecnico, texto, diagnostico, solucao, interno = false }, log = silencio) {
  const c = await acharChamado(dino, chamado);
  const prob = problemaFalso(c.expand?.categoria?.nome);
  const patch = (corpo, como) => dino.req("PATCH", `/api/collections/chamados/records/${c.id}`, { corpo, como });

  if (["iniciar", "comentar", "resolver"].includes(acao)) {
    // quem já está com o chamado continua com ele
    const tec = await tecnicoFicticio(dino, tecnico || c.responsavel);
    if (acao === "iniciar") await patch({ status: "em_andamento" }, tec.id);
    if (acao === "comentar") {
      await dino.req("POST", "/api/collections/interacoes/records", {
        corpo: { chamado: c.id, texto: texto || comentarioTI(), interno }, como: tec.id,
      });
    }
    if (acao === "resolver") {
      await patch({ status: "resolvido", diagnostico: diagnostico || prob.diagnostico, solucao: solucao || prob.solucao }, tec.id);
    }
    log(`~ ${c.protocolo}: ${acao} (técnico ${tec.name})`);
  } else if (["responder", "confirmar", "reabrir"].includes(acao)) {
    if (!c.solicitante) throw new ErroDino("Chamado sem solicitante cadastrado.");
    if (acao === "responder") {
      await dino.req("POST", "/api/collections/interacoes/records", {
        corpo: { chamado: c.id, texto: texto || comentarioSolicitante() }, como: c.solicitante,
      });
    }
    if (acao === "confirmar") await dino.req("POST", `/api/chamados/${c.id}/confirmar`, { corpo: {}, como: c.solicitante });
    if (acao === "reabrir") {
      await dino.req("POST", `/api/chamados/${c.id}/reabrir`, { corpo: { motivo: texto || "O problema voltou a acontecer." }, como: c.solicitante });
    }
    log(`~ ${c.protocolo}: ${acao} (solicitante)`);
  } else {
    throw new ErroDino(`Ação "${acao}" inválida. Use iniciar, comentar, resolver, responder, confirmar ou reabrir.`);
  }
  const depois = await acharChamado(dino, c.id);
  return { protocolo: depois.protocolo, status: depois.status, confirmado: depois.confirmado, acao };
}

export async function listarChamados(dino, { status, ficticios, limite = 20 } = {}) {
  const f = [];
  if (status) f.push(`status = ${aspas(status)}`);
  if (ficticios !== undefined) f.push(`ficticio = ${ficticios ? "true" : "false"}`);
  const q = new URLSearchParams({ perPage: String(Math.min(limite, 200)), sort: "-created", expand: "categoria,solicitante,setor" });
  if (f.length) q.set("filter", f.join(" && "));
  const r = await dino.req("GET", `/api/collections/chamados/records?${q}`);
  return {
    total: r.totalItems,
    chamados: r.items.map((c) => ({
      id: c.id, protocolo: c.protocolo, status: c.status, prioridade: c.prioridade,
      categoria: c.expand?.categoria?.nome || "", setor: c.expand?.setor?.nome || "",
      solicitante: c.expand?.solicitante?.name || c.solicitante_nome || "", origem: c.origem,
      anexos: c.anexos?.length || 0, ficticio: !!c.ficticio, criado: c.created,
    })),
  };
}

// ---------- geração em lote ----------

/**
 * Popula o sistema de uma vez: usuários + chamados em vários estados, com anexos falsos.
 * Bom para ver as telas cheias (fila, histórico, painel).
 */
export async function popular(dino, { usuarios = 10, tecnicos = 2, chamados = 20, midia = true } = {}, log = silencio) {
  await exigirAmbienteDeTeste(dino);
  const atuais = await dino.todos("users", { filtro: "ficticio = true" });
  const faltamSol = Math.max(0, usuarios - atuais.filter((u) => u.papel !== "tecnico").length);
  const faltamTec = Math.max(0, tecnicos - atuais.filter((u) => u.papel === "tecnico").length);
  if (faltamSol || faltamTec) await criarUsuariosFicticios(dino, { quantidade: faltamSol, tecnicos: faltamTec }, log);

  const abertos = [];
  for (let i = 0; i < chamados; i++) {
    const origem = chance(0.25) ? sortear(["whatsapp", "ligacao", "presencial"]) : "sistema";
    abertos.push(await abrirChamado(dino, {
      origem,
      fotos: midia && chance(0.4) ? 1 + (chance(0.3) ? 1 : 0) : 0,
      videos: midia && chance(0.1) ? 1 : 0,
    }, log));
  }
  // espalha os estados: ~40% ficam abertos, ~25% em andamento, ~35% resolvidos
  for (const c of abertos) {
    const r = Math.random();
    if (r < 0.4) continue;
    await atenderChamado(dino, { chamado: c.id, acao: "iniciar" }, log);
    if (chance(0.5)) await atenderChamado(dino, { chamado: c.id, acao: "comentar" }, log);
    if (r >= 0.65) {
      await atenderChamado(dino, { chamado: c.id, acao: "resolver" }, log);
      if (c.origem === "sistema" && chance(0.5)) await atenderChamado(dino, { chamado: c.id, acao: "confirmar" }, log);
    }
  }
  return { chamados_criados: abertos.length, ...(await info(dino)).totais };
}

/**
 * Executa N ações aleatórias como num dia de trabalho: servidores abrindo chamados,
 * técnicos iniciando, comentando e resolvendo, servidores confirmando.
 * Só mexe em chamados FICTÍCIOS.
 */
export async function simularRodadas(dino, { rodadas = 10, midia = true } = {}, log = silencio) {
  await exigirAmbienteDeTeste(dino);
  const feitas = [];
  for (let i = 0; i < rodadas; i++) {
    const r = Math.random();
    const pegar = async (status) => {
      const l = await dino.todos("chamados", { filtro: `ficticio = true && status = ${aspas(status)}`, ordem: "-peso,created", campos: "id,protocolo,origem,confirmado" });
      return l;
    };
    let feito = null;
    if (r < 0.2) {
      const l = await pegar("aberto");
      if (l.length) feito = await atenderChamado(dino, { chamado: l[0].id, acao: "iniciar" }, log);
    } else if (r < 0.32) {
      const l = await pegar("em_andamento");
      if (l.length) feito = await atenderChamado(dino, { chamado: sortear(l).id, acao: "comentar" }, log);
    } else if (r < 0.47) {
      const l = await pegar("em_andamento");
      if (l.length) feito = await atenderChamado(dino, { chamado: sortear(l).id, acao: "resolver" }, log);
    } else if (r < 0.52) {
      const l = (await pegar("resolvido")).filter((c) => c.origem === "sistema" && !c.confirmado);
      if (l.length) feito = await atenderChamado(dino, { chamado: sortear(l).id, acao: chance(0.85) ? "confirmar" : "reabrir" }, log);
    } else if (r < 0.58) {
      feito = await abrirChamado(dino, { origem: sortear(["whatsapp", "ligacao", "presencial"]) }, log);
    }
    if (!feito) {
      feito = await abrirChamado(dino, {
        fotos: midia && chance(0.35) ? 1 : 0,
        videos: midia && chance(0.08) ? 1 : 0,
      }, log);
    }
    feitas.push(feito);
  }
  return { rodadas: feitas.length, acoes: feitas, totais: (await info(dino)).totais };
}

/**
 * Simulação contínua (CLI): uma ação a cada `intervalo` segundos durante `minutos`.
 * `parar()` devolve true para interromper (Ctrl+C).
 */
export async function simular(dino, { minutos = 5, intervalo = 8, midia = true } = {}, log = silencio, parar = () => false) {
  await exigirAmbienteDeTeste(dino);
  const fim = Date.now() + minutos * 60000;
  let n = 0;
  while (Date.now() < fim && !parar()) {
    try {
      await simularRodadas(dino, { rodadas: 1, midia }, log);
      n++;
    } catch (err) {
      log(`! ${err.message}`);
    }
    const espera = intervalo * 1000 * (0.5 + Math.random()); // ritmo irregular, como gente de verdade
    const ate = Date.now() + espera;
    while (Date.now() < ate && !parar()) await new Promise((r) => setTimeout(r, 200));
  }
  return { acoes: n, totais: (await info(dino)).totais };
}

/** Apaga TODOS os chamados e usuários fictícios (comentários vão junto). Setores ficam. */
export async function limparFicticios(dino, { confirmar = false } = {}, log = silencio) {
  const chamados = await dino.todos("chamados", { filtro: "ficticio = true", campos: "id" });
  const usuarios = await dino.todos("users", { filtro: "ficticio = true", campos: "id" });
  if (!confirmar) {
    return { apagaria: { chamados: chamados.length, usuarios: usuarios.length }, aviso: "Nada apagado. Para apagar: confirmar = true (na CLI: --confirmar)." };
  }
  for (const c of chamados) await dino.req("DELETE", `/api/collections/chamados/records/${c.id}`);
  log(`- ${chamados.length} chamado(s) fictício(s) apagado(s)`);
  for (const u of usuarios) await dino.req("DELETE", `/api/collections/users/records/${u.id}`);
  log(`- ${usuarios.length} usuário(s) fictício(s) apagado(s)`);
  return { apagados: { chamados: chamados.length, usuarios: usuarios.length }, dominio: DOMINIO_TESTE };
}
