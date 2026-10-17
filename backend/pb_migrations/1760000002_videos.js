/// <reference path="../pb_data/types.d.ts" />

// Vídeos de celular passam fácil de 30 MB (Full HD = ~2 MB por segundo).
// O limite sobe para 250 MB e o servidor comprime os vídeos depois do envio
// (pb_hooks/videos.pb.js), então o espaço em disco continua pequeno.

migrate((app) => {
  const chamados = app.findCollectionByNameOrId("chamados");

  const anexos = chamados.fields.getByName("anexos");
  anexos.maxSize = 250 * 1024 * 1024;
  anexos.mimeTypes = [
    "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
    "video/mp4", "video/quicktime", "video/webm", "video/3gpp", "video/3gpp2", "video/x-m4v", "video/x-matroska",
  ];

  // há vídeo esperando compressão
  chamados.fields.add(new BoolField({ name: "midia_pendente" }));
  // nomes dos arquivos já comprimidos (para não comprimir de novo)
  chamados.fields.add(new JSONField({ name: "videos_otimizados", hidden: true, maxSize: 20000 }));

  app.save(chamados);
}, (app) => {
  const chamados = app.findCollectionByNameOrId("chamados");
  const anexos = chamados.fields.getByName("anexos");
  anexos.maxSize = 30 * 1024 * 1024;
  chamados.fields.removeByName("midia_pendente");
  chamados.fields.removeByName("videos_otimizados");
  app.save(chamados);
});
