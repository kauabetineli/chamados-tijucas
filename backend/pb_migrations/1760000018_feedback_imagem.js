/// <reference path="../pb_data/types.d.ts" />

// "Sua opinião" com print: uma imagem opcional (colada com Ctrl+V ou escolhida), para mostrar o problema.
migrate((app) => {
  const col = app.findCollectionByNameOrId("feedbacks");
  col.fields.add(new FileField({
    name: "imagem",
    maxSelect: 1,
    maxSize: 10 * 1024 * 1024,
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"],
    thumbs: ["400x0"],
  }));
  app.save(col);
}, (app) => {
  const col = app.findCollectionByNameOrId("feedbacks");
  col.fields.removeByName("imagem");
  app.save(col);
});
