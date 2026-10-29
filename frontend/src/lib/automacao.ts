import type { Prioridade } from "./pb";
import { textoMinutos } from "./configTI";

/**
 * Automação dos chamados: tipos e textos da tela. O MOTOR fica no servidor (backend/pb_hooks/lib/automacao.js);
 * o "Testar" da tela chama POST /api/ti/automacao/testar, então mostra exatamente o que o servidor faria.
 */

export type Etapa = "ajustes" | "quem" | "tempo";
export type Campo = "categoria" | "setor" | "impacto" | "prioridade" | "origem" | "texto" | "anexo" | "horario" | "reaberto";
export type Op = "e" | "nao_e" | "contem" | "nao_contem";
export type TipoAcao = "prioridade" | "prazo" | "avisar" | "resposta" | "nota" | "atribuir" | "rodizio" | "subir" | "devolver";
export type Gatilho = "sem_inicio" | "vencido" | "espera";

export interface Condicao { campo: Campo; op: Op; valores: string[] }
export interface Acao { tipo: TipoAcao; valor?: string; pessoas?: string[]; modo?: "sequencia" | "carga" }
export interface Regra {
  id: string; nome: string; ativa: boolean; conds: Condicao[]; acoes: Acao[];
  tipo?: "regra"; gatilho?: Gatilho; minutos?: number;
}
export interface Bloco {
  tipo: "bloco"; id: string; nome: string; ativa: boolean; conds: Condicao[];
  senao: { tipo: "continua" | "livre" | "pessoa"; pessoa?: string };
  regras: Regra[];
}
export type ItemQuem = Regra | Bloco;
export interface Automacao {
  ajustes: Regra[];
  quem: ItemQuem[];
  senao: { tipo: "livre" | "pessoa"; pessoa?: string };
  tempo: Regra[];
}

export const AUTOMACAO_VAZIA: Automacao = { ajustes: [], quem: [], senao: { tipo: "livre" }, tempo: [] };

export const ehBloco = (x: ItemQuem): x is Bloco => (x as Bloco).tipo === "bloco";
export const novoId = () => "r" + Math.random().toString(36).slice(2, 10);

/* ---------- condições ---------- */

export interface Opcao { v: string; rot: string }
export interface Listas { categorias: Opcao[]; setores: Opcao[]; pessoas: Opcao[] }

export const ROTULO_CAMPO: Record<Campo, string> = {
  categoria: "Categoria", setor: "Setor", impacto: "Quem é afetado", prioridade: "Prioridade", origem: "Por onde chegou",
  texto: "Descrição", anexo: "Tem foto ou vídeo", horario: "Quando chegou", reaberto: "Foi reaberto",
};

const FIXAS: Partial<Record<Campo, Opcao[]>> = {
  impacto: [{ v: "so_eu", rot: "Só eu" }, { v: "setor", rot: "Meu setor inteiro" }, { v: "publico", rot: "Atendimento ao público parou" }],
  prioridade: [{ v: "baixa", rot: "Baixa" }, { v: "normal", rot: "Normal" }, { v: "alta", rot: "Alta" }, { v: "urgente", rot: "Urgente" }],
  origem: [{ v: "sistema", rot: "Pelo sistema" }, { v: "whatsapp", rot: "WhatsApp" }, { v: "ligacao", rot: "Ligação" }, { v: "presencial", rot: "Presencial" }],
  anexo: [{ v: "sim", rot: "Sim" }, { v: "nao", rot: "Não" }],
  horario: [{ v: "expediente", rot: "No expediente" }, { v: "fora", rot: "Fora do expediente" }, { v: "fim_semana", rot: "Fim de semana" }],
  reaberto: [{ v: "sim", rot: "Sim" }, { v: "nao", rot: "Não" }],
};

export function opcoesDoCampo(campo: Campo, l: Listas): Opcao[] {
  if (campo === "categoria") return l.categorias;
  if (campo === "setor") return l.setores;
  return FIXAS[campo] ?? [];
}

export const CAMPOS_POR_ETAPA: Record<Etapa, Campo[]> = {
  ajustes: ["categoria", "setor", "impacto", "prioridade", "origem", "texto", "anexo", "horario"],
  quem: ["categoria", "setor", "impacto", "prioridade", "origem", "texto", "anexo", "horario"],
  tempo: ["categoria", "setor", "prioridade", "origem"],
};

export function rotuloValor(campo: Campo, v: string, l: Listas) {
  return opcoesDoCampo(campo, l).find((o) => o.v === v)?.rot ?? (campo === "texto" ? `"${v}"` : "(removido)");
}

/* ---------- ações ---------- */

export const ROTULO_ACAO: Record<TipoAcao, string> = {
  prioridade: "Definir prioridade", prazo: "Definir prazo", avisar: "Avisar no celular", resposta: "Responder a quem pediu",
  nota: "Nota interna", atribuir: "Atribuir a", rodizio: "Dividir entre", subir: "Subir a prioridade um nível", devolver: "Devolver para a fila",
};

export const ACOES_POR_ETAPA: Record<Etapa, TipoAcao[]> = {
  ajustes: ["prioridade", "prazo", "avisar", "resposta", "nota"],
  quem: ["atribuir", "rodizio", "avisar", "nota"],
  tempo: ["avisar", "subir", "devolver", "resposta", "nota"],
};

export const PRIORIDADES: Prioridade[] = ["baixa", "normal", "alta", "urgente"];
export const PRAZOS_REGRA = [30, 60, 120, 240, 480, 1440];
export const MINUTOS_GATILHO: Record<Gatilho, number[]> = {
  sem_inicio: [15, 30, 60, 120, 240, 1440],
  vencido: [],
  espera: [1440, 2880, 4320, 7200],
};
export const ROTULO_GATILHO: Record<Gatilho, string> = {
  sem_inicio: "Ninguém começou o atendimento em",
  vencido: "Passou do prazo",
  espera: "Quem pediu não respondeu em",
};

export function opcoesAvisar(l: Listas): Opcao[] {
  return [{ v: "equipe", rot: "Toda a equipe" }, { v: "responsavel", rot: "Quem está com o chamado" }, ...l.pessoas];
}

export function novaAcao(tipo: TipoAcao, l: Listas, respostas: string[]): Acao {
  switch (tipo) {
    case "prioridade": return { tipo, valor: "alta" };
    case "prazo": return { tipo, valor: "120" };
    case "avisar": return { tipo, valor: "equipe" };
    case "resposta": return { tipo, valor: respostas[0] ?? "Recebemos o seu chamado e já vamos verificar." };
    case "nota": return { tipo, valor: "" };
    case "atribuir": return { tipo, valor: l.pessoas[0]?.v ?? "" };
    case "rodizio": return { tipo, pessoas: l.pessoas.slice(0, 2).map((p) => p.v), modo: "carga" };
    default: return { tipo };
  }
}

export function novaCondicao(campo: Campo, l: Listas): Condicao {
  if (campo === "texto") return { campo, op: "contem", valores: [] };
  const o = opcoesDoCampo(campo, l)[0];
  return { campo, op: "e", valores: o ? [o.v] : [] };
}

/* ---------- texto em português ---------- */

const PRIO_ROT: Record<string, string> = { baixa: "Baixa", normal: "Normal", alta: "Alta", urgente: "Urgente" };

export function textoAcao(a: Acao, l: Listas): string {
  const pessoa = (id?: string) => l.pessoas.find((p) => p.v === id)?.rot ?? "(pessoa removida)";
  switch (a.tipo) {
    case "prioridade": return `prioridade ${PRIO_ROT[a.valor ?? ""] ?? a.valor}`;
    case "prazo": return `prazo de ${textoMinutos(parseInt(a.valor ?? "0", 10))}`;
    case "avisar": return `avisa ${(opcoesAvisar(l).find((o) => o.v === a.valor)?.rot ?? "alguém").toLowerCase()}`;
    case "resposta": return "responde automaticamente";
    case "nota": return "nota interna";
    case "atribuir": return `vai para ${pessoa(a.valor)}`;
    case "rodizio": return `dividido entre ${(a.pessoas ?? []).map(pessoa).join(", ") || "…"}`;
    case "subir": return "sobe a prioridade";
    case "devolver": return "volta para a fila";
  }
}

export function textoCondicao(c: Condicao, l: Listas): string {
  const vals = c.valores.map((v) => rotuloValor(c.campo, v, l));
  if (c.campo === "texto") return `descrição ${c.op === "nao_contem" ? "não contém" : "contém"} ${vals.join(" ou ") || "…"}`;
  return `${ROTULO_CAMPO[c.campo].toLowerCase()} ${c.op === "nao_e" ? "não é" : "é"} ${vals.join(" ou ") || "…"}`;
}

/** Nome automático quando a regra não tem nome: "Impressora → Rafael" */
export function nomeAuto(r: Regra, l: Listas): string {
  const quando = r.gatilho ? `${ROTULO_GATILHO[r.gatilho]}${r.gatilho !== "vencido" ? " " + textoMinutos(r.minutos ?? 0) : ""}` : "";
  const c = r.conds.map((x) => x.valores.map((v) => rotuloValor(x.campo, v, l)).join(" ou ")).join(" e ");
  const a = r.acoes.map((x) => textoAcao(x, l)).join(", ");
  return `${[quando, c].filter(Boolean).join(" e ") || "Qualquer chamado"} → ${a || "…"}`;
}

/** Problemas que a tela mostra dentro da regra */
export function avisosDaRegra(r: Regra, l: Listas, indisponiveis: Set<string>): string[] {
  const av: string[] = [];
  if (!r.acoes.length) av.push("Esta regra ainda não faz nada: acrescente um “Então”.");
  for (const c of r.conds) if (!c.valores.length) av.push(`A condição “${ROTULO_CAMPO[c.campo]}” está sem valor: ela nunca combina.`);
  for (const a of r.acoes) {
    if (a.tipo === "atribuir" && a.valor && indisponiveis.has(a.valor)) av.push(`${l.pessoas.find((p) => p.v === a.valor)?.rot ?? "A pessoa"} está ausente ou não recebe chamados automáticos: a regra é pulada.`);
    if (a.tipo === "atribuir" && !l.pessoas.some((p) => p.v === a.valor)) av.push("Escolha para quem vai.");
    if (a.tipo === "rodizio" && (a.pessoas ?? []).length < 2) av.push("Para dividir, escolha pelo menos duas pessoas.");
    if ((a.tipo === "nota" || a.tipo === "resposta") && !(a.valor ?? "").trim()) av.push("Escreva o texto da mensagem.");
  }
  return av;
}
