import { EsqueletoConversa } from "./Esqueleto";
import { mudancaDaAcao, ROTULO_ACAO, type AcaoPronta } from "../lib/respostasProntas";
import { CheckCircle2, Hourglass, ImagePlus, Lock, Send, X } from "lucide-react";
import { Avatar } from "./Avatar";
import { useMediaQuery } from "../lib/useMediaQuery";
import { Fragment, useCallback, useEffect, useMemo, useState, type DragEvent, type FormEvent } from "react";
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
export function LinhaDoTempo({ chamadoId, solicitanteId, solicitanteNome, status, aoMudarChamado, semTitulo }: {
  /** na gaveta a aba "Conversa" já é o título */
  semTitulo?: boolean;
  chamadoId: string;
  solicitanteId: string;
  /** para o técnico: o botão "Para <nome>" do campo de mensagem */
  solicitanteNome?: string;
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
  const [soMensagens, setSoMensagens] = useState(false);
  // resposta pronta com ação: ao enviar, o chamado também muda (pôr em espera, resolver)
  const [acaoPronta, setAcaoPronta] = useState<{ texto: string; acao: AcaoPronta } | null>(null);
  const acaoValendo = acaoPronta && texto.trim() && !interno ? acaoPronta.acao : null;
  // no computador o campo lembra que dá para colar um print (no celular não há Ctrl+V)
  const noPc = useMediaQuery("(min-width: 768px)");

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
      if (!aguardar && acaoValendo) {
        await pb.collection("chamados").update(chamadoId, mudancaDaAcao(acaoValendo));
        avisar(`Mensagem enviada e chamado ${acaoValendo === "resolver" ? "marcado como resolvido" : "posto em espera"}.`);
        aoMudarChamado?.();
      }
      setAcaoPronta(null);
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
      <div className={`mb-3 flex flex-wrap items-center gap-2 ${semTitulo ? "justify-end" : "justify-between"}`}>
        <h2 id="titulo-conversa" className={semTitulo ? "sr-only" : "text-xl font-bold"}>Conversa</h2>
        {/* o técnico pode esconder o registro de mudanças; o servidor vê tudo (lá o registro é curto) */}
        {tecnico && (
          <div role="group" aria-label="O que mostrar" className="flex rounded-lg bg-fundo p-0.5 text-sm ring-1 ring-linha">
            {([[false, "Tudo"], [true, "Só mensagens"]] as const).map(([v, rot]) => (
              <button key={rot} type="button" aria-pressed={soMensagens === v} onClick={() => setSoMensagens(v)}
                className={`min-h-9 rounded-md px-3 font-semibold ${soMensagens === v ? "bg-superficie text-tinta shadow-sm ring-1 ring-linha" : "text-tinta-2 hover:text-tinta"}`}>
                {rot}
              </button>
            ))}
          </div>
        )}
      </div>
      {!carregou && <EsqueletoConversa />}
      <ol className="space-y-3">
        {agrupar(itens, soMensagens).map((g, gi, todos) => {
          const dia = g.novoDia ? <span className="font-semibold text-tinta">{diaCurto(g.itens[0].created)}</span> : null;
          if (g.tipo === "mudancas") {
            // mudanças seguidas (status, responsável, prioridade, abertura) viram UMA linha fina
            return (
              <li key={g.itens[0].id} className="px-2 text-center text-sm text-tinta-2">
                {dia}{dia && " · "}
                {g.itens.map((i, n) => (
                  <Fragment key={i.id}>
                    {n > 0 && " · "}
                    <span className="texto-livre" title={`${dataHora(i.created)}${i.expand?.autor ? ` · ${i.expand.autor.name}` : ""}`}>{textoMudanca(i)}</span>
                  </Fragment>
                ))}
              </li>
            );
          }
          const i = g.itens[0];
          // sem autor = mensagem automática de uma regra (Configurações > Automação)
          const automatica = !i.autor;
          const doSolicitante = !automatica && i.autor === solicitanteId;
          const nome = automatica ? (i.interno ? "Nota automática" : "Resposta automática") : primeiroNome(i.expand?.autor?.name ?? "Usuário");
          // mensagens seguidas da mesma pessoa: o rosto aparece só na última
          const seguinte = todos[gi + 1];
          const continua = seguinte?.tipo === "mensagem" && !seguinte.novoDia && seguinte.itens[0].autor === i.autor;
          const rosto = continua
            ? <span className="w-7 shrink-0" aria-hidden="true" />
            : automatica
            ? <span className="grid size-7 shrink-0 place-items-center rounded-full bg-fundo text-xs font-bold text-tinta-2 ring-1 ring-linha" aria-hidden="true">TI</span>
            : <Avatar id={i.autor} nome={i.expand?.autor?.name} tamanho="sm" />;
          return (
            <Fragment key={i.id}>
              {dia && <li className="pt-1 text-center text-sm text-tinta-2">{dia}</li>}
              <li className={`flex items-end gap-2 ${doSolicitante ? "" : "flex-row-reverse"} ${continua ? "-mb-1.5" : ""}`}>
                {rosto}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                    i.interno
                      ? "bg-sol-50 ring-1 ring-linha"
                      : doSolicitante
                        ? "rounded-bl-md bg-superficie ring-1 ring-linha"
                        : "rounded-br-md bg-mar-50"
                  }`}
                >
                  {i.interno && (
                    <p className="mb-1 flex items-center gap-1.5 text-sm font-bold">
                      <Lock className="size-4" aria-hidden="true" /> Nota interna · só o TI vê
                    </p>
                  )}
                  {i.texto && <p className="selecionavel texto-livre whitespace-pre-wrap">{i.texto}</p>}
                  {!!i.anexos?.length && (
                    <ul className={`mt-2 grid gap-1.5 ${i.anexos.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                      {i.anexos.map((arquivo, n) => (
                        <li key={arquivo}>
                          <button
                            type="button"
                            onClick={() => abrirImagem(i.id, n)}
                            className="block w-full overflow-hidden rounded-xl ring-1 ring-linha hover:ring-2 hover:ring-acento"
                            aria-label={`Ver imagem ${n + 1} em tela cheia`}
                          >
                            <img
                              src={pb.files.getURL(i, arquivo, { thumb: "400x400" })}
                              alt=""
                              className={`w-full object-cover ${i.anexos!.length > 1 ? "aspect-square" : "max-h-64"}`}
                            />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-1 text-xs text-tinta-2" title={dataHora(i.created)}>
                    {nome}{!doSolicitante && !automatica && !i.interno && " (TI)"} · {hora(i.created)}
                  </p>
                </div>
              </li>
            </Fragment>
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
        {tecnico && (
          <div role="group" aria-label="Quem vai ler" className="flex w-fit rounded-lg bg-fundo p-0.5 text-sm ring-1 ring-linha">
            <button type="button" aria-pressed={!interno} onClick={() => setInterno(false)}
              className={`min-h-9 rounded-md px-3 font-semibold ${!interno ? "bg-superficie text-tinta shadow-sm ring-1 ring-linha" : "text-tinta-2 hover:text-tinta"}`}>
              Para {solicitanteNome ? primeiroNome(solicitanteNome) : "quem pediu"}
            </button>
            <button type="button" aria-pressed={interno} onClick={() => setInterno(true)}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 font-semibold ${interno ? "bg-sol-50 text-tinta shadow-sm ring-1 ring-linha" : "text-tinta-2 hover:text-tinta"}`}>
              <Lock className="size-4" aria-hidden="true" /> Nota interna
            </button>
          </div>
        )}
        {tecnico && !interno && (
          <RespostasProntas
            selecionada={texto}
            aoEscolher={(t, a) => { setTexto(t); setAcaoPronta(a ? { texto: t, acao: a } : null); }}
          />
        )}
        {acaoValendo && (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-mar-50 px-3 py-1 font-semibold text-acento">
              {acaoValendo === "resolver" ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <Hourglass className="size-4" aria-hidden="true" />}
              Ao enviar: {ROTULO_ACAO[acaoValendo]}
            </span>
            <button type="button" className="min-h-9 rounded-lg px-2 font-semibold text-tinta-2 hover:text-tinta" onClick={() => setAcaoPronta(null)}>Só mandar</button>
          </p>
        )}
        <label htmlFor="mensagem" className="sr-only">Mensagem</label>
        <div className="relative">
          <textarea
            id="mensagem"
            className={`campo min-h-24 ${interno ? "bg-sol-50" : ""}`}
            placeholder={`${!tecnico ? "Escreva para o TI" : interno ? "Só o TI vai ler" : `Escreva para ${solicitanteNome ? primeiroNome(solicitanteNome) : "quem pediu"}`}${noPc ? " · print: Ctrl+V" : ""}`}
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

const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] || nome;
const hora = (iso: string) => new Date(iso.replace(" ", "T")).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const chaveDia = (iso: string) => new Date(iso.replace(" ", "T")).toDateString();
function diaCurto(iso: string) {
  const d = new Date(iso.replace(" ", "T"));
  const hoje = new Date();
  const ontem = new Date(Date.now() - 86400000);
  if (d.toDateString() === hoje.toDateString()) return "Hoje";
  if (d.toDateString() === ontem.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", ...(d.getFullYear() !== hoje.getFullYear() ? { year: "numeric" } : {}) });
}

/** Mudança em texto curto: quem fez entra só quando não está no próprio texto. */
function textoMudanca(i: Interacao) {
  const quem = i.expand?.autor?.name;
  const t = i.texto.replace(/\.$/, "");
  return quem && !t.includes(quem) ? `${t} (${primeiroNome(quem)})` : t;
}

type Grupo = { tipo: "mensagem" | "mudancas"; itens: Interacao[]; novoDia: boolean };

/** Junta mudanças seguidas do mesmo dia numa linha só; marca onde começa um dia novo. */
function agrupar(itens: Interacao[], soMensagens: boolean): Grupo[] {
  const grupos: Grupo[] = [];
  let ultimoDia = "";
  for (const i of itens) {
    const mudanca = i.tipo !== "comentario";
    if (mudanca && soMensagens) continue;
    const dia = chaveDia(i.created);
    const novoDia = dia !== ultimoDia;
    ultimoDia = dia;
    const anterior = grupos[grupos.length - 1];
    if (mudanca && anterior?.tipo === "mudancas" && !novoDia) anterior.itens.push(i);
    else grupos.push({ tipo: mudanca ? "mudancas" : "mensagem", itens: [i], novoDia });
  }
  return grupos;
}
