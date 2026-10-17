/// <reference path="../pb_data/types.d.ts" />

// Contas e setores, gerenciados pelo ADMINISTRADOR DO TI (tela "Pessoas e setores") e pelas ferramentas (ferramentas/).
// Não existe "criar conta" público: o admin cria a conta com matrícula e uma senha provisória aleatória;
// no primeiro acesso a pessoa é obrigada a escolher a própria senha (campo trocar_senha).
// Técnicos sem "admin" só consultam. Documentação das rotas: docs/API.md.

// ---------- a própria pessoa só troca a senha ----------
// Nome, setor, matrícula, papel, ramal etc. são do admin (rotas abaixo, que salvam direto e não passam por aqui).
onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth()) throw new ForbiddenError("As contas são criadas pelo Departamento de TI.");
  if (e.record.getBool("ficticio") && require(`${__hooks}/lib/config.js`).ehProducao()) {
    throw new BadRequestError("Este servidor está em produção: não é permitido criar dados fictícios.");
  }
  e.next();
}, "users");

onRecordUpdateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next();
  const antes = e.record.original();
  for (const campo of ["name", "setor", "papel", "ramal", "matricula", "admin", "bloqueado", "ficticio", "trocar_senha", "emailVisibility"]) {
    e.record.set(campo, antes.get(campo));
  }
  e.record.setEmail(antes.email());

  const corpo = e.requestInfo().body || {};
  if (corpo.password) {
    if (String(corpo.password) === String(corpo.oldPassword || "")) {
      throw new BadRequestError("Escolha uma senha diferente da provisória.");
    }
    e.record.set("trocar_senha", false);
  }
  e.next();
}, "users");

// ---------- conta bloqueada não entra ----------
onRecordAuthWithPasswordRequest((e) => {
  if (e.record && e.record.getBool("bloqueado")) {
    throw new ForbiddenError("Esta conta está bloqueada. Fale com o Departamento de TI.");
  }
  e.next();
}, "users");

onRecordAuthRefreshRequest((e) => {
  if (e.record && e.record.getBool("bloqueado")) throw new ForbiddenError("Esta conta está bloqueada.");
  e.next();
}, "users");

// ---------- com senha provisória, a pessoa troca antes de usar o sistema ----------
onRecordCreateRequest((e) => {
  if (e.auth && e.auth.collection().name === "users" && e.auth.getBool("trocar_senha")) {
    throw new ForbiddenError("Troque a senha provisória antes de continuar.");
  }
  e.next();
}, "chamados", "interacoes");

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

// ---------- listar pessoas (qualquer técnico) ----------
// O PocketBase esconde o e-mail de outros usuários; o TI precisa ver.
// ?q=trecho do nome/matrícula/e-mail &papel=tecnico|solicitante &setor=id &ocultar_teste=1
// Paginado no banco: &pagina=1&por_pagina=25 (por_pagina=0 = todos, até 5000).
// Resposta: { itens, total, pagina, por_pagina }
routerAdd("GET", "/api/ti/usuarios", (e) => {
  const R = require(`${__hooks}/lib/regras.js`);
  const U = require(`${__hooks}/lib/usuarios.js`);
  if (!e.hasSuperuserAuth() && !R.ehTecnico(e.auth)) throw new ForbiddenError("Somente o TI.");
  const query = e.request.url.query();
  const q = query.get("q"), papel = query.get("papel"), setor = query.get("setor"), ocultar = query.get("ocultar_teste") === "1";

  // o mesmo filtro em duas formas: texto (para buscar a página) e expressão (para contar o total)
  const partes = ["id != ''"];
  const params = {};
  const exps = [];
  if (q) {
    partes.push("(name ~ {:q} || email ~ {:q} || matricula ~ {:q})"); params.q = q;
    exps.push($dbx.or($dbx.like("name", q), $dbx.like("email", q), $dbx.like("matricula", q)));
  }
  if (papel) { partes.push("papel = {:p}"); params.p = papel; exps.push($dbx.hashExp({ papel })); }
  if (setor) { partes.push("setor = {:s}"); params.s = setor; exps.push($dbx.hashExp({ setor })); }
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

// ---------- criar pessoa (admin) ----------
// Corpo: { nome, matricula, setor?: id, papel?: "solicitante"|"tecnico", admin?, email?, ramal?, senha?, ficticio? }
// Sem "senha", gera uma senha provisória aleatória (devolvida uma única vez em "senha_provisoria")
// e marca trocar_senha: a pessoa escolhe a própria senha no primeiro acesso.
// "senha" e "ficticio" só valem para o superusuário (ferramentas de teste).
routerAdd("POST", "/api/ti/usuarios", (e) => {
  const R = require(`${__hooks}/lib/regras.js`);
  const U = require(`${__hooks}/lib/usuarios.js`);
  const superuser = e.hasSuperuserAuth();
  if (!superuser && !R.ehAdmin(e.auth)) throw new ForbiddenError("Somente o administrador do TI cria contas.");

  const b = e.requestInfo().body || {};
  const nome = String(b.nome || "").trim();
  const matricula = String(b.matricula || "").trim();
  const email = String(b.email || "").trim().toLowerCase();
  const papel = b.papel === "tecnico" ? "tecnico" : "solicitante";
  const ficticio = superuser && b.ficticio === true;

  if (!nome) throw new BadRequestError("Informe o nome.");
  if (!U.matriculaValida(matricula)) throw new BadRequestError("Informe a matrícula: só números, até 8 dígitos.");
  if (email && !U.emailValido(email)) throw new BadRequestError("E-mail inválido. Deixe em branco se a pessoa não tiver.");
  if (ficticio && require(`${__hooks}/lib/config.js`).ehProducao()) {
    throw new BadRequestError("Este servidor está em produção: não é permitido criar dados fictícios.");
  }
  U.exigirUnico(e.app, "matricula", matricula, "", "Já existe uma pessoa com esta matrícula.");
  U.exigirUnico(e.app, "email", email, "", "Já existe uma pessoa com este e-mail.");
  U.exigirSetor(e.app, String(b.setor || ""));

  const senhaFixa = superuser && b.senha ? String(b.senha) : "";
  if (senhaFixa && senhaFixa.length < 8) throw new BadRequestError("A senha precisa de pelo menos 8 caracteres.");
  const senha = senhaFixa || U.senhaProvisoria();

  const rec = new Record(e.app.findCollectionByNameOrId("users"));
  rec.set("name", nome);
  rec.set("matricula", matricula);
  if (email) rec.setEmail(email);
  rec.setPassword(senha);
  rec.setVerified(true);
  rec.set("setor", String(b.setor || ""));
  rec.set("papel", papel);
  rec.set("admin", papel === "tecnico" && b.admin === true);
  rec.set("ramal", String(b.ramal || "").trim().slice(0, 20));
  rec.set("trocar_senha", !senhaFixa);
  rec.set("ficticio", ficticio);
  U.salvar(e.app, rec);

  return e.json(201, { usuario: U.publico(e.app, rec), senha_provisoria: senhaFixa ? null : senha });
}, $apis.requireAuth());

// ---------- editar pessoa (admin) ----------
// Corpo (todos opcionais): { nome, matricula, email, setor: id|"", ramal, papel, admin, bloqueado }.
// Proteções: o admin não tira o próprio admin nem se bloqueia, e sempre sobra pelo menos 1 admin ativo.
routerAdd("PATCH", "/api/ti/usuarios/{id}", (e) => {
  const R = require(`${__hooks}/lib/regras.js`);
  const U = require(`${__hooks}/lib/usuarios.js`);
  const superuser = e.hasSuperuserAuth();
  if (!superuser && !R.ehAdmin(e.auth)) throw new ForbiddenError("Somente o administrador do TI edita contas.");
  let rec;
  try { rec = e.app.findRecordById("users", e.request.pathValue("id")); } catch (_) { throw new NotFoundError("Pessoa não encontrada."); }
  const eu = !superuser && e.auth.id === rec.id;
  const b = e.requestInfo().body || {};

  if (b.nome !== undefined) {
    const nome = String(b.nome).trim();
    if (!nome) throw new BadRequestError("Informe o nome.");
    rec.set("name", nome);
  }
  if (b.matricula !== undefined) {
    const m = String(b.matricula).trim();
    if (!U.matriculaValida(m)) throw new BadRequestError("Matrícula: só números, até 8 dígitos.");
    U.exigirUnico(e.app, "matricula", m, rec.id, "Já existe uma pessoa com esta matrícula.");
    rec.set("matricula", m);
  }
  if (b.email !== undefined) {
    const email = String(b.email || "").trim().toLowerCase();
    if (email && !U.emailValido(email)) throw new BadRequestError("E-mail inválido. Deixe em branco se a pessoa não tiver.");
    U.exigirUnico(e.app, "email", email, rec.id, "Já existe uma pessoa com este e-mail.");
    rec.setEmail(email);
  }
  if (b.setor !== undefined) {
    U.exigirSetor(e.app, String(b.setor || ""));
    rec.set("setor", String(b.setor || ""));
  }
  if (b.ramal !== undefined) rec.set("ramal", String(b.ramal || "").trim().slice(0, 20));

  const eraAdminAtivo = rec.getBool("admin") && !rec.getBool("bloqueado") && rec.getString("papel") === "tecnico";
  if (b.papel !== undefined) rec.set("papel", b.papel === "tecnico" ? "tecnico" : "solicitante");
  if (b.admin !== undefined) rec.set("admin", b.admin === true);
  if (rec.getString("papel") !== "tecnico") rec.set("admin", false);
  if (b.bloqueado !== undefined) rec.set("bloqueado", b.bloqueado === true);

  const ficaAdminAtivo = rec.getBool("admin") && !rec.getBool("bloqueado") && rec.getString("papel") === "tecnico";
  if (eu && eraAdminAtivo && !ficaAdminAtivo) {
    throw new BadRequestError("Você não pode tirar o seu próprio acesso de administrador nem se bloquear.");
  }
  if (eraAdminAtivo && !ficaAdminAtivo && U.adminsAtivos(e.app, rec.id) === 0) {
    throw new BadRequestError("O sistema precisa de pelo menos um administrador do TI ativo.");
  }
  // bloqueou: derruba as sessões abertas
  if (b.bloqueado === true && !rec.original().getBool("bloqueado")) rec.refreshTokenKey();

  U.salvar(e.app, rec);
  return e.json(200, { usuario: U.publico(e.app, rec) });
}, $apis.requireAuth());

// ---------- nova senha provisória (admin) ----------
// Para quando a pessoa esquece a senha. Devolve a nova senha uma única vez; a pessoa troca no próximo acesso.
routerAdd("POST", "/api/ti/usuarios/{id}/senha", (e) => {
  const R = require(`${__hooks}/lib/regras.js`);
  const U = require(`${__hooks}/lib/usuarios.js`);
  if (!e.hasSuperuserAuth() && !R.ehAdmin(e.auth)) throw new ForbiddenError("Somente o administrador do TI troca senhas.");
  let rec;
  try { rec = e.app.findRecordById("users", e.request.pathValue("id")); } catch (_) { throw new NotFoundError("Pessoa não encontrada."); }
  const senha = U.senhaProvisoria();
  rec.setPassword(senha);
  rec.set("trocar_senha", true);
  U.salvar(e.app, rec);
  return e.json(200, { usuario: U.publico(e.app, rec), senha_provisoria: senha });
}, $apis.requireAuth());

// ---------- setores ----------
// Listar (qualquer técnico): todos, com o número de pessoas de cada um.
routerAdd("GET", "/api/ti/setores", (e) => {
  const R = require(`${__hooks}/lib/regras.js`);
  const U = require(`${__hooks}/lib/usuarios.js`);
  if (!e.hasSuperuserAuth() && !R.ehTecnico(e.auth)) throw new ForbiddenError("Somente o TI.");
  const lista = e.app.findRecordsByFilter("setores", "id != ''", "nome", 0, 0);
  return e.json(200, { itens: lista.filter((s) => !!s).map((s) => U.setorPublico(e.app, s)) });
}, $apis.requireAuth());

// Criar (admin). Corpo: { nome, predio?, ramal? }. Se já existir com o mesmo nome, devolve o existente (criado = false).
routerAdd("POST", "/api/ti/setores", (e) => {
  const R = require(`${__hooks}/lib/regras.js`);
  const U = require(`${__hooks}/lib/usuarios.js`);
  if (!e.hasSuperuserAuth() && !R.ehAdmin(e.auth)) throw new ForbiddenError("Somente o administrador do TI cria setores.");
  const b = e.requestInfo().body || {};
  const nome = String(b.nome || "").trim();
  if (!nome) throw new BadRequestError("Informe o nome do setor.");
  const iguais = e.app.findRecordsByFilter("setores", "nome = {:n}", "", 1, 0, { n: nome });
  if (iguais.length && iguais[0]) {
    return e.json(200, { setor: U.setorPublico(e.app, iguais[0]), criado: false });
  }
  const rec = new Record(e.app.findCollectionByNameOrId("setores"));
  rec.set("nome", nome);
  rec.set("predio", String(b.predio || "").trim());
  rec.set("ramal", String(b.ramal || "").trim().slice(0, 20));
  rec.set("ativo", true);
  e.app.save(rec);
  return e.json(201, { setor: U.setorPublico(e.app, rec), criado: true });
}, $apis.requireAuth());

// Editar (admin). Corpo (opcionais): { nome, predio, ramal, ativo }. Setor inativo some da lista de escolha.
routerAdd("PATCH", "/api/ti/setores/{id}", (e) => {
  const R = require(`${__hooks}/lib/regras.js`);
  const U = require(`${__hooks}/lib/usuarios.js`);
  if (!e.hasSuperuserAuth() && !R.ehAdmin(e.auth)) throw new ForbiddenError("Somente o administrador do TI edita setores.");
  let rec;
  try { rec = e.app.findRecordById("setores", e.request.pathValue("id")); } catch (_) { throw new NotFoundError("Setor não encontrado."); }
  const b = e.requestInfo().body || {};
  if (b.nome !== undefined) {
    const nome = String(b.nome).trim();
    if (!nome) throw new BadRequestError("Informe o nome do setor.");
    const iguais = e.app.findRecordsByFilter("setores", "nome = {:n} && id != {:id}", "", 1, 0, { n: nome, id: rec.id });
    if (iguais.length && iguais[0]) throw new BadRequestError("Já existe um setor com este nome.");
    rec.set("nome", nome);
  }
  if (b.predio !== undefined) rec.set("predio", String(b.predio || "").trim());
  if (b.ramal !== undefined) rec.set("ramal", String(b.ramal || "").trim().slice(0, 20));
  if (b.ativo !== undefined) rec.set("ativo", b.ativo === true);
  e.app.save(rec);
  return e.json(200, { setor: U.setorPublico(e.app, rec) });
}, $apis.requireAuth());
