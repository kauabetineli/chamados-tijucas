import { ArrowLeft, Check, CheckCircle2, Hourglass, MessageCircleQuestion, ThumbsDown, ThumbsUp } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { GaleriaAnexos } from "../components/Anexos";
import { EsqueletoChamado } from "../components/Esqueleto";
import { IconeCategoria } from "../components/Icone";
import { LinhaDoTempo } from "../components/LinhaDoTempo";
import { PainelTecnico } from "../components/PainelTecnico";
import { SeloStatus, SeloTeste } from "../components/Selos";
import { SenhaFila } from "../components/SenhaFila";
import { SolucoesParecidas } from "../components/SolucoesParecidas";
import { useAuth } from "../lib/auth";
import { dataHora, ROTULO_AGUARDANDO, ROTULO_IMPACTO, ROTULO_ORIGEM, ROTULO_STATUS } from "../lib/formato";
import { EXPAND_CHAMADO, ehTecnico, mensagemErro, nomeSolicitante, pb, type Chamado as TChamado, type Status, ramalDe } from "../lib/pb";
import { useRealtime } from "../lib/useRealtime";

const ETAPAS: Status[] = ["aberto", "em_andamento", "resolvido"];

/** Página inteira do chamado (/chamado/:id e /ti/chamado/:id). */
export function Chamado() {
  const { id = "" } = useParams();
  return <DetalheChamado id={id} />;
}

/**
 * Conteúdo do chamado. Usado na página inteira e, com `embutido`, no painel que sobe de baixo
 * (components/PainelChamado.tsx): sem o "voltar" e sem a faixa de "chamado aberto".
 */
export function DetalheChamado({ id, embutido }: { id: string; embutido?: boolean }) {
  const { usuario } = useAuth();
  const tecnico = ehTecnico(usuario);
  const estado = useLocation().state as { novo?: boolean } | null;
  const novo = !embutido && estado?.novo;
  const [c, setC] = useState<TChamado | null>(null);
  const [aFrente, setAFrente] = useState<number | null>(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    try {
      const reg = await pb.collection("chamados").getOne<TChamado>(id, { expand: EXPAND_CHAMADO });
      setC(reg);
      if (reg.status === "aberto" && reg.solicitante === usuario?.id) {
        const pos = await pb.send<{ itens: Record<string, { a_frente: number }> }>("/api/fila/minhas-posicoes", {});
        setAFrente(pos?.itens?.[id]?.a_frente ?? null);
      }
    } catch (err) {
      setErro(mensagemErro(err));
    }
  }, [id, usuario?.id]);

  useEffect(() => { carregar(); }, [carregar]);
  useRealtime("chamados", carregar);

  const voltar = tecnico ? "/ti" : "/";

  if (erro && !c) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="font-semibold text-alerta">Não foi possível abrir este chamado. {erro}</p>
        {!embutido && <Link to={voltar} className="btn-secundario mt-4">Voltar</Link>}
      </div>
    );
  }
  if (!c) return <EsqueletoChamado tecnico={tecnico} />;

  const doSolicitante = c.solicitante === usuario?.id;
  // "aguardando" é a etapa do meio (o TI está com o chamado), com outro nome
  const etapa = c.status === "aguardando" ? 1 : ETAPAS.indexOf(c.status);
  const rotuloEtapa = (s: Status) => (s === "em_andamento" && c.status === "aguardando" ? "Em espera" : ROTULO_STATUS[s]);

  return (
    <div className="mx-auto max-w-5xl">
      {!embutido && (
        <Link to={voltar} className="mb-4 inline-flex items-center gap-1.5 font-semibold text-acento">
          <ArrowLeft className="size-5" aria-hidden="true" /> {tecnico ? "Fila" : "Meus chamados"}
        </Link>
      )}

      {novo && (
        <div role="status" className="mb-5 flex items-start gap-3 rounded-2xl bg-campo-50 p-4 text-ok">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0" aria-hidden="true" />
          <p className="font-semibold">
            Chamado aberto. O TI já vê o seu pedido na fila e você recebe as respostas por aqui
            {usuario?.email ? " e por e-mail" : ""}.
          </p>
        </div>
      )}

      {/* no celular: dados do chamado, ações do técnico, conversa. No computador: ações na lateral */}
      <div className="grid gap-x-8 gap-y-7 md:grid-cols-[minmax(0,1fr)_20rem] md:grid-rows-[auto_1fr]">
        {/* min-w-0: em celular bem estreito (320 px) o conteúdo encolhe em vez de vazar da tela */}
        <div className="min-w-0 space-y-7 md:col-start-1">
          <header>
            <p className="font-display text-3xl font-extrabold tracking-tight min-[360px]:text-4xl">{c.protocolo}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <SeloStatus status={c.status} />
              <SeloTeste ficticio={c.ficticio} />
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <IconeCategoria nome={c.expand?.categoria?.icone} className="size-5 text-acento" />
                {c.expand?.categoria?.nome}
              </span>
              <span className="text-tinta-2">aberto em {dataHora(c.created)}</span>
            </div>
          </header>

          {/* andamento em etapas: é de fato uma sequência */}
          <ol className="flex items-center gap-2" aria-label="Andamento do chamado">
            {ETAPAS.map((s, i) => (
              <li key={s} className="flex min-w-0 flex-1 items-center gap-2" aria-current={i === etapa ? "step" : undefined}>
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
                    i < etapa || c.status === "resolvido"
                      ? "bg-campo-700 text-white"
                      : i === etapa
                        ? "bg-mar-700 text-white"
                        : "bg-superficie text-tinta-2 ring-2 ring-linha"
                  }`}
                >
                  {i < etapa || c.status === "resolvido" ? <Check className="size-4" aria-hidden="true" /> : i + 1}
                </span>
                {/* celular bem estreito (< 360 px): só a etapa atual mostra o nome; as outras ficam só com o número */}
                <span className={`text-sm font-semibold ${i <= etapa ? "text-tinta" : "text-tinta-2"} ${i === etapa ? "" : "max-[359px]:sr-only"}`}>{rotuloEtapa(s)}</span>
                {i < ETAPAS.length - 1 && <span className={`h-0.5 flex-1 ${i < etapa ? "bg-campo-700" : "bg-linha"}`} aria-hidden="true" />}
              </li>
            ))}
          </ol>

          {c.status === "aberto" && doSolicitante && aFrente !== null && (
            <SenhaFila aFrente={aFrente} protocolo={c.protocolo} categoria={c.expand?.categoria?.nome} icone={c.expand?.categoria?.icone} animar={novo} />
          )}

          {c.status === "aguardando" && c.aguardando_motivo && !tecnico && (
            c.aguardando_motivo === "solicitante" ? (
              <div role="status" className="flex items-start gap-3 rounded-2xl border-l-8 border-acento bg-mar-50 p-4">
                <MessageCircleQuestion className="mt-0.5 size-6 shrink-0 text-acento" aria-hidden="true" />
                <div>
                  <p className="font-bold">O TI precisa de uma resposta sua.</p>
                  <p className="text-tinta-2">Leia a última mensagem na conversa e responda por lá. O atendimento continua assim que você responder.</p>
                  <a href="#mensagem" className="mt-2 inline-flex min-h-11 items-center font-semibold text-acento underline underline-offset-4">Ir para a conversa</a>
                </div>
              </div>
            ) : (
              <div role="status" className="flex items-start gap-3 rounded-2xl bg-superficie p-4 ring-1 ring-linha">
                <Hourglass className="mt-0.5 size-6 shrink-0 text-acento" aria-hidden="true" />
                <p>
                  <b>{c.expand?.responsavel?.name ?? "O TI"} está aguardando {ROTULO_AGUARDANDO[c.aguardando_motivo]}.</b>{" "}
                  <span className="text-tinta-2">O chamado continua com o TI; você não precisa abrir outro.</span>
                </p>
              </div>
            )
          )}

          {c.status === "resolvido" && doSolicitante && !c.confirmado && <Confirmacao chamadoId={c.id} aoConcluir={carregar} />}

          <section className="space-y-4">
            <p className="texto-livre text-lg whitespace-pre-wrap">{c.descricao}</p>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {tecnico && <Dado termo="Quem pediu" valor={nomeSolicitante(c) + (ramalDe(c.expand?.solicitante, c.expand?.setor) ? ` (ramal ${ramalDe(c.expand?.solicitante, c.expand?.setor)})` : "")} />}
              <Dado termo="Setor" valor={c.expand?.setor?.nome} />
              <Dado termo="Quem é afetado" valor={ROTULO_IMPACTO[c.impacto]} />
              {tecnico && <Dado termo="Como chegou" valor={ROTULO_ORIGEM[c.origem]} />}
              <Dado termo="Responsável no TI" valor={c.expand?.responsavel?.name} />
            </dl>
            <GaleriaAnexos chamado={c} />
          </section>

          {tecnico && c.status !== "resolvido" && c.categoria && (
            <SolucoesParecidas chamadoId={c.id} categoriaId={c.categoria} categoriaNome={c.expand?.categoria?.nome} />
          )}
        </div>

        {tecnico && (
          <aside className="md:col-start-2 md:row-span-2 md:row-start-1">
            <div className={embutido ? "" : "md:sticky md:top-6"}>
              <PainelTecnico chamado={c} aoMudar={carregar} />
            </div>
          </aside>
        )}

        <div className="space-y-7 md:col-start-1">

          {c.status === "resolvido" && (c.diagnostico || c.solucao) && (
            <section className="rounded-2xl border-l-8 border-campo bg-superficie p-5 ring-1 ring-linha">
              <h2 className="text-xl font-bold">O que o TI fez</h2>
              {c.diagnostico && (
                <p className="texto-livre mt-2"><span className="font-semibold">Causa: </span>{c.diagnostico}</p>
              )}
              {c.solucao && (
                <p className="texto-livre mt-1"><span className="font-semibold">Solução: </span>{c.solucao}</p>
              )}
              {c.confirmado && (
                <div className="mt-3 space-y-1 text-sm">
                  <p className="font-semibold text-ok">{doSolicitante ? "Você confirmou" : "Solicitante confirmou"} que deu certo.</p>
                  {c.avaliacao && (
                    <p className="flex items-center gap-1.5 font-semibold">
                      {c.avaliacao === "bom"
                        ? <><ThumbsUp className="size-4 text-ok" aria-hidden="true" /> Atendimento avaliado como bom</>
                        : <><ThumbsDown className="size-4 text-alerta" aria-hidden="true" /> Atendimento avaliado como "poderia ser melhor"</>}
                    </p>
                  )}
                  {c.avaliacao_comentario && <p className="texto-livre text-tinta-2">“{c.avaliacao_comentario}”</p>}
                </div>
              )}
            </section>
          )}

          <LinhaDoTempo chamadoId={c.id} solicitanteId={c.solicitante} status={c.status} aoMudarChamado={carregar} />
        </div>
      </div>
    </div>
  );
}

function Dado({ termo, valor }: { termo: string; valor?: string }) {
  return (
    <div>
      <dt className="text-sm text-tinta-2">{termo}</dt>
      <dd className="font-semibold">{valor || "—"}</dd>
    </div>
  );
}

/**
 * Quem pediu confirma se deu certo. "Sim" abre uma pergunta rápida sobre o atendimento (bom / poderia ser melhor,
 * comentário opcional): é o indicador de satisfação do piloto. Pode pular; a confirmação vale do mesmo jeito.
 * "Não resolveu" reabre com o motivo.
 */
function Confirmacao({ chamadoId, aoConcluir }: { chamadoId: string; aoConcluir: () => void }) {
  const [etapa, setEtapa] = useState<"pergunta" | "avaliar" | "reabrir">("pergunta");
  const [motivo, setMotivo] = useState("");
  const [avaliacao, setAvaliacao] = useState<"bom" | "ruim" | "">("");
  const [comentario, setComentario] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(acao: "confirmar" | "reabrir", corpo: Record<string, string> = {}) {
    setErro("");
    setEnviando(true);
    try {
      await pb.send(`/api/chamados/${chamadoId}/${acao}`, { method: "POST", body: corpo });
      aoConcluir();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  }

  const opcao = (valor: "bom" | "ruim", Icone: typeof ThumbsUp, rotulo: string) => (
    <label
      className={`flex min-h-16 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 font-semibold ring-1 ${
        avaliacao === valor ? "bg-mar-50 text-acento ring-2 ring-acento" : "ring-linha hover:ring-acento"
      }`}
    >
      <input type="radio" name="avaliacao" className="sr-only" checked={avaliacao === valor} onChange={() => setAvaliacao(valor)} />
      <Icone className="size-6" aria-hidden="true" /> {rotulo}
    </label>
  );

  return (
    <section className="rounded-2xl bg-superficie p-5 ring-2 ring-campo">
      {etapa === "pergunta" && (
        <>
          <h2 className="text-xl font-bold">O TI marcou como resolvido. Deu certo?</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-sucesso flex-1" onClick={() => setEtapa("avaliar")}>Sim, resolveu</button>
            <button className="btn-secundario flex-1" onClick={() => setEtapa("reabrir")}>Não resolveu</button>
          </div>
        </>
      )}

      {etapa === "avaliar" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold">Que bom! Como foi o atendimento?</h2>
            <p className="text-tinta-2">Sua resposta ajuda o TI a melhorar. É rápido e opcional.</p>
          </div>
          <div role="radiogroup" aria-label="Como foi o atendimento" className="flex gap-2">
            {opcao("bom", ThumbsUp, "Bom")}
            {opcao("ruim", ThumbsDown, "Poderia ser melhor")}
          </div>
          {avaliacao && (
            <div>
              <label htmlFor="comentario-avaliacao" className="rotulo">
                {avaliacao === "bom" ? "Quer deixar um recado? (opcional)" : "O que poderia ser melhor? (opcional)"}
              </label>
              <textarea id="comentario-avaliacao" className="campo min-h-20" maxLength={500} value={comentario} onChange={(e) => setComentario(e.target.value)} />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-sucesso flex-1"
              disabled={enviando || !avaliacao}
              onClick={() => enviar("confirmar", { avaliacao, comentario: comentario.trim() })}
            >
              {enviando ? "Enviando..." : "Enviar e confirmar"}
            </button>
            <button className="btn-secundario" disabled={enviando} onClick={() => enviar("confirmar")}>Só confirmar</button>
          </div>
        </div>
      )}

      {etapa === "reabrir" && (
        <div className="space-y-3">
          <h2 className="text-xl font-bold">Que pena. Vamos reabrir.</h2>
          <label htmlFor="motivo" className="rotulo">O que continua acontecendo?</label>
          <textarea id="motivo" className="campo min-h-24" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <button className="btn-primario flex-1" disabled={enviando || !motivo.trim()} onClick={() => enviar("reabrir", { motivo })}>
              Reabrir chamado
            </button>
            <button className="btn-secundario" onClick={() => setEtapa("pergunta")}>Cancelar</button>
          </div>
        </div>
      )}
      {erro && <p role="alert" className="mt-2 font-semibold text-alerta">{erro}</p>}
    </section>
  );
}
