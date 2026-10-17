// Cria setores, usuários e (opcional) chamados de exemplo para TESTE.
// Nunca rode no PC da Prefeitura em produção.
//
// Uso (com o PocketBase rodando):
//   node scripts/dados-teste.mjs <email-superusuario> <senha-superusuario> [--com-chamados] [--url http://127.0.0.1:8090]
//
// Pode rodar mais de uma vez: o que já existe é pulado.
// Logins criados: docs/DADOS-TESTE.md

const args = process.argv.slice(2);
const [suEmail, suSenha] = args.filter((a) => !a.startsWith("--") && !/^https?:/.test(a));
const comChamados = args.includes("--com-chamados");
const iUrl = args.indexOf("--url");
const BASE = (iUrl >= 0 ? args[iUrl + 1] : "http://127.0.0.1:8090").replace(/\/$/, "");

if (!suEmail || !suSenha) {
  console.log("Uso: node scripts/dados-teste.mjs <email-superusuario> <senha-superusuario> [--com-chamados]");
  process.exit(1);
}

const SENHA = "Teste@1234";

const SETORES = [
  ["Engenharia", "Paço Municipal"],
  ["Arquitetura", "Paço Municipal"],
  ["Comunicação", "Paço Municipal"],
  ["Jurídico", "Paço Municipal"],
  ["Recursos Humanos", "Paço Municipal"],
  ["Finanças", "Paço Municipal"],
  ["Protocolo", "Paço Municipal"],
  ["Educação", "Secretaria de Educação"],
  ["Saúde", "Secretaria de Saúde"],
  ["Obras", "Pátio de Obras"],
];

// nome, e-mail, setor, papel
const USUARIOS = [
  ["Ana Engenharia", "ana.engenharia@teste.dinodesk", "Engenharia", ""],
  ["Bruno Arquitetura", "bruno.arquitetura@teste.dinodesk", "Arquitetura", ""],
  ["Carla Comunicação", "carla.comunicacao@teste.dinodesk", "Comunicação", ""],
  ["Diego Jurídico", "diego.juridico@teste.dinodesk", "Jurídico", ""],
  ["Elisa RH", "elisa.rh@teste.dinodesk", "Recursos Humanos", ""],
  ["Fábio Finanças", "fabio.financas@teste.dinodesk", "Finanças", ""],
  ["Gabi Protocolo", "gabi.protocolo@teste.dinodesk", "Protocolo", ""],
  ["Hugo Educação", "hugo.educacao@teste.dinodesk", "Educação", ""],
  ["Íris Saúde", "iris.saude@teste.dinodesk", "Saúde", ""],
  ["João Obras", "joao.obras@teste.dinodesk", "Obras", ""],
  ["Técnico Teste 1", "tecnico1@teste.dinodesk", "Departamento de TI", "tecnico"],
  ["Técnico Teste 2", "tecnico2@teste.dinodesk", "Departamento de TI", "tecnico"],
];

// e-mail de quem abre, categoria, impacto, local, descrição
const CHAMADOS = [
  ["ana.engenharia@teste.dinodesk", "Computador", "so_eu", "Sala 12", "O computador demora muito para ligar e trava ao abrir o AutoCAD."],
  ["carla.comunicacao@teste.dinodesk", "Internet ou rede", "setor", "Sala da Comunicação", "A internet do setor caiu e não conseguimos publicar as notícias do site."],
  ["gabi.protocolo@teste.dinodesk", "Sistema ou programa", "publico", "Balcão do Protocolo", "O sistema de protocolo não abre e tem fila de cidadãos esperando."],
  ["elisa.rh@teste.dinodesk", "Impressora", "setor", "RH, 1º andar", "A impressora do RH está puxando várias folhas de uma vez."],
  ["diego.juridico@teste.dinodesk", "Senha ou acesso", "so_eu", "Jurídico", "Minha senha do e-mail expirou e não consigo trocar."],
  ["iris.saude@teste.dinodesk", "Telefone", "so_eu", "Recepção da Secretaria de Saúde", "O ramal da recepção está sem linha desde ontem."],
];

async function api(caminho, { metodo = "GET", corpo, token } = {}) {
  const r = await fetch(BASE + caminho, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${metodo} ${caminho}: ${r.status} ${JSON.stringify(dados)}`);
  return dados;
}

const filtro = (f) => encodeURIComponent(f);
const aspas = (s) => `"${String(s).replace(/"/g, '\\"')}"`;

async function main() {
  let su;
  try {
    su = (await api("/api/collections/_superusers/auth-with-password", {
      metodo: "POST", corpo: { identity: suEmail, password: suSenha },
    })).token;
  } catch {
    console.error(`Não consegui entrar como superusuário em ${BASE}. O PocketBase está rodando? E-mail e senha estão certos?`);
    process.exit(1);
  }

  // setores
  const idSetor = {};
  const ti = await api(`/api/collections/setores/records?filter=${filtro(`nome=${aspas("Departamento de TI")}`)}`, { token: su });
  if (ti.items[0]) idSetor["Departamento de TI"] = ti.items[0].id;
  for (const [nome, predio] of SETORES) {
    const achou = await api(`/api/collections/setores/records?filter=${filtro(`nome=${aspas(nome)}`)}`, { token: su });
    if (achou.items[0]) {
      idSetor[nome] = achou.items[0].id;
      console.log(`  setor já existia: ${nome}`);
    } else {
      idSetor[nome] = (await api("/api/collections/setores/records", { metodo: "POST", token: su, corpo: { nome, predio, ativo: true } })).id;
      console.log(`+ setor: ${nome}`);
    }
  }

  // usuários
  for (const [name, email, setor, papel] of USUARIOS) {
    const achou = await api(`/api/collections/users/records?filter=${filtro(`email=${aspas(email)}`)}`, { token: su });
    if (achou.items[0]) {
      console.log(`  usuário já existia: ${email}`);
      continue;
    }
    await api("/api/collections/users/records", {
      metodo: "POST", token: su,
      corpo: { name, email, password: SENHA, passwordConfirm: SENHA, setor: idSetor[setor] || "", papel, verified: true, ficticio: true },
    });
    console.log(`+ usuário: ${email}${papel ? " (técnico)" : ""}`);
  }

  if (!comChamados) {
    console.log("\nPronto. Para criar também chamados de exemplo, rode de novo com --com-chamados.");
    return;
  }

  // chamados: abertos pelo próprio usuário, para passar pelas regras normais do sistema
  const categorias = (await api("/api/collections/categorias/records?perPage=100", { token: su })).items;
  for (const [email, nomeCat, impacto, local, descricao] of CHAMADOS) {
    const existe = await api(`/api/collections/chamados/records?filter=${filtro(`descricao=${aspas(descricao)}`)}`, { token: su });
    if (existe.items[0]) {
      console.log(`  chamado já existia: ${existe.items[0].protocolo}`);
      continue;
    }
    const cat = categorias.find((c) => c.nome === nomeCat) || categorias[0];
    const token = (await api("/api/collections/users/auth-with-password", {
      metodo: "POST", corpo: { identity: email, password: SENHA },
    })).token;
    const c = await api("/api/collections/chamados/records", {
      metodo: "POST", token, corpo: { categoria: cat.id, impacto, descricao }, // sem "local": o lugar é o setor de quem abre
    });
    console.log(`+ chamado ${c.protocolo} (${nomeCat}, ${email})`);
  }
  console.log("\nPronto.");
}

main().catch((e) => {
  console.error("Erro:", e.message);
  process.exit(1);
});
