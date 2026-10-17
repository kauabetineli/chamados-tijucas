// Configuração do servidor, lida de backend/config.json (fora do GitHub) e de variáveis de ambiente.
//
//   {
//     "ambiente": "producao",          // "producao" | "teste" (padrão: "teste")
//     "ntfy_topico": "dinodesk-ti-xxxx",
//     "ntfy_servidor": "https://ntfy.sh",
//     "avisar_ficticios": false         // true = dado fictício também dispara ntfy (para testar o aviso)
//   }
//
// Variáveis de ambiente têm preferência: DINO_AMBIENTE, NTFY_TOPICO, NTFY_SERVIDOR.
// Em "producao" o servidor RECUSA criar dado fictício (ver pb_hooks/usuarios.pb.js).

function lerConfig() {
  let arquivo = {};
  try {
    arquivo = JSON.parse(toString($os.readFile(`${__hooks}/../config.json`)));
  } catch (_) {}
  const ambiente = String($os.getenv("DINO_AMBIENTE") || arquivo.ambiente || "teste").toLowerCase();
  return {
    ambiente: ambiente === "producao" ? "producao" : "teste",
    ntfyTopico: $os.getenv("NTFY_TOPICO") || arquivo.ntfy_topico || "",
    ntfyServidor: ($os.getenv("NTFY_SERVIDOR") || arquivo.ntfy_servidor || "https://ntfy.sh").replace(/\/$/, ""),
    avisarFicticios: arquivo.avisar_ficticios === true,
  };
}

function ehProducao() {
  return lerConfig().ambiente === "producao";
}

module.exports = { lerConfig, ehProducao };
