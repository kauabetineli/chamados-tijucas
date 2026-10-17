// Compressão dos vídeos enviados pelo celular.
//
// Celulares gravam em Full HD ou 4K (2 a 6 MB por segundo) e o iPhone usa HEVC,
// que não abre no Chrome do Windows. Depois do envio, o servidor converte cada vídeo
// para MP4 H.264 em até 1280 px: abre em qualquer navegador e fica ~10x menor.
//
// Precisa do ffmpeg no PC servidor (scripts\baixar-ffmpeg.ps1 coloca em backend\bin).
// Sem ffmpeg, o vídeo original continua anexado e funcionando.

const EXT_VIDEO = /\.(mp4|mov|m4v|webm|3gp|3g2|mkv)$/i;

// maior lado do vídeo, em px
const LADO_MAX = 1280;
// segundos máximos guardados por vídeo
const DURACAO_MAX = 180;

function ehVideo(nome) {
  return EXT_VIDEO.test(String(nome || ""));
}

function lerOtimizados(record) {
  try {
    const v = JSON.parse(record.getString("videos_otimizados") || "[]");
    return Array.isArray(v) ? v : [];
  } catch (_) {
    return [];
  }
}

function videosPendentes(record) {
  const feitos = lerOtimizados(record);
  return record.getStringSlice("anexos").filter((n) => ehVideo(n) && feitos.indexOf(n) < 0);
}

function acharFfmpeg() {
  const candidatos = [];
  const doAmbiente = $os.getenv("FFMPEG_PATH");
  if (doAmbiente) candidatos.push(doAmbiente);
  candidatos.push(`${__hooks}/../bin/ffmpeg.exe`, `${__hooks}/../bin/ffmpeg`);
  for (const c of candidatos) {
    try {
      $os.stat(c);
      return c;
    } catch (_) {}
  }
  try {
    $os.cmd("ffmpeg", "-version").output();
    return "ffmpeg";
  } catch (_) {
    return "";
  }
}

function comprimir(ffmpeg, entrada, saida) {
  const escala =
    `scale='if(gt(iw,ih),min(${LADO_MAX},iw),-2)':'if(gt(iw,ih),-2,min(${LADO_MAX},ih))'`;
  $os.cmd(
    ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
    "-i", entrada,
    "-t", String(DURACAO_MAX),
    "-vf", escala, "-fpsmax", "30",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "64k",
    "-movflags", "+faststart",
    saida,
  ).combinedOutput();
}

function tamanho(caminho) {
  try {
    return $os.stat(caminho).size();
  } catch (_) {
    return 0;
  }
}

/** Processa até 3 chamados com vídeo pendente. Chamado pelo cron a cada minuto. */
function processarPendentes(app) {
  const lista = app.findRecordsByFilter("chamados", "midia_pendente = true", "updated", 3, 0);
  if (!lista.length) return;

  const ffmpeg = acharFfmpeg();
  for (const r of lista) {
    if (!r) continue;
    // "reserva" o chamado antes de começar, para outra execução não pegar o mesmo
    r.set("midia_pendente", false);
    app.save(r);
    if (!ffmpeg) {
      app.logger().warn("ffmpeg não encontrado: o vídeo fica no tamanho original", "chamado", r.getString("protocolo"));
      continue;
    }
    for (const nome of videosPendentes(r)) processarVideo(app, r.id, nome, ffmpeg);
  }
}

function processarVideo(app, id, nome, ffmpeg) {
  const pasta = `${app.dataDir()}/storage/${app.findCollectionByNameOrId("chamados").id}/${id}`;
  const entrada = `${pasta}/${nome}`;
  // o PocketBase acrescenta "_xxxxxxxxxx" ao nome; o arquivo novo vira "<nome>.mp4"
  const base = nome.replace(/\.[^.]+$/, "").replace(/_[a-z0-9]{10}$/i, "") || "video";
  const saida = `${$os.tempDir()}/${base}.mp4`;
  const mbAntes = Math.round(tamanho(entrada) / 104857.6) / 10;
  let novos = [];
  try {
    comprimir(ffmpeg, entrada, saida);
    const atual = app.findRecordById("chamados", id);
    const antes = atual.getStringSlice("anexos");
    atual.set("anexos-", [nome]);
    atual.set("anexos+", [$filesystem.fileFromPath(saida)]);
    app.save(atual);
    novos = atual.getStringSlice("anexos").filter((n) => antes.indexOf(n) < 0);
    app.logger().info("Vídeo comprimido", "chamado", atual.getString("protocolo"),
      "antes_mb", mbAntes, "depois_mb", Math.round(tamanho(saida) / 104857.6) / 10);
  } catch (err) {
    app.logger().warn("Não foi possível comprimir o vídeo; o original continua anexado", "arquivo", nome, "erro", String(err));
    novos = [nome];
  } finally {
    try { $os.remove(saida); } catch (_) {}
  }
  // registra o que já foi tratado, para não comprimir de novo
  const atual = app.findRecordById("chamados", id);
  atual.set("videos_otimizados", lerOtimizados(atual).concat(novos));
  app.save(atual);
}

module.exports = { ehVideo, videosPendentes, processarPendentes };
