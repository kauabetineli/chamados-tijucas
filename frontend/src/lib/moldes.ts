import { useSyncExternalStore } from "react";
import { useMediaQuery } from "./useMediaQuery";

/**
 * Os 3 moldes de página (docs/ARQUITETURA.md, "Moldes de página"). Toda página é de um deles; é o que decide como
 * o espaço sobrando de uma tela larga é usado.
 *
 * - "lista"      lista + detalhe: a lista ocupa o que sobra e, em tela larga, o item escolhido fica FIXO à direita
 *                (Fila, Todos os chamados, Soluções, Pessoas, Feedback).
 * - "painel"     painel de dados: largura toda, a grade ganha colunas conforme a tela (Painel, Automação).
 * - "formulario" formulário com apoio: largura de leitura, CENTRALIZADO na área (o resto do sistema).
 */
export type Molde = "lista" | "painel" | "formulario";

/** Tela larga: a partir daqui o detalhe fica fixo ao lado da lista (classe Tailwind `larga:`, ver index.css). */
export const TELA_LARGA = "(min-width: 100rem)"; // = 1600 px; o mesmo valor do breakpoint `larga` em index.css
export const useTelaLarga = () => useMediaQuery(TELA_LARGA);

const LISTAS = ["/ti", "/ti/chamados", "/ti/historico", "/ti/usuarios", "/projeto/feedback"];

export function moldeDaRota(caminho: string, params: URLSearchParams, tecnico: boolean): { molde: Molde; max: string } {
  if ((tecnico && LISTAS.includes(caminho)) || caminho === "/projeto/feedback") return { molde: "lista", max: "100%" };
  if (caminho === "/ti/painel") return { molde: "painel", max: "100%" };
  if (caminho === "/ti/configuracoes") {
    const aba = params.get("aba");
    return !aba || aba === "automacao" ? { molde: "painel", max: "100%" } : { molde: "formulario", max: "76rem" };
  }
  if (caminho === "/" || caminho === "/novo" || caminho === "/ti/registrar") return { molde: "formulario", max: "76rem" };
  if (caminho.startsWith("/chamado/") || caminho.startsWith("/ti/chamado/") || caminho === "/ti/qrcodes") return { molde: "formulario", max: "64rem" };
  return { molde: "formulario", max: "48rem" };
}

/**
 * O que a coluna de detalhe mostra quando NADA foi clicado (tela larga, molde "lista"):
 * a Fila põe o "seu próximo", Soluções a mais recente. Sem padrão, a lista usa a largura toda.
 */
export type PadraoDoPainel = { id: string; etiqueta: string } | null;
let padrao: PadraoDoPainel = null;
const ouvintes = new Set<() => void>();
export function definirPadraoDoPainel(p: PadraoDoPainel) {
  if (padrao?.id === p?.id && padrao?.etiqueta === p?.etiqueta) return;
  padrao = p;
  ouvintes.forEach((f) => f());
}
export function usePadraoDoPainel(): PadraoDoPainel {
  return useSyncExternalStore(
    (f) => { ouvintes.add(f); return () => ouvintes.delete(f); },
    () => padrao,
  );
}
