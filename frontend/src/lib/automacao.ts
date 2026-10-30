import type { Prioridade } from "./pb";
import { textoMinutos } from "./configTI";

/**
 * Automação dos chamados em FLUXOS (como jobs/DAGs): cada fluxo começa num gatilho e segue blocos ligados.
 * O MOTOR fica no servidor (backend/pb_hooks/lib/automacao.js, com o formato explicado no topo).
 * O teste da tela chama POST /api/ti/automacao/testar, então mostra exatamente o que o servidor faria.
 */

export type Gatilho = "novo" | "reaberto" | "sem_inicio" | "vencido" | "espera";
export type Campo = "categoria" | "setor" | "impacto" | "prioridade" | "origem" | "texto" | "anexo" | "horario" | "responsavel";
export type Op = "e" | "nao_e" | "contem" | "nao_contem";
export type TipoAcao = "prioridade" | "prazo" | "subir" | "atribuir" | "rodizio" | "devolver" | "avisar" | "resposta" | "nota";
export type Saida = "sim" | "nao" | "segue";

export interface Condicao { campo: Campo; op: Op; valores: string[] }
export interface Acao { tipo: TipoAcao; valor: string; pessoas: string[]; modo: "carga" | "sequencia" }
export interface No { id: string; tipo: "inicio" | "cond" | "acao"; x: number; y: number; cond?: Condicao; acao?: Acao }
export interface Ligacao { id: string; de: string; saida: Saida; para: string }
export interface Fluxo { id: string; nome: string; ativo: boolean; gatilho: Gatilho; minutos: number; nos: No[]; ligacoes: Ligacao[] }
export interface Automacao { fluxos: Fluxo[]; senao: { tipo: "livre" | "pessoa"; pessoa: string } }

export const AUTOMACAO_VAZIA: Automacao = { fluxos: [], senao: { tipo: "livre", pessoa: "" } };
export const novoId = () => "n" + Math.random().toString(36).slice(2, 10);

/* ---------- gatilhos ---------- */

export const GATILHOS: Gatilho[] = ["novo", "reaberto", "sem_inicio", "vencido", "espera"];
export const ROTULO_GATILHO: Record<Gatilho, string> = {
  novo: "Chamado novo",
  reaberto: "Chamado reaberto",
  sem_inicio: "Ninguém começou o atendimento",
  vencido: "Passou do prazo",
  espera: "Quem pediu não respondeu",
};
export const AJUDA_GATILHO: Record<Gatilho, string> = {
  novo: "Roda uma vez, no momento em que o chamado chega (aberto pelo servidor ou registrado pelo TI).",
  reaberto: "Roda quando quem pediu diz que o problema continua e reabre o chamado.",
  sem_inicio: "Conferido a cada 5 minutos: chamados abertos há mais tempo que o limite, sem ninguém ter começado.",
  vencido: "Conferido a cada 5 minutos: chamados abertos que passaram do prazo.",
  espera: "Conferido a cada 5 minutos: chamados em espera pela resposta de quem pediu há mais tempo que o limite.",
};
export const ehTempo = (g: Gatilho) => g === "sem_inicio" || g === "vencido" || g === "espera";
export const temMinutos = (g: Gatilho) => g === "sem_inicio" || g === "espera";
export const MINUTOS: Record<"sem_inicio" | "espera", number[]> = {
  sem_inicio: [15, 30, 60, 120, 240, 480, 1440],
  espera: [1440, 2880, 4320, 7200],
};

export function textoGatilho(f: Pick<Fluxo, "gatilho" | "minutos">): string {
  if (f.gatilho === "sem_inicio") return `Ninguém começou em ${textoMinutos(f.minutos)}`;
  if (f.gatilho === "espera") return `Quem pediu não respondeu em ${textoMinutos(f.minutos)}`;
  return ROTULO_GATILHO[f.gatilho];
}

/* ---------- condições ---------- */

export interface Opcao { v: string; rot: string }
export interface Listas { categorias: Opcao[]; setores: Opcao[]; pessoas: Opcao[] }

export const CAMPOS: Campo[] = ["categoria", "setor", "prioridade", "impacto", "origem", "texto", "anexo", "horario", "responsavel"];
export const ROTULO_CAMPO: Record<Campo, string> = {
  categoria: "Categoria", setor: "Setor", impacto: "Quem é afetado", prioridade: "Prioridade", origem: "Por onde chegou",
  texto: "Descrição", anexo: "Tem foto ou vídeo", horario: "Quando chegou", responsavel: "Tem responsável",
};

const FIXAS: Partial<Record<Campo, Opcao[]>> = {
  impacto: [{ v: "so_eu", rot: "Só quem pediu" }, { v: "setor", rot: "O setor inteiro" }, { v: "publico", rot: "Atendimento ao público parou" }],
  prioridade: [{ v: "baixa", rot: "Baixa" }, { v: "normal", rot: "Normal" }, { v: "alta", rot: "Alta" }, { v: "urgente", rot: "Urgente" }],
  origem: [{ v: "sistema", rot: "Pelo sistema" }, { v: "whatsapp", rot: "WhatsApp" }, { v: "ligacao", rot: "Ligação" }, { v: "presencial", rot: "Presencial" }],
  anexo: [{ v: "sim", rot: "Sim" }, { v: "nao", rot: "Não" }],
  horario: [{ v: "expediente", rot: "No expediente" }, { v: "fora", rot: "Fora do expediente" }, { v: "fim_semana", rot: "Fim de semana" }],
  responsavel: [{ v: "sim", rot: "Sim" }, { v: "nao", rot: "Não" }],
};

export function opcoesDoCampo(campo: Campo, l: Listas): Opcao[] {
  if (campo === "categoria") return l.categorias;
  if (campo === "setor") return l.setores;
  return FIXAS[campo] ?? [];
}

export function rotuloValor(campo: Campo, v: string, l: Listas) {
  if (campo === "texto") return `“${v}”`;
  return opcoesDoCampo(campo, l).find((o) => o.v === v)?.rot ?? "(removido)";
}

export function textoCondicao(c: Condicao, l: Listas): string {
  const vals = c.valores.map((v) => rotuloValor(c.campo, v, l));
  const lista = vals.length ? vals.join(" ou ") : "…";
  if (c.campo === "texto") return `Descrição ${c.op === "nao_contem" ? "não contém" : "contém"} ${lista}`;
  return `${ROTULO_CAMPO[c.campo]} ${c.op === "nao_e" ? "não é" : "é"} ${lista}`;
}

export function novaCondicao(campo: Campo): Condicao {
  return { campo, op: campo === "texto" ? "contem" : "e", valores: [] };
}

/* ---------- ações ---------- */

export const ROTULO_ACAO: Record<TipoAcao, string> = {
  prioridade: "Definir prioridade", prazo: "Definir prazo", subir: "Subir a prioridade um nível",
  atribuir: "Mandar para uma pessoa", rodizio: "Dividir entre a equipe", devolver: "Devolver para a fila",
  avisar: "Avisar no celular", resposta: "Responder a quem pediu", nota: "Nota interna",
};

const NO_TEMPO: TipoAcao[] = ["prioridade", "subir", "atribuir", "rodizio", "devolver", "avisar", "resposta", "nota"];
export const ACOES_POR_GATILHO: Record<Gatilho, TipoAcao[]> = {
  novo: ["prioridade", "prazo", "subir", "atribuir", "rodizio", "avisar", "resposta", "nota"],
  reaberto: ["prioridade", "subir", "atribuir", "rodizio", "avisar", "resposta", "nota"],
  sem_inicio: NO_TEMPO, vencido: NO_TEMPO, espera: NO_TEMPO,
};

export const PRIORIDADES: Prioridade[] = ["baixa", "normal", "alta", "urgente"];
export const ROTULO_PRIO: Record<string, string> = { baixa: "Baixa", normal: "Normal", alta: "Alta", urgente: "Urgente" };
export const PRAZOS = [30, 60, 120, 240, 480, 1440, 2880];

export function opcoesAvisar(l: Listas): Opcao[] {
  return [{ v: "equipe", rot: "Toda a equipe" }, { v: "responsavel", rot: "Quem está com o chamado" }, ...l.pessoas];
}

export function novaAcao(tipo: TipoAcao): Acao {
  const a: Acao = { tipo, valor: "", pessoas: [], modo: "carga" };
  if (tipo === "prioridade") a.valor = "alta";
  if (tipo === "prazo") a.valor = "120";
  if (tipo === "avisar") a.valor = "equipe";
  return a;
}

export function textoAcao(a: Acao, l: Listas): string {
  const pessoa = (id: string) => l.pessoas.find((p) => p.v === id)?.rot ?? "…";
  switch (a.tipo) {
    case "prioridade": return `Prioridade ${ROTULO_PRIO[a.valor] ?? "…"}`;
    case "prazo": return `Prazo de ${a.valor ? textoMinutos(parseInt(a.valor, 10)) : "…"}`;
    case "subir": return "Sobe a prioridade um nível";
    case "atribuir": return `Mandar para ${a.valor ? pessoa(a.valor) : "…"}`;
    case "rodizio": return `Dividir entre ${a.pessoas.map(pessoa).join(", ") || "…"} (${a.modo === "carga" ? "menos chamados" : "um de cada vez"})`;
    case "devolver": return "Devolver para a fila, sem responsável";
    case "avisar": return `Avisar ${(opcoesAvisar(l).find((o) => o.v === a.valor)?.rot ?? "…").toLowerCase()}`;
    case "resposta": return a.valor ? `Responder: “${a.valor}”` : "Responder: …";
    case "nota": return a.valor ? `Nota: “${a.valor}”` : "Nota interna: …";
  }
}

/* ---------- fluxos ---------- */

export function novoFluxo(gatilho: Gatilho = "novo"): Fluxo {
  return {
    id: novoId(), nome: "", ativo: true, gatilho, minutos: gatilho === "espera" ? 1440 : temMinutos(gatilho) ? 30 : 0,
    nos: [{ id: "inicio", tipo: "inicio", x: 0, y: 0 }], ligacoes: [],
  };
}

export const nomeFluxo = (f: Fluxo) => f.nome.trim() || "Fluxo sem nome";

/** Ordem em que os blocos rodam; null = tem ciclo (o mesmo cálculo do servidor). */
export function ordemTopologica(nos: No[], ligacoes: Ligacao[]): string[] | null {
  const entra: Record<string, number> = {}; const saem: Record<string, string[]> = {};
  nos.forEach((n) => { entra[n.id] = 0; saem[n.id] = []; });
  ligacoes.forEach((l) => { if (l.para in entra && l.de in saem) { entra[l.para]++; saem[l.de].push(l.para); } });
  const fila = nos.filter((n) => entra[n.id] === 0).map((n) => n.id);
  const ordem: string[] = [];
  while (fila.length) {
    const id = fila.shift()!;
    ordem.push(id);
    for (const p of saem[id]) { entra[p]--; if (entra[p] === 0) fila.push(p); }
  }
  return ordem.length === nos.length ? ordem : null;
}

export interface Problemas {
  /** impedem salvar */
  erros: string[];
  /** por bloco: o que está faltando (a tela mostra no bloco e no painel) */
  porNo: Record<string, string[]>;
  /** avisos do fluxo inteiro */
  avisos: string[];
}

export function problemasDoFluxo(f: Fluxo, l: Listas, indisponiveis: Set<string>): Problemas {
  const p: Problemas = { erros: [], porNo: {}, avisos: [] };
  const no = (id: string, t: string) => { (p.porNo[id] ??= []).push(t); };
  if (!ordemTopologica(f.nos, f.ligacoes)) p.erros.push("Há um caminho que volta para trás (ciclo).");
  const chega = new Set(f.ligacoes.map((x) => x.para));
  const sai = new Set(f.ligacoes.map((x) => x.de));
  for (const n of f.nos) {
    if (n.tipo === "inicio") { if (!sai.has(n.id)) p.avisos.push("O gatilho não está ligado a nenhum bloco: o fluxo não faz nada."); continue; }
    if (!chega.has(n.id)) no(n.id, "Bloco solto: ligue algo nele, senão nunca roda.");
    if (n.tipo === "cond" && n.cond) {
      if (!n.cond.valores.length) no(n.id, "Escolha pelo menos um valor.");
      if (!f.ligacoes.some((x) => x.de === n.id)) no(n.id, "Ligue o Sim ou o Não a algum bloco.");
    }
    if (n.tipo === "acao" && n.acao) {
      const a = n.acao;
      if (!ACOES_POR_GATILHO[f.gatilho].includes(a.tipo)) {
        no(n.id, `Esta ação não vale para o gatilho “${ROTULO_GATILHO[f.gatilho]}”.`);
        p.erros.push(`A ação “${ROTULO_ACAO[a.tipo]}” não vale para este gatilho.`);
      }
      if (a.tipo === "atribuir" && !l.pessoas.some((x) => x.v === a.valor)) no(n.id, "Escolha para quem vai.");
      if (a.tipo === "atribuir" && a.valor && indisponiveis.has(a.valor)) no(n.id, "Esta pessoa está ausente ou não recebe automáticos hoje: o bloco é ignorado.");
      if (a.tipo === "rodizio" && a.pessoas.length < 2) no(n.id, "Escolha pelo menos duas pessoas.");
      if ((a.tipo === "resposta" || a.tipo === "nota") && !a.valor.trim()) no(n.id, "Escreva a mensagem.");
    }
  }
  return p;
}

/** Arruma o desenho em camadas: cada bloco fica abaixo do mais fundo dos que apontam para ele. */
export function organizar(f: Fluxo): Fluxo {
  const ordem = ordemTopologica(f.nos, f.ligacoes) ?? f.nos.map((n) => n.id);
  const nivel: Record<string, number> = {};
  for (const id of ordem) {
    const pais = f.ligacoes.filter((l) => l.para === id).map((l) => nivel[l.de] ?? 0);
    nivel[id] = pais.length ? Math.max(...pais) + 1 : (id === "inicio" ? 0 : 1);
  }
  const porNivel: Record<number, string[]> = {};
  for (const id of ordem) (porNivel[nivel[id]] ??= []).push(id);
  const pos: Record<string, { x: number; y: number }> = {};
  const LARG = 300; const ALT = 170;
  for (const [k, ids] of Object.entries(porNivel)) {
    // ordena pela posição média dos pais (menos cruzamentos); "Sim" à esquerda, "Não" à direita
    const chave = (id: string) => {
      const ls = f.ligacoes.filter((l) => l.para === id);
      if (!ls.length) return 0;
      return ls.reduce((s, l) => s + (pos[l.de]?.x ?? 0) + (l.saida === "sim" ? -1 : l.saida === "nao" ? 1 : 0), 0) / ls.length;
    };
    ids.sort((a, b) => chave(a) - chave(b));
    ids.forEach((id, i) => { pos[id] = { x: (i - (ids.length - 1) / 2) * LARG, y: Number(k) * ALT }; });
  }
  return { ...f, nos: f.nos.map((n) => ({ ...n, ...(pos[n.id] ?? {}) })) };
}
