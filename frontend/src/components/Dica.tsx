import { Info } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

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
  const [lado, setLado] = useState<"esquerda" | "direita" | "centro">("esquerda");
  const caixa = useRef<HTMLSpanElement>(null);
  const balao = useRef<HTMLSpanElement>(null);
  const [desvio, setDesvio] = useState(0); // empurra o balão para dentro da tela
  const passou = useRef(false); // abriu pelo mouse: o clique seguinte não fecha
  const gerado = useId();
  const idBalao = id ?? `dica-${gerado}`;

  useEffect(() => {
    if (!aberta) return;
    // o balão cresce para o lado em que há espaço
    const r = caixa.current?.getBoundingClientRect();
    if (r) {
      const meio = (r.left + r.right) / 2 / window.innerWidth;
      setLado(meio > 0.35 && meio < 0.65 ? "centro" : meio >= 0.65 ? "direita" : "esquerda");
    }
    // depois de desenhar: se ainda passar da borda, empurra para dentro (16 px de margem)
    const quadro = requestAnimationFrame(() => {
      const b = balao.current?.getBoundingClientRect();
      if (!b) return;
      const margem = 16;
      setDesvio(b.right > window.innerWidth - margem ? window.innerWidth - margem - b.right : b.left < margem ? margem - b.left : 0);
    });
    const fora = (e: PointerEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberta(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAberta(false); };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      cancelAnimationFrame(quadro);
      setDesvio(0);
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberta, lado]);

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
        onClick={() => { if (passou.current) { passou.current = false; setAberta(true); } else setAberta(!aberta); }}
        className={texto
          ? "min-h-11 px-1 text-sm font-semibold text-acento underline-offset-4 hover:underline"
          : "-m-2.5 grid size-10 place-items-center rounded-full text-tinta-2 hover:text-acento focus-visible:text-acento"}
      >
        {texto ?? <Info className="size-4" aria-hidden="true" />}
      </button>
      {/* sempre no DOM (escondido) para o aria-describedby funcionar */}
      <span
        ref={balao}
        id={idBalao}
        role="tooltip"
        style={desvio ? { translate: `${desvio}px 0` } : undefined}
        hidden={!aberta}
        className={`absolute top-full z-40 mt-1 w-max max-w-[min(18rem,calc(100vw-2rem))] rounded-xl bg-noite px-3.5 py-2.5 text-left text-sm leading-snug font-normal text-white shadow-lg ring-1 ring-white/10 ${
          lado === "direita" ? "-right-2" : lado === "centro" ? "left-1/2 -translate-x-1/2" : "-left-2"
        }`}
      >
        {children}
      </span>
    </span>
  );
}

/** id do balão de um campo, para o aria-describedby do campo. */
export const idDaDica = (campo: string) => `dica-${campo}`;

/** Rótulo do campo com o "i" ao lado. */
export function RotuloComDica({ htmlFor, dica, children, className = "rotulo" }: { htmlFor: string; dica: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={`flex items-center gap-1.5 ${className}`}>
      <label htmlFor={htmlFor}>{children}</label>
      <Dica id={idDaDica(htmlFor)} rotulo={`Ajuda sobre ${typeof children === "string" ? children.toLowerCase() : "este campo"}`}>{dica}</Dica>
    </span>
  );
}
