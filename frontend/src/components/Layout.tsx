import { BarChart3, ClipboardList, History, ListOrdered, Plus, SquarePen, Users } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router";
import { useAuth } from "../lib/auth";
import { Avisos } from "./Avisos";
import { Avatar } from "./Avatar";
import { BarraLateral } from "./BarraLateral";
import { PainelChamado } from "./PainelChamado";
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
  const { usuario } = useAuth();
  const itens = ehTecnico(usuario) ? TECNICO : SOLICITANTE;
  // no passo a passo de novo chamado a barra de baixo some: o único botão no rodapé é o da etapa
  const caminho = useLocation().pathname;
  const focado = caminho === "/novo";
  // "Todos os chamados" é a outra visão da Fila: o item Fila continua marcado, e a página fica mais larga (tabela)
  const ativo = (i: Item, isActive: boolean) => isActive || (i.para === "/ti" && caminho === "/ti/chamados");
  const largura = caminho === "/ti/chamados" || caminho === "/ti/registrar" || focado ? "max-w-7xl" : "max-w-5xl";

  return (
    // PC: barra lateral à esquerda + conteúdo. Celular: topo + barra de baixo (a lateral não aparece).
    <div className="md:flex">
    <BarraLateral />
    <div className={`flex min-h-dvh min-w-0 flex-1 flex-col md:pb-0 ${focado ? "" : "pb-[calc(76px+env(safe-area-inset-bottom))]"}`}>
      <header className="sticky top-0 z-20 print:hidden border-t-[6px] border-mar bg-superficie/95 backdrop-blur md:hidden">
        <div className={`mx-auto flex items-center gap-4 px-4 py-3 ${largura}`}>
          <NavLink to={itens[0].para} className="mr-auto flex items-center gap-2.5">
            <img src="/icone-simples.svg" alt="" className="size-10" />
            <span className="font-display text-2xl leading-none font-extrabold tracking-tight md:text-3xl">Dino Desk</span>
          </NavLink>


          <div className="flex items-center gap-1">
            <BotaoTema />
            {/* o próprio nome leva ao perfil (é lá que fica o "Sair da conta") */}
            <NavLink
              to="/perfil"
              className={({ isActive }) => `flex min-h-10 items-center gap-2 rounded-full py-1 pr-1 pl-1 sm:pr-3 ${isActive ? "bg-mar-50 text-acento" : "text-tinta-2 hover:bg-fundo hover:text-tinta"}`}
              aria-label="Meu perfil"
            >
              {usuario && <Avatar id={usuario.id} nome={usuario.name} tamanho="sm" />}
              <span className="hidden max-w-40 truncate text-sm font-semibold sm:block">{usuario?.name}</span>
            </NavLink>
          </div>
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
    </div>
  );
}
