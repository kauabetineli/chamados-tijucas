/// <reference path="../pb_data/types.d.ts" />

// Contador do protocolo (2026-00001, 2026-00002...). Antes o número era "o último + 1", lido e gravado em dois
// passos: dois chamados criados no mesmo instante pegavam o mesmo número e o segundo falhava no índice único
// (a pessoa perdia o envio, até com vídeo). Agora o número sai de UMA instrução no banco que soma e devolve
// (INSERT ... ON CONFLICT DO UPDATE ... RETURNING): o SQLite grava uma de cada vez, então não repete.
// Tabela simples (não é coleção): não aparece no painel /_/ nem na API.

migrate((app) => {
  app.db().newQuery(`
    CREATE TABLE IF NOT EXISTS dd_contadores (
      nome  TEXT PRIMARY KEY NOT NULL,
      valor INTEGER NOT NULL DEFAULT 0
    )`).execute();
}, (app) => {
  app.db().newQuery("DROP TABLE IF EXISTS dd_contadores").execute();
});
