import type { Chamado, Prioridade } from "./pb";
import { paraData } from "./formato";

/**
 * Prazo para começar o atendimento. O certo vem do servidor (chamados.prazo_em, calculado com
 * Configurações do TI > Fila e atendimento e as regras da automação). Este padrão só vale para
 * chamado antigo sem prazo_em.
 */
export const META_ESPERA_HORAS: Record<Prioridade, number> = {
  urgente: 1,
  alta: 4,
  normal: 24,
  baixa: 72,
};

/** Horas desde a abertura. */
export function horasEsperando(c: Chamado, agora = Date.now()): number {
  const d = paraData(c.created);
  return d ? (agora - d.getTime()) / 3_600_000 : 0;
}

/** Quando vence o prazo para começar o atendimento. */
export function prazoDe(c: Chamado): Date | null {
  const p = c.prazo_em ? paraData(c.prazo_em) : null;
  if (p) return p;
  const d = paraData(c.created);
  return d ? new Date(d.getTime() + META_ESPERA_HORAS[c.prioridade] * 3_600_000) : null;
}

export function atrasado(c: Chamado, agora = Date.now()): boolean {
  if (c.status !== "aberto") return false;
  const p = prazoDe(c);
  return !!p && agora > p.getTime();
}

/** "12 min", "3 h", "2 dias": curto, para caber no cartão da fila. */
export function esperaCurta(horas: number): string {
  if (horas < 1 / 60) return "agora";
  if (horas < 1) return `${Math.round(horas * 60)} min`;
  if (horas < 24) return `${Math.floor(horas)} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? "1 dia" : `${dias} dias`;
}

/**
 * Divide os chamados não resolvidos nas partes da fila do técnico:
 * - atendendo: em atendimento por mim agora;
 * - proximo: MEU próximo = o primeiro da fila (na ordem escolhida em Configurações do TI) que é meu ou está livre.
 *   Um chamado passado para mim e um livre disputam pela ordem da fila: urgente vem antes;
 * - depois: o resto dos abertos, na ordem (os meus aparecem destacados);
 * - comOutros: em atendimento por colegas;
 * - esperando: MEUS chamados em "aguardando" (peça, resposta, terceiro): fora da fila e da carga, mas não esquecidos.
 * `fila` = todos os abertos na ordem de atendimento (para numerar 1º, 2º...).
 * Espera a lista já ordenada por ordem_fila,created (a mesma ordem da senha que o servidor vê).
 */
export function organizarFila(lista: Chamado[], eu: string) {
  const fila = lista.filter((c) => c.status === "aberto");
  const atendendo = lista.filter((c) => c.status === "em_andamento" && c.responsavel === eu);
  const comOutros = lista.filter((c) => c.status === "em_andamento" && c.responsavel !== eu);
  const esperando = lista.filter((c) => c.status === "aguardando" && c.responsavel === eu);
  const proximo = fila.find((c) => !c.responsavel || c.responsavel === eu) ?? null;
  const depois = fila.filter((c) => c !== proximo);
  return { atendendo, comOutros, esperando, fila, proximo, depois };
}

/** Quantos chamados (abertos ou em atendimento) cada técnico tem, e quantos estão livres. */
export function cargaDaEquipe(lista: Chamado[]) {
  const carga: Record<string, number> = {};
  let livres = 0;
  for (const c of lista) {
    // "aguardando" não pesa: o técnico não consegue avançar enquanto espera
    if (c.status === "resolvido" || c.status === "aguardando") continue;
    if (c.responsavel) carga[c.responsavel] = (carga[c.responsavel] ?? 0) + 1;
    else if (c.status === "aberto") livres++;
  }
  return { carga, livres };
}
