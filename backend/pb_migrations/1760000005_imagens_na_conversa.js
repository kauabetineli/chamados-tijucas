/// <reference path="../pb_data/types.d.ts" />

// Imagens na conversa do chamado: print da tela, foto do erro.
// Só imagem (vídeo continua nos anexos do chamado). O celular reduz a foto antes de enviar
// (src/lib/imagem.ts), então 15 MB é folga para um print grande de PC.

migrate((app) => {
  const interacoes = app.findCollectionByNameOrId("interacoes");
  interacoes.fields.add(new FileField({
    name: "anexos",
    maxSelect: 4,
    maxSize: 15 * 1024 * 1024,
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"],
    thumbs: ["400x400"],
  }));
  app.save(interacoes);
}, (app) => {
  const interacoes = app.findCollectionByNameOrId("interacoes");
  interacoes.fields.removeByName("anexos");
  app.save(interacoes);
});
