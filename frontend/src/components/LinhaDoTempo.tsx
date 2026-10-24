import { EsqueletoConversa } from "./Esqueleto";
import { Hourglass, ImagePlus, Lock, Send, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type DragEvent, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { useAuth } from "../lib/auth";
import { avisar } from "../lib/avisos";
import { dataHora } from "../lib/formato";
import { prepararArquivo } from "../lib/imagem";
import { ehTecnico, mensagemErro, pb, type Interacao, type Status } from "../lib/pb";
import { useRealtime } from "../lib/useRealtime";
import { marcarVisto } from "../lib/visto";
import { RespostasProntas } from "./RespostasProntas";
import { Visualizador, type ItemVisualizador } from "./Visualizador";

const MAX_IMAGENS = 4;
const ehImagem = (f: File) => f.type.startsWith("image/");

/** Imagens ainda não enviadas, com botão de remover. */
function PreviasImagens({ arquivos, aoRemover }: { arquivos: File[]; aoRemover: (f: File) => void }) {
  const previas = useMemo(() => arquivos.map((f) => ({ f, url: URL.createObjectURL(f) })), [arquivos]);
  useEffect(() => () => previas.forEach((p) => URL.revokeObjectURL(p.url)), [previas]);
  if (!previas.length) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {previas.map(({ f, url }, i) => (
        <li key={url} className="relative size-20 overflow-hidden rounded-lg ring-1 ring-linha">
          <img src={url} alt={`Imagem ${i + 1} a enviar`} className="size-full object-cover" />
          <button
            type="button"
            onClick={() => aoRemover(f)}
            className="absolute top-1 right-1 rounded-full bg-noite/80 p-1 text-white"
            aria-label={`Remover imagem ${i + 1}`}
          >
            <X className="size-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Conversa e andamento do chamado. A mensagem pode levar até 4 imagens:
 * botão "Imagem" (galeria ou câmera), colar print (Ctrl+V) ou arrastar no PC.
 * A imagem aberta fica no endereço (?imagem=<mensagem>.<n>): o "voltar" do celular fecha a tela cheia.
 */
export function LinhaDoTempo({ chamadoId, solicitanteId, status, aoMudarChamado }: {
  chamadoId: string;
  solicitanteId: string;
  /** situação do chamado: libera o "Enviar e aguardar resposta" para o técnico */
  status?: Status;
  aoMudarChamado?: () => void;
}) {
  const { usuario } = useAuth();
  const tecnico = ehTecnico(usuario);
  const [params, setParams] = useSearchParams();
  const [itens, setItens] = useState<Interacao[]>([]);
  const [carregou, setCarregou] = useState(false);
  const [texto, setTexto] = useState("");
  const [imagens, setImagens] = useState<File[]>([]);
  const [preparando, setPreparando] = useState(false);
  const [sobre, setSobre] = useState(false);
  const [interno, setInterno] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    const lista = await pb.collection("interacoes").getFullList<Interacao>({
      filter: pb.filter("chamado = {:id}", { id: chamadoId }),
      sort: "created",
      expand: "autor",
    });
    setItens(lista);
    setCarregou(true);
    marcarVisto(chamadoId); // a conversa está na tela: some o "Nova resposta"
  }, [chamadoId]);

  useEffect(() => { carregar().catch(() => {}); }, [carregar]);
  useRealtime("interacoes", () => carregar().catch(() => {}));

  async function adicionar(lista: FileList | File[] | null | undefined) {
    const novas = Array.from(lista ?? []).filter(ehImagem);
    if (!novas.length) return;
    setErro("");
    setPreparando(true);
    try {
      const prontas = await Promise.all(novas.map(prepararArquivo));
      setImagens((atual) => {
        const todas = [...atual, ...prontas];
        if (todas.length > MAX_IMAGENS) setErro(`Até ${MAX_IMAGENS} imagens por mensagem.`);
        return todas.slice(0, MAX_IMAGENS);
      });
    } finally {
      setPreparando(false);
    }
  }

  // técnico: pergunta e já deixa o chamado esperando a resposta (volta sozinho quando a pessoa responder)
  const podeAguardar = tecnico && !interno && !!solicitanteId && (status === "em_andamento" || status === "aguardando");

  async function enviar(e: FormEvent, aguardar = false) {
    e.preventDefault();
    if (!texto.trim() && !imagens.length) return;
    setEnviando(true);
    setErro("");
    try {
      const d = new FormData();
      d.append("chamado", chamadoId);
      d.append("texto", texto.trim());
      d.append("interno", String(tecnico && interno));
      imagens.forEach((f) => d.append("anexos", f));
      await pb.collection("interacoes").create(d);
      if (aguardar) {
        await pb.collection("chamados").update(chamadoId, { status: "aguardando", aguardando_motivo: "solicitante" });
        avisar("Mensagem enviada. O chamado fica em espera até a pessoa responder.");
        aoMudarChamado?.();
      }
      setTexto("");
      setImagens([]);
      setInterno(false);
      await carregar();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  }

  // tela cheia: ?imagem=<id da mensagem>.<índice>
  const [abertaId, abertaIdx] = (params.get("imagem") ?? "").split(".");
  const aberta = itens.find((i) => i.id === abertaId);
  const itensAbertos: ItemVisualizador[] = (aberta?.anexos ?? []).map((nome) => ({
    url: pb.files.getURL(aberta!, nome), tipo: "imagem", nome,
  }));
  function abrirImagem(id: string, n: number, substituir = false) {
    const p = new URLSearchParams(params);
    p.set("imagem", `${id}.${n}`);
    setParams(p, { replace: substituir });
  }
  function fecharImagem() {
    if ((window.history.state?.idx ?? 0) > 0) window.history.back();
    else {
      const p = new URLSearchParams(params);
      p.delete("imagem");
      setParams(p, { replace: true });
    }
  }

  const arrastando = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
  const podeEnviar = (texto.trim() || imagens.length) && !enviando && !preparando;

  return (
    <section aria-labelledby="titulo-conversa">
      <h2 id="titulo-conversa" className="mb-3 text-xl font-bold">Conversa e andamento</h2>
      {!carregou && <EsqueletoConversa />}
      <ol className="space-y-3">
        {itens.map((i) => {
          if (i.tipo !== "comentario") {
            return (
              <li key={i.id} className="flex gap-2 text-sm text-tinta-2">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-linha" aria-hidden="true" />
                <span className="texto-livre min-w-0">
                  {i.texto}
                  {i.expand?.autor && <> ({i.expand.autor.name})</>}
                  <span className="ml-1 whitespace-nowrap">{dataHora(i.created)}</span>
                </span>
              </li>
            );
          }
          const doSolicitante = i.autor === solicitanteId;
          return (
            <li key={i.id} className={`flex ${doSolicitante ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  i.interno
                    ? "border-2 border-dashed border-tinta-2/40 bg-superficie"
                    : doSolicitante
                      ? "bg-superficie ring-1 ring-linha"
                      : "bg-mar-50"
                }`}
              >
                <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
                  {i.interno && <Lock className="size-4" aria-label="Nota interna" />}
                  {i.expand?.autor?.name ?? "Usuário"}
                  {!doSolicitante && !i.interno && <span className="font-normal text-tinta-2">(TI)</span>}
                </p>
                {i.texto && <p className="selecionavel texto-livre whitespace-pre-wrap">{i.texto}</p>}
                {!!i.anexos?.length && (
                  <ul className={`mt-2 grid gap-1.5 ${i.anexos.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                    {i.anexos.map((nome, n) => (
                      <li key={nome}>
                        <button
                          type="button"
                          onClick={() => abrirImagem(i.id, n)}
                          className="block w-full overflow-hidden rounded-xl ring-1 ring-linha hover:ring-2 hover:ring-acento"
                          aria-label={`Ver imagem ${n + 1} em tela cheia`}
                        >
                          <img
                            src={pb.files.getURL(i, nome, { thumb: "400x400" })}
                            alt=""
                            className={`w-full object-cover ${i.anexos!.length > 1 ? "aspect-square" : "max-h-64"}`}
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-1 text-xs text-tinta-2">{dataHora(i.created)}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <form
        onSubmit={enviar}
        className="mt-4 space-y-2"
        onDragOver={(e) => { if (arrastando(e)) { e.preventDefault(); setSobre(true); } }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSobre(false); }}
        onDrop={(e) => { if (!arrastando(e)) return; e.preventDefault(); setSobre(false); adicionar(e.dataTransfer.files); }}
      >
        {tecnico && !interno && <RespostasProntas selecionada={texto} aoEscolher={setTexto} />}
        <label htmlFor="mensagem" className="sr-only">Mensagem</label>
        <div className="relative">
          <textarea
            id="mensagem"
            className="campo min-h-24"
            placeholder={tecnico ? "Escreva para o solicitante" : "Escreva para o TI"}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            // print colado (Ctrl+V) vai como imagem da mensagem
            onPaste={(e) => {
              const arquivos = Array.from(e.clipboardData.files).filter(ehImagem);
              if (arquivos.length) { e.preventDefault(); adicionar(arquivos); }
            }}
          />
          {sobre && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-xl border-2 border-dashed border-acento bg-mar-50/90 font-semibold text-acento">
              Solte a imagem aqui
            </div>
          )}
        </div>
        <PreviasImagens arquivos={imagens} aoRemover={(f) => setImagens((atual) => atual.filter((x) => x !== f))} />
        {preparando && <p className="text-sm text-tinta-2" role="status">Preparando imagem...</p>}
        <div className="flex flex-wrap items-center gap-3">
          <label className={`btn-secundario min-h-11 cursor-pointer px-3 ${imagens.length >= MAX_IMAGENS ? "pointer-events-none opacity-50" : ""}`}>
            <ImagePlus className="size-5" aria-hidden="true" /> Imagem
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => { adicionar(e.target.files); e.target.value = ""; }}
            />
          </label>
          {tecnico && (
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={interno} onChange={(e) => setInterno(e.target.checked)} className="size-5 accent-acento" />
              Nota interna (só o TI vê)
            </label>
          )}
          <div className="ml-auto flex flex-wrap justify-end gap-2">
            {podeAguardar && (
              <button
                type="button"
                className="btn-secundario"
                disabled={!podeEnviar}
                onClick={(e) => enviar(e, true)}
                title="Envia a mensagem e põe o chamado em espera. Quando a pessoa responder, volta sozinho para atendimento."
              >
                <Hourglass className="size-5" aria-hidden="true" /> Enviar e aguardar resposta
              </button>
            )}
            <button className="btn-primario" disabled={!podeEnviar}>
              <Send className="size-5" aria-hidden="true" /> {enviando ? "Enviando..." : "Enviar"}
            </button>
          </div>
        </div>
        <p className="hidden text-sm text-tinta-2 md:block">Dica: cole um print com Ctrl+V ou arraste uma imagem para cá.</p>
        {erro && <p className="text-sm font-semibold text-alerta">{erro}</p>}
      </form>

      {aberta && itensAbertos.length > 0 && (
        <Visualizador
          itens={itensAbertos}
          indice={Math.min(Number(abertaIdx) || 0, itensAbertos.length - 1)}
          aoMudar={(n) => abrirImagem(aberta.id, n, true)}
          aoFechar={fecharImagem}
        />
      )}
    </section>
  );
}
