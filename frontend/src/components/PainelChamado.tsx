import { ChevronDown, ChevronUp, Maximize2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as KE, type PointerEvent as PE } from "react";
import { Link, useLocation } from "react-router";
import { useAuth } from "../lib/auth";
import { veComoTI } from "../lib/pb";
import { useMediaQuery } from "../lib/useMediaQuery";
import { chamadosNaTela, useVerChamado } from "../lib/verChamado";
import { moldeDaRota, usePadraoDoPainel, useTelaLarga } from "../lib/moldes";
import { DetalheChamado } from "../pages/Chamado";

const CHAVE_LARGURA = "dinodesk:largura-painel";
const MIN = 460, PADRAO = 600;
const maximo = () => Math.max(MIN, Math.min(900, window.innerWidth - 520));

function larguraSalva() {
  try {
    const v = Number(localStorage.getItem(CHAVE_LARGURA));
    if (v >= MIN) return Math.min(v, maximo());
  } catch { /* ok */ }
  return Math.min(PADRAO, maximo());
}

/**
 * Chamado aberto ao lado da lista, sem sair dela. Abre com ?ver=<id> (ver lib/verChamado.tsx).
 * - PC: gaveta à direita (600 px; a borda esquerda muda a largura, lembrada no aparelho). A lista encolhe ao lado
 *   (Layout reserva --largura-painel) e ↑ ↓ (ou K e J) passam para o chamado de cima/de baixo da lista.
 * - Tela larga (1600 px+), nas páginas de lista: a gaveta fica FIXA, como uma coluna. Sem nada clicado ela mostra
 *   o padrão da página (lib/moldes.ts: Fila = seu próximo, Soluções = a mais recente).
 * - Celular: folha quase da altura da tela; arrastar a alça para baixo (ou o "voltar") fecha.
 */
export function PainelChamado() {
  const { aberto, abrir, fechar } = useVerChamado();
  const { usuario } = useAuth();
  const pc = useMediaQuery("(min-width: 768px)");
  // tela larga + página de lista (molde "lista"): a gaveta fica FIXA e, sem nada clicado, mostra o padrão da página
  // (Fila: o seu próximo; Soluções: a mais recente). Fora disso, só abre quando alguém clica.
  const larga = useTelaLarga();
  const local = useLocation();
  const listaFixa = pc && larga && moldeDaRota(local.pathname, new URLSearchParams(local.search), veComoTI(usuario)).molde === "lista";
  const padrao = usePadraoDoPainel();
  const atual = aberto || (listaFixa ? padrao?.id ?? null : null) || null;
  const mostrandoPadrao = !aberto && !!atual;
  const fixo = listaFixa && !!atual;
  const [largura, setLargura] = useState(larguraSalva);
  const [puxando, setPuxando] = useState(0); // celular: quanto a folha já desceu no arrasto
  const arrasto = useRef<{ pos: number; largura: number } | null>(null);
  const fecharRef = useRef(fechar);
  fecharRef.current = fechar;

  // fixa: no máximo ~1/3 da tela, para a lista continuar com espaço
  const larguraVista = fixo ? Math.min(largura, Math.max(MIN, Math.round(window.innerWidth * 0.34))) : largura;

  // a lista ganha espaço à direita (no PC) para não ficar por baixo da gaveta
  useEffect(() => {
    const raiz = document.documentElement;
    if (atual && pc) raiz.style.setProperty("--largura-painel", `${larguraVista}px`);
    else raiz.style.removeProperty("--largura-painel");
    return () => { raiz.style.removeProperty("--largura-painel"); };
  }, [atual, pc, larguraVista]);

  const vizinho = useCallback((passo: 1 | -1) => {
    const lista = chamadosNaTela();
    const i = lista.findIndex((x) => x.id === atual);
    return i < 0 ? null : lista[i + passo] ?? null;
  }, [atual]);
  const irPara = useCallback((passo: 1 | -1) => {
    const v = vizinho(passo);
    if (v) abrir(v.id, v.el);
  }, [vizinho, abrir]);
  // os botões ↑ ↓ ficam apagados no começo/fim da lista (a lista muda em tempo real: confere a cada troca)
  const [limites, setLimites] = useState({ antes: false, depois: false });
  useEffect(() => {
    if (!atual) return;
    const t = window.setTimeout(() => setLimites({ antes: !!vizinho(-1), depois: !!vizinho(1) }), 50);
    return () => window.clearTimeout(t);
  }, [atual, vizinho]);

  // Esc fecha; ↑ ↓ / K J trocam de chamado (se não houver outra janela por cima nem alguém digitando).
  // Mostrando só o padrão (ninguém clicou), as setas continuam rolando a página: só K e J trocam.
  useEffect(() => {
    if (!atual) return;
    const tecla = (e: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const alvo = e.target as HTMLElement;
      if (alvo.closest("input, textarea, select, [contenteditable]")) return;
      const setas = !mostrandoPadrao;
      if (e.key === "Escape") { if (aberto) fecharRef.current(); }
      else if (pc && !e.altKey && !e.ctrlKey && !e.metaKey && ((setas && e.key === "ArrowDown") || e.key === "j")) { e.preventDefault(); irPara(1); }
      else if (pc && !e.altKey && !e.ctrlKey && !e.metaKey && ((setas && e.key === "ArrowUp") || e.key === "k")) { e.preventDefault(); irPara(-1); }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [atual, aberto, mostrandoPadrao, pc, irPara]);

  // celular: a página de trás não rola com a folha aberta
  useEffect(() => {
    if (!aberto || pc) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = antes; };
  }, [aberto, pc]);

  if (!atual) return null;
  const pagina = veComoTI(usuario) ? `/ti/chamado/${atual}` : `/chamado/${atual}`;

  const botao = "grid size-10 place-items-center rounded-lg text-tinta-2 hover:bg-fundo hover:text-tinta disabled:opacity-30 disabled:hover:bg-transparent";
  const controles = (
    <div className="flex shrink-0 items-center gap-0.5">
      {pc && (
        <>
          <button type="button" className={botao} onClick={() => irPara(-1)} disabled={!limites.antes} aria-label="Chamado de cima" title="Chamado de cima (↑ ou K)">
            <ChevronUp className="size-5" aria-hidden="true" />
          </button>
          <button type="button" className={botao} onClick={() => irPara(1)} disabled={!limites.depois} aria-label="Chamado de baixo" title="Chamado de baixo (↓ ou J)">
            <ChevronDown className="size-5" aria-hidden="true" />
          </button>
        </>
      )}
      <Link to={pagina} className={botao} aria-label="Abrir em página inteira" title="Abrir em página inteira">
        <Maximize2 className="size-4" aria-hidden="true" />
      </Link>
      {aberto && (
        <button type="button" onClick={fechar} className={botao} aria-label="Fechar o chamado" title={fixo && padrao ? "Voltar (Esc)" : "Fechar (Esc)"}>
          <X className="size-5" aria-hidden="true" />
        </button>
      )}
    </div>
  );

  // key: trocar de chamado volta o painel para o topo e recarrega tudo
  const detalhe = <DetalheChamado key={atual} id={atual} embutido gaveta={pc} controles={controles} etiqueta={mostrandoPadrao ? padrao?.etiqueta : undefined} />;

  if (pc) {
    const borda = {
      onPointerDown: (e: PE) => {
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        arrasto.current = { pos: e.clientX, largura };
      },
      onPointerMove: (e: PE) => {
        const a = arrasto.current;
        if (a) setLargura(Math.min(maximo(), Math.max(MIN, a.largura + (a.pos - e.clientX))));
      },
      onPointerUp: () => {
        arrasto.current = null;
        try { localStorage.setItem(CHAVE_LARGURA, String(largura)); } catch { /* ok */ }
      },
      onDoubleClick: () => { const v = Math.min(PADRAO, maximo()); setLargura(v); try { localStorage.setItem(CHAVE_LARGURA, String(v)); } catch { /* ok */ } },
      onKeyDown: (e: KE) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        e.stopPropagation();
        const v = Math.min(maximo(), Math.max(MIN, largura + (e.key === "ArrowLeft" ? 24 : -24)));
        setLargura(v);
        try { localStorage.setItem(CHAVE_LARGURA, String(v)); } catch { /* ok */ }
      },
    };
    return (
      <section
        aria-label="Chamado aberto"
        data-gaveta
        className={`fixed top-0 right-0 bottom-0 flex flex-col border-l border-linha bg-superficie print:hidden ${fixo ? "" : "gaveta-entra shadow-[-12px_0_32px_-12px_rgb(0_0_0/0.25)]"}`}
        style={{ width: larguraVista, zIndex: 30 }}
      >
        <div
          {...borda}
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-label="Largura do painel (setas para ajustar)"
          aria-valuemin={MIN}
          aria-valuemax={maximo()}
          aria-valuenow={largura}
          title="Arraste para mudar a largura. Duplo clique volta ao padrão."
          className="group absolute inset-y-0 -left-1.5 z-10 w-3 cursor-col-resize touch-none focus-visible:outline-none"
        >
          <span className="mx-auto block h-full w-0.5 bg-transparent group-hover:bg-acento group-focus-visible:bg-acento" aria-hidden="true" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-4 pb-6">{detalhe}</div>
      </section>
    );
  }

  const alca = {
    onPointerDown: (e: PE) => {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      arrasto.current = { pos: e.clientY, largura };
    },
    onPointerMove: (e: PE) => {
      const a = arrasto.current;
      if (a) setPuxando(Math.max(0, e.clientY - a.pos));
    },
    onPointerUp: () => {
      arrasto.current = null;
      if (puxando > 120) fechar();
      setPuxando(0);
    },
  };

  return (
    <div className="fixed inset-0" style={{ zIndex: 95 }}>
      <div className="absolute inset-0 bg-noite/50" onClick={fechar} aria-hidden="true" />
      {/* o arrasto move o invólucro; a animação de entrada fica na folha (animação venceria o transform) */}
      <div className="absolute inset-x-0 bottom-0" style={{ transform: puxando ? `translateY(${puxando}px)` : undefined }}>
        <section aria-label="Chamado aberto" data-gaveta className="painel-sobe flex h-[92dvh] flex-col rounded-t-2xl bg-superficie shadow-2xl">
          <div {...alca} className="flex shrink-0 cursor-grab touch-none justify-center py-2.5" role="separator" aria-label="Arraste para baixo para fechar">
            <span className="h-1.5 w-12 rounded-full bg-linha" aria-hidden="true" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(24px,env(safe-area-inset-bottom))]">{detalhe}</div>
        </section>
      </div>
    </div>
  );
}
