// Regras de negócio compartilhadas pelos hooks.
// Atenção (limitação do PocketBase): cada handler roda isolado, então este
// módulo precisa ser importado DENTRO do handler:
//   const R = require(`${__hooks}/lib/regras.js`)

const PESOS = { baixa: 1, normal: 2, alta: 3, urgente: 4 };

// prioridade sugerida a partir do impacto informado pelo solicitante;
// o técnico pode mudar depois
const PRIORIDADE_POR_IMPACTO = { so_eu: "normal", setor: "alta", publico: "urgente" };

const ROTULO_STATUS = { aberto: "Aberto", em_andamento: "Em andamento", aguardando: "Em espera", resolvido: "Resolvido" };
const ROTULO_AGUARDANDO = { peca: "peça ou equipamento", solicitante: "resposta do solicitante", terceiro: "terceiro ou fornecedor" };
const ROTULO_PRIORIDADE = { baixa: "Baixa", normal: "Normal", alta: "Alta", urgente: "Urgente" };

function ehTecnico(auth) {
  return !!auth && auth.collection().name === "users" && auth.getString("papel") === "tecnico";
}

// administrador do TI: técnico com "admin" (cria setores e contas, troca senhas, bloqueia)
function ehAdmin(auth) {
  return ehTecnico(auth) && auth.getBool("admin");
}

function ehUsuario(auth) {
  return !!auth && auth.collection().name === "users";
}

function pesoDe(prioridade) {
  return PESOS[prioridade] || PESOS.normal;
}

// Protocolo legível por ano: 2026-00001, 2026-00002...
function proximoProtocolo(app) {
  const ano = new Date().getFullYear();
  const prefixo = ano + "-";
  const ultimos = app.findRecordsByFilter(
    "chamados", "protocolo ~ {:p}", "-protocolo", 1, 0, { p: prefixo + "%" },
  );
  let n = 0;
  if (ultimos.length && ultimos[0]) {
    n = parseInt(ultimos[0].getString("protocolo").slice(prefixo.length), 10) || 0;
  }
  return prefixo + String(n + 1).padStart(5, "0");
}

function registrar(app, chamadoId, autorId, tipo, texto, interno) {
  const col = app.findCollectionByNameOrId("interacoes");
  const r = new Record(col);
  r.set("chamado", chamadoId);
  if (autorId) r.set("autor", autorId);
  r.set("tipo", tipo);
  r.set("texto", texto || "");
  r.set("interno", !!interno);
  app.save(r);
}

function agora() {
  return new DateTime();
}

// E-mail para o solicitante. Só envia se o SMTP estiver ligado no painel
// (Configurações > Mail settings). Falhas de e-mail nunca derrubam a operação.
function notificarSolicitante(app, chamado, assunto, mensagem) {
  try {
    if (!app.settings().smtp.enabled) return;
    if (chamado.getBool("ficticio")) return; // e-mail de teste não existe
    const id = chamado.getString("solicitante");
    if (!id) return;
    const usuario = app.findRecordById("users", id);
    const email = usuario.email();
    if (!email) return;
    const meta = app.settings().meta;
    const link = meta.appURL ? `${meta.appURL.replace(/\/$/, "")}/chamado/${chamado.id}` : "";
    const html =
      `<p>Olá, ${escapar(usuario.getString("name") || "servidor(a)")}.</p>` +
      `<p>${escapar(mensagem)}</p>` +
      `<p><b>Chamado ${escapar(chamado.getString("protocolo"))}</b></p>` +
      (link ? `<p><a href="${link}">Abrir o chamado</a> (funciona na rede da Prefeitura)</p>` : "") +
      `<p>Dino Desk<br>Departamento de TI da Prefeitura de Tijucas</p>`;
    app.newMailClient().send(new MailerMessage({
      from: { address: meta.senderAddress, name: meta.senderName },
      to: [{ address: email }],
      subject: `${assunto} | Dino Desk ${chamado.getString("protocolo")}`,
      html,
    }));
  } catch (err) {
    app.logger().warn("Falha ao enviar e-mail do chamado", "erro", String(err));
  }
}

function escapar(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

module.exports = {
  PESOS,
  PRIORIDADE_POR_IMPACTO,
  ROTULO_STATUS,
  ROTULO_AGUARDANDO,
  ROTULO_PRIORIDADE,
  ehTecnico,
  ehAdmin,
  ehUsuario,
  pesoDe,
  proximoProtocolo,
  registrar,
  agora,
  notificarSolicitante,
};
