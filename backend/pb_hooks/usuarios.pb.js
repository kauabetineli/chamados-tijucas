/// <reference path="../pb_data/types.d.ts" />

// Usuários e setores gerenciados pelo TI (tela "Usuários") e pelas ferramentas de IA/CLI (ferramentas/).
// Documentação das rotas: docs/API.md.

// ---------- proteção do campo "ficticio" ----------
onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    e.record.set("ficticio", false);
    e.record.set("ramal", ""); // ramal é cadastrado pelo TI
  }
  if (e.record.getBool("ficticio") && require(`${__hooks}/lib/config.js`).ehProducao()) {
    throw new BadRequestError("Este servidor está em produção: não é permitido criar dados fictícios.");
  }
  e.next();
}, "users");

onRecordUpdateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    e.record.set("ficticio", e.record.original().getBool("ficticio"));
    e.record.set("ramal", e.record.original().getString("ramal")); // só o TI muda (rota PATCH abaixo)
  }
  e.next();
}, "users");

// ---------- informações do servidor ----------
// Usado pelas ferramentas para saber se podem gerar dados de teste.
routerAdd("GET", "/api/sistema/info", (e) => {
  const cfg = require(`${__hooks}/lib/config.js`).lerConfig();
  return e.json(200, {
    sistema: "Dino Desk",
    ambiente: cfg.ambiente,
    ntfy_configurado: !!cfg.ntfyTopico,
    smtp_ligado: !!e.app.settings().smtp.enabled,
    totais: {
      usuarios: e.app.countRecords("users"),
      usuarios_ficticios: e.app.countRecords("users", $dbx.hashExp({ ficticio: true })),
      chamados: e.app.countRecords("chamados"),
      chamados_ficticios: e.app.countRecords("chamados", $dbx.hashExp({ ficticio: true })),
      setores: e.app.countRecords("setores"),
    },
  });
}, $apis.requireAuth());

// ---------- listar usuários (TI) ----------
// O PocketBase esconde o e-mail de outros usuários; o TI precisa ver para passar o login.
// ?q=trecho do nome/e-mail  &papel=tecnico|solicitante  &ocultar_teste=1
// Paginado no banco: &pagina=1&por_pagina=25 (por_pagina=0 = todos, até 5000).
// Resposta: { itens, total, pagina, por_pagina }
routerAdd("GET", "/api/ti/usuarios", (e) => {
  const R = require(`${__hooks}/lib/regras.js`);
  const U = require(`${__hooks}/lib/usuarios.js`);
  if (!e.hasSuperuserAuth() && !R.ehTecnico(e.auth)) throw new ForbiddenError("Somente o TI.");
  const query = e.request.url.query();
  const q = query.get("q"), papel = query.get("papel"), ocultar = query.get("ocultar_teste") === "1";

  // o mesmo filtro em duas formas: texto (para buscar a página) e expressão (para contar o total)
  const partes = ["id != ''"];
  const params = {};
  const exps = [];
  if (q) {
    partes.push("(name ~ {:q} || email ~ {:q})"); params.q = q;
    exps.push($dbx.or($dbx.like("name", q), $dbx.like("email", q)));
  }
  if (papel) { partes.push("papel = {:p}"); params.p = papel; exps.push($dbx.hashExp({ papel })); }
  if (ocultar) { partes.push("ficticio != true"); exps.push($dbx.exp("ficticio != 1")); }

  let porPagina = parseInt(query.get("por_pagina"), 10);
  if (!(porPagina >= 0)) porPagina = 25;
  porPagina = porPagina === 0 ? 5000 : Math.min(porPagina, 200);
  const total = e.app.countRecords("users", ...exps);
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const pagina = Math.min(Math.max(1, parseInt(query.get("pagina"), 10) || 1), paginas);

  const lista = e.app.findRecordsByFilter("users", partes.join(" && "), "name", porPagina, (pagina - 1) * porPagina, params);
  return e.json(200, {
    itens: lista.filter((r) => !!r).map((r) => U.publico(e.app, r)),
    total, pagina, por_pagina: porPagina,
  });
}, $apis.requireAuth());

// ---------- criar usuário (TI) ----------
// Corpo: { nome, email, setor?: id, papel?: "solicitante"|"tecnico", ramal?, senha?, ficticio? }
// Sem "senha", gera uma senha provisória e devolve em "senha_provisoria" (mostrada uma única vez).
routerAdd("POST", "/api/ti/usuarios", (e) => {
  const R = require(`${__hooks}/lib/regras.js`);
  const U = require(`${__hooks}/lib/usuarios.js`);
  const superuser = e.hasSuperuserAuth();
  if (!superuser && !R.ehTecnico(e.auth)) throw new ForbiddenError("Somente o TI cria usuários.");

  const b = e.requestInfo().body || {};
  const nome = String(b.nome || "").trim();
  const email = String(b.email || "").trim().toLowerCase();
  const papel = b.papel === "tecnico" ? "tecnico" : "solicitante";
  const ficticio = superuser && b.ficticio === true;

  if (!nome) throw new BadRequestError("Informe o nome.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestError("Informe um e-mail válido.");
  if (ficticio && require(`${__hooks}/lib/config.js`).ehProducao()) {
    throw new BadRequestError("Este servidor está em produção: não é permitido criar dados fictícios.");
  }
  try {
    e.app.findAuthRecordByEmail("users", email);
    throw new BadRequestError("Já existe um usuário com este e-mail.");
  } catch (err) {
    if (err instanceof BadRequestError) throw err;
  }
  if (b.setor) {
    try { e.app.findRecordById("setores", String(b.setor)); } catch (_) { throw new BadRequestError("Setor não encontrado."); }
  }

  const senha = b.senha ? String(b.senha) : U.senhaProvisoria();
  if (senha.length < 8) throw new BadRequestError("A senha precisa de pelo menos 8 caracteres.");

  const rec = new Record(e.app.findCollectionByNameOrId("users"));
  rec.set("name", nome);
  rec.setEmail(email);
  rec.setPassword(senha);
  rec.setVerified(true);
  rec.set("setor", b.setor ? String(b.setor) : "");
  rec.set("papel", papel);
  rec.set("ramal", String(b.ramal || "").trim().slice(0, 20));
  rec.set("ficticio", ficticio);
  U.salvar(e.app, rec);

  return e.json(201, { usuario: U.publico(e.app, rec), senha_provisoria: b.senha ? null : senha });
}, $apis.requireAuth());

// ---------- editar usuário (TI) ----------
// Corpo (todos opcionais): { nome, setor: id | "", ramal }. Papel e e-mail não mudam aqui.
routerAdd("PATCH", "/api/ti/usuarios/{id}", (e) => {
  const R = require(`${__hooks}/lib/regras.js`);
  const U = require(`${__hooks}/lib/usuarios.js`);
  if (!e.hasSuperuserAuth() && !R.ehTecnico(e.auth)) throw new ForbiddenError("Somente o TI edita usuários.");
  let rec;
  try { rec = e.app.findRecordById("users", e.request.pathValue("id")); } catch (_) { throw new NotFoundError("Usuário não encontrado."); }
  const b = e.requestInfo().body || {};
  if (b.nome !== undefined) {
    const nome = String(b.nome).trim();
    if (!nome) throw new BadRequestError("Informe o nome.");
    rec.set("name", nome);
  }
  if (b.setor !== undefined) {
    if (b.setor) {
      try { e.app.findRecordById("setores", String(b.setor)); } catch (_) { throw new BadRequestError("Setor não encontrado."); }
    }
    rec.set("setor", String(b.setor || ""));
  }
  if (b.ramal !== undefined) rec.set("ramal", String(b.ramal || "").trim().slice(0, 20));
  U.salvar(e.app, rec);
  return e.json(200, { usuario: U.publico(e.app, rec) });
}, $apis.requireAuth());

// ---------- nova senha provisória (TI) ----------
// Para quando o servidor esquece a senha. Devolve a nova senha uma única vez.
routerAdd("POST", "/api/ti/usuarios/{id}/senha", (e) => {
  const R = require(`${__hooks}/lib/regras.js`);
  const U = require(`${__hooks}/lib/usuarios.js`);
  if (!e.hasSuperuserAuth() && !R.ehTecnico(e.auth)) throw new ForbiddenError("Somente o TI troca senhas.");
  let rec;
  try { rec = e.app.findRecordById("users", e.request.pathValue("id")); } catch (_) { throw new NotFoundError("Usuário não encontrado."); }
  const senha = U.senhaProvisoria();
  rec.setPassword(senha);
  U.salvar(e.app, rec);
  return e.json(200, { usuario: U.publico(e.app, rec), senha_provisoria: senha });
}, $apis.requireAuth());

// ---------- criar setor (TI) ----------
// Corpo: { nome, predio? }. Se já existir um setor com o mesmo nome, devolve o existente (criado = false).
routerAdd("POST", "/api/ti/setores", (e) => {
  const R = require(`${__hooks}/lib/regras.js`);
  if (!e.hasSuperuserAuth() && !R.ehTecnico(e.auth)) throw new ForbiddenError("Somente o TI cria setores.");
  const b = e.requestInfo().body || {};
  const nome = String(b.nome || "").trim();
  if (!nome) throw new BadRequestError("Informe o nome do setor.");
  const iguais = e.app.findRecordsByFilter("setores", "nome = {:n}", "", 1, 0, { n: nome });
  if (iguais.length && iguais[0]) {
    return e.json(200, { setor: { id: iguais[0].id, nome: iguais[0].getString("nome") }, criado: false });
  }
  const rec = new Record(e.app.findCollectionByNameOrId("setores"));
  rec.set("nome", nome);
  rec.set("predio", String(b.predio || ""));
  rec.set("ativo", true);
  e.app.save(rec);
  return e.json(201, { setor: { id: rec.id, nome }, criado: true });
}, $apis.requireAuth());
