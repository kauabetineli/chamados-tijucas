// Funções de apoio das rotas de usuários (pb_hooks/usuarios.pb.js).
// Importe DENTRO do handler: const U = require(`${__hooks}/lib/usuarios.js`)

// Senha provisória fácil de ditar por telefone: "Dino" + 6 números (sem 0 e 1, que confundem com O e l).
function senhaProvisoria() {
  return "Dino" + $security.randomStringWithAlphabet(6, "23456789");
}

// Salva e transforma erro de validação em mensagem legível (400 em vez de 500).
function salvar(app, rec) {
  try {
    app.save(rec);
  } catch (err) {
    throw new BadRequestError("Não foi possível salvar o usuário: " + String(err));
  }
}

// Dados do usuário que podem voltar na resposta (nunca hash de senha nem token).
function publico(app, rec) {
  let setorNome = "";
  if (rec.getString("setor")) {
    try { setorNome = app.findRecordById("setores", rec.getString("setor")).getString("nome"); } catch (_) {}
  }
  return {
    id: rec.id,
    nome: rec.getString("name"),
    email: rec.email(),
    papel: rec.getString("papel") || "solicitante",
    setor: rec.getString("setor"),
    setor_nome: setorNome,
    ramal: rec.getString("ramal"),
    ficticio: rec.getBool("ficticio"),
  };
}

module.exports = { senhaProvisoria, salvar, publico };
