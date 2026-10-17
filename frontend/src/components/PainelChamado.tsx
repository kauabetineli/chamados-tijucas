import { ExternalLink, GripHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as PE } from "react";
import { Link } from "react-router";
import { useAuth } from "../lib/auth";
import { ehTecnico } from "../lib/pb";
import { useMediaQuery } from "../lib/useMediaQuery";
import { useVerChamado } from "../lib/verChamado";
import { DetalheChamado } from "../pages/Chamado";

const CHAVE_ALTURA = "dinodesk:altura-painel";
const MINIMO = 260;

function alturaSalva() {
  try {
    const v = Number(localStorage.getItem(CHAVE_ALTURA));
    if (v >= MINIMO) return v;
  } catch { /* ok */ }
  return Math.round(window.innerHeight * 0.55);
}

/**
 * Painel do chamado que sobe de baixo (como no SoftDesk): a lista continua em cima e dá para
 * trocar de chamado com um clique. Abre com ?ver=<id> (ver lib/verChamado.tsx).
 * - PC: ocupa a parte de baixo da tela; a alça no topo muda a altura (lembrada no aparelho).
 * - Celular: folha quase da altura da tela; arrastar a alça para baixo (ou o "voltar") fecha.
 */
export function PainelChamado() {
  const { aberto, fechar } = useVerChamado();
  const { usuario } = useAuth();
  const pc = useMediaQuery("(min-width: 768px)");
  const [altura, setAltura] = useState(alturaSalva);
  const [puxando, setPuxando] = useState(0); // celular: quanto a folha já desceu no arrasto
  const arrasto = useRef<{ y: number; altura: number } | null>(null);
  const fecharRef = useRef(fechar);
  fecharRef.current = fechar;

  // a página ganha espaço embaixo (no PC) para a lista rolar por inteiro acima do painel
  useEffect(() => {
    const raiz = document.documentElement;
    if (aberto && pc) raiz.style.setProperty("--altura-painel", `${altura}px`);
    else raiz.style.removeProperty("--altura-painel");
    return () => { raiz.style.removeProperty("--altura-painel"); };
  }, [aberto, pc, altura]);

  // Esc fecha (se não houver outra janela aberta por cima nem alguém digitando)
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const alvo = e.target as HTMLElement;
      if (alvo.closest("input, textarea, select")) return;
      fecharRef.current();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberto]);

  // celular: a página de trás não rola com a folha aberta
  useEffect(() => {
    if (!aberto || pc) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = antes; };
  }, [aberto, pc]);

  if (!aberto) return null;
  const pagina = ehTecnico(usuario) ? `/ti/chamado/${aberto}` : `/chamado/${aberto}`;

  const alca = {
    onPointerDown: (e: PE) => {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      arrasto.current = { y: e.clientY, altura };
    },
    onPointerMove: (e: PE) => {
      const a = arrasto.current;
      if (!a) return;
      if (pc) {
        const max = window.innerHeight - 120;
        setAltura(Math.min(max, Math.max(MINIMO, a.altura + (a.y - e.clientY))));
      } else {
        setPuxando(Math.max(0, e.clientY - a.y));
      }
    },
    onPointerUp: () => {
      arrasto.current = null;
      if (pc) {
        try { localStorage.setItem(CHAVE_ALTURA, String(altura)); } catch { /* ok */ }
      } else {
        if (puxando > 120) fechar();
        setPuxando(0);
      }
    },
  };

  const barra = (
    <div className="flex shrink-0 items-center gap-2 border-b border-linha px-3 py-1.5">
      <div
        {...alca}
        className={`flex flex-1 touch-none items-center justify-center self-stretch py-1.5 text-tinta-2 ${pc ? "cursor-row-resize" : "cursor-grab"}`}
        role="separator"
        aria-label={pc ? "Arraste para mudar a altura do painel" : "Arraste para baixo para fechar"}
      >
        {pc ? <GripHorizontal className="size-5" aria-hidden="true" /> : <span className="h-1.5 w-12 rounded-full bg-linha" aria-hidden="true" />}
      </div>
      <Link to={pagina} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-tinta-2 hover:bg-fundo hover:text-tinta" title="Abrir em página inteira">
        <ExternalLink className="size-4" aria-hidden="true" /> <span className="hidden sm:inline">Página inteira</span>
      </Link>
      <button type="button" onClick={fechar} className="grid size-10 place-items-center rounded-full text-tinta-2 hover:bg-fundo hover:text-tinta" aria-label="Fechar o chamado">
        <X className="size-5" />
      </button>
    </div>
  );

  const conteudo = (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-[max(24px,env(safe-area-inset-bottom))] md:px-6">
      {/* key: trocar de chamado volta o painel para o topo e recarrega tudo */}
      <DetalheChamado key={aberto} id={aberto} embutido />
    </div>
  );

  if (pc) {
    return (
      <section
        aria-label="Chamado aberto"
        className="painel-sobe fixed right-0 bottom-0 flex flex-col border-t-2 border-acento bg-superficie shadow-[0_-12px_32px_-12px_rgb(0_0_0/0.35)]"
        style={{ height: altura, zIndex: 30, left: "var(--largura-lateral, 0px)" }}
      >
        {barra}
        {conteudo}
      </section>
    );
  }

  return (
    <div className="fixed inset-0" style={{ zIndex: 95 }}>
      <div className="absolute inset-0 bg-noite/50" onClick={fechar} aria-hidden="true" />
      {/* o arrasto move o invólucro; a animação de entrada fica na folha (animação venceria o transform) */}
      <div className="absolute inset-x-0 bottom-0" style={{ transform: puxando ? `translateY(${puxando}px)` : undefined }}>
        <section aria-label="Chamado aberto" className="painel-sobe flex h-[92dvh] flex-col rounded-t-2xl bg-superficie shadow-2xl">
          {barra}
          {conteudo}
        </section>
      </div>
    </div>
  );
}
