import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

/** 0 = "Todos" (busca tudo; use com cuidado em listas grandes). */
export const OPCOES_POR_PAGINA = [10, 25, 50, 100, 0];

/**
 * Página atual + quantos por página, lembrando a escolha no aparelho (por lista).
 * A consulta ao banco usa page/perPage do PocketBase: só a página pedida trafega.
 */
export function usePaginacao(chave: string, padrao = 25) {
  const chaveLocal = `dinodesk:por-pagina:${chave}`;
  const [porPagina, setPorPaginaEstado] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem(chaveLocal));
      return OPCOES_POR_PAGINA.includes(v) && localStorage.getItem(chaveLocal) !== null ? v : padrao;
    } catch {
      return padrao;
    }
  });
  const [pagina, setPagina] = useState(1);

  function setPorPagina(n: number) {
    setPorPaginaEstado(n);
    setPagina(1);
    try { localStorage.setItem(chaveLocal, String(n)); } catch { /* ok */ }
  }

  return { pagina, setPagina, porPagina, setPorPagina, voltarAoInicio: () => setPagina(1) };
}

/** Rodapé de lista: "1–25 de 132", por página e navegação entre páginas. */
export function Paginacao({ pagina, porPagina, total, aoMudarPagina, aoMudarPorPagina, rotulo = "itens" }: {
  pagina: number;
  porPagina: number;
  total: number;
  aoMudarPagina: (p: number) => void;
  aoMudarPorPagina: (n: number) => void;
  rotulo?: string;
}) {
  const todas = porPagina === 0;
  const totalPaginas = todas ? 1 : Math.max(1, Math.ceil(total / porPagina));
  const inicio = total === 0 ? 0 : todas ? 1 : (pagina - 1) * porPagina + 1;
  const fim = todas ? total : Math.min(total, pagina * porPagina);
  const botao = "grid size-11 place-items-center rounded-xl ring-1 ring-linha hover:ring-acento disabled:opacity-40 disabled:hover:ring-linha";

  function irPara(p: number) {
    aoMudarPagina(Math.min(totalPaginas, Math.max(1, p)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <nav aria-label="Paginação" className="flex flex-wrap items-center justify-between gap-3 text-sm text-tinta-2">
      <span>
        {total === 0 ? `Nenhum ${rotulo}` : <><b className="text-tinta">{inicio}–{fim}</b> de <b className="text-tinta">{total}</b> {rotulo}</>}
      </span>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          Por página
          <select
            className="campo min-h-11 w-auto py-1.5 pr-9 text-sm"
            value={porPagina}
            onChange={(e) => aoMudarPorPagina(Number(e.target.value))}
          >
            {OPCOES_POR_PAGINA.map((n) => <option key={n} value={n}>{n === 0 ? "Todos" : n}</option>)}
          </select>
        </label>

        {!todas && totalPaginas > 1 && (
          <div className="flex items-center gap-2">
            <button type="button" className={botao} onClick={() => irPara(pagina - 1)} disabled={pagina <= 1} aria-label="Página anterior">
              <ChevronLeft className="size-5" />
            </button>
            <span className="min-w-24 text-center">
              Página <b className="text-tinta">{pagina}</b> de {totalPaginas}
            </span>
            <button type="button" className={botao} onClick={() => irPara(pagina + 1)} disabled={pagina >= totalPaginas} aria-label="Próxima página">
              <ChevronRight className="size-5" />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
