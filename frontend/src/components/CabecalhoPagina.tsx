import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";

/**
 * Cabeçalho de página: o título fica SEMPRE no mesmo lugar e na mesma altura em todas as telas
 * (o conteúdo começa alinhado à esquerda, no Layout). Ações à direita, abas embaixo.
 * Sem margem própria: a página usa space-y-* (ou passe className="mb-6").
 *
 *   <CabecalhoPagina titulo="Fila" subtitulo="31 na fila" acoes={<button className="btn-primario">…</button>}
 *     abas={<AbasPagina rotulo="Visões" itens={[{ rotulo: "Fila", para: "/ti", ativo: true }]} />} />
 *
 * Seta de voltar (`voltar`): SÓ em página que fica dentro de outra (Você → Painel, Painel → QR code...).
 * Nunca nas abas da barra de baixo (Fila, Registrar, Soluções, Você) nem em Todos os chamados (outra visão da Fila).
 * Por padrão aparece só no celular: no PC essas páginas estão direto na barra lateral. `sempre: true` quando
 * nem no PC há outro caminho de volta (ex.: QR code, aberto pelo Painel).
 */
export function CabecalhoPagina({ titulo, subtitulo, acoes, abas, voltar, className = "" }: {
  titulo: ReactNode;
  voltar?: { para: string; rotulo: string; sempre?: boolean };
  subtitulo?: ReactNode;
  acoes?: ReactNode;
  abas?: ReactNode;
  className?: string;
}) {
  return (
    <header className={className}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 md:min-h-[4.5rem] md:gap-y-3">
        <div className="flex min-w-0 items-start gap-1">
          {voltar && (
            <Link to={voltar.para} aria-label={voltar.rotulo} title={voltar.rotulo}
              className={`-my-1.5 -ml-2.5 grid size-11 shrink-0 place-items-center rounded-full text-acento hover:bg-mar-50 md:-my-1 ${voltar.sempre ? "" : "md:hidden"}`}>
              <ArrowLeft className="size-6" aria-hidden="true" />
            </Link>
          )}
          <div className="min-w-0">
          <h1 className="text-2xl leading-tight font-bold md:text-3xl break-words">{titulo}</h1>
          {subtitulo && <div className="mt-0.5 text-[15px] text-tinta-2 md:mt-1 md:text-base">{subtitulo}</div>}
          </div>
        </div>
        {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
      </div>
      {abas && <div className="mt-2 md:mt-3">{abas}</div>}
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
