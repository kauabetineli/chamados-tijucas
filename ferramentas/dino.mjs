#!/usr/bin/env node
// CLI do Dino Desk para gerar dados de teste e operar o sistema pela linha de comando.
// Mesmas operações do servidor MCP (mcp.mjs). Ajuda: node ferramentas/dino.mjs ajuda

import { Dino } from "./lib/cliente.mjs";
import * as op from "./lib/operacoes.mjs";

const AJUDA = `
Dino Desk — ferramentas de teste e operação

Uso: node ferramentas/dino.mjs <comando> [--opção valor] [--json]

Consultas
  info                                   ambiente, totais e se ntfy/e-mail estão ligados
  setores | categorias
  usuarios   [--ficticios sim|nao] [--papel tecnico] [--busca texto]
  chamados   [--status aberto|em_andamento|resolvido] [--ficticios sim|nao] [--limite 20]

Criação
  setor:criar    --nome "Tributos" [--predio "Paço Municipal"] [--ramal 2045]
  usuario:criar  [--nome "Maria"] [--matricula 12345] [--email maria@x] [--setor Engenharia] [--ramal 2134] [--papel tecnico] [--admin]
                 [--senha ...] [--real]        (sem --real a conta é FICTÍCIA)
  usuarios:ficticios --quantidade 10 [--tecnicos 2] [--senha Teste@1234]
  chamado:abrir  [--solicitante email] [--categoria Impressora] [--impacto so_eu|setor|publico]
                 [--descricao "..."] [--fotos 1] [--videos 1] [--origem whatsapp --tecnico email]
  chamado:atender --chamado 2026-00012 --acao iniciar|comentar|resolver|responder|confirmar|reabrir
                 [--texto "..."] [--tecnico email] [--diagnostico "..."] [--solucao "..."]

Geração em lote (só com dados fictícios; recusado em produção)
  popular        [--usuarios 10] [--tecnicos 2] [--chamados 20] [--sem-midia]
  rodadas        --quantidade 10 [--sem-midia]       N ações aleatórias agora
  simular        [--minutos 5] [--intervalo 8] [--sem-midia]   fica rodando (Ctrl+C para parar)

Limpeza
  limpar         [--confirmar]     apaga todos os chamados e usuários fictícios

Conexão: ferramentas/.env (DINO_URL, DINO_ADMIN_EMAIL, DINO_ADMIN_SENHA) ou --url/--email-admin/--senha-admin.
`;

function lerArgs(argv) {
  const [comando = "ajuda", ...resto] = argv;
  const o = {};
  for (let i = 0; i < resto.length; i++) {
    const a = resto[i];
    if (!a.startsWith("--")) continue;
    const chave = a.slice(2);
    const prox = resto[i + 1];
    if (prox === undefined || prox.startsWith("--")) o[chave] = true;
    else { o[chave] = prox; i++; }
  }
  return { comando, o };
}

const num = (v, padrao) => (v === undefined || v === true ? padrao : Number(v));
const simNao = (v) => (v === undefined ? undefined : !["nao", "não", "false", "0", "n"].includes(String(v).toLowerCase()));

async function main() {
  const { comando, o } = lerArgs(process.argv.slice(2));
  if (["ajuda", "help", "-h", "--help"].includes(comando)) return console.log(AJUDA);

  const dino = new Dino({ url: o.url, email: o["email-admin"], senha: o["senha-admin"] });
  const log = o.json ? () => {} : (m) => console.log(m);
  const midia = !o["sem-midia"];
  let parar = false;

  const comandos = {
    info: () => op.info(dino),
    setores: () => op.listarSetores(dino),
    categorias: () => op.listarCategorias(dino),
    usuarios: () => op.listarUsuarios(dino, { ficticios: simNao(o.ficticios), papel: o.papel, busca: o.busca }),
    chamados: () => op.listarChamados(dino, { status: o.status, ficticios: simNao(o.ficticios), limite: num(o.limite, 20) }),
    "setor:criar": () => op.criarSetor(dino, { nome: o.nome, predio: o.predio, ramal: o.ramal }),
    "usuario:criar": () => op.criarUsuario(dino, {
      nome: o.nome, matricula: o.matricula, email: o.email, setor: o.setor, papel: o.papel, admin: !!o.admin, ramal: o.ramal, senha: o.senha, ficticio: !o.real,
    }, log),
    "usuarios:ficticios": () => op.criarUsuariosFicticios(dino, {
      quantidade: num(o.quantidade, 10), tecnicos: num(o.tecnicos, 0), senha: o.senha,
    }, log),
    "chamado:abrir": () => op.abrirChamado(dino, {
      solicitante: o.solicitante, categoria: o.categoria, impacto: o.impacto, descricao: o.descricao,
      fotos: num(o.fotos, 0), videos: num(o.videos, 0), origem: o.origem, tecnico: o.tecnico,
    }, log),
    "chamado:atender": () => op.atenderChamado(dino, {
      chamado: o.chamado, acao: o.acao, tecnico: o.tecnico, texto: o.texto, diagnostico: o.diagnostico, solucao: o.solucao,
      interno: !!o.interno,
    }, log),
    popular: () => op.popular(dino, {
      usuarios: num(o.usuarios, 10), tecnicos: num(o.tecnicos, 2), chamados: num(o.chamados, 20), midia,
    }, log),
    rodadas: () => op.simularRodadas(dino, { rodadas: num(o.quantidade, 10), midia }, log),
    simular: () => {
      process.on("SIGINT", () => { parar = true; console.log("\nParando..."); });
      log(`Simulando por ${num(o.minutos, 5)} min (Ctrl+C para parar)...`);
      return op.simular(dino, { minutos: num(o.minutos, 5), intervalo: num(o.intervalo, 8), midia }, log, () => parar);
    },
    limpar: () => op.limparFicticios(dino, { confirmar: !!o.confirmar }, log),
  };

  const fn = comandos[comando];
  if (!fn) {
    console.error(`Comando desconhecido: ${comando}\n${AJUDA}`);
    process.exit(2);
  }
  const r = await fn();
  if (o.json) console.log(JSON.stringify(r, null, 2));
  else if (["info", "setores", "categorias", "usuarios", "chamados", "limpar"].includes(comando) || !r?.acoes) {
    console.log(JSON.stringify(r, null, 2));
  } else {
    console.log(JSON.stringify(r.totais ?? r, null, 2));
  }
}

main().catch((err) => {
  console.error("Erro:", err.message);
  process.exit(1);
});
