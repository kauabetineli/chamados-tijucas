import { Check, Undo2, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Usuario } from "../lib/pb";
import { Avatar } from "./Avatar";

/**
 * Casca das janelas rápidas da fila (ações, atribuir).
 * Celular: painel que sobe de baixo. PC: janela centralizada.
 * Cabeçalho e rodapé ficam fixos; só o meio rola.
 * Esc, o X e o clique fora chamam `aoTentarFechar` (quem usa decide se pergunta antes de descartar).
 */
export function PainelRapido({ titulo, idTitulo, subtitulo, largura = "max-w-lg", aoTentarFechar, rodape, children }: {
  titulo: ReactNode;
  idTitulo: string;
  subtitulo?: ReactNode;
  largura?: string;
  aoTentarFechar: () => void;
  rodape?: ReactNode;
  children: ReactNode;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const fechar = useRef(aoTentarFechar);
  fechar.current = aoTentarFechar;

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && fechar.current();
    window.addEventListener("keydown", tecla);
    // foco dentro da janela (teclado e leitor de tela começam por ela)
    caixa.current?.focus();
    // a página de trás não rola enquanto a janela está aberta
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tecla);
      document.body.style.overflow = antes;
    };
  }, []);

  // portal no <body> + z-index alto em estilo: fica SEMPRE acima da barra de navegação do celular
  return createPortal(
    <div
      className="fixed inset-0 flex items-end justify-center bg-noite/50 md:items-center md:p-6"
      style={{ zIndex: 100 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) fechar.current(); }}
    >
      <div
        ref={caixa}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className={`flex max-h-[92dvh] w-full ${largura} flex-col overflow-hidden rounded-t-2xl bg-superficie shadow-2xl ring-1 ring-linha focus:outline-none md:max-h-[85dvh] md:rounded-2xl`}
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-linha px-5 pt-4 pb-3">
          <div className="min-w-0 flex-1">
            <h2 id={idTitulo} className="font-display text-lg font-bold">{titulo}</h2>
            {subtitulo}
          </div>
          <button type="button" onClick={() => fechar.current()} className="-mr-2 grid size-10 shrink-0 place-items-center rounded-full text-tinta-2 hover:bg-fundo hover:text-tinta" aria-label="Fechar">
            <X className="size-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {rodape && (
          <footer className="shrink-0 border-t border-linha bg-superficie px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            {rodape}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Rótulo de seção do painel, com a marca "alterado" quando o rascunho difere do salvo. */
export function RotuloSecao({ children, alterado, id }: { children: ReactNode; alterado?: boolean; id?: string }) {
  return (
    <p id={id} className="mb-2 flex items-center gap-2 text-sm font-semibold text-tinta-2">
      {children}
      {alterado && <span className="rounded-full bg-mar-50 px-2 py-0.5 text-xs font-bold text-acento">alterado</span>}
    </p>
  );
}

/**
 * Escolha de quem fica com o chamado, como opções (nada é salvo aqui: quem usa confirma depois).
 * Ordem: você, colegas, "Ninguém (fica na fila)".
 */
export function EscolhaResponsavel({ tecnicos, eu, carga, valor, original, aoEscolher, nomeGrupo, colunas = "sm:grid-cols-2" }: {
  tecnicos: Usuario[];
  eu: string;
  carga: Record<string, number>;
  /** escolhido no rascunho ("" = ninguém) */
  valor: string;
  /** o que está salvo hoje */
  original: string;
  aoEscolher: (id: string) => void;
  nomeGrupo: string;
  /** classes de colunas da grade (padrão: 2 colunas a partir do celular deitado) */
  colunas?: string;
}) {
  const ordem = [...tecnicos].sort((a, b) => (a.id === eu ? -1 : b.id === eu ? 1 : 0));
  const opcoes = [
    ...ordem.map((t) => ({ id: t.id, nome: t.id === eu ? "Você" : t.name, completo: t.name })),
    { id: "", nome: "Ninguém", completo: "" },
  ];

  return (
    <div role="radiogroup" aria-label="Quem fica com o chamado" className={`grid gap-2 ${colunas}`}>
      {opcoes.map((o) => {
        const marcado = valor === o.id;
        const total = o.id ? carga[o.id] ?? 0 : 0;
        return (
          <label
            key={o.id || "ninguem"}
            className={`relative flex min-h-14 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 ring-1 transition-colors ${
              marcado ? "bg-mar-50 ring-2 ring-acento" : "ring-linha hover:bg-fundo hover:ring-acento"
            }`}
          >
            <input type="radio" name={nomeGrupo} className="sr-only" checked={marcado} onChange={() => aoEscolher(o.id)} />
            {o.id ? (
              <Avatar id={o.id} nome={o.completo} destaque={o.id === eu} />
            ) : (
              <span className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-dashed border-tinta-2/50 text-tinta-2">
                <Undo2 className="size-4" aria-hidden="true" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{o.nome}</span>
              <span className="block text-sm text-tinta-2">
                {!o.id ? "Fica livre na fila" : o.id === original ? "Está com o chamado" : total ? `Já tem ${total} chamado${total > 1 ? "s" : ""}` : "Sem chamados agora"}
              </span>
            </span>
            {marcado && <Check className="size-5 shrink-0 text-acento" aria-hidden="true" />}
          </label>
        );
      })}
    </div>
  );
}

/** Botões de rodapé "Descartar / Salvar", com contagem de mudanças e a pergunta antes de sair sem salvar. */
export function RodapeRascunho({ mudancas, saindo, salvando, rotuloSalvar, aoSalvar, aoDescartar, aoContinuar, aoSairSemSalvar, semMudancas }: {
  mudancas: number;
  /** o usuário tentou fechar com alterações pendentes */
  saindo: boolean;
  salvando: boolean;
  rotuloSalvar: string;
  aoSalvar: () => void;
  aoDescartar: () => void;
  aoContinuar: () => void;
  aoSairSemSalvar: () => void;
  /** o que mostrar quando não há nada para salvar */
  semMudancas: ReactNode;
}) {
  if (saindo) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center" role="alertdialog" aria-label="Alterações não salvas">
        <p className="flex-1 font-semibold">
          Sair sem salvar?
          <span className="block text-sm font-normal text-tinta-2">{mudancas === 1 ? "1 alteração será perdida." : `${mudancas} alterações serão perdidas.`}</span>
        </p>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button type="button" className="btn-perigo" onClick={aoSairSemSalvar}>Descartar</button>
          <button type="button" className="btn-primario" onClick={aoContinuar} autoFocus>Continuar editando</button>
        </div>
      </div>
    );
  }
  if (!mudancas) return <>{semMudancas}</>;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <p className="flex-1 text-sm whitespace-nowrap text-tinta-2">
        <b className="text-tinta">{mudancas === 1 ? "1 alteração" : `${mudancas} alterações`}</b> não salva{mudancas > 1 ? "s" : ""}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <button type="button" className="btn-secundario" onClick={aoDescartar} disabled={salvando}>Descartar</button>
        <button type="button" className="btn-primario" onClick={aoSalvar} disabled={salvando} title="Atalho: Ctrl+Enter">
          {salvando ? "Salvando..." : rotuloSalvar}
        </button>
      </div>
    </div>
  );
}
