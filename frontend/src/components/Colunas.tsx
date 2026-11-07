import { Columns3, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as KE, type PointerEvent as PE } from "react";

/**
 * Colunas de tabela que cada técnico ajusta do seu jeito (largura, quais aparecem e a densidade).
 * Fica guardado NESTE navegador (localStorage, chave própria por tabela). Mudou de PC, volta ao padrão.
 *
 *   const col = useColunas("todos-chamados", DEFINICOES);
 *   <col style={{ width: col.largura("protocolo") }} />   ·   <AlcaColuna col={col} id="protocolo" />
 */

export interface DefColuna {
  id: string;
  rotulo: string;
  /** largura inicial e mínima, em px */
  padrao: number;
  minimo: number;
  /** começa escondida (o técnico liga no menu "Colunas") */
  oculta?: boolean;
  /** não pode ser escondida */
  fixa?: boolean;
}

type Salvo = { larguras: Record<string, number>; ocultas: string[] | null; densa: boolean };

function ler(chave: string): Salvo {
  try {
    const v = JSON.parse(localStorage.getItem(chave) || "null");
    if (v && typeof v === "object") return { larguras: v.larguras ?? {}, ocultas: Array.isArray(v.ocultas) ? v.ocultas : null, densa: !!v.densa };
  } catch { /* sem armazenamento: padrão */ }
  return { larguras: {}, ocultas: null, densa: false };
}

export function useColunas(nome: string, defs: DefColuna[]) {
  const chave = `dinodesk:colunas-${nome}`;
  const [salvo, setSalvo] = useState<Salvo>(() => ler(chave));
  useEffect(() => {
    try { localStorage.setItem(chave, JSON.stringify(salvo)); } catch { /* ok */ }
  }, [chave, salvo]);

  const ocultas = salvo.ocultas ?? defs.filter((d) => d.oculta).map((d) => d.id);
  const visiveis = defs.filter((d) => d.fixa || !ocultas.includes(d.id));
  const def = (id: string) => defs.find((d) => d.id === id)!;
  const largura = (id: string) => Math.max(def(id).minimo, salvo.larguras[id] ?? def(id).padrao);

  const mudarLargura = useCallback((id: string, px: number) => {
    const d = defs.find((x) => x.id === id);
    if (!d) return;
    setSalvo((s) => ({ ...s, larguras: { ...s.larguras, [id]: Math.round(Math.min(900, Math.max(d.minimo, px))) } }));
  }, [defs]);

  return {
    defs,
    visiveis,
    largura,
    mudarLargura,
    visivel: (id: string) => visiveis.some((d) => d.id === id),
    alternar: (id: string) => setSalvo((s) => {
      const atual = s.ocultas ?? defs.filter((d) => d.oculta).map((d) => d.id);
      return { ...s, ocultas: atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id] };
    }),
    densa: salvo.densa,
    setDensa: (densa: boolean) => setSalvo((s) => ({ ...s, densa })),
    padrao: () => setSalvo({ larguras: {}, ocultas: null, densa: false }),
    larguraTotal: visiveis.reduce((n, d) => n + Math.max(d.minimo, salvo.larguras[d.id] ?? d.padrao), 0),
  };
}

export type Colunas = ReturnType<typeof useColunas>;

/**
 * Alça na borda direita do título da coluna: arrastar muda a largura; duplo clique ajusta ao texto mais longo
 * que está na tela; setas ←/→ no teclado.
 */
export function AlcaColuna({ col, id, tabela }: { col: Colunas; id: string; tabela: React.RefObject<HTMLTableElement | null> }) {
  const inicio = useRef<{ x: number; largura: number } | null>(null);
  const [ativa, setAtiva] = useState(false);
  const d = col.defs.find((x) => x.id === id)!;

  function ajustar() {
    // mede cada célula da coluna sem quebra de linha e fica com a maior
    const celulas = tabela.current?.querySelectorAll<HTMLElement>(`[data-col="${id}"] > .celula`) ?? [];
    let maior = 0;
    celulas.forEach((el) => {
      const antes = el.style.cssText;
      el.style.cssText = "width:max-content;white-space:nowrap;display:inline-block";
      maior = Math.max(maior, el.offsetWidth);
      el.style.cssText = antes;
    });
    if (maior) col.mudarLargura(id, maior + 26); // + o respiro da célula (px-3) e a alça
  }

  return (
    <span
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={`Largura da coluna ${d.rotulo} (setas para ajustar)`}
      aria-valuenow={col.largura(id)}
      aria-valuemin={d.minimo}
      title="Arraste para mudar a largura · duplo clique ajusta ao texto"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e: PE) => {
        e.stopPropagation();
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        inicio.current = { x: e.clientX, largura: col.largura(id) };
        setAtiva(true);
      }}
      onPointerMove={(e: PE) => {
        const i = inicio.current;
        if (i) col.mudarLargura(id, i.largura + (e.clientX - i.x));
      }}
      onPointerUp={() => { inicio.current = null; setAtiva(false); }}
      onDoubleClick={ajustar}
      onKeyDown={(e: KE) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        col.mudarLargura(id, col.largura(id) + (e.key === "ArrowRight" ? 16 : -16));
      }}
      className="group/alca absolute inset-y-0 -right-1.5 z-10 flex w-3 cursor-col-resize touch-none justify-center focus-visible:outline-none"
    >
      <span className={`h-full w-0.5 ${ativa ? "bg-acento" : "bg-linha group-hover/alca:bg-acento group-focus-visible/alca:bg-acento"}`} aria-hidden="true" />
    </span>
  );
}

/** Botão "Colunas": quais aparecem, densidade e voltar ao padrão. */
export function MenuColunas({ col }: { col: Colunas }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("pointerdown", fora); document.removeEventListener("keydown", tecla); };
  }, [aberto]);

  return (
    <div ref={caixa} className="relative">
      <button type="button" className="btn-secundario min-h-10 px-3 text-sm" aria-expanded={aberto} aria-haspopup="true" onClick={() => setAberto(!aberto)}>
        <Columns3 className="size-4" aria-hidden="true" /> Colunas
      </button>
      {aberto && (
        <div className="absolute right-0 z-30 mt-2 w-64 space-y-4 rounded-2xl bg-superficie p-4 shadow-xl ring-1 ring-linha">
          <fieldset>
            <legend className="mb-1.5 text-xs font-bold tracking-wider text-tinta-2 uppercase">Mostrar</legend>
            {col.defs.filter((d) => !d.fixa).map((d) => (
              <label key={d.id} className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm font-semibold">
                <input type="checkbox" className="size-5 accent-acento" checked={col.visivel(d.id)} onChange={() => col.alternar(d.id)} />
                {d.rotulo}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend className="mb-1.5 text-xs font-bold tracking-wider text-tinta-2 uppercase">Densidade</legend>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-fundo p-0.5 ring-1 ring-linha">
              {([[false, "Confortável"], [true, "Compacta"]] as const).map(([v, r]) => (
                <button key={r} type="button" aria-pressed={col.densa === v} onClick={() => col.setDensa(v)}
                  className={`min-h-9 rounded-md text-sm font-semibold ${col.densa === v ? "bg-superficie text-tinta shadow-sm ring-1 ring-linha" : "text-tinta-2 hover:text-tinta"}`}>
                  {r}
                </button>
              ))}
            </div>
          </fieldset>
          <button type="button" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-acento" onClick={col.padrao}>
            <RotateCcw className="size-4" aria-hidden="true" /> Voltar ao padrão
          </button>
          <p className="text-xs text-tinta-2">Arraste a borda do título de uma coluna para alargar. Duplo clique ajusta ao texto. Fica salvo neste navegador.</p>
        </div>
      )}
    </div>
  );
}
