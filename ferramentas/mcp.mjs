#!/usr/bin/env node
// Servidor MCP do Dino Desk (stdio). Deixa um assistente de IA (Claude Code, Claude Desktop,
// Cursor, VS Code...) operar o sistema com ferramentas prontas, sem decorar a API.
// Configuração: .mcp.json na raiz do projeto + ferramentas/.env com o superusuário.
// IMPORTANTE: em stdio, NADA pode ir para o stdout além do protocolo. Logs vão para a resposta.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Dino } from "./lib/cliente.mjs";
import * as op from "./lib/operacoes.mjs";

const dino = new Dino();
const servidor = new McpServer({ name: "dino-desk", version: "1.0.0" });

/** Registra uma ferramenta que devolve JSON + o log de progresso. */
function ferramenta(nome, { titulo, descricao, entrada = {}, somenteLeitura = false, destrutiva = false }, fn) {
  servidor.registerTool(nome, {
    title: titulo,
    description: descricao,
    inputSchema: entrada,
    annotations: { readOnlyHint: somenteLeitura, destructiveHint: destrutiva, openWorldHint: false },
  }, async (args) => {
    const linhas = [];
    try {
      const r = await fn(args ?? {}, (m) => linhas.push(m));
      const texto = (linhas.length ? linhas.join("\n") + "\n\n" : "") + JSON.stringify(r, null, 2);
      return { content: [{ type: "text", text: texto }] };
    } catch (err) {
      const texto = (linhas.length ? linhas.join("\n") + "\n\n" : "") + `Erro: ${err.message}`;
      return { content: [{ type: "text", text: texto }], isError: true };
    }
  });
}

const ACOES = ["iniciar", "comentar", "resolver", "responder", "confirmar", "reabrir"];

// ---------- consultas ----------
ferramenta("info", {
  titulo: "Situação do Dino Desk",
  descricao: "Mostra o endereço, o ambiente (teste ou producao), se ntfy/e-mail estão ligados e os totais (incluindo quantos registros são fictícios). Chame primeiro.",
  somenteLeitura: true,
}, () => op.info(dino));

ferramenta("listar_setores", { titulo: "Listar setores", descricao: "Setores cadastrados (id, nome, prédio).", somenteLeitura: true },
  () => op.listarSetores(dino));

ferramenta("listar_categorias", { titulo: "Listar categorias", descricao: "Categorias de chamado ativas (Computador, Impressora...).", somenteLeitura: true },
  () => op.listarCategorias(dino));

ferramenta("listar_usuarios", {
  titulo: "Listar usuários",
  descricao: "Usuários com papel, setor e se são fictícios.",
  somenteLeitura: true,
  entrada: {
    ficticios: z.boolean().optional().describe("true = só fictícios; false = só reais; vazio = todos"),
    papel: z.enum(["solicitante", "tecnico"]).optional(),
    busca: z.string().optional().describe("trecho do nome ou e-mail"),
    limite: z.number().int().min(1).max(200).optional(),
  },
}, (a) => op.listarUsuarios(dino, a));

ferramenta("listar_chamados", {
  titulo: "Listar chamados",
  descricao: "Chamados mais recentes com protocolo, status, prioridade, categoria, setor e solicitante.",
  somenteLeitura: true,
  entrada: {
    status: z.enum(["aberto", "em_andamento", "resolvido"]).optional(),
    ficticios: z.boolean().optional(),
    limite: z.number().int().min(1).max(200).optional(),
  },
}, (a) => op.listarChamados(dino, a));

// ---------- criação ----------
ferramenta("criar_setor", {
  titulo: "Criar setor",
  descricao: "Cria um setor (se já existir com o mesmo nome, devolve o existente).",
  entrada: { nome: z.string(), predio: z.string().optional() },
}, (a) => op.criarSetor(dino, a));

ferramenta("criar_usuario", {
  titulo: "Criar usuário",
  descricao:
    "Cria um usuário. Por padrão é FICTÍCIO (dado de teste, e-mail @teste.dinodesk gerado se faltar). " +
    "Use ficticio=false SOMENTE quando o usuário humano pedir uma conta real; nesse caso nome e e-mail são obrigatórios. " +
    "Sem senha, o servidor gera uma provisória e devolve em senha_provisoria. O setor pode ser o nome; se não existir, é criado.",
  entrada: {
    nome: z.string().optional(),
    email: z.string().optional(),
    setor: z.string().optional().describe("nome ou id do setor"),
    papel: z.enum(["solicitante", "tecnico"]).optional(),
    ramal: z.string().max(20).optional().describe("ramal da sala (nunca celular pessoal)"),
    senha: z.string().min(8).optional(),
    ficticio: z.boolean().optional().describe("padrão true"),
  },
}, (a, log) => op.criarUsuario(dino, a, log));

ferramenta("criar_usuarios_ficticios", {
  titulo: "Criar vários usuários fictícios",
  descricao: "Cria N servidores fictícios distribuídos pelos setores de teste (Engenharia, Saúde, Obras...) e, opcionalmente, técnicos fictícios. Todos com a mesma senha (padrão Teste@1234), para dar para entrar no sistema e ver as telas.",
  entrada: {
    quantidade: z.number().int().min(0).max(200).default(10),
    tecnicos: z.number().int().min(0).max(20).default(0),
    setores: z.array(z.string()).optional().describe("nomes de setores; padrão: os 10 setores de teste"),
    senha: z.string().min(8).optional(),
  },
}, (a, log) => op.criarUsuariosFicticios(dino, a, log));

ferramenta("abrir_chamado", {
  titulo: "Abrir chamado",
  descricao:
    "Abre um chamado como um servidor (origem sistema) ou registra um pedido como técnico (origem whatsapp/ligacao/presencial). " +
    "Campos vazios são sorteados com problemas realistas. fotos/videos anexam mídia FALSA (prints de erro desenhados e um vídeo de 4 s) para testar anexos e a compressão de vídeo.",
  entrada: {
    solicitante: z.string().optional().describe("e-mail ou id; vazio = servidor fictício sorteado"),
    categoria: z.string().optional().describe("nome, ex.: Impressora"),
    impacto: z.enum(["so_eu", "setor", "publico"]).optional().describe("define a prioridade: so_eu=normal, setor=alta, publico=urgente"),
    descricao: z.string().optional(),
    fotos: z.number().int().min(0).max(5).optional(),
    videos: z.number().int().min(0).max(5).optional(),
    origem: z.enum(["sistema", "whatsapp", "ligacao", "presencial"]).optional(),
    tecnico: z.string().optional().describe("e-mail do técnico que registra (origem diferente de sistema)"),
  },
}, (a, log) => op.abrirChamado(dino, a, log));

ferramenta("atender_chamado", {
  titulo: "Agir sobre um chamado",
  descricao:
    "Técnico: iniciar (vira em andamento), comentar, resolver (diagnóstico e solução são sorteados se faltarem). " +
    "Solicitante: responder, confirmar (resolvido) ou reabrir. Chamado = protocolo (2026-00012) ou id.",
  entrada: {
    chamado: z.string(),
    acao: z.enum(ACOES),
    tecnico: z.string().optional().describe("e-mail do técnico; padrão: o responsável ou um técnico fictício"),
    texto: z.string().optional(),
    diagnostico: z.string().optional(),
    solucao: z.string().optional(),
    interno: z.boolean().optional().describe("comentário só para o TI"),
  },
}, (a, log) => op.atenderChamado(dino, a, log));

// ---------- lote ----------
ferramenta("popular", {
  titulo: "Popular o sistema",
  descricao: "Cria usuários fictícios (se faltarem) e N chamados em estados variados (aberto, em andamento, resolvido e confirmado), com anexos falsos. Ótimo para ver fila, histórico e painel cheios.",
  entrada: {
    usuarios: z.number().int().min(1).max(200).default(10),
    tecnicos: z.number().int().min(1).max(20).default(2),
    chamados: z.number().int().min(1).max(300).default(20),
    midia: z.boolean().default(true),
  },
}, (a, log) => op.popular(dino, a, log));

ferramenta("simular_rodadas", {
  titulo: "Simular movimento",
  descricao: "Executa N ações aleatórias como num dia de trabalho (abrir, iniciar, comentar, resolver, confirmar, registrar WhatsApp). Só mexe em chamados fictícios. Para simulação contínua por minutos, use a CLI: node ferramentas/dino.mjs simular --minutos 10.",
  entrada: { rodadas: z.number().int().min(1).max(100).default(10), midia: z.boolean().default(true) },
}, (a, log) => op.simularRodadas(dino, a, log));

ferramenta("limpar_ficticios", {
  titulo: "Apagar dados fictícios",
  descricao: "Apaga TODOS os chamados e usuários fictícios (dados reais nunca são tocados). Sem confirmar=true só mostra quantos seriam apagados.",
  destrutiva: true,
  entrada: { confirmar: z.boolean().default(false) },
}, (a, log) => op.limparFicticios(dino, a, log));

await servidor.connect(new StdioServerTransport());
