import { ChevronRight, UserRound } from "lucide-react";
import { dataCurta, resumo, tempoRelativo } from "../lib/formato";
import type { Chamado } from "../lib/pb";
import { LinkChamado } from "../lib/verChamado";
import { IconeCategoria } from "./Icone";
import { MarcaTeste, SeloStatus } from "./Selos";

/**
 * Linha de chamado das listas do servidor. Clique abre o painel de baixo (Ctrl+clique abre a página).
 * `historico`: mostra quem atendeu, quando resolveu e a solução em uma linha.
 */
export function LinhaChamado({ c, para, novidade, historico, selecionado }: {
  c: Chamado;
  para: string;
  novidade?: boolean;
  historico?: boolean;
  selecionado?: boolean;
}) {
  return (
    <li>
      <LinkChamado
        id={c.id}
        para={para}
        className={`-mx-2 flex items-center gap-3 rounded-xl px-2 py-4 hover:bg-superficie ${selecionado ? "bg-mar-50 ring-2 ring-acento" : ""}`}
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-superficie ring-1 ring-linha">
          <IconeCategoria nome={c.expand?.categoria?.icone} className="size-5 text-acento" />
        </span>
        {/* mesmo desenho da Fila (sistema de sinais): o problema é o título; situação, tempo e protocolo embaixo */}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="min-w-0 truncate font-semibold">{resumo(c.descricao, 80)}</span>
            {novidade && (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-mar-700 px-2 py-0.5 text-xs font-bold text-white">
                <span className="size-2 rounded-full bg-sol" aria-hidden="true" /> Novo
              </span>
            )}
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm whitespace-nowrap text-tinta-2">
            {!historico && <SeloStatus status={c.status} />}
            <span className="min-w-0 truncate">
              {!historico && "· "}
              {historico && c.resolvido_em ? `resolvido em ${dataCurta(c.resolvido_em)}` : tempoRelativo(c.created)}
              {" · "}<span className="tabular-nums">{c.protocolo}</span> <MarcaTeste ficticio={c.ficticio} />
            </span>
          </span>
          {historico && (
            <>
              {c.expand?.responsavel?.name && (
                <span className="mt-1 flex items-center gap-1.5 text-sm text-tinta-2">
                  <UserRound className="size-4 shrink-0" aria-hidden="true" /> Atendido por <b className="text-tinta">{c.expand.responsavel.name}</b>
                </span>
              )}
              {c.solucao && <span className="mt-0.5 block truncate text-sm text-tinta-2">Solução: {c.solucao}</span>}
            </>
          )}
        </span>
        <ChevronRight className="size-5 shrink-0 text-tinta-2" aria-hidden="true" />
      </LinkChamado>
    </li>
  );
}
