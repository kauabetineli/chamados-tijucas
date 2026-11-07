import type { ReactNode } from "react";
import { Link } from "react-router";

/**
 * Cabeçalho de página: o título fica SEMPRE no mesmo lugar e na mesma altura em todas as telas
 * (o conteúdo começa alinhado à esquerda, no Layout). Ações à direita, abas embaixo.
 * Sem margem própria: a página usa space-y-* (ou passe className="mb-6").
 *
 *   <CabecalhoPagina titulo="Fila" subtitulo="31 na fila" acoes={<button className="btn-primario">…</button>}
 *     abas={<AbasPagina rotulo="Visões" itens={[{ rotulo: "Fila", para: "/ti", ativo: true }]} />} />
 */
export function CabecalhoPagina({ titulo, subtitulo, acoes, abas, className = "" }: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  acoes?: ReactNode;
  abas?: ReactNode;
  className?: string;
}) {
  return (
    <header className={className}>
      <div className="flex min-h-[4.5rem] flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-3xl leading-tight font-bold break-words">{titulo}</h1>
          {subtitulo && <div className="mt-1 text-tinta-2">{subtitulo}</div>}
        </div>
        {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
      </div>
      {abas && <div className="mt-3">{abas}</div>}
    </header>
  );
}

export interface ItemAba {
  rotulo: ReactNode;
  /** link (troca de página) ou ação (troca de aba na mesma página) */
  para?: string;
  aoClicar?: () => void;
  ativo: boolean;
  numero?: number;
}

/** Abas sublinhadas logo abaixo do título (as mesmas em todas as telas). */
export function AbasPagina({ itens, rotulo }: { itens: ItemAba[]; rotulo: string }) {
  return (
    <nav aria-label={rotulo} className="-mb-px flex gap-6 overflow-x-auto border-b border-linha">
      {itens.map((i, n) => {
        const classe = `flex min-h-11 shrink-0 items-center gap-1.5 border-b-[3px] px-0.5 font-semibold whitespace-nowrap ${
          i.ativo ? "border-acento font-bold text-acento" : "border-transparent text-tinta-2 hover:text-tinta"
        }`;
        const conteudo = <>{i.rotulo}{i.numero !== undefined && <span className={i.ativo ? "" : "text-tinta-2"}>{i.numero}</span>}</>;
        return i.para
          ? <Link key={n} to={i.para} aria-current={i.ativo ? "page" : undefined} className={classe}>{conteudo}</Link>
          : <button key={n} type="button" aria-pressed={i.ativo} onClick={i.aoClicar} className={classe}>{conteudo}</button>;
      })}
    </nav>
  );
}
