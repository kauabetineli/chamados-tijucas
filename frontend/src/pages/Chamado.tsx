import { LinkChamado } from "../lib/verChamado";
import { Bloco } from "../components/Esqueleto";
import { LigarAoAviso } from "../components/MuralAvisos";
import { ArrowLeft, History as IconeHistorico, Check, Hourglass, MessageCircleQuestion, ThumbsDown, ThumbsUp } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useParams } from "react-router";
import { GaleriaAnexos } from "../components/Anexos";
import { EsqueletoChamado } from "../components/Esqueleto";
import { IconeCategoria } from "../components/Icone";
import { LinhaDoTempo } from "../components/LinhaDoTempo";
import { PainelTecnico } from "../components/PainelTecnico";
import { EtiquetaPrioridade, SeloStatus, SeloTeste } from "../components/Selos";
import { SenhaFila } from "../components/SenhaFila";
import { ListaParecidas, SolucoesParecidas, useSolucoesParecidas } from "../components/SolucoesParecidas";
import { AbasPagina } from "../components/CabecalhoPagina";
import { Espera } from "../components/Espera";
import { useAuth } from "../lib/auth";
import { dentroDoHorario, diasParaConfirmar, mensagemForaDoHorario, useConfigTI } from "../lib/configTI";
import { dataHora, ROTULO_AGUARDANDO, ROTULO_IMPACTO, ROTULO_ORIGEM, ROTULO_STATUS } from "../lib/formato";
import { EXPAND_CHAMADO, ehObservador, veComoTI, mensagemErro, nomeSolicitante, pb, type Chamado as TChamado, type Status, ramalDe } from "../lib/pb";
import { convidarOpiniao } from "../lib/opiniao";
import { useRealtime } from "../lib/useRealtime";
import { useMediaQuery } from "../lib/useMediaQuery";

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
export function DetalheChamado({ id, embutido, gaveta, controles, etiqueta }: {
  id: string;
  embutido?: boolean;
  /** PC: gaveta da direita (components/PainelChamado.tsx), em formato compacto com abas */
  gaveta?: boolean;
  /** botões do painel (↑ ↓, página inteira, fechar), no canto do cabeçalho */
  controles?: ReactNode;
  /** por que este chamado está aberto sem ninguém ter clicado (ex.: "Seu próximo na fila") */
  etiqueta?: string;
}) {
  const { usuario } = useAuth();
  const tecnico = veComoTI(usuario);
  // observador (equipe do Dino Desk): vê como o TI, mas os controles ficam travados
  const soLeitura = ehObservador(usuario);
  // celular (coluna única): soluções parecidas vão para depois das ações do técnico
  const pc = useMediaQuery("(min-width: 768px)");
  const estado = useLocation().state as { novo?: boolean } | null;
  const novo = !embutido && estado?.novo;
  const { config } = useConfigTI();
  const [c, setC] = useState<TChamado | null>(null);
  const [aFrente, setAFrente] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const [viuEnviado, setViuEnviado] = useState(false);

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
        {controles && <div className="mb-2 flex justify-end">{controles}</div>}
        <p className="font-semibold text-alerta">Não foi possível abrir este chamado. {erro}</p>
        {!embutido && <Link to={voltar} className="btn-secundario mt-4">Voltar</Link>}
      </div>
    );
  }
  if (!c) return <>{controles && <div className="mb-2 flex justify-end">{controles}</div>}<EsqueletoChamado tecnico={tecnico && !gaveta} /></>;

  const doSolicitante = c.solicitante === usuario?.id;
  const parecidas = tecnico && c.status !== "resolvido" && c.categoria
    ? <SolucoesParecidas chamadoId={c.id} categoriaId={c.categoria} categoriaNome={c.expand?.categoria?.nome} />
    : null;
  // "aguardando" é a etapa do meio (o TI está com o chamado), com outro nome
  const etapa = c.status === "aguardando" ? 1 : ETAPAS.indexOf(c.status);
  const rotuloEtapa = (s: Status) => (s === "em_andamento" && c.status === "aguardando" ? "Em espera" : ROTULO_STATUS[s]);

  const paraOServidor = (
    <>
      {c.status === "aberto" && doSolicitante && aFrente !== null && (
        <SenhaFila aFrente={aFrente} protocolo={c.protocolo} categoria={c.expand?.categoria?.nome} icone={c.expand?.categoria?.icone} animar={novo} />
      )}
      {c.status === "aguardando" && c.aguardando_motivo && !tecnico && <AvisoEspera c={c} />}
      {c.status === "resolvido" && doSolicitante && !c.confirmado && <Confirmacao chamadoId={c.id} resolvidoEm={c.resolvido_em} aoConcluir={carregar} />}
    </>
  );
  const oQueOTIFez = c.status === "resolvido" && (c.diagnostico || c.solucao) ? <OQueOTIFez c={c} doSolicitante={doSolicitante} /> : null;
  const conversa = <LinhaDoTempo chamadoId={c.id} solicitanteId={c.solicitante} solicitanteNome={nomeSolicitante(c)} status={c.status} aoMudarChamado={carregar} semTitulo={gaveta} />;

  // logo depois de abrir: a tela "Chamado enviado!" (some no "Acompanhar meu chamado")
  if (novo && !viuEnviado) {
    return (
      <ChamadoEnviado
        c={c}
        aFrente={aFrente}
        comEmail={!!usuario?.email}
        foraDoHorario={!dentroDoHorario(config) ? mensagemForaDoHorario(config) : ""}
        aoAcompanhar={() => { setViuEnviado(true); window.scrollTo({ top: 0 }); }}
      />
    );
  }

  if (gaveta) {
    return <Gaveta c={c} etiqueta={etiqueta} tecnico={tecnico} soLeitura={soLeitura} controles={controles} aoMudar={carregar} paraOServidor={paraOServidor} oQueOTIFez={oQueOTIFez} conversa={conversa} />;
  }

  return (
    <div className="max-w-5xl">
      {!embutido && (
        <Link to={voltar} className="mb-4 inline-flex items-center gap-1.5 font-semibold text-acento">
          <ArrowLeft className="size-5" aria-hidden="true" /> {tecnico ? "Fila" : "Meus chamados"}
        </Link>
      )}


      {/* no celular: dados do chamado, ações do técnico, conversa. No computador: ações na lateral */}
      <div className="grid gap-x-8 gap-y-7 md:grid-cols-[minmax(0,1fr)_20rem] md:grid-rows-[auto_1fr]">
        {/* min-w-0: em celular bem estreito (320 px) o conteúdo encolhe em vez de vazar da tela */}
        <div className="min-w-0 space-y-7 md:col-start-1">
          <header>
            <div className="flex items-start justify-between gap-2">
              <p className="font-display text-3xl font-extrabold tracking-tight min-[360px]:text-4xl">{c.protocolo}</p>
              {controles}
            </div>
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
          {/* três colunas iguais: bolinha centralizada e o nome embaixo (cabe em qualquer largura, até 320 px);
              a linha que liga as etapas vai do centro de uma bolinha ao centro da próxima */}
          <ol className="grid grid-cols-3" aria-label="Andamento do chamado">
            {ETAPAS.map((s, i) => {
              const feita = i < etapa || c.status === "resolvido";
              return (
                <li key={s} className="relative flex flex-col items-center gap-1.5 text-center" aria-current={i === etapa ? "step" : undefined}>
                  {i < ETAPAS.length - 1 && (
                    <span className={`absolute top-4 left-1/2 h-0.5 w-full -translate-y-1/2 ${i < etapa ? "bg-campo-700" : "bg-linha"}`} aria-hidden="true" />
                  )}
                  <span
                    className={`relative grid size-8 place-items-center rounded-full text-sm font-bold ${
                      feita ? "bg-campo-700 text-white" : i === etapa ? "bg-mar-700 text-white" : "bg-superficie text-tinta-2 ring-2 ring-linha"
                    }`}
                  >
                    {feita ? <Check className="size-4" aria-hidden="true" /> : i + 1}
                  </span>
                  <span className={`px-1 text-sm leading-tight font-semibold ${i <= etapa ? "text-tinta" : "text-tinta-2"}`}>{rotuloEtapa(s)}</span>
                </li>
              );
            })}
          </ol>

          {paraOServidor}

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

          {pc && parecidas}
        </div>

        {tecnico && (
          <aside className="md:col-start-2 md:row-span-2 md:row-start-1">
            <div className={embutido ? "" : "md:sticky md:top-6"}>
              <fieldset disabled={soLeitura} className="min-w-0"><PainelTecnico chamado={c} aoMudar={carregar} /></fieldset>
            </div>
          </aside>
        )}

        <div className="space-y-7 md:col-start-1">
          {/* celular: as ações do técnico vêm logo depois dos dados; as soluções parecidas, depois delas */}
          {!pc && parecidas}

          {oQueOTIFez}

          {conversa}
        </div>
      </div>
    </div>
  );
}

/** Logo depois de abrir o chamado: o Dino, a posição na fila e o que acontece agora. */
function ChamadoEnviado({ c, aFrente, comEmail, foraDoHorario, aoAcompanhar }: {
  c: TChamado; aFrente: number | null; comEmail: boolean; foraDoHorario: string; aoAcompanhar: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl space-y-6 py-2 text-center md:py-6" role="status">
      <img src="/icone.svg" alt="" className="animar-chegada mx-auto size-24" />
      <div>
        <h1 className="text-3xl font-bold">Chamado enviado!</h1>
        <p className="mt-2 text-lg text-tinta-2">
          O TI já recebeu. Você não precisa mandar WhatsApp: a resposta chega por aqui{comEmail ? " e por e-mail" : ""}.
        </p>
        {foraDoHorario && <p className="mt-2 text-tinta-2">{foraDoHorario}</p>}
      </div>
      {c.status === "aberto" && aFrente !== null && (
        <div className="text-left">
          <SenhaFila aFrente={aFrente} protocolo={c.protocolo} categoria={c.expand?.categoria?.nome} icone={c.expand?.categoria?.icone} animar />
        </div>
      )}
      <ol className="space-y-3 rounded-2xl bg-superficie p-5 text-left ring-1 ring-linha">
        {["Alguém do TI pega o seu chamado.", "Se precisar, ele pergunta por aqui.", "Quando resolver, você confirma se deu certo."].map((t, i) => (
          <li key={t} className="flex items-center gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-mar-50 font-bold text-acento">{i + 1}</span>
            <span>{t}</span>
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <button type="button" className="btn-primario" onClick={aoAcompanhar}>Acompanhar meu chamado</button>
        <Link to="/" className="btn-secundario">Voltar ao início</Link>
      </div>
    </div>
  );
}

/** Servidor com o chamado em espera: o que o TI está esperando (e, se for ele, o que fazer). */
function AvisoEspera({ c }: { c: TChamado }) {
  if (!c.aguardando_motivo) return null;
  return c.aguardando_motivo === "solicitante" ? (
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
  );
}

function OQueOTIFez({ c, doSolicitante }: { c: TChamado; doSolicitante: boolean }) {
  return (
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
  );
}

type Aba = "conversa" | "fotos" | "parecidas";

/**
 * Chamado na gaveta da direita (PC): cabeçalho fixo com protocolo, situação e os botões do painel; o problema e os dados
 * em duas colunas; as ações do técnico numa linha; e abas Conversa / Fotos / Soluções parecidas.
 */
function Gaveta({ c, etiqueta, tecnico, soLeitura, controles, aoMudar, paraOServidor, oQueOTIFez, conversa }: {
  c: TChamado; etiqueta?: string; tecnico: boolean; soLeitura: boolean; controles?: ReactNode; aoMudar: () => void;
  paraOServidor: ReactNode; oQueOTIFez: ReactNode; conversa: ReactNode;
}) {
  const [aba, setAba] = useState<Aba>("conversa");
  const comParecidas = tecnico && c.status !== "resolvido" && !!c.categoria;
  const parecidas = useSolucoesParecidas(c.id, comParecidas);
  const fotos = c.anexos?.length ?? 0;
  const nParecidas = parecidas?.itens.length ?? 0;
  const ramal = ramalDe(c.expand?.solicitante, c.expand?.setor);
  const abas: { id: Aba; rotulo: string; n?: number }[] = [
    { id: "conversa", rotulo: "Conversa" },
    ...(fotos ? [{ id: "fotos" as const, rotulo: "Fotos e vídeos", n: fotos }] : []),
    ...(nParecidas ? [{ id: "parecidas" as const, rotulo: "Soluções parecidas", n: nParecidas }] : []),
  ];
  const abaAtual = abas.some((a) => a.id === aba) ? aba : "conversa";

  return (
    <div className="space-y-5">
      <header className="sticky -top-4 z-10 -mx-6 -mt-4 flex items-start gap-3 border-b border-linha bg-superficie px-6 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          {etiqueta && <p className="text-xs font-bold tracking-wider text-acento uppercase">{etiqueta}</p>}
          <h2 className="font-display text-2xl leading-tight font-extrabold tracking-tight">{c.protocolo}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <SeloStatus status={c.status} />
            <EtiquetaPrioridade prioridade={c.prioridade} />
            <SeloTeste ficticio={c.ficticio} />
            <span className="inline-flex items-center gap-1.5 text-sm text-tinta-2">
              <IconeCategoria nome={c.expand?.categoria?.icone} className="size-4" />
              {c.expand?.categoria?.nome}
            </span>
          </div>
        </div>
        {controles}
      </header>

      <p className="texto-livre text-lg whitespace-pre-wrap">{c.descricao}</p>

      {/* a foto costuma ser a primeira coisa que o técnico quer ver: miniaturas logo abaixo do problema */}
      {fotos > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Fotos e vídeos do chamado">
          {c.anexos!.slice(0, 4).map((nome) => (
            <li key={nome}>
              <button type="button" onClick={() => setAba("fotos")} className="block size-20 overflow-hidden rounded-xl ring-1 ring-linha hover:ring-2 hover:ring-acento" aria-label="Ver fotos e vídeos">
                {/\.(mp4|mov|webm|3gp)$/i.test(nome)
                  ? <span className="grid size-full place-items-center bg-fundo text-xs font-semibold text-tinta-2">Vídeo</span>
                  : <img src={pb.files.getURL(c, nome, { thumb: "200x200" })} alt="" className="size-full object-cover" />}
              </button>
            </li>
          ))}
          {fotos > 4 && (
            <li><button type="button" onClick={() => setAba("fotos")} className="grid size-20 place-items-center rounded-xl bg-fundo font-semibold text-tinta-2 ring-1 ring-linha hover:ring-acento">+{fotos - 4}</button></li>
          )}
        </ul>
      )}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        {tecnico && <Dado termo="Quem pediu" valor={`${nomeSolicitante(c)}${ramal ? ` (ramal ${ramal})` : ""}`} />}
        <Dado termo="Setor" valor={c.expand?.setor?.nome} />
        {tecnico && <Dado termo="Como chegou" valor={ROTULO_ORIGEM[c.origem]} />}
        <Dado termo="Quem é afetado" valor={ROTULO_IMPACTO[c.impacto]} />
        <div>
          <dt className="text-tinta-2">{({ resolvido: "Aberto em", aberto: "Esperando", em_andamento: "Em atendimento", aguardando: "Em espera" } as const)[c.status]}</dt>
          <dd className="font-semibold">{c.status === "resolvido" ? dataHora(c.created) : <Espera c={c} />}</dd>
        </div>
        {!tecnico && <Dado termo="Responsável no TI" valor={c.expand?.responsavel?.name} />}
      </dl>

      {tecnico && c.solicitante && <HistoricoDaPessoa c={c} />}
      {paraOServidor}
      {tecnico && !soLeitura && c.status !== "resolvido" && <LigarAoAviso chamadoId={c.id} aviso={c.aviso} aoMudar={aoMudar} />}
      {tecnico && <fieldset disabled={soLeitura} className="min-w-0"><PainelTecnico chamado={c} aoMudar={aoMudar} linha /></fieldset>}
      {oQueOTIFez}

      <div>
        {/* uma aba só (sem fotos nem soluções parecidas) ainda serve de título da conversa */}
        <div className="mb-4">
          <AbasPagina rotulo="O que ver do chamado" itens={abas.map((a) => ({ rotulo: a.rotulo, numero: a.n, ativo: abaAtual === a.id, aoClicar: () => setAba(a.id) }))} />
        </div>
        {abaAtual === "conversa" && conversa}
        {abaAtual === "fotos" && <GaleriaAnexos chamado={c} />}
        {abaAtual === "parecidas" && parecidas && (
          <>
            <p className="text-sm text-tinta-2">Chamados de {c.expand?.categoria?.nome ?? "mesma categoria"} já resolvidos, os mais parecidos primeiro.</p>
            <ListaParecidas dados={parecidas} categoriaId={c.categoria} />
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Histórico de quem pediu (painel de contexto, como nos sistemas de mercado): quantos chamados a pessoa abriu
 * nos últimos 30 dias e de qual tipo, para notar problema que se repete.
 */
function HistoricoDaPessoa({ c }: { c: TChamado }) {
  const [lista, setLista] = useState<TChamado[] | null>(null);
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    const desde = new Date(Date.now() - 30 * 86400000).toISOString().replace("T", " ");
    pb.collection("chamados").getList<TChamado>(1, 30, {
      filter: pb.filter("solicitante = {:s} && id != {:id} && created >= {:d}", { s: c.solicitante, id: c.id, d: desde }),
      sort: "-created", expand: "categoria", fields: "id,protocolo,descricao,status,created,categoria,expand.categoria.nome", requestKey: null,
    }).then((r) => setLista(r.items)).catch(() => setLista([]));
  }, [c.id, c.solicitante]);
  if (lista === null) return <Bloco className="h-6 w-72" />;
  const nome = nomeSolicitante(c).split(" ")[0];
  if (!lista.length) return <p className="text-sm text-tinta-2">Primeiro chamado de {nome} nos últimos 30 dias.</p>;
  const porTipo = new Map<string, number>();
  lista.forEach((x) => { const t = x.expand?.categoria?.nome ?? "Outro"; porTipo.set(t, (porTipo.get(t) ?? 0) + 1); });
  const [tipo, n] = [...porTipo.entries()].sort((a, b) => b[1] - a[1])[0];
  const mesmo = c.expand?.categoria?.nome === tipo ? " (o mesmo deste)" : "";
  return (
    <div className="text-sm">
      <button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)} className="inline-flex min-h-9 items-center gap-1.5 text-left font-semibold text-acento hover:underline">
        <IconeHistorico className="size-4 shrink-0" aria-hidden="true" />
        {nome} abriu mais {lista.length} {lista.length === 1 ? "chamado" : "chamados"} nos últimos 30 dias{n > 1 ? ` · ${n} de ${tipo}${mesmo}` : ""}
      </button>
      {aberto && (
        <ul className="mt-1 divide-y divide-linha rounded-xl ring-1 ring-linha">
          {lista.map((x) => (
            <li key={x.id}>
              <LinkChamado id={x.id} para={`/ti/chamado/${x.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-fundo">
                <span className="w-24 shrink-0 font-display font-bold">{x.protocolo}</span>
                <span className="texto-livre min-w-0 flex-1 truncate">{x.descricao}</span>
                <SeloStatus status={x.status} />
              </LinkChamado>
            </li>
          ))}
        </ul>
      )}
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
function Confirmacao({ chamadoId, aoConcluir, resolvidoEm }: { chamadoId: string; aoConcluir: () => void; resolvidoEm?: string }) {
  const { config } = useConfigTI();
  const faltam = diasParaConfirmar(resolvidoEm, config.dias_confirmar);
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
      if (acao === "confirmar") convidarOpiniao();
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
          {faltam !== null && (
            <p className="mt-1 text-sm text-tinta-2">
              {faltam === 0 ? "Sem resposta, ele é considerado resolvido ainda hoje." : `Sem resposta, ele é considerado resolvido em ${faltam} ${faltam === 1 ? "dia útil" : "dias úteis"}.`}
            </p>
          )}
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
