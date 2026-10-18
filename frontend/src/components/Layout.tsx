import { BarChart3, ChevronUp, ClipboardList, History, ListOrdered, Plus, SquarePen, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../lib/auth";
import { Avisos } from "./Avisos";
import { Avatar } from "./Avatar";
import { BarraLateral } from "./BarraLateral";
import { PainelChamado } from "./PainelChamado";
import { ehTecnico } from "../lib/pb";
import { useNumeros, VISOES, type Numeros } from "../lib/numeros";

type Item = { para: string; rotulo: string; Icone: typeof Plus; fim?: boolean; destaque?: boolean };

const SOLICITANTE: Item[] = [
  { para: "/", rotulo: "Meus chamados", Icone: ClipboardList, fim: true },
  { para: "/novo", rotulo: "Novo chamado", Icone: Plus, destaque: true },
];
const TECNICO: Item[] = [
  { para: "/ti", rotulo: "Fila", Icone: ListOrdered, fim: true },
  { para: "/ti/registrar", rotulo: "Registrar", Icone: SquarePen },
  { para: "/ti/historico", rotulo: "Histórico", Icone: History },
  { para: "/ti/painel", rotulo: "Painel", Icone: BarChart3 },
  { para: "/ti/usuarios", rotulo: "Pessoas", Icone: Users },
];

export function Layout() {
  const { usuario } = useAuth();
  const itens = ehTecnico(usuario) ? TECNICO : SOLICITANTE;
  // no passo a passo de novo chamado a barra de baixo some: o único botão no rodapé é o da etapa
  const caminho = useLocation().pathname;
  const focado = caminho === "/novo";
  // "Todos os chamados" é a outra visão da Fila: o item Fila continua marcado, e a página fica mais larga (tabela)
  const ativo = (i: Item, isActive: boolean) => isActive || (i.para === "/ti" && caminho === "/ti/chamados");
  const numeros = useNumeros();
  const tecnico = ehTecnico(usuario);
  const [params] = useSearchParams();
  const navegar = useNavigate();
  // celular, técnico: tocar de novo em "Fila" (já estando nela) abre o menu das visões
  const [menuFila, setMenuFila] = useState(false);
  useEffect(() => setMenuFila(false), [caminho, params]);
  const largura = caminho === "/ti/chamados" || caminho === "/ti/registrar" || focado ? "max-w-7xl" : "max-w-5xl";

  return (
    // PC: barra lateral à esquerda + conteúdo. Celular: topo + barra de baixo (a lateral não aparece).
    <div className="md:flex">
    <BarraLateral numeros={numeros} />
    <div className={`flex min-h-dvh min-w-0 flex-1 flex-col md:pb-0 ${focado ? "" : "pb-[calc(76px+env(safe-area-inset-bottom))]"}`}>
      {/* celular: topo FINO (dino pequeno + avatar), para sobrar tela para o conteúdo. O nome "Dino Desk" fica
          na tela de entrar, na aba do navegador e na barra lateral do PC. O tema fica em Perfil. */}
      <header className="sticky top-0 z-20 print:hidden border-t-[3px] border-mar bg-superficie/95 backdrop-blur md:hidden">
        <div className={`mx-auto flex h-12 items-center gap-3 px-4 ${largura}`}>
          <NavLink to={itens[0].para} className="mr-auto flex items-center" aria-label="Dino Desk: início">
            <img src="/icone-simples.svg" alt="" className="size-8" />
          </NavLink>
          {/* o avatar leva ao perfil (é lá que ficam o tema e o "Sair da conta") */}
          <NavLink
            to="/perfil"
            className={({ isActive }) => `flex min-h-10 items-center gap-2 rounded-full p-1 sm:pr-3 ${isActive ? "bg-mar-50 text-acento" : "text-tinta-2 hover:bg-fundo hover:text-tinta"}`}
            aria-label="Meu perfil"
          >
            {usuario && <Avatar id={usuario.id} nome={usuario.name} tamanho="sm" />}
            <span className="hidden max-w-40 truncate text-sm font-semibold sm:block">{usuario?.name}</span>
          </NavLink>
        </div>
      </header>

      {/* com o painel do chamado aberto no PC, sobra espaço embaixo para a lista rolar inteira acima dele */}
      <main className={`mx-auto w-full flex-1 px-4 pt-5 pb-8 md:px-8 md:pt-8 ${largura}`} style={{ paddingBottom: "calc(2rem + var(--altura-painel, 0px))" }}>
        <Outlet />
        <Avisos />
        <PainelChamado />
      </main>

      {/* barra inferior no celular */}
      {!focado && <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-20 print:hidden border-t border-linha bg-superficie pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="flex">
          {itens.map((i) => (
            <li key={i.para} className="relative flex-1">
              <NavLink
                to={i.para}
                end={i.fim}
                onClick={(e) => {
                  if (tecnico && i.para === "/ti" && caminho === "/ti") { e.preventDefault(); setMenuFila((m) => !m); }
                }}
                aria-haspopup={tecnico && i.para === "/ti" ? "menu" : undefined}
                aria-expanded={tecnico && i.para === "/ti" ? menuFila : undefined}
                className={({ isActive: marcado }) => { const isActive = ativo(i, marcado); return (
                  i.destaque
                    ? "m-2 flex h-[60px] items-center justify-center gap-2 rounded-xl bg-mar-700 font-bold text-white"
                    : `flex h-[76px] flex-col items-center justify-center gap-1 text-sm font-semibold ${
                        isActive ? "text-acento" : "text-tinta-2"
                      }`
                ); }}
              >
                <span className="relative">
                  <i.Icone className="size-6" aria-hidden="true" />
                  <SeloMenu i={i} numeros={numeros} tecnico={tecnico} />
                </span>
                <span className="flex items-center gap-0.5">
                  {i.rotulo}
                  {/* na Fila: setinha avisa que tocar de novo abre as visões */}
                  {tecnico && i.para === "/ti" && caminho === "/ti" && <ChevronUp className={`size-3.5 transition-transform ${menuFila ? "rotate-180" : ""}`} aria-hidden="true" />}
                </span>
              </NavLink>
              {tecnico && i.para === "/ti" && menuFila && (
                <MenuVisoes numeros={numeros} atual={params.get("visao")} aoEscolher={(v) => { setMenuFila(false); navegar(v ? `/ti?visao=${v}` : "/ti"); }} aoFechar={() => setMenuFila(false)} />
              )}
            </li>
          ))}
        </ul>
      </nav>}
    </div>
    </div>
  );
}

/** Número no ícone da barra de baixo: servidor = quantos precisam dele (responder ou confirmar); TI = fila. */
function SeloMenu({ i, numeros, tecnico }: { i: Item; numeros: Numeros | null; tecnico: boolean }) {
  const n = !numeros ? 0 : tecnico ? (i.para === "/ti" ? numeros.fila : 0) : i.para === "/" ? numeros.precisaDeVoce : 0;
  if (!n) return null;
  const alerta = tecnico && !!numeros?.atrasados;
  return (
    <span
      className={`absolute -top-1.5 -right-3 grid min-w-5 place-items-center rounded-full px-1 text-[11px] leading-5 font-bold text-white ${alerta ? "bg-brasa" : "bg-mar-700"}`}
      aria-label={tecnico ? `${n} na fila` : `${n} precisa(m) de você`}
    >
      {n}
    </span>
  );
}

/** Menu que sobe do ícone "Fila" (celular): as visões rápidas, com os números. */
function MenuVisoes({ numeros, atual, aoEscolher, aoFechar }: {
  numeros: Numeros | null;
  atual: string | null;
  aoEscolher: (v: string) => void;
  aoFechar: () => void;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fora = (e: PointerEvent) => { if (!caixa.current?.parentElement?.contains(e.target as Node)) aoFechar(); };
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    document.addEventListener("pointerdown", fora);
    window.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("pointerdown", fora); window.removeEventListener("keydown", tecla); };
  }, [aoFechar]);
  const opcoes = [{ id: "", rotulo: "Fila completa", Icone: ListOrdered, total: numeros?.fila }, ...VISOES.map((v) => ({ id: v.id as string, rotulo: v.rotulo as string, Icone: v.Icone, total: numeros?.[v.id] }))];
  return (
    <div
      ref={caixa}
      role="menu"
      aria-label="Visões da fila"
      className="absolute bottom-full left-2 mb-2 w-60 overflow-hidden rounded-2xl bg-superficie p-1.5 shadow-2xl ring-1 ring-linha"
    >
      {opcoes.map((o) => {
        const ativo = (atual ?? "") === o.id;
        return (
          <Link
            key={o.id || "tudo"}
            to={o.id ? `/ti?visao=${o.id}` : "/ti"}
            role="menuitem"
            aria-current={ativo ? "true" : undefined}
            onClick={(e) => { e.preventDefault(); aoEscolher(o.id); }}
            className={`flex min-h-12 items-center gap-3 rounded-xl px-3 font-semibold ${ativo ? "bg-mar-50 text-acento" : "text-tinta hover:bg-fundo"}`}
          >
            <o.Icone className="size-5 shrink-0" aria-hidden="true" />
            <span className="flex-1">{o.rotulo}</span>
            {o.total !== undefined && <span className="font-display text-tinta-2">{o.total}</span>}
          </Link>
        );
      })}
    </div>
  );
}
