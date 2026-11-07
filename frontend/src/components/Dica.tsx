import { Info } from "lucide-react";
import { useCallback, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * O "i" de ajuda: em vez de um texto explicativo fixo embaixo do campo, um ícone discreto que abre um balão curto.
 * Abre com toque/clique (celular e PC) e também ao passar o mouse; fecha com Esc, tocando fora ou de novo no "i".
 * O texto também fica ligado ao campo por aria-describedby (quem usa leitor de tela ouve sem abrir).
 *
 *   <RotuloComDica htmlFor="matricula" dica="Quem tem e-mail cadastrado também pode entrar com ele.">Matrícula</RotuloComDica>
 *   <input id="matricula" aria-describedby={idDaDica("matricula")} … />
 *
 * Use para ajuda que a maioria não precisa ler. O que é obrigatório saber (um erro, um aviso) continua visível na tela.
 */
export function Dica({ children, rotulo = "Ajuda", id, texto }: {
  children: ReactNode;
  rotulo?: string;
  id?: string;
  /** no lugar do "i", um texto clicável (ex.: "Não consegue entrar?") */
  texto?: string;
}) {
  const [aberta, setAberta] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const caixa = useRef<HTMLSpanElement>(null);
  const balao = useRef<HTMLSpanElement>(null);
  const passou = useRef(false); // abriu pelo mouse: o clique seguinte não fecha
  const gerado = useId();
  const idBalao = id ?? `dica-${gerado}`;

  // O balão fica no fim da página (portal), por cima de tudo: assim nenhuma caixa com overflow-hidden o corta
  // (tabelas, cartões, a lista da Fila). A posição vem do "i": embaixo dele (ou em cima, se não couber),
  // sempre com 16 px de margem da borda da tela.
  const posicionar = useCallback(() => {
    const r = caixa.current?.getBoundingClientRect();
    const b = balao.current;
    if (!r || !b) return;
    const margem = 16;
    const w = b.offsetWidth;
    const h = b.offsetHeight;
    const meio = (r.left + r.right) / 2;
    const fracao = meio / window.innerWidth;
    let left = fracao > 0.35 && fracao < 0.65 ? meio - w / 2 : fracao >= 0.65 ? r.right + 8 - w : r.left - 8;
    left = Math.max(margem, Math.min(left, window.innerWidth - margem - w));
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 8 && r.top - 6 - h > 8) top = r.top - 6 - h;
    setPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!aberta) { setPos(null); return; }
    posicionar();
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node;
      if (!caixa.current?.contains(alvo) && !balao.current?.contains(alvo)) setAberta(false);
    };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAberta(false); };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla);
    window.addEventListener("scroll", posicionar, true);
    window.addEventListener("resize", posicionar);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("scroll", posicionar, true);
      window.removeEventListener("resize", posicionar);
    };
  }, [aberta, posicionar]);

  return (
    <span
      ref={caixa}
      className="relative inline-flex align-middle"
      onPointerEnter={(e) => { if (e.pointerType === "mouse") { passou.current = true; setAberta(true); } }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") { passou.current = false; setAberta(false); } }}
    >
      <button
        type="button"
        aria-label={texto ? undefined : rotulo}
        aria-expanded={aberta}
        aria-controls={idBalao}
        onClick={(e) => { e.stopPropagation(); if (passou.current) { passou.current = false; setAberta(true); } else setAberta(!aberta); }}
        className={texto
          ? "min-h-11 px-1 text-sm font-semibold text-acento underline-offset-4 hover:underline"
          : "-m-2.5 grid size-10 place-items-center rounded-full text-tinta-2 hover:text-acento focus-visible:text-acento"}
      >
        {texto ?? <Info className="size-4" aria-hidden="true" />}
      </button>
      {/* sempre no DOM (escondido) para o aria-describedby funcionar */}
      {createPortal(
        <span
          ref={balao}
          id={idBalao}
          role="tooltip"
          hidden={!aberta}
          style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? "visible" : "hidden" }}
          className="fixed z-[120] block w-max max-w-[min(18rem,calc(100vw-2rem))] rounded-xl bg-noite px-3.5 py-2.5 text-left text-sm leading-snug font-normal tracking-normal text-white normal-case shadow-lg ring-1 ring-white/10"
        >
          {children}
        </span>,
        document.body,
      )}
    </span>
  );
}

/** id do balão de um campo, para o aria-describedby do campo. */
export const idDaDica = (campo: string) => `dica-${campo}`;

/** Rótulo do campo com o "i" ao lado. */
export function RotuloComDica({ htmlFor, dica, children, className = "rotulo", nome }: {
  htmlFor: string; dica: ReactNode; children: ReactNode; className?: string;
  /** nome do campo para o leitor de tela ("Ajuda sobre <nome>"), quando o rótulo não é só texto */
  nome?: string;
}) {
  return (
    <span className={`flex items-center gap-1.5 ${className}`}>
      <label htmlFor={htmlFor}>{children}</label>
      <Dica id={idDaDica(htmlFor)} rotulo={`Ajuda sobre ${(nome ?? (typeof children === "string" ? children : "este campo")).toLowerCase()}`}>{dica}</Dica>
    </span>
  );
}
