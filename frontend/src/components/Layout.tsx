import { BarChart3, ClipboardList, History, ListOrdered, LogOut, Plus, SquarePen, Users } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router";
import { useAuth } from "../lib/auth";
import { Avisos } from "./Avisos";
import { BotaoTema } from "./BotaoTema";
import { ehTecnico } from "../lib/pb";

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
  const { usuario, sair } = useAuth();
  const itens = ehTecnico(usuario) ? TECNICO : SOLICITANTE;
  // no passo a passo de novo chamado a barra de baixo some: o único botão no rodapé é o da etapa
  const caminho = useLocation().pathname;
  const focado = caminho === "/novo";
  // "Todos os chamados" é a outra visão da Fila: o item Fila continua marcado, e a página fica mais larga (tabela)
  const ativo = (i: Item, isActive: boolean) => isActive || (i.para === "/ti" && caminho === "/ti/chamados");
  const largura = caminho === "/ti/chamados" ? "max-w-7xl" : focado ? "max-w-6xl" : "max-w-5xl";

  return (
    <div className={`flex min-h-dvh flex-col md:pb-0 ${focado ? "" : "pb-[calc(76px+env(safe-area-inset-bottom))]"}`}>
      <header className="sticky top-0 z-20 print:hidden border-t-[6px] border-mar bg-superficie/95 backdrop-blur">
        <div className={`mx-auto flex items-center gap-4 px-4 py-3 ${largura}`}>
          <NavLink to={itens[0].para} className="mr-auto flex items-center gap-2.5">
            <img src="/icone-simples.svg" alt="" className="size-10" />
            <span className="font-display text-2xl leading-none font-extrabold tracking-tight md:text-3xl">Dino Desk</span>
          </NavLink>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Principal">
            {itens.map((i) => (
              <NavLink
                key={i.para}
                to={i.para}
                end={i.fim}
                className={({ isActive: marcado }) => { const isActive = ativo(i, marcado); return (
                  `flex items-center gap-2 rounded-lg px-3 py-2 font-semibold ${
                    isActive ? "bg-mar-50 text-acento" : "text-tinta-2 hover:text-tinta"
                  }`
                ); }}
              >
                <i.Icone className="size-5" aria-hidden="true" />
                {i.rotulo}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <BotaoTema />
            <span className="hidden max-w-40 truncate text-sm text-tinta-2 sm:block">{usuario?.name}</span>
            <button onClick={sair} className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-semibold text-tinta-2 hover:text-tinta">
              <LogOut className="size-5" aria-hidden="true" />
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className={`mx-auto w-full flex-1 px-4 pt-5 pb-8 ${largura}`}>
        <Outlet />
        <Avisos />
      </main>

      {/* barra inferior no celular */}
      {!focado && <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-20 print:hidden border-t border-linha bg-superficie pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="flex">
          {itens.map((i) => (
            <li key={i.para} className="flex-1">
              <NavLink
                to={i.para}
                end={i.fim}
                className={({ isActive: marcado }) => { const isActive = ativo(i, marcado); return (
                  i.destaque
                    ? "m-2 flex h-[60px] items-center justify-center gap-2 rounded-xl bg-mar-700 font-bold text-white"
                    : `flex h-[76px] flex-col items-center justify-center gap-1 text-sm font-semibold ${
                        isActive ? "text-acento" : "text-tinta-2"
                      }`
                ); }}
              >
                <i.Icone className="size-6" aria-hidden="true" />
                {i.rotulo}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>}
    </div>
  );
}
