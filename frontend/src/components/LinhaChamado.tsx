import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { resumo, tempoRelativo } from "../lib/formato";
import type { Chamado } from "../lib/pb";
import { IconeCategoria } from "./Icone";
import { SeloStatus } from "./Selos";

export function LinhaChamado({ c, para }: { c: Chamado; para: string }) {
  return (
    <li>
      <Link to={para} className="flex items-center gap-3 py-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white ring-1 ring-linha">
          <IconeCategoria nome={c.expand?.categoria?.icone} className="size-5 text-mar-700" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{resumo(c.descricao, 80)}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-tinta-2">
            <span className="font-display font-bold text-tinta">{c.protocolo}</span>
            <span>{tempoRelativo(c.created)}</span>
            <SeloStatus status={c.status} />
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-tinta-2" aria-hidden="true" />
      </Link>
    </li>
  );
}
