import {
  BarChart3, ChevronsLeft, ChevronsRight, ClipboardList, History, ListOrdered, Plus, SquarePen, Table2, Users,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as KE, type PointerEvent as PE } from "react";
import { Link, NavLink, useLocation, useSearchParams } from "react-router";
import { useAuth } from "../lib/auth";
import { atrasado } from "../lib/fila";
import { ehAdmin, ehTecnico, pb, type Chamado } from "../lib/pb";
import { useRealtime } from "../lib/useRealtime";
import { Avatar } from "./Avatar";
import { BotaoTema } from "./BotaoTema";
import { MuralAvisos } from "./MuralAvisos";

const MIN = 200, MAX = 380, PADRAO = 256, RECOLHIDA = 76;
const CHAVE_LARGURA = "dinodesk:lateral-largura";
const CHAVE_RECOLHIDA = "dinodesk:lateral-recolhida";

function ler(chave: string) {
  try { return localStorage.getItem(chave); } catch { return null; }
}
function gravar(chave: string, valor: string) {
  try { localStorage.setItem(chave, valor); } catch { /* ok */ }
}

/** Números ao vivo da barra: fila (aguardando e atrasados) para o TI; em aberto para o servidor. */
function useNumeros() {
  const { usuario } = useAuth();
  const tecnico = ehTecnico(usuario);
  const [n, setN] = useState<{ fila: number; atrasados: number; meus: number } | null>(null);
  const carregar = useCallback(async () => {
    if (!usuario) return;
    if (tecnico) {
      const abertos = await pb.collection("chamados").getFullList<Chamado>({
        filter: 'status = "aberto"', fields: "id,created,prioridade,status", requestKey: "lateral-fila",
      });
      setN({ fila: abertos.length, atrasados: abertos.filter((c) => atrasado(c)).length, meus: 0 });
    } else {
      const r = await pb.collection("chamados").getList(1, 1, {
        filter: pb.filter('solicitante = {:u} && (status != "resolvido" || confirmado = false)', { u: usuario.id }),
        fields: "id", requestKey: "lateral-meus",
      });
      setN({ fila: 0, atrasados: 0, meus: r.totalItems });
    }
  }, [usuario, tecnico]);
  useEffect(() => {
    carregar().catch(() => {});
    const t = window.setInterval(() => carregar().catch(() => {}), 60_000); // "atrasado" muda com o tempo
    return () => window.clearInterval(t);
  }, [carregar]);
  useRealtime("chamados", () => carregar().catch(() => {}));
  return n;
}

type Item = { para: string; rotulo: string; Icone: typeof Plus; ativo: boolean; numero?: number; alerta?: number; so?: "admin" };

/**
 * Barra lateral do PC (md+). Recolhe para só ícones e muda de largura arrastando a borda direita
 * (ou com as setas do teclado na alça); as duas escolhas ficam guardadas no aparelho.
 * Define --largura-lateral no <html> para o painel do chamado e os avisos rápidos não ficarem por baixo dela.
 * No celular não aparece (lá ficam o topo e a barra de baixo, em Layout.tsx).
 */
export function BarraLateral() {
  const { usuario } = useAuth();
  const tecnico = ehTecnico(usuario);
  const caminho = useLocation().pathname;
  const [params] = useSearchParams();
  const numeros = useNumeros();

  const [largura, setLargura] = useState(() => {
    const v = Number(ler(CHAVE_LARGURA));
    return v >= MIN && v <= MAX ? v : PADRAO;
  });
  // primeira vez: em tela menor (notebook), começa recolhida
  const [recolhida, setRecolhida] = useState(() => {
    const v = ler(CHAVE_RECOLHIDA);
    return v === null ? window.innerWidth < 1280 : v === "1";
  });
  const [arrastando, setArrastando] = useState(false);
  const inicio = useRef<{ x: number; largura: number; recolhida: boolean } | null>(null);
  const atual = recolhida ? RECOLHIDA : largura;

  useEffect(() => {
    const raiz = document.documentElement;
    const mq = window.matchMedia("(min-width: 768px)");
    const aplicar = () => raiz.style.setProperty("--largura-lateral", mq.matches ? `${atual}px` : "0px");
    aplicar();
    mq.addEventListener("change", aplicar);
    return () => { mq.removeEventListener("change", aplicar); raiz.style.removeProperty("--largura-lateral"); };
  }, [atual]);

  function recolher(v: boolean) {
    setRecolhida(v);
    gravar(CHAVE_RECOLHIDA, v ? "1" : "0");
  }

  const alca = {
    onPointerDown: (e: PE) => {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      inicio.current = { x: e.clientX, largura: atual, recolhida };
      setArrastando(true);
    },
    onPointerMove: (e: PE) => {
      const i = inicio.current;
      if (!i) return;
      const nova = i.largura + (e.clientX - i.x);
      // puxou bem para a esquerda: recolhe; puxou para a direita estando recolhida: abre
      if (nova < MIN - 50) { if (!recolhida) setRecolhida(true); return; }
      if (recolhida) setRecolhida(false);
      setLargura(Math.min(MAX, Math.max(MIN, nova)));
    },
    onPointerUp: () => {
      inicio.current = null;
      setArrastando(false);
      gravar(CHAVE_LARGURA, String(largura));
      gravar(CHAVE_RECOLHIDA, recolhida ? "1" : "0");
    },
    onDoubleClick: () => { setLargura(PADRAO); gravar(CHAVE_LARGURA, String(PADRAO)); recolher(false); },
    onKeyDown: (e: KE) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      if (recolhida) { if (e.key === "ArrowRight") recolher(false); return; }
      const nova = largura + (e.key === "ArrowRight" ? 16 : -16);
      if (nova < MIN) { recolher(true); return; }
      const v = Math.min(MAX, nova);
      setLargura(v);
      gravar(CHAVE_LARGURA, String(v));
    },
  };

  const aba = params.get("aba");
  const itens: Item[] = tecnico
    ? [
        { para: "/ti", rotulo: "Fila", Icone: ListOrdered, ativo: caminho === "/ti", numero: numeros?.fila, alerta: numeros?.atrasados },
        { para: "/ti/chamados", rotulo: "Todos os chamados", Icone: Table2, ativo: caminho === "/ti/chamados" },
        { para: "/ti/registrar", rotulo: "Registrar pedido", Icone: SquarePen, ativo: caminho === "/ti/registrar" },
        { para: "/ti/historico", rotulo: "Histórico", Icone: History, ativo: caminho === "/ti/historico" },
        { para: "/ti/painel", rotulo: "Painel", Icone: BarChart3, ativo: caminho === "/ti/painel" },
        { para: "/ti/usuarios", rotulo: ehAdmin(usuario) ? "Pessoas e setores" : "Pessoas", Icone: Users, ativo: caminho === "/ti/usuarios" },
      ]
    : [
        { para: "/", rotulo: "Meus chamados", Icone: ClipboardList, ativo: caminho === "/" && aba !== "historico", numero: numeros?.meus },
        { para: "/?aba=historico", rotulo: "Histórico", Icone: History, ativo: caminho === "/" && aba === "historico" },
      ];

  return (
    <aside
      aria-label="Menu"
      className={`group/lateral sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-linha bg-superficie md:flex print:hidden ${arrastando ? "select-none" : "transition-[width] duration-150"}`}
      style={{ width: atual }}
    >
      <div className="h-1.5 shrink-0 bg-mar" aria-hidden="true" />

      {/* marca */}
      <Link to={tecnico ? "/ti" : "/"} className={`flex shrink-0 items-center gap-2.5 py-4 ${recolhida ? "justify-center" : "px-4"}`} title="Dino Desk">
        <img src="/icone-simples.svg" alt="" className="size-10 shrink-0" />
        {!recolhida && <span className="truncate font-display text-2xl leading-none font-extrabold tracking-tight">Dino Desk</span>}
      </Link>

      {!tecnico && (
        <div className={`shrink-0 pb-3 ${recolhida ? "flex justify-center" : "px-3"}`}>
          <Link to="/novo" className={recolhida ? "grid size-11 place-items-center rounded-xl bg-mar-700 text-white hover:bg-noite" : "btn-primario w-full"} title="Novo chamado" aria-label={recolhida ? "Novo chamado" : undefined}>
            <Plus className="size-5" aria-hidden="true" /> {!recolhida && "Novo chamado"}
          </Link>
        </div>
      )}

      {/* navegação */}
      <nav aria-label="Principal" className={`shrink-0 space-y-0.5 ${recolhida ? "px-2" : "px-3"}`}>
        {itens.map((i) => (
          <NavLink
            key={i.para}
            to={i.para}
            title={recolhida ? i.rotulo : undefined}
            aria-current={i.ativo ? "page" : undefined}
            className={`relative flex min-h-11 items-center gap-3 rounded-xl font-semibold ${recolhida ? "justify-center" : "px-3"} ${
              i.ativo ? "bg-mar-50 text-acento" : "text-tinta-2 hover:bg-fundo hover:text-tinta"
            }`}
          >
            <i.Icone className="size-5 shrink-0" aria-hidden="true" />
            {!recolhida && <span className="min-w-0 flex-1 truncate">{i.rotulo}</span>}
            {!recolhida && i.numero !== undefined && (
              <span className="flex items-center gap-1.5">
                {!!i.alerta && <span className="rounded-full bg-brasa-50 px-1.5 text-xs font-bold text-alerta" title={`${i.alerta} atrasado(s)`}>{i.alerta}</span>}
                <span className="font-display text-base">{i.numero}</span>
              </span>
            )}
            {recolhida && !!i.numero && (
              <span className={`absolute top-1 right-1 grid min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold text-white ${i.alerta ? "bg-brasa" : "bg-mar-700"}`}>{i.numero}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* avisos do TI */}
      <div className={`mt-5 min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-linha pt-4 ${recolhida ? "px-2" : "px-3"}`}>
        <MuralAvisos compacto={recolhida} aoExpandir={() => recolher(false)} />
      </div>

      {/* pessoa, tema e recolher */}
      <div className={`flex shrink-0 items-center gap-1 border-t border-linha py-2 ${recolhida ? "flex-col px-2" : "px-2"}`}>
        <NavLink
          to="/perfil"
          title="Meu perfil"
          className={({ isActive }) => `flex min-h-11 min-w-0 items-center gap-2.5 rounded-xl p-1.5 ${recolhida ? "" : "flex-1 pr-2"} ${isActive ? "bg-mar-50 text-acento" : "hover:bg-fundo"}`}
        >
          {usuario && <Avatar id={usuario.id} nome={usuario.name} tamanho="sm" />}
          {!recolhida && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{usuario?.name}</span>
              <span className="block truncate text-xs text-tinta-2">{ehAdmin(usuario) ? "Admin do TI" : tecnico ? "Técnico do TI" : (usuario?.expand?.setor?.nome ?? "Meu perfil")}</span>
            </span>
          )}
        </NavLink>
        <BotaoTema />
        <button
          type="button"
          onClick={() => recolher(!recolhida)}
          className="grid size-10 place-items-center rounded-lg text-tinta-2 hover:bg-mar-50 hover:text-tinta"
          aria-label={recolhida ? "Abrir o menu" : "Recolher o menu"}
          title={recolhida ? "Abrir o menu" : "Recolher o menu"}
        >
          {recolhida ? <ChevronsRight className="size-5" /> : <ChevronsLeft className="size-5" />}
        </button>
      </div>

      {/* alça de largura: arrastar a borda direita (duplo clique volta ao padrão) */}
      <div
        {...alca}
        role="separator"
        tabIndex={0}
        aria-orientation="vertical"
        aria-label="Largura do menu (setas para ajustar)"
        aria-valuemin={RECOLHIDA}
        aria-valuemax={MAX}
        aria-valuenow={atual}
        title="Arraste para mudar a largura · duplo clique volta ao padrão"
        className="absolute inset-y-0 -right-1.5 z-10 w-3 cursor-col-resize touch-none focus-visible:outline-none"
      >
        <span className={`mx-auto block h-full w-0.5 ${arrastando ? "bg-acento" : "bg-transparent group-hover/lateral:bg-linha hover:!bg-acento"}`} aria-hidden="true" />
      </div>
    </aside>
  );
}
