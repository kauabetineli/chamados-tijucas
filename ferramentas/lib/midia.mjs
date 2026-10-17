// Mídia FALSA para chamados de teste: imagens PNG desenhadas na hora (sem dependências)
// e um vídeo curto pronto (fixtures/video-teste.mp4, 4 s, ~70 KB).
// Não são fotos reais: servem para provar que anexo, miniatura e compressão funcionam.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const PASTA = dirname(dirname(fileURLToPath(import.meta.url)));

// ---------- PNG mínimo ----------
const TABELA_CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABELA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function bloco(tipo, dados) {
  const t = Buffer.from(tipo, "ascii");
  const tam = Buffer.alloc(4); tam.writeUInt32BE(dados.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, dados])));
  return Buffer.concat([tam, t, dados, crc]);
}
function codificarPNG(largura, altura, rgb) {
  const linhas = Buffer.alloc((largura * 3 + 1) * altura);
  for (let y = 0; y < altura; y++) {
    linhas[y * (largura * 3 + 1)] = 0;
    rgb.copy(linhas, y * (largura * 3 + 1) + 1, y * largura * 3, (y + 1) * largura * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0); ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8 bits, RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco("IHDR", ihdr),
    bloco("IDAT", deflateSync(linhas, { level: 9 })),
    bloco("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- desenho simples ----------
function tela(largura, altura, fundo) {
  const px = Buffer.alloc(largura * altura * 3);
  const ret = (x, y, w, h, [r, g, b]) => {
    for (let j = Math.max(0, y); j < Math.min(altura, y + h); j++)
      for (let i = Math.max(0, x); i < Math.min(largura, x + w); i++) {
        const o = (j * largura + i) * 3; px[o] = r; px[o + 1] = g; px[o + 2] = b;
      }
  };
  const circ = (cx, cy, raio, cor) => {
    for (let j = -raio; j <= raio; j++) {
      const meia = Math.floor(Math.sqrt(raio * raio - j * j));
      ret(cx - meia, cy + j, meia * 2 + 1, 1, cor);
    }
  };
  ret(0, 0, largura, altura, fundo);
  return { px, ret, circ };
}

const sortear = (lista) => lista[Math.floor(Math.random() * lista.length)];
const entre = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

/** "Print" de uma tela com janela de erro. Cada chamada sai diferente. */
export function printDeErro({ largura = 800, altura = 500 } = {}) {
  const corJanela = sortear([[0, 147, 201], [0, 166, 81], [17, 50, 39], [90, 90, 110]]);
  const { px, ret, circ } = tela(largura, altura, [232, 236, 239]);
  // barra de tarefas
  ret(0, altura - 36, largura, 36, [30, 36, 44]);
  for (let i = 0; i < 6; i++) ret(16 + i * 44, altura - 28, 28, 20, [70, 80, 92]);
  // janela do programa com "linhas de texto"
  ret(40, 30, largura - 80, altura - 100, [255, 255, 255]);
  ret(40, 30, largura - 80, 34, corJanela);
  for (let y = 90; y < altura - 90; y += 22) ret(64, y, entre(160, largura - 200), 10, [205, 210, 215]);
  // caixa de erro
  const w = 360, h = 150, x = (largura - w) / 2 + entre(-60, 60), y = (altura - h) / 2 + entre(-40, 20);
  ret(x + 6, y + 6, w, h, [150, 155, 160]);
  ret(x, y, w, h, [250, 250, 250]);
  ret(x, y, w, 28, [60, 64, 70]);
  circ(x + 50, y + 80, 26, [232, 48, 47]);
  ret(x + 40, y + 76, 20, 8, [255, 255, 255]);
  for (let i = 0; i < 3; i++) ret(x + 96, y + 52 + i * 20, entre(150, 230), 9, [120, 125, 130]);
  ret(x + w - 104, y + h - 40, 88, 26, [0, 147, 201]);
  return codificarPNG(largura, altura, px);
}

/** "Foto" de um equipamento (monitor/impressora estilizados). */
export function fotoDeEquipamento({ largura = 720, altura = 540 } = {}) {
  const { px, ret, circ } = tela(largura, altura, [200 + entre(0, 30), 190 + entre(0, 30), 170 + entre(0, 30)]);
  ret(0, altura * 0.62, largura, altura, [140, 110, 80]); // mesa
  if (Math.random() < 0.5) {
    // monitor com tela azul ou preta
    ret(150, 80, 420, 260, [30, 30, 34]);
    ret(166, 96, 388, 228, sortear([[0, 90, 200], [10, 10, 12], [240, 240, 240]]));
    ret(330, 340, 60, 40, [40, 40, 44]); ret(260, 380, 200, 16, [40, 40, 44]);
  } else {
    // impressora com luz laranja
    ret(170, 170, 380, 170, [225, 225, 228]);
    ret(170, 160, 380, 20, [200, 200, 204]);
    ret(230, 330, 260, 30, [245, 245, 245]);
    circ(500, 210, 10, [255, 140, 0]);
    circ(470, 210, 10, [90, 90, 90]);
  }
  return codificarPNG(largura, altura, px);
}

/** Arquivo pronto para FormData. tipo: "print" | "foto" | "video". */
export function arquivoFalso(tipo, n = 1) {
  if (tipo === "video") {
    const buf = readFileSync(join(PASTA, "fixtures", "video-teste.mp4"));
    return new File([buf], `video-teste-${n}.mp4`, { type: "video/mp4" });
  }
  const buf = tipo === "foto" ? fotoDeEquipamento() : printDeErro();
  return new File([buf], `${tipo}-teste-${n}.png`, { type: "image/png" });
}
