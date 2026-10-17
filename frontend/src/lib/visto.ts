/**
 * "Já vi este chamado": guarda no aparelho quando a pessoa abriu cada chamado pela última vez,
 * para marcar "Nova resposta" quando o TI escreve depois disso. Sem armazenamento, nada é marcado.
 */
const prefixo = "dinodesk:visto:";

export function marcarVisto(chamadoId: string) {
  try { localStorage.setItem(prefixo + chamadoId, new Date().toISOString()); } catch { /* ok */ }
}

/** Data (ms) da última visita, ou 0 se nunca abriu neste aparelho. */
export function ultimaVisita(chamadoId: string): number {
  try { return Date.parse(localStorage.getItem(prefixo + chamadoId) || "") || 0; } catch { return 0; }
}
