import { CheckCircle2, Clock, Info, Lightbulb, Paperclip, Send, Ticket, Video, X } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { arrastandoArquivo, useAnexos } from "../../components/Anexos";
import { IconeCategoria } from "../../components/Icone";
import { ProgressoEnvio } from "../../components/ProgressoEnvio";
import { useCategorias } from "../../components/CamposChamado";
import { ROTULO_IMPACTO } from "../../lib/formato";
import { mensagemErro, type Impacto } from "../../lib/pb";
import { AvisoSemelhantes } from "./AvisoSemelhantes";
import { DICAS, DICAS_GERAIS, SUGESTOES } from "./sugestoes";
import type { FormularioChamado } from "./useNovoChamado";

const DETALHE_IMPACTO: Record<Impacto, string> = {
  so_eu: "Consigo continuar trabalhando de outro jeito, ou só eu fui afetado.",
  setor: "Várias pessoas do setor estão sem conseguir trabalhar.",
  publico: "A população está esperando: atendimento, protocolo ou serviço parado.",
};

/** Título numerado de cada parte do formulário (1, 2, 3): a ordem fica clara sem explicar. */
function Passo({ n, titulo, feito, children, id }: { n: number; titulo: string; feito: boolean; children: ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <h2 id={id} className="flex items-center gap-3 font-display text-xl font-bold">
        <span className={`grid size-8 shrink-0 place-items-center rounded-full text-sm ${feito ? "bg-campo-700 text-white" : "bg-mar-50 text-acento"}`}>
          {feito ? <CheckCircle2 className="size-5" aria-hidden="true" /> : n}
        </span>
        {titulo}
      </h2>
      <div className="pl-11">{children}</div>
    </section>
  );
}

/**
 * Computador: o formulário é UMA coluna, de cima para baixo (1 problema · 2 o que acontece · 3 quem é afetado · enviar),
 * e a coluna da direita ajuda a preencher (perguntas que o TI vai fazer, chamado parecido, o que acontece depois).
 * No celular continua o passo a passo (Assistente.tsx).
 */
export function Painel({ f }: { f: FormularioChamado }) {
  const navegar = useNavigate();
  const categorias = useCategorias();
  const [erro, setErro] = useState("");
  const [sobre, setSobre] = useState(false);
  const anexos = useAnexos(f.setArquivos, f.setPreparandoAnexo);
  const caixa = useRef<HTMLTextAreaElement>(null);
  const fim = useRef<HTMLDivElement>(null);
  const [grudado, setGrudado] = useState(false);
  useEffect(() => {
    const el = fim.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const obs = new IntersectionObserver(([e]) => setGrudado(!e.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const nomeCategoria = f.categoriaEscolhida?.nome ?? "";
  const sugestoes = SUGESTOES[nomeCategoria] ?? [];
  const dicas = DICAS[nomeCategoria] ?? DICAS_GERAIS;
  const previas = useMemo(() => f.arquivos.map((a) => ({ a, url: URL.createObjectURL(a) })), [f.arquivos]);
  useEffect(() => () => previas.forEach((p) => URL.revokeObjectURL(p.url)), [previas]);

  // a caixa de texto começa baixa e cresce com o texto
  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(360, Math.max(140, el.scrollHeight + 2))}px`;
  }, [f.descricao]);

  // arquivo solto fora da área de anexo não pode fazer o navegador sair da página e perder o texto
  useEffect(() => {
    const bloquear = (e: DragEvent) => { if (e.dataTransfer?.types.includes("Files")) e.preventDefault(); };
    window.addEventListener("dragover", bloquear);
    window.addEventListener("drop", bloquear);
    return () => { window.removeEventListener("dragover", bloquear); window.removeEventListener("drop", bloquear); };
  }, []);

  const juntar = (trecho: string) => {
    f.setDescricao((atual) => (atual.trim() ? `${atual.trim()}\n${trecho} ` : `${trecho} `));
    caixa.current?.focus();
  };

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro("");
    if (!f.categoria) return setErro("Escolha o que está com problema (passo 1).");
    if (!f.descricao.trim()) return setErro("Conte o que está acontecendo (passo 2).");
    if (!f.impacto) return setErro("Diga quem está sendo afetado (passo 3).");
    try {
      const c = await f.enviar();
      navegar(`/chamado/${c.id}`, { state: { novo: true } });
    } catch (err) {
      setErro(mensagemErro(err));
    }
  }

  return (
    <form onSubmit={enviar} className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-8">
      <div className="space-y-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-3xl font-bold">Novo chamado</h1>
          {f.setor && <p className="text-tinta-2">Para o TI, a partir de <span className="font-semibold text-tinta">{f.setor}</span></p>}
        </div>

        <div className="space-y-8 rounded-2xl bg-superficie p-6 ring-1 ring-linha md:p-8">
          {/* 1 */}
          <Passo n={1} id="p-categoria" titulo="O que está com problema?" feito={!!f.categoria}>
            <div role="radiogroup" aria-labelledby="p-categoria" className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-4">
              {categorias.map((c) => (
                <label key={c.id} className="opcao min-h-12 gap-2.5 py-2 text-[15px]">
                  <input type="radio" name="categoria" className="sr-only" checked={f.categoria === c.id} onChange={() => f.setCategoria(c.id)} />
                  <IconeCategoria nome={c.icone} className="size-5 shrink-0 text-acento" />
                  <span className="leading-tight">{c.nome}</span>
                </label>
              ))}
            </div>
          </Passo>

          {/* 2 */}
          <Passo n={2} id="p-descricao" titulo="Conte o que está acontecendo" feito={!!f.descricao.trim()}>
            {sugestoes.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2" aria-label="Começar com">
                {sugestoes.map((s) => (
                  <button key={s} type="button" onClick={() => juntar(`${s}.`)} className="rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-linha hover:bg-mar-50 hover:ring-acento">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {/* caixa de texto + anexos no rodapé dela, como no e-mail */}
            <div
              className={`relative overflow-hidden rounded-xl border-2 bg-superficie focus-within:border-acento ${sobre ? "border-acento" : "border-linha"}`}
              onDragEnter={(e) => { if (arrastandoArquivo(e)) { e.preventDefault(); setSobre(true); } }}
              onDragOver={(e) => { if (arrastandoArquivo(e)) e.preventDefault(); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSobre(false); }}
              onDrop={(e) => { if (!e.dataTransfer.files.length) return; e.preventDefault(); setSobre(false); anexos.adicionar(e.dataTransfer.files); }}
            >
              <label htmlFor="descricao" className="sr-only">Descrição do problema</label>
              <textarea
                ref={caixa}
                id="descricao"
                rows={4}
                className="block w-full resize-none bg-transparent px-4 py-3 text-base leading-relaxed text-tinta placeholder:text-tinta-2/70 focus:outline-none"
                placeholder="Ex.: a impressora da recepção mostra uma luz laranja e não imprime desde hoje cedo."
                value={f.descricao}
                onChange={(e) => f.setDescricao(e.target.value)}
                onPaste={(e) => {
                  const imgs = Array.from(e.clipboardData.files);
                  if (imgs.length) { e.preventDefault(); anexos.adicionar(imgs); }
                }}
              />
              <div className="flex flex-wrap items-center gap-2 border-t border-linha bg-fundo/60 px-3 py-2">
                <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm font-semibold text-acento hover:bg-mar-50">
                  <Paperclip className="size-4" aria-hidden="true" /> Anexar foto ou vídeo
                  <input type="file" accept="image/*,video/*" multiple className="sr-only" onChange={(e) => { anexos.adicionar(e.target.files); e.target.value = ""; }} />
                </label>
                {previas.map(({ a, url }, i) => (
                  <span key={url} className="relative size-10 overflow-hidden rounded-md ring-1 ring-linha">
                    {a.type.startsWith("video/") ? (
                      <><video src={url} className="size-full bg-noite object-cover" muted preload="metadata" /><Video className="absolute bottom-0.5 left-0.5 size-3 text-white" aria-hidden="true" /></>
                    ) : <img src={url} alt={`Anexo ${i + 1}`} className="size-full object-cover" />}
                    <button type="button" onClick={() => f.setArquivos((l) => l.filter((x) => x !== a))} className="absolute top-0 right-0 rounded-bl-md bg-noite/80 p-0.5 text-white" aria-label={`Remover anexo ${i + 1}`}>
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                <span className="ml-auto text-xs text-tinta-2">
                  {anexos.preparando ? "Preparando anexo..." : <>ou cole um print com <kbd className="rounded border border-linha bg-superficie px-1 font-sans font-semibold">Ctrl</kbd>+<kbd className="rounded border border-linha bg-superficie px-1 font-sans font-semibold">V</kbd></>}
                </span>
              </div>
              {sobre && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center bg-mar-50/90 font-semibold text-acento">Solte para anexar ao chamado</div>
              )}
            </div>
            {anexos.aviso && <p className="mt-2 text-sm font-semibold text-alerta">{anexos.aviso}</p>}
          </Passo>

          {/* 3 */}
          <Passo n={3} id="p-impacto" titulo="Isso está atrapalhando quem?" feito={!!f.impacto}>
            <div role="radiogroup" aria-labelledby="p-impacto" className="grid gap-2 2xl:grid-cols-3">
              {(Object.keys(ROTULO_IMPACTO) as Impacto[]).map((k) => (
                <label key={k} className="opcao items-start py-3">
                  <input type="radio" name="impacto" className="mt-0.5 size-5 shrink-0 accent-acento" checked={f.impacto === k} onChange={() => f.setImpacto(k)} />
                  <span>
                    <span className="block">{ROTULO_IMPACTO[k]}</span>
                    <span className="mt-0.5 block text-sm font-normal text-tinta-2">{DETALHE_IMPACTO[k]}</span>
                  </span>
                </label>
              ))}
            </div>
          </Passo>

          {/* enviar: no fim do formulário, onde a leitura termina. Se o fim estiver fora da tela (notebook),
              este rodapé do cartão gruda embaixo e o botão continua à vista; ao chegar no fim, volta ao lugar. */}
          <div
            className={`sticky bottom-0 z-10 -mx-6 -mb-6 space-y-3 rounded-b-2xl border-t border-linha bg-superficie px-6 py-3 md:-mx-8 md:-mb-8 md:px-8 md:pl-[4.75rem] ${
              grudado ? "shadow-[0_-10px_24px_-14px_rgb(0_0_0/0.35)]" : ""
            }`}
          >
            <ProgressoEnvio pct={f.progresso} />
            {erro && <p role="alert" className="font-semibold text-alerta">{erro}</p>}
            <div className="flex flex-wrap items-center justify-end gap-3">
              {/* grudado embaixo: só o botão, para a faixa ficar baixa */}
              <p className={`mr-auto text-sm text-tinta-2 ${grudado ? "hidden" : ""}`}>Depois de enviar, você acompanha a sua vez na fila em Meus chamados.</p>
              <button className="btn-primario px-8 text-lg" disabled={f.enviando || f.preparandoAnexo}>
                <Send className="size-5" aria-hidden="true" />
                {f.enviando ? "Enviando..." : f.preparandoAnexo ? "Preparando anexo..." : "Enviar chamado"}
              </button>
            </div>
          </div>
        </div>
        {/* marcador do fim do cartão: enquanto não aparece na tela, o rodapé está "grudado" */}
        <div ref={fim} aria-hidden="true" />
      </div>

      {/* coluna de apoio: aproveita a largura com o que ajuda a preencher */}
      <aside className="space-y-4 xl:sticky xl:top-8 xl:mt-[3.25rem]" aria-label="Ajuda para abrir o chamado">
        <AvisoSemelhantes categoria={f.categoria} />

        <section className="rounded-2xl bg-superficie p-5 ring-1 ring-linha">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <Lightbulb className="size-5 text-acento" aria-hidden="true" /> O que ajuda o TI
          </h2>
          <p className="mt-1 text-sm text-tinta-2">
            {nomeCategoria ? `Sobre ${nomeCategoria.toLowerCase()}, o TI costuma perguntar:` : "Responder isto no texto evita idas e vindas:"}
          </p>
          <ul className="mt-3 space-y-1.5">
            {dicas.map((d) => (
              <li key={d}>
                <button type="button" onClick={() => juntar(d)} className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-mar-50" title="Colocar a pergunta no texto">
                  <span className="mt-0.5 text-acento">+</span> {d}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl bg-superficie p-5 ring-1 ring-linha">
          <h2 className="font-display text-lg font-bold">Depois de enviar</h2>
          <ol className="mt-3 space-y-3 text-sm">
            <li className="flex gap-3"><Ticket className="size-5 shrink-0 text-acento" aria-hidden="true" /><span>Você recebe uma <b>senha da fila</b> e vê quantos chamados estão antes do seu.</span></li>
            <li className="flex gap-3"><Clock className="size-5 shrink-0 text-acento" aria-hidden="true" /><span>A ordem segue a <b>urgência</b> e, depois, quem pediu primeiro.</span></li>
            <li className="flex gap-3"><Info className="size-5 shrink-0 text-acento" aria-hidden="true" /><span>O TI responde <b>por aqui</b>: não precisa mandar WhatsApp.</span></li>
          </ol>
        </section>
      </aside>
    </form>
  );
}
