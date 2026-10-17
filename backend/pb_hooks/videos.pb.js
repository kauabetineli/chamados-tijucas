/// <reference path="../pb_data/types.d.ts" />

// A cada minuto, comprime os vídeos que chegaram (detalhes em lib/videos.js).
cronAdd("comprimir-videos", "* * * * *", () => {
  const V = require(`${__hooks}/lib/videos.js`);
  V.processarPendentes($app);
});
