import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMediaQuery } from "../lib/useMediaQuery";

export type OpcaoEscolha = { valor: string; rotulo: string; icone?: ReactNode; detalhe?: string };

/**
 * Seletor em pílula com lista própria (no lugar do <select> nativo): cada opção com ícone (avatar da pessoa,
 * sinal da prioridade), abre com uma animação curta e funciona no teclado:
 * setas para andar, Enter para escolher, Esc para fechar, Tab sai.
 * No PC a lista cai logo abaixo da pílula. No celular ela vira uma FOLHA que sobe de baixo (bottom sheet do
 * Material), por cima da barra de navegação, com opções altas para o dedo; tocar fora fecha.
 */
export function Escolha({ rotulo, valor, opcoes, aoEscolher, desabilitado }: {
  /** lido pelo leitor de tela e título da folha no celular ("Com quem está", "Prioridade") */
  rotulo: string;
  valor: string;
  opcoes: OpcaoEscolha[];
  aoEscolher: (valor: string) => void;
  desabilitado?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const folha = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const itens = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const celular = useMediaQuery("(max-width: 767px)");
  const atual = opcoes.find((o) => o.valor === valor) ?? opcoes[0];

  useEffect(() => {
    if (!aberto) return;
    // abre com o foco na opção escolhida (sem rolar a página)
    itens.current[Math.max(0, opcoes.findIndex((o) => o.valor === valor))]?.focus({ preventScroll: true });
    // no celular a folha está num portal, fora da caixa: os dois contam como "dentro"
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node;
      if (!caixa.current?.contains(alvo) && !folha.current?.contains(alvo)) setAberto(false);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto, opcoes, valor]);

  function teclas(e: KeyboardEvent) {
    const n = itens.current.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") { e.preventDefault(); setAberto(false); botao.current?.focus(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); itens.current[(n + 1) % opcoes.length]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); itens.current[(n - 1 + opcoes.length) % opcoes.length]?.focus(); }
    else if (e.key === "Home") { e.preventDefault(); itens.current[0]?.focus(); }
    else if (e.key === "End") { e.preventDefault(); itens.current[opcoes.length - 1]?.focus(); }
    else if (e.key === "Tab") setAberto(false);
  }

  const lista = opcoes.map((o, n) => {
    const sel = o.valor === valor;
    return (
      <button
        key={o.valor || "vazio"}
        ref={(el) => { itens.current[n] = el; }}
        type="button"
        role="option"
        aria-selected={sel}
        onClick={() => { setAberto(false); botao.current?.focus({ preventScroll: true }); if (!sel) aoEscolher(o.valor); }}
        // a lista vai aparecendo de cima para baixo (escalonado, bem curto)
        style={{ animationDelay: `${Math.min(n, 6) * 18}ms` }}
        className={`animar-opcao flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-sm outline-none hover:bg-fundo focus-visible:bg-fundo max-md:min-h-14 max-md:px-3 max-md:text-base ${sel ? "font-semibold" : ""}`}
      >
        {o.icone}
        <span className="min-w-0 flex-1 truncate">{o.rotulo}</span>
        {o.detalhe && <span className="text-xs text-tinta-2">{o.detalhe}</span>}
        <Check className={`size-4 shrink-0 text-acento max-md:size-5 ${sel ? "" : "invisible"}`} aria-hidden="true" />
      </button>
    );
  });

  return (
    <div ref={caixa} className="relative inline-flex" onKeyDown={aberto && !celular ? teclas : undefined}>
      <button
        ref={botao}
        type="button"
        disabled={desabilitado}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={aberto ? id : undefined}
        aria-label={`${rotulo}: ${atual?.rotulo}`}
        onClick={() => setAberto(!aberto)}
        onKeyDown={(e) => { if (!aberto && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); setAberto(true); } }}
        className={`inline-flex min-h-10 items-center gap-2 rounded-full bg-superficie py-1.5 pr-2.5 pl-2 text-sm font-semibold ring-1 transition-shadow hover:ring-acento focus-visible:ring-2 focus-visible:ring-acento focus-visible:outline-none max-md:min-h-11 ${aberto ? "ring-acento" : "ring-linha"}`}
      >
        {atual?.icone}
        {atual?.rotulo}
        <ChevronDown className={`size-4 text-tinta-2 transition-transform duration-150 ${aberto ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {aberto && !celular && (
        <div id={id} role="listbox" aria-label={rotulo}
          className="animar-menu absolute top-full left-0 z-30 mt-1.5 min-w-52 rounded-2xl bg-superficie p-1.5 shadow-xl ring-1 ring-linha">
          {lista}
        </div>
      )}

      {/* celular: folha que sobe de baixo, num portal (acima da barra de navegação, z-index alto) */}
      {aberto && celular && createPortal(
        <div className="animar-fundo fixed inset-0 flex items-end bg-noite/40" style={{ zIndex: 100 }} onKeyDown={teclas}>
          <div ref={folha} id={id} role="listbox" aria-label={rotulo}
            className="animar-folha w-full rounded-t-3xl bg-superficie px-2 pt-2 pb-[max(12px,env(safe-area-inset-bottom))] shadow-2xl ring-1 ring-linha">
            <span className="mx-auto mb-1 block h-1.5 w-10 rounded-full bg-linha" aria-hidden="true" />
            <p className="px-3 pt-1 pb-2 text-sm font-semibold text-tinta-2">{rotulo}</p>
            {lista}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
