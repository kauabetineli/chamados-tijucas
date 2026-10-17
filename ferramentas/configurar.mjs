#!/usr/bin/env node
// Prepara o projeto para a IA usar as ferramentas do Dino Desk. Rode uma vez:
//   node ferramentas/configurar.mjs
// - cria ferramentas/.env com o superusuário (pergunta no terminal);
// - cria .mcp.json na raiz (servidor MCP "dino-desk" para o Claude Code e outros);
// - instala a skill .claude/skills/dados-de-teste/SKILL.md.
// Não sobrescreve nada que já exista (use --forcar para atualizar .mcp.json e a skill).

import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const PASTA = dirname(fileURLToPath(import.meta.url));
const RAIZ = dirname(PASTA);
const forcar = process.argv.includes("--forcar");

function copiar(origem, destino, rotulo) {
  if (existsSync(destino) && !forcar) return console.log(`= ${rotulo} já existe`);
  mkdirSync(dirname(destino), { recursive: true });
  copyFileSync(origem, destino);
  console.log(`+ ${rotulo}`);
}

copiar(join(PASTA, "modelos", "mcp.json"), join(RAIZ, ".mcp.json"), ".mcp.json (servidor MCP dino-desk)");
copiar(join(PASTA, "modelos", "SKILL-dados-de-teste.md"), join(RAIZ, ".claude", "skills", "dados-de-teste", "SKILL.md"),
  ".claude/skills/dados-de-teste/SKILL.md");

const env = join(PASTA, ".env");
if (existsSync(env)) {
  console.log("= ferramentas/.env já existe");
} else {
  // leitor de linhas que funciona digitando ou com entrada colada/redirecionada
  const rl = createInterface({ input: process.stdin });
  const linhas = [], esperando = [];
  rl.on("line", (l) => (esperando.length ? esperando.shift()(l) : linhas.push(l)));
  rl.on("close", () => { while (esperando.length) esperando.shift()(""); });
  const perguntar = (p) => {
    process.stdout.write(p);
    return linhas.length ? Promise.resolve(linhas.shift()) : new Promise((r) => esperando.push(r));
  };
  console.log("\nSuperusuário do PocketBase (o mesmo do painel /_/). Fica só em ferramentas/.env, fora do Git.");
  const url = (await perguntar("Endereço [http://127.0.0.1:8090]: ")).trim() || "http://127.0.0.1:8090";
  const email = (await perguntar("E-mail do superusuário: ")).trim();
  const senha = (await perguntar("Senha do superusuário: ")).trim();
  rl.close();
  writeFileSync(env, `DINO_URL=${url}\nDINO_ADMIN_EMAIL=${email}\nDINO_ADMIN_SENHA=${senha}\n`);
  console.log("+ ferramentas/.env");
}

if (!existsSync(join(PASTA, "node_modules"))) {
  console.log("\nFalta instalar as dependências: cd ferramentas && npm install");
} else {
  console.log("\nTestando a conexão...");
  const { Dino } = await import("./lib/cliente.mjs");
  const { info } = await import("./lib/operacoes.mjs");
  try {
    const i = await info(new Dino());
    console.log(`OK: ${i.url}, ambiente "${i.ambiente}", ${i.totais.chamados} chamado(s).`);
  } catch (err) {
    console.log(`Atenção: ${err.message}`);
  }
}
console.log("\nPronto. Teste com: node ferramentas/dino.mjs ajuda");
