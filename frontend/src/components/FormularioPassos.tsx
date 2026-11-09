import { Camera, CheckCircle2, Paperclip, Video, X } from "lucide-react";
import { Dica } from "./Dica";
import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { arrastandoArquivo, type ControleAnexos } from "./Anexos";
import { useMediaQuery } from "../lib/useMediaQuery";

/**
 * Peças dos formulários "em uma coluna numerada" do PC (Novo chamado e Registrar pedido):
 * - Passo: título com o número (vira ✓ quando preenchido);
 * - CaixaComAnexos: caixa de texto que cresce, com anexar/colar/arrastar no rodapé dela (como no e-mail);
 * - RodapeEnviar: faixa do botão no fim do cartão que GRUDA embaixo da tela enquanto o fim não aparece.
 */

export function Passo({ n, titulo, feito, children, id, extra, dica }: {
  n: number;
  titulo: string;
  feito: boolean;
  children: ReactNode;
  id: string;
  /** algo pequeno à direita do título (ex.: "opcional") */
  extra?: ReactNode;
  /** explicação curta no "i" ao lado do título */
  dica?: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-3 md:space-y-4">
      <h2 id={id} className="flex items-center gap-2.5 font-display text-lg font-bold md:gap-3 md:text-xl">
        <span className={`grid size-7 shrink-0 place-items-center rounded-full text-sm md:size-8 ${feito ? "bg-campo-700 text-white" : "bg-mar-50 text-acento"}`}>
          {feito ? <CheckCircle2 className="size-5" aria-hidden="true" /> : n}
        </span>
        <span className="flex flex-1 items-center gap-2">{titulo}{dica && <span className="font-sans text-base font-normal"><Dica rotulo={`Ajuda: ${titulo}`}>{dica}</Dica></span>}</span>
        {extra}
      </h2>
      <div className="md:pl-11">{children}</div>
    </section>
  );
}

export const CaixaComAnexos = forwardRef<HTMLTextAreaElement, {
  id: string;
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  placeholder?: string;
  arquivos: File[];
  setArquivos: Dispatch<SetStateAction<File[]>>;
  anexos: ControleAnexos & { aviso: string };
  rotuloAnexar?: string;
  aceitar?: string;
  /** altura mínima e máxima da caixa (cresce com o texto) */
  min?: number;
  max?: number;
}>(function CaixaComAnexos(
  { id, rotulo, valor, aoMudar, placeholder, arquivos, setArquivos, anexos, rotuloAnexar = "Anexar foto ou vídeo", aceitar = "image/*,video/*", min = 110, max = 360 },
  ref,
) {
  const [sobre, setSobre] = useState(false);
  const toque = useMediaQuery("(pointer: coarse)");
  const interna = useRef<HTMLTextAreaElement | null>(null);
  const previas = useMemo(() => arquivos.map((a) => ({ a, url: URL.createObjectURL(a) })), [arquivos]);
  useEffect(() => () => previas.forEach((p) => URL.revokeObjectURL(p.url)), [previas]);

  useLayoutEffect(() => {
    const el = interna.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(max, Math.max(min, el.scrollHeight + 2))}px`;
  }, [valor, min, max]);

  // arquivo solto fora da caixa não pode fazer o navegador sair da página e perder o texto
  useEffect(() => {
    const bloquear = (e: DragEvent) => { if (e.dataTransfer?.types.includes("Files")) e.preventDefault(); };
    window.addEventListener("dragover", bloquear);
    window.addEventListener("drop", bloquear);
    return () => { window.removeEventListener("dragover", bloquear); window.removeEventListener("drop", bloquear); };
  }, []);

  return (
    <>
      {/* campo único (como GitHub/Linear): texto em cima; embaixo, DENTRO do campo, as miniaturas e os ícones
          de anexar (clipe; câmera só no celular). Sem faixa separada. */}
      <div
        className={`relative rounded-xl bg-superficie ring-1 transition-shadow focus-within:ring-2 focus-within:ring-acento ${sobre ? "ring-2 ring-acento" : "ring-linha"}`}
        onDragEnter={(e) => { if (arrastandoArquivo(e)) { e.preventDefault(); setSobre(true); } }}
        onDragOver={(e) => { if (arrastandoArquivo(e)) e.preventDefault(); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSobre(false); }}
        onDrop={(e) => { if (!e.dataTransfer.files.length) return; e.preventDefault(); setSobre(false); anexos.adicionar(e.dataTransfer.files); }}
      >
        <label htmlFor={id} className="sr-only">{rotulo}</label>
        <textarea
          ref={(el) => {
            interna.current = el;
            if (typeof ref === "function") ref(el); else if (ref) ref.current = el;
          }}
          id={id}
          rows={3}
          className="block w-full resize-none rounded-t-xl bg-transparent px-4 pt-3 pb-1 text-base leading-relaxed text-tinta placeholder:text-tinta-2/70 focus:outline-none"
          placeholder={placeholder}
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
          onPaste={(e) => {
            const imgs = Array.from(e.clipboardData.files);
            if (imgs.length) { e.preventDefault(); anexos.adicionar(imgs); }
          }}
        />
        {previas.length > 0 && (
          <ul className="flex flex-wrap gap-2.5 px-4 pt-2 pb-1" aria-label="Anexos">
            {previas.map(({ a, url }, i) => (
              <li key={url} className="relative">
                <span className="block size-16 overflow-hidden rounded-lg ring-1 ring-linha">
                  {a.type.startsWith("video/") ? (
                    <><video src={url} className="size-full bg-noite object-cover" muted preload="metadata" /><Video className="absolute bottom-1 left-1 size-3.5 text-white" aria-hidden="true" /></>
                  ) : <img src={url} alt={`Anexo ${i + 1}`} className="size-full object-cover" />}
                </span>
                <button
                  type="button"
                  onClick={() => setArquivos((l) => l.filter((x) => x !== a))}
                  className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-superficie text-tinta-2 ring-1 ring-linha hover:text-alerta"
                  aria-label={`Remover anexo ${i + 1}`}
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-0.5 px-1.5 pt-0.5 pb-1.5">
          <label className="grid size-10 cursor-pointer place-items-center rounded-lg text-tinta-2 hover:bg-fundo hover:text-tinta focus-within:ring-2 focus-within:ring-acento" title={rotuloAnexar}>
            <Paperclip className="size-5" aria-hidden="true" />
            <span className="sr-only">{rotuloAnexar}</span>
            <input type="file" accept={aceitar} multiple className="sr-only" onChange={(e) => { anexos.adicionar(e.target.files); e.target.value = ""; }} />
          </label>
          {toque && (
            <label className="grid size-10 cursor-pointer place-items-center rounded-lg text-tinta-2 hover:bg-fundo hover:text-tinta focus-within:ring-2 focus-within:ring-acento" title="Tirar foto">
              <Camera className="size-5" aria-hidden="true" />
              <span className="sr-only">Tirar foto</span>
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { anexos.adicionar(e.target.files); e.target.value = ""; }} />
            </label>
          )}
          <span className="ml-auto pr-2.5 text-xs text-tinta-2" aria-live="polite">
            {anexos.preparando ? "Preparando anexo..." : previas.length ? `${previas.length} ${previas.length === 1 ? "anexo" : "anexos"}` : toque ? "" : "Ctrl+V cola um print"}
          </span>
        </div>
        {sobre && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-xl bg-mar-50/90 font-semibold text-acento">Solte para anexar</div>
        )}
      </div>
      {anexos.aviso && <p className="mt-2 text-sm font-semibold text-alerta">{anexos.aviso}</p>}
    </>
  );
});

/**
 * Rodapé do cartão com o botão de enviar. Fica no fim do formulário (onde a leitura termina); se o fim estiver
 * fora da tela, gruda embaixo e o botão continua à vista. `frase` some quando grudado (faixa baixa).
 * Coloque como ÚLTIMO filho do cartão com padding p-6 md:p-8.
 * `soNoFimNoCelular`: no celular o rodapé NÃO gruda: o botão fica só no fim do formulário (Registrar, onde a
 * pessoa preenche tudo antes de enviar e um botão flutuando no meio do caminho atrapalhava). No PC continua grudando.
 */
export function RodapeEnviar({ frase, children, topo, soNoFimNoCelular }: { frase?: ReactNode; children: ReactNode; topo?: ReactNode; soNoFimNoCelular?: boolean }) {
  const fim = useRef<HTMLDivElement>(null);
  const [passou, setPassou] = useState(false);
  const pc = useMediaQuery("(min-width: 768px)");
  const gruda = pc || !soNoFimNoCelular;
  const grudado = gruda && passou;
  useEffect(() => {
    const el = fim.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const obs = new IntersectionObserver(([e]) => setPassou(!e.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <>
      <div
        className={`z-10 -mx-5 -mb-5 space-y-3 rounded-b-2xl border-t border-linha bg-superficie px-5 py-3 md:-mx-8 md:-mb-8 md:px-8 md:pl-[4.75rem] ${
          gruda ? "sticky bottom-0" : ""
        } ${grudado ? "shadow-[0_-10px_24px_-14px_rgb(0_0_0/0.35)]" : ""}`}
      >
        {topo}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {frase && <p className={`mr-auto text-sm text-tinta-2 ${grudado ? "hidden" : ""}`}>{frase}</p>}
          {children}
        </div>
      </div>
      {/* marcador do fim do cartão: enquanto não aparece na tela, o rodapé está "grudado" */}
      <div ref={fim} aria-hidden="true" className="h-px" />
    </>
  );
}
