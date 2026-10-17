import { LayoutList, Table2 } from "lucide-react";
import { NavLink } from "react-router";

/** Alterna entre as duas visões do TI: a Fila (o que fazer agora) e Todos os chamados (tabela). */
export function VisaoTI() {
  const aba = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold ${
      isActive ? "bg-mar-700 text-white" : "text-tinta-2 hover:text-tinta"
    }`;
  return (
    <nav aria-label="Visão" className="inline-flex rounded-xl bg-superficie p-1 ring-1 ring-linha">
      <NavLink to="/ti" end className={aba}>
        <LayoutList className="size-4" aria-hidden="true" /> Fila
      </NavLink>
      <NavLink to="/ti/chamados" className={aba}>
        <Table2 className="size-4" aria-hidden="true" /> Todos os chamados
      </NavLink>
    </nav>
  );
}
