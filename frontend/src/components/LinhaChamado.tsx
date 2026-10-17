import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { resumo, tempoRelativo } from "../lib/formato";
import type { Chamado } from "../lib/pb";
import { IconeCategoria } from "./Icone";
import { SeloStatus, SeloTeste } from "./Selos";

export function LinhaChamado({ c, para, novidade }: { c: Chamado; para: string; novidade?: boolean }) {
  return (
    <li>
      <Link to={para} className="flex items-center gap-3 py-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-superficie ring-1 ring-linha">
          <IconeCategoria nome={c.expand?.categoria?.icone} className="size-5 text-acento" />
        </span>
        {/* mesmo desenho do cartão da fila: 1 identidade (não quebra) · 2 problema · 3 detalhes */}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 whitespace-nowrap">
            <span className="font-display font-bold">{c.protocolo}</span>
            <SeloStatus status={c.status} />
            {novidade && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-mar-700 px-2 py-0.5 text-xs font-bold text-white">
                <span className="size-2 rounded-full bg-sol" aria-hidden="true" /> Novo
              </span>
            )}
          </span>
          <span className="mt-1 block truncate font-semibold">{resumo(c.descricao, 80)}</span>
          <span className="mt-0.5 flex min-w-0 items-center gap-2 text-sm whitespace-nowrap text-tinta-2">
            <span className="truncate">{c.expand?.categoria?.nome}</span>
            <span aria-hidden="true">·</span>
            <span className="shrink-0">{tempoRelativo(c.created)}</span>
            {c.ficticio && <span className="ml-auto shrink-0"><SeloTeste ficticio compacto /></span>}
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-tinta-2" aria-hidden="true" />
      </Link>
    </li>
  );
}
