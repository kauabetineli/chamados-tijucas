import type { MouseEvent, ReactNode } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";

/**
 * "Ver o chamado sem sair da lista": o chamado aberto fica no endereço (?ver=<id>) e aparece no
 * painel de baixo (components/PainelChamado.tsx). Por estar no endereço, o "voltar" do celular fecha o painel,
 * e dá para trocar de chamado com um clique, sem recarregar a lista.
 */
export function useVerChamado() {
  const [params, setParams] = useSearchParams();
  const local = useLocation();
  const navegar = useNavigate();
  const aberto = params.get("ver") ?? "";

  /** `origem`: o cartão clicado; no PC a tela rola para ele não ficar escondido atrás do painel. */
  function abrir(id: string, origem?: Element | null) {
    const p = new URLSearchParams(params);
    p.set("ver", id);
    // trocar de chamado com o painel aberto não empilha histórico: o "voltar" fecha o painel
    setParams(p, { replace: !!aberto, state: { painel: true } });
    if (origem) manterVisivel(origem);
  }

  function fechar() {
    if ((local.state as { painel?: boolean } | null)?.painel) {
      navegar(-1);
      return;
    }
    const p = new URLSearchParams(params);
    p.delete("ver");
    setParams(p, { replace: true });
  }

  return { aberto, abrir, fechar };
}

// espera o painel abrir e rola só o necessário (PC: o painel fica à direita e não cobre a lista; celular: cobre a tela)
function manterVisivel(el: Element) {
  window.setTimeout(() => {
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, 60);
}

/** Chamados da lista que está na tela, na ordem em que aparecem (para o ↑ ↓ do painel). */
export function chamadosNaTela(): { id: string; el: Element }[] {
  const vistos = new Set<string>();
  const lista: { id: string; el: Element }[] = [];
  document.querySelectorAll("[data-ver-chamado]").forEach((el) => {
    if (el.closest("[data-gaveta]")) return; // links dentro do próprio painel (soluções parecidas) não contam
    const id = el.getAttribute("data-ver-chamado")!;
    if (vistos.has(id)) return;
    vistos.add(id);
    lista.push({ id, el });
  });
  return lista;
}

/**
 * Link para um chamado que, num clique normal, abre o painel de baixo em vez de trocar de página.
 * Ctrl/Cmd/Shift + clique e o botão do meio continuam abrindo a página inteira (ou outra aba).
 */
export function LinkChamado({ id, para, className, children, ...resto }: {
  id: string;
  para: string;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
  draggable?: boolean;
}) {
  const { abrir } = useVerChamado();
  function clique(e: MouseEvent<HTMLAnchorElement>) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    abrir(id, e.currentTarget);
  }
  return (
    <Link to={para} onClick={clique} className={className} data-ver-chamado={id} {...resto}>
      {children}
    </Link>
  );
}
