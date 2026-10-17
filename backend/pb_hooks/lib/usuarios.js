// Funções de apoio das rotas de usuários e setores (pb_hooks/usuarios.pb.js).
// Importe DENTRO do handler: const U = require(`${__hooks}/lib/usuarios.js`)

// Senha provisória aleatória, em 3 blocos fáceis de ler e digitar: "k7Pm-x4Qz-9Rta".
// Sem 0/O, 1/l/I, que confundem. A pessoa troca no primeiro acesso (trocar_senha).
const LETRAS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function senhaProvisoria() {
  return [4, 4, 4].map((n) => $security.randomStringWithAlphabet(n, LETRAS)).join("-");
}

// Matrícula: só números, de 1 a 8 dígitos (hoje a Prefeitura usa 5).
function matriculaValida(m) {
  return /^[0-9]{1,8}$/.test(m);
}

function emailValido(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

// Erro 400 se o valor já existe em outro usuário.
function exigirUnico(app, campo, valor, idAtual, mensagem) {
  if (!valor) return;
  const iguais = app.findRecordsByFilter("users", `${campo} = {:v} && id != {:id}`, "", 1, 0, { v: valor, id: idAtual || "" });
  if (iguais.length && iguais[0]) throw new BadRequestError(mensagem);
}

function exigirSetor(app, id) {
  if (!id) return;
  try { app.findRecordById("setores", id); } catch (_) { throw new BadRequestError("Setor não encontrado."); }
}

// Quantos administradores ativos (não bloqueados) existem, sem contar `exceto`.
function adminsAtivos(app, exceto) {
  return app.findRecordsByFilter("users", "admin = true && bloqueado != true && papel = 'tecnico' && id != {:id}", "", 0, 0, { id: exceto || "" })
    .filter((r) => !!r).length;
}

// Salva e transforma erro de validação em mensagem legível (400 em vez de 500).
function salvar(app, rec) {
  try {
    app.save(rec);
  } catch (err) {
    const txt = String(err);
    if (txt.includes("matricula")) throw new BadRequestError("Matrícula inválida ou já usada (só números, até 8 dígitos).");
    if (txt.includes("email")) throw new BadRequestError("E-mail inválido ou já usado.");
    throw new BadRequestError("Não foi possível salvar: " + txt);
  }
}

// Dados do usuário que podem voltar na resposta (nunca hash de senha nem token).
function publico(app, rec) {
  let setorNome = "", setorRamal = "";
  if (rec.getString("setor")) {
    try {
      const s = app.findRecordById("setores", rec.getString("setor"));
      setorNome = s.getString("nome");
      setorRamal = s.getString("ramal");
    } catch (_) {}
  }
  return {
    id: rec.id,
    nome: rec.getString("name"),
    matricula: rec.getString("matricula"),
    email: rec.email(),
    papel: rec.getString("papel") || "solicitante",
    admin: rec.getBool("admin"),
    setor: rec.getString("setor"),
    setor_nome: setorNome,
    setor_ramal: setorRamal,
    ramal: rec.getString("ramal"),
    trocar_senha: rec.getBool("trocar_senha"),
    bloqueado: rec.getBool("bloqueado"),
    ficticio: rec.getBool("ficticio"),
    criado: rec.getString("created"),
  };
}

function setorPublico(app, s) {
  return {
    id: s.id,
    nome: s.getString("nome"),
    predio: s.getString("predio"),
    ramal: s.getString("ramal"),
    ativo: s.getBool("ativo"),
    pessoas: app.countRecords("users", $dbx.hashExp({ setor: s.id })),
  };
}

module.exports = { senhaProvisoria, matriculaValida, emailValido, exigirUnico, exigirSetor, adminsAtivos, salvar, publico, setorPublico };
