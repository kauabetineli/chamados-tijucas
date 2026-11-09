import { AbasPagina, CabecalhoPagina } from "../components/CabecalhoPagina";
import { diasParaConfirmar, useConfigTI } from "../lib/configTI";
import { CheckCircle2, MessageCircleQuestion, Plus, Search, Wrench } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { EsqueletoLinhas } from "../components/Esqueleto";
import { MuralAvisos } from "../components/MuralAvisos";
import { LinhaChamado } from "../components/LinhaChamado";
import { Paginacao, usePaginacao } from "../components/Paginacao";
import { SenhaFila } from "../components/SenhaFila";
import { useAuth } from "../lib/auth";
import { avisar } from "../lib/avisos";
import { convidarOpiniao } from "../lib/opiniao";
import { Avatar } from "../components/Avatar";
import { resumo, ROTULO_AGUARDANDO, tempoRelativo } from "../lib/formato";
import { EXPAND_CHAMADO, mensagemErro, pb, type Chamado } from "../lib/pb";
import { buscarPagina } from "../lib/paginar";
import { useRealtime } from "../lib/useRealtime";
import { ultimaVisita } from "../lib/visto";
import { LinkChamado, useVerChamado } from "../lib/verChamado";

type Posicoes = Record<string, { a_frente: number; posicao: number }>;

export function MeusChamados() {
  const { usuario } = useAuth();
  const [chamados, setChamados] = useState<Chamado[] | null>(null);
  const [posicoes, setPosicoes] = useState<Posicoes>({});
  // última mensagem ou mudança feita pelo TI em cada chamado (para o "Nova resposta")
  const [ultimaDoTI, setUltimaDoTI] = useState<Record<string, number>>({});
  // última mensagem escrita pelo TI (aparece em "Com o TI")
  const [ultimaMensagem, setUltimaMensagem] = useState<Record<string, string>>({});
  const [verTodaFila, setVerTodaFila] = useState(false);
  const [confirmando, setConfirmando] = useState("");
  const { config } = useConfigTI();

  const carregar = useCallback(async () => {
    if (!usuario) return;
    const [lista, pos, doTI] = await Promise.all([
      // só os ativos vêm inteiros; os já confirmados (que só crescem) são paginados abaixo
      pb.collection("chamados").getFullList<Chamado>({
        filter: pb.filter('solicitante = {:u} && (status != "resolvido" || confirmado = false)', { u: usuario.id }),
        sort: "-created",
        expand: EXPAND_CHAMADO,
      }),
      pb.send<{ itens: Posicoes }>("/api/fila/minhas-posicoes", {}),
      pb.collection("interacoes").getList<{ chamado: string; created: string; tipo: string; texto: string }>(1, 200, {
        filter: pb.filter('chamado.solicitante = {:u} && autor != {:u} && (tipo = "comentario" || tipo = "status")', { u: usuario.id }),
        sort: "-created",
        fields: "chamado,created,tipo,texto",
      }).catch(() => ({ items: [] })),
    ]);
    setChamados(lista);
    setPosicoes(pos?.itens ?? {});
    const mapa: Record<string, number> = {};
    const msgs: Record<string, string> = {};
    for (const i of doTI.items) {
      mapa[i.chamado] ??= Date.parse(i.created.replace(" ", "T"));
      if (i.tipo === "comentario" && i.texto) msgs[i.chamado] ??= i.texto;
    }
    setUltimaDoTI(mapa);
    setUltimaMensagem(msgs);
  }, [usuario]);

  useEffect(() => { carregar().catch(() => setChamados([])); }, [carregar]);
  // a posição muda quando QUALQUER chamado anda; o PocketBase só avisa dos meus,
  // então também atualizamos a cada 30 s
  useRealtime("chamados", () => carregar().catch(() => {}));
  useEffect(() => {
    const t = window.setInterval(() => carregar().catch(() => {}), 30_000);
    return () => window.clearInterval(t);
  }, [carregar]);

  // histórico (todos os resolvidos): paginado no banco, com busca
  const [params, setParams] = useSearchParams();
  const aba = params.get("aba") === "historico" ? "historico" : "abertos";
  const { aberto: verId, abrir } = useVerChamado();
  const pag = usePaginacao("meus-anteriores", 10);
  const [busca, setBusca] = useState("");
  const [historico, setHistorico] = useState<Chamado[] | null>(null);
  const [totalHistorico, setTotalHistorico] = useState(0);
  const [totalLista, setTotalLista] = useState(0);
  useEffect(() => {
    if (!usuario) return;
    const t = window.setTimeout(() => {
      const termo = busca.trim();
      buscarPagina<Chamado>("chamados", pag.pagina, pag.porPagina, {
        filter: termo
          ? pb.filter('solicitante = {:u} && status = "resolvido" && (protocolo ~ {:q} || descricao ~ {:q} || solucao ~ {:q})', { u: usuario.id, q: termo })
          : pb.filter('solicitante = {:u} && status = "resolvido"', { u: usuario.id }),
        sort: "-resolvido_em",
        expand: EXPAND_CHAMADO,
        requestKey: "meu-historico",
      }).then((r) => {
        setHistorico(r.itens);
        setTotalLista(r.total);
        if (!termo) setTotalHistorico(r.total);
        if (r.pagina !== pag.pagina) pag.setPagina(r.pagina);
      }).catch(() => {});
    }, busca ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [usuario, pag.pagina, pag.porPagina, busca]); // eslint-disable-line react-hooks/exhaustive-deps

  // novidade = o TI escreveu ou mudou o status depois da última vez que a pessoa abriu o chamado
  const novidade = (c: Chamado) => (ultimaDoTI[c.id] ?? 0) > ultimaVisita(c.id);

  if (chamados === null) {
    return (
      <div className="mx-auto max-w-2xl space-y-7">
        <CabecalhoPagina titulo="Meus chamados" />
        <EsqueletoLinhas quantos={3} rotulo="Carregando seus chamados..." />
      </div>
    );
  }

  const naFila = chamados
    .filter((c) => c.status === "aberto")
    .sort((a, b) => (posicoes[a.id]?.a_frente ?? 0) - (posicoes[b.id]?.a_frente ?? 0));
  // "Precisa de você": o que depende da PESSOA agora (responder o TI ou confirmar se deu certo). Vem no topo.
  const responder = chamados.filter((c) => c.status === "aguardando" && c.aguardando_motivo === "solicitante");
  const paraConfirmar = chamados.filter((c) => c.status === "resolvido" && !c.confirmado);
  // com o TI: em atendimento ou em espera de peça/terceiro
  const emAtendimento = chamados.filter((c) => c.status === "em_andamento" || (c.status === "aguardando" && c.aguardando_motivo !== "solicitante"));
  const precisaDeVoce = responder.length + paraConfirmar.length;
  const emAberto = naFila.length + emAtendimento.length + precisaDeVoce;

  if (chamados.length === 0 && totalHistorico === 0 && historico !== null) {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <h1 className="text-2xl font-bold md:text-3xl">Precisa de ajuda do TI?</h1>
        <p className="mt-3 text-lg text-tinta-2">
          Abra um chamado e acompanhe por aqui a sua vez na fila e as nossas respostas.
        </p>
        <Link to="/novo" className="btn-primario mt-6">
          <Plus className="size-5" aria-hidden="true" /> Novo chamado
        </Link>
      </div>
    );
  }

  const irPara = (a: "abertos" | "historico") => {
    const p = new URLSearchParams(params);
    if (a === "historico") p.set("aba", "historico"); else p.delete("aba");
    p.delete("ver");
    setParams(p, { replace: true });
  };

  // "O Hugo está cuidando de 1 chamado seu, 15 estão na fila e 1 precisa da sua resposta."
  const cuidando = [...new Set(emAtendimento.map((c) => c.expand?.responsavel?.name?.split(" ")[0]).filter(Boolean))];
  const resumoDoDia = emAberto === 0 ? "Nada em aberto agora." : [
    emAtendimento.length ? `${cuidando.length === 1 ? `${cuidando[0]} está` : "Estamos"} cuidando de ${emAtendimento.length} ${emAtendimento.length === 1 ? "chamado seu" : "chamados seus"}` : "",
    naFila.length ? `${naFila.length} ${naFila.length === 1 ? "está" : "estão"} na fila` : "",
    precisaDeVoce ? `${precisaDeVoce} ${precisaDeVoce === 1 ? "precisa" : "precisam"} de você` : "",
  ].filter(Boolean).join(", ").replace(/, ([^,]*)$/, " e $1") + ".";

  async function deuCerto(c: Chamado) {
    setConfirmando(c.id);
    try {
      await pb.send(`/api/chamados/${c.id}/confirmar`, { method: "POST", body: {} });
      avisar(`Que bom! ${c.protocolo} encerrado.`);
      convidarOpiniao();
      await carregar();
    } catch (err) {
      avisar(mensagemErro(err), { tipo: "erro" });
    } finally {
      setConfirmando("");
    }
  }

  const FILA_CURTA = 3;
  const filaVisivel = verTodaFila ? naFila : naFila.slice(0, FILA_CURTA);

  return (
    <div className="grid items-start gap-x-10 gap-y-7 lg:grid-cols-[minmax(0,1fr)_19rem]">
    <div className="min-w-0 space-y-7">
      <CabecalhoPagina
        titulo={`${saudacao()}, ${usuario?.name.split(" ")[0] ?? ""}!`}
        subtitulo={aba === "abertos" ? resumoDoDia : undefined}
        // no PC a barra do topo já tem "Meus chamados" e "Histórico": as abas aqui são só do celular
        abas={<div className="md:hidden"><AbasPagina rotulo="Quais chamados" itens={[
          { rotulo: "Em aberto", ativo: aba === "abertos", aoClicar: () => irPara("abertos"), numero: emAberto },
          { rotulo: "Histórico", ativo: aba === "historico", aoClicar: () => irPara("historico"), numero: totalHistorico },
        ]} /></div>}
      />

      {/* celular: avisos aqui no topo; PC: na coluna da direita */}
      <MuralAvisos className="lg:hidden" />

      {aba === "abertos" ? (
        <>
          {emAberto === 0 && (
            <div className="rounded-2xl bg-superficie p-8 text-center ring-1 ring-linha">
              <p className="text-xl font-bold">Nada em aberto.</p>
              <p className="mt-1 text-tinta-2">Os chamados resolvidos ficam no <button type="button" onClick={() => irPara("historico")} className="font-semibold text-acento underline underline-offset-4">Histórico</button>.</p>
              <Link to="/novo" className="btn-primario mt-5"><Plus className="size-5" aria-hidden="true" /> Novo chamado</Link>
            </div>
          )}

          {precisaDeVoce > 0 && (
            <section aria-labelledby="t-voce" className="space-y-3">
              <h2 id="t-voce" className="flex items-center gap-2 text-lg md:text-xl font-bold">
                <span className="size-2.5 rounded-full bg-acento" aria-hidden="true" /> Precisa de você
              </h2>
              {responder.map((c) => (
                <CartaoAcao
                  key={c.id}
                  c={c}
                  selecionado={verId === c.id}
                  Icone={MessageCircleQuestion}
                  titulo="Precisamos de uma resposta sua."
                  acao="Responder"
                  novidade={novidade(c)}
                />
              ))}
              {paraConfirmar.map((c) => (
                <div key={c.id} className={`rounded-2xl border-l-8 border-acento bg-mar-50 p-4 ring-1 ${verId === c.id ? "ring-2 ring-acento" : "ring-linha"}`}>
                  <LinkChamado id={c.id} para={`/chamado/${c.id}`} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-acento" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">Resolvemos: {resumo(c.descricao, 70).replace(/[.!?…]+$/, "")}. Deu certo?</span>
                      <span className="block text-sm text-tinta-2">
                        <span className="font-display font-bold text-tinta">{c.protocolo}</span>
                        {/* a solução pode ocupar várias linhas: vai na linha de baixo (sem o "·" de antes) */}
                        {c.solucao && <span className="block">Solução: {resumo(c.solucao, 90)}</span>}
                      </span>
                      {(() => {
                        const faltam = diasParaConfirmar(c.resolvido_em, config.dias_confirmar);
                        return faltam === null ? null : (
                          <span className="mt-0.5 block text-sm text-tinta-2">
                            {faltam === 0 ? "Sem resposta, é considerado resolvido ainda hoje." : `Sem resposta, é considerado resolvido em ${faltam} ${faltam === 1 ? "dia útil" : "dias úteis"}.`}
                          </span>
                        );
                      })()}
                      {novidade(c) && <SeloNovidade />}
                    </span>
                  </LinkChamado>
                  <div className="mt-3 flex flex-wrap gap-2 sm:pl-9">
                    <button type="button" className="btn-sucesso min-h-11 flex-1 sm:flex-none" disabled={confirmando === c.id} onClick={() => deuCerto(c)}>
                      {confirmando === c.id ? "Confirmando..." : "Sim, resolveu"}
                    </button>
                    <button type="button" className="btn-secundario min-h-11 flex-1 sm:flex-none" onClick={(e) => abrir(c.id, e.currentTarget)}>Não resolveu</button>
                  </div>
                </div>
              ))}
            </section>
          )}

          {emAtendimento.length > 0 && (
            <section aria-labelledby="t-atend" className="space-y-3">
              <h2 id="t-atend" className="text-lg md:text-xl font-bold">Em atendimento</h2>
              {emAtendimento.map((c) => {
                const quem = c.expand?.responsavel?.name?.split(" ")[0] ?? "Um técnico";
                const msg = ultimaMensagem[c.id];
                return (
                  <LinkChamado
                    key={c.id}
                    id={c.id}
                    para={`/chamado/${c.id}`}
                    className={`flex items-start gap-3 rounded-2xl bg-superficie p-4 ring-1 ${verId === c.id ? "ring-2 ring-acento" : "ring-linha hover:ring-acento"}`}
                  >
                    {c.responsavel ? <Avatar id={c.responsavel} nome={c.expand?.responsavel?.name} /> : <Wrench className="mt-0.5 size-6 shrink-0" aria-hidden="true" />}
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">
                        {c.status === "aguardando" && c.aguardando_motivo
                          ? `${quem} está aguardando ${ROTULO_AGUARDANDO[c.aguardando_motivo]}`
                          : `${quem} está cuidando de: ${resumo(c.descricao, 60)}`}
                      </span>
                      <span className="meta block text-sm text-tinta-2">
                        <span className="font-display font-bold text-tinta">{c.protocolo}</span>
                        {c.status === "aguardando" ? <span>{resumo(c.descricao, 60)}</span> : c.iniciado_em ? <span>começou {tempoRelativo(c.iniciado_em)}</span> : null}
                      </span>
                      {msg && (
                        <span className="mt-2 block rounded-xl rounded-tl-md bg-mar-50 px-3 py-2 text-sm">
                          {novidade(c) && <b className="mb-0.5 block text-xs font-bold text-acento">Mensagem nova</b>}
                          <span className="texto-livre line-clamp-2">“{msg}”</span>
                        </span>
                      )}
                      {!msg && novidade(c) && <SeloNovidade />}
                    </span>
                  </LinkChamado>
                );
              })}
            </section>
          )}

          {naFila.length > 0 && (
            <section aria-labelledby="t-fila" className="space-y-4">
              <h2 id="t-fila" className="text-lg md:text-xl font-bold">Na fila <span className="font-display text-base text-tinta-2">{naFila.length}</span></h2>
              {filaVisivel.map((c, i) => i === 0 ? (
                <LinkChamado key={c.id} id={c.id} para={`/chamado/${c.id}`} className={`block rounded-[18px] focus-visible:outline-offset-4 ${verId === c.id ? "ring-4 ring-acento" : ""}`}>
                  <SenhaFila
                    aFrente={posicoes[c.id]?.a_frente ?? 0}
                    protocolo={c.protocolo}
                    categoria={c.expand?.categoria?.nome}
                    icone={c.expand?.categoria?.icone}
                    descricao={resumo(c.descricao, 90)}
                    novidade={novidade(c)}
                  />
                </LinkChamado>
              ) : (
                <LinkChamado
                  key={c.id}
                  id={c.id}
                  para={`/chamado/${c.id}`}
                  className={`flex items-center gap-4 rounded-2xl bg-superficie px-4 py-3 ring-1 ${verId === c.id ? "ring-2 ring-acento" : "ring-linha hover:ring-acento"}`}
                >
                  <span className="w-12 shrink-0 font-display text-2xl font-extrabold">{(posicoes[c.id]?.a_frente ?? 0) + 1}º</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{resumo(c.descricao, 80)}</span>
                    <span className="meta block text-sm text-tinta-2"><span>{c.expand?.categoria?.nome ?? "Outro"}</span><span>{c.protocolo}</span></span>
                    {novidade(c) && <SeloNovidade />}
                  </span>
                </LinkChamado>
              ))}
              {naFila.length > FILA_CURTA && (
                <button type="button" className="btn-secundario w-full" onClick={() => setVerTodaFila(!verTodaFila)} aria-expanded={verTodaFila}>
                  {verTodaFila ? "Mostrar menos" : `Ver os outros ${naFila.length - FILA_CURTA}`}
                </button>
              )}
              <p className="text-sm text-tinta-2">
                A ordem segue a urgência de cada pedido e, depois, quem pediu primeiro.
              </p>
            </section>
          )}

        </>
      ) : (
        <section aria-label="Histórico" className="space-y-3">
          <label className="relative block">
            <span className="sr-only">Pesquisar no histórico</span>
            <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-tinta-2" aria-hidden="true" />
            <input type="search" enterKeyHint="search" className="campo pl-12" placeholder="Protocolo ou palavra do problema" value={busca} onChange={(e) => { setBusca(e.target.value); pag.voltarAoInicio(); }} />
          </label>
          {historico === null ? (
            <EsqueletoLinhas quantos={4} />
          ) : historico.length === 0 ? (
            <p className="py-6 text-center text-tinta-2">{busca ? "Nada encontrado com essa busca." : "Nenhum chamado resolvido ainda."}</p>
          ) : (
            <ul className="divide-y divide-linha">
              {historico.map((c) => <LinhaChamado key={c.id} c={c} para={`/chamado/${c.id}`} historico selecionado={verId === c.id} />)}
            </ul>
          )}
          {historico && historico.length > 0 && (
            <Paginacao
              pagina={pag.pagina}
              porPagina={pag.porPagina}
              total={totalLista}
              aoMudarPagina={pag.setPagina}
              aoMudarPorPagina={pag.setPorPagina}
              rotulo="chamados"
            />
          )}
        </section>
      )}
    </div>

    {/* PC largo: coluna da direita com os avisos (e o "Como funciona" no começo) */}
    <aside className="hidden space-y-5 lg:sticky lg:top-24 lg:block" aria-label="Informações">
      <MuralAvisos />
      {/* "Como funciona" só no começo (até o primeiro chamado); sem nenhum, a tela vazia já explica */}
      {chamados.length + totalHistorico <= 1 && (
        <section aria-labelledby="t-como" className="rounded-2xl bg-superficie p-5 ring-1 ring-linha">
          <h2 id="t-como" className="font-bold">Como funciona</h2>
          <ol className="mt-3 space-y-3 text-sm">
            {["Você abre o chamado e recebe a sua posição na fila.", "Atendemos na ordem da fila; o que é urgente passa na frente.", "A conversa acontece aqui, sem precisar mandar WhatsApp."].map((t, i) => (
              <li key={t} className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-mar-50 text-xs font-bold text-acento">{i + 1}</span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </aside>
    </div>
  );
}

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

/** Cartão do "Precisa de você": o que a pessoa tem que fazer, com o botão da ação à direita. */
function CartaoAcao({ c, Icone, titulo, acao, detalhe, novidade, selecionado }: {
  c: Chamado;
  Icone: typeof Wrench;
  titulo: string;
  acao: string;
  detalhe?: string;
  novidade?: boolean;
  selecionado?: boolean;
}) {
  return (
    <LinkChamado
      id={c.id}
      para={`/chamado/${c.id}`}
      className={`flex items-center gap-3 rounded-2xl border-l-8 border-acento bg-mar-50 p-4 ring-1 ${selecionado ? "ring-2 ring-acento" : "ring-linha hover:ring-acento"}`}
    >
      <Icone className="size-6 shrink-0 text-acento" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{titulo}</span>
        <span className="block text-tinta-2">
          <span className="font-display font-bold text-tinta">{c.protocolo}</span> {resumo(c.descricao, 70)}
        </span>
        {detalhe && <span className="mt-0.5 block truncate text-sm text-tinta-2">{detalhe}</span>}
        {novidade && <SeloNovidade />}
      </span>
      <span className="hidden shrink-0 rounded-xl bg-mar-700 px-4 py-2 text-sm font-semibold text-white sm:inline-flex">{acao}</span>
    </LinkChamado>
  );
}

function SeloNovidade() {
  return (
    <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-mar-700 px-2.5 py-0.5 text-xs font-bold text-white">
      <span className="size-2 rounded-full bg-sol" aria-hidden="true" /> Nova resposta do TI
    </span>
  );
}
