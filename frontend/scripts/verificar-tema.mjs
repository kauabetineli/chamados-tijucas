// Garante que todo componente funcione no tema claro E no escuro.
// Procura cores fixas nos .tsx/.css de src/ (bg-white, text-black, hexadecimal...) que não mudam com o tema.
// Roda antes do build (npm run build falha) e no dev (só avisa: node scripts/verificar-tema.mjs --aviso).
// Exceção consciente: escreva "tema-fixo" num comentário na mesma linha ou até 2 linhas acima.
// Regras e tokens: comentário no topo de src/index.css.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(RAIZ, "src");
const aviso = process.argv.includes("--aviso");

const REGRAS = [
  [/\b(bg|ring-offset|from|to|via)-white\b/, "use bg-superficie (cartão/painel) ou bg-fundo (página)"],
  [/\b(bg|text|border|ring)-black\b/, "use bg-noite/text-noite (escuro fixo) ou text-tinta"],
  [/\btext-black\b/, "use text-tinta"],
  [/\b(text|border|ring|outline|accent)-mar-700\b/, "use text-acento / ring-acento / border-acento (bg-mar-700 pode)"],
  [/\b(text|ring|accent)-campo-700\b/, "use text-ok / ring-ok (bg-campo-700 pode)"],
  [/\b(text|border)-brasa-700\b/, "use text-alerta / border-alerta"],
  [/\bbg-tinta\b/, "bg-tinta vira claro no modo escuro; use bg-noite"],
  [/\b(?:text|bg|border|ring)-(?:gray|slate|zinc|neutral|stone)-\d+/, "use os tokens do tema (tinta, tinta-2, linha, superficie, fundo)"],
  [/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])/, "cor em hexadecimal no componente: use um token de src/index.css"],
];

function arquivos(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return arquivos(p);
    return /\.tsx$/.test(n) ? [p] : [];
  });
}

const problemas = [];
for (const arq of arquivos(SRC)) {
  const linhas = readFileSync(arq, "utf8").split("\n");
  linhas.forEach((linha, i) => {
    const contexto = linhas.slice(Math.max(0, i - 2), i + 1).join("\n");
    if (contexto.includes("tema-fixo")) return;
    for (const [re, dica] of REGRAS) {
      const m = linha.match(re);
      if (m) problemas.push(`${relative(RAIZ, arq)}:${i + 1}  "${m[0]}"  → ${dica}`);
    }
  });
}

if (problemas.length) {
  console.log(`\n${aviso ? "Aviso" : "Erro"}: ${problemas.length} cor(es) que não funcionam no modo escuro:\n`);
  for (const p of problemas) console.log("  " + p);
  console.log('\nTroque pelos tokens do tema (veja o topo de src/index.css) ou marque com o comentário "tema-fixo".\n');
  if (!aviso) process.exit(1);
} else if (!aviso) {
  console.log("Tema: ok (claro e escuro).");
}
