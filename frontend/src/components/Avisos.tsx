import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router";
import { assinarAvisos, avisosAtuais, fecharAviso, type Aviso } from "../lib/avisos";

const ICONE = { ok: CheckCircle2, info: Info, erro: AlertTriangle };
const COR_ICONE = { ok: "text-ok", info: "text-acento", erro: "text-alerta" };

/** Um aviso: some sozinho; com o mouse em cima (ou foco), espera. */
function Item({ a }: { a: Aviso }) {
  const [saindo, setSaindo] = useState(false);
  const [pausado, setPausado] = useState(false);
  const restante = useRef(a.duracao);
  const inicio = useRef(0);

  useEffect(() => {
    if (pausado || saindo) return;
    inicio.current = Date.now();
    const t = window.setTimeout(() => setSaindo(true), restante.current);
    return () => {
      window.clearTimeout(t);
      restante.current -= Date.now() - inicio.current;
    };
  }, [pausado, saindo]);

  useEffect(() => {
    if (!saindo) return;
    const t = window.setTimeout(() => fecharAviso(a.id), 180);
    return () => window.clearTimeout(t);
  }, [saindo, a.id]);

  const Icone = ICONE[a.tipo];
  return (
    <li
      role={a.tipo === "erro" ? "alert" : "status"}
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
      className={`pointer-events-auto flex w-full items-center gap-3 rounded-xl bg-superficie py-2.5 pr-2 pl-3.5 text-sm font-semibold shadow-lg ring-1 ring-linha ${
        saindo ? "aviso-saindo" : "aviso-entrando"
      }`}
    >
      <Icone className={`size-5 shrink-0 ${COR_ICONE[a.tipo]}`} aria-hidden="true" />
      <span className="texto-livre min-w-0 flex-1">{a.texto}</span>
      {a.link && (
        <Link to={a.link.para} onClick={() => setSaindo(true)} className="shrink-0 rounded-lg px-2 py-1 text-acento underline underline-offset-4 hover:bg-mar-50">
          {a.link.rotulo}
        </Link>
      )}
      {a.acao && (
        <button type="button" onClick={() => { a.acao?.fazer(); setSaindo(true); }} className="shrink-0 rounded-lg px-2.5 py-1.5 font-bold text-acento ring-1 ring-acento hover:bg-mar-50">
          {a.acao.rotulo}
        </button>
      )}
      <button type="button" onClick={() => setSaindo(true)} className="grid size-8 shrink-0 place-items-center rounded-lg text-tinta-2 hover:bg-fundo hover:text-tinta" aria-label="Fechar aviso">
        <X className="size-4" />
      </button>
    </li>
  );
}

/**
 * Pilha de avisos rápidos. Fica no canto de cima à direita no PC e no topo, centralizada, no celular;
 * logo abaixo do cabeçalho, sem cobrir a navegação. Montada uma vez no Layout.
 */
export function Avisos() {
  const lista = useSyncExternalStore(assinarAvisos, avisosAtuais);
  return createPortal(
    <ol
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-3 md:top-4 flex flex-col items-center gap-2 px-3 md:right-4 md:left-auto md:w-96 md:items-end md:px-0"
      style={{ zIndex: 90 }}
    >
      {lista.map((a) => <Item key={a.id} a={a} />)}
    </ol>,
    document.body,
  );
}
