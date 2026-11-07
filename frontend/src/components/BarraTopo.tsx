import { Plus } from "lucide-react";
import { Link, NavLink, useLocation, useSearchParams } from "react-router";
import { useAuth } from "../lib/auth";
import type { Numeros } from "../lib/numeros";
import { Avatar } from "./Avatar";
import { BotaoTema } from "./BotaoTema";

/**
 * Barra do topo do SERVIDOR no PC (no lugar da barra lateral): quem abre chamado usa poucas telas, então a navegação
 * cabe numa linha e o conteúdo fica com a largura toda. No celular não aparece (lá fica a barra de baixo).
 */
export function BarraTopo({ numeros }: { numeros: Numeros | null }) {
  const { usuario } = useAuth();
  const caminho = useLocation().pathname;
  const [params] = useSearchParams();
  const historico = caminho === "/" && params.get("aba") === "historico";
  const link = (ativo: boolean) =>
    `relative flex h-16 items-center gap-2 border-b-[3px] px-1 font-semibold ${ativo ? "border-acento text-acento" : "border-transparent text-tinta-2 hover:text-tinta"}`;
  return (
    <header className="sticky top-0 z-20 hidden border-b border-linha bg-superficie md:block print:hidden">
      <div className="h-1.5 bg-mar" aria-hidden="true" />
      <div className="flex items-center gap-6 px-8">
        <Link to="/" className="flex shrink-0 items-center gap-2.5" title="Dino Desk">
          <img src="/icone-simples.svg" alt="" className="size-9" />
          <span className="font-display text-xl leading-none font-extrabold tracking-tight">Dino Desk</span>
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-6">
          <NavLink to="/" end className={() => link(caminho === "/" && !historico)} aria-current={caminho === "/" && !historico ? "page" : undefined}>
            Meus chamados
            {!!numeros?.precisaDeVoce && (
              <span className="rounded-full bg-mar-700 px-1.5 text-xs font-bold text-white" title={`${numeros.precisaDeVoce} precisa(m) de você`}>
                {numeros.precisaDeVoce}<span className="sr-only"> precisam de você</span>
              </span>
            )}
          </NavLink>
          <Link to="/?aba=historico" className={link(historico)} aria-current={historico ? "page" : undefined}>Histórico</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link to="/novo" className="btn-primario min-h-11"><Plus className="size-5" aria-hidden="true" /> Novo chamado</Link>
          <BotaoTema />
          {usuario && (
            <NavLink to="/perfil" title="Você" aria-label="Você" className={({ isActive }) => `rounded-full p-0.5 ${isActive ? "ring-2 ring-acento" : "hover:ring-2 hover:ring-linha"}`}>
              <Avatar id={usuario.id} nome={usuario.name} tamanho="md" />
            </NavLink>
          )}
        </div>
      </div>
    </header>
  );
}
