// Avisos para o celular dos técnicos pelo ntfy (https://ntfy.sh).
//
// Configuração em backend/config.json (ver pb_hooks/lib/config.js).
// Sem tópico configurado, nenhum aviso é enviado e o sistema funciona normalmente.
//
// Privacidade: a mensagem passa pelo servidor do ntfy, então leva só protocolo,
// categoria, setor e prioridade. Nome e descrição ficam no Dino Desk.

const PRIORIDADE_NTFY = { baixa: 2, normal: 3, alta: 4, urgente: 5 };
const ROTULO_PRIORIDADE = { baixa: "Baixa", normal: "Normal", alta: "Alta", urgente: "Urgente" };

function nomeDe(app, colecao, id) {
  if (!id) return "";
  try {
    return app.findRecordById(colecao, id).getString("nome");
  } catch (_) {
    return "";
  }
}

/**
 * Envia um aviso sobre o chamado. `titulo` ex.: "Novo chamado".
 * Nunca derruba a operação: falhas só vão para o log.
 */
function avisarTecnicos(app, chamado, titulo, extra) {
  const cfg = require(`${__hooks}/lib/config.js`).lerConfig();
  if (!cfg.ntfyTopico) return;
  // dado de teste não acorda o celular do TI (a não ser que avisar_ficticios = true)
  if (chamado.getBool("ficticio") && !cfg.avisarFicticios) return;
  try {
    const prioridade = chamado.getString("prioridade") || "normal";
    const categoria = nomeDe(app, "categorias", chamado.getString("categoria"));
    const setor = nomeDe(app, "setores", chamado.getString("setor"));
    const linhas = [[categoria, setor].filter(Boolean).join(", ")];
    if (extra) linhas.push(extra);

    const tags = ["t-rex"];
    if (prioridade === "urgente") tags.unshift("rotating_light");

    const corpo = {
      topic: cfg.ntfyTopico,
      title: `${titulo} ${chamado.getString("protocolo")} (${ROTULO_PRIORIDADE[prioridade] || "Normal"})`,
      message: linhas.filter(Boolean).join("\n") || "Abra o Dino Desk para ver os detalhes.",
      priority: PRIORIDADE_NTFY[prioridade] || 3,
      tags,
    };
    const appURL = (app.settings().meta.appURL || "").replace(/\/$/, "");
    if (appURL) corpo.click = `${appURL}/ti/chamado/${chamado.id}`;

    const res = $http.send({
      url: cfg.ntfyServidor,
      method: "POST",
      body: JSON.stringify(corpo),
      headers: { "content-type": "application/json" },
      timeout: 5,
    });
    if (res.statusCode >= 300) {
      app.logger().warn("ntfy recusou o aviso", "status", res.statusCode);
    }
  } catch (err) {
    app.logger().warn("Falha ao enviar aviso pelo ntfy", "erro", String(err));
  }
}

module.exports = { avisarTecnicos };
