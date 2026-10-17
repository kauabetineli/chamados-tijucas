import { History, Inbox, Plus, Search, Wrench } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { EsqueletoLinhas } from "../components/Esqueleto";
import { LinhaChamado } from "../components/LinhaChamado";
import { Paginacao, usePaginacao } from "../components/Paginacao";
import { SenhaFila } from "../components/SenhaFila";
import { useAuth } from "../lib/auth";
import { resumo } from "../lib/formato";
import { EXPAND_CHAMADO, pb, type Chamado } from "../lib/pb";
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
      pb.collection("interacoes").getList<{ chamado: string; created: string }>(1, 200, {
        filter: pb.filter('chamado.solicitante = {:u} && autor != {:u} && (tipo = "comentario" || tipo = "status")', { u: usuario.id }),
        sort: "-created",
        fields: "chamado,created",
      }).catch(() => ({ items: [] })),
    ]);
    setChamados(lista);
    setPosicoes(pos?.itens ?? {});
    const mapa: Record<string, number> = {};
    for (const i of doTI.items) mapa[i.chamado] ??= Date.parse(i.created.replace(" ", "T"));
    setUltimaDoTI(mapa);
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
  const { aberto: verId } = useVerChamado();
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
        <h1 className="text-3xl font-bold">Meus chamados</h1>
        <EsqueletoLinhas quantos={3} rotulo="Carregando seus chamados..." />
      </div>
    );
  }

  const naFila = chamados
    .filter((c) => c.status === "aberto")
    .sort((a, b) => (posicoes[a.id]?.a_frente ?? 0) - (posicoes[b.id]?.a_frente ?? 0));
  const emAtendimento = chamados.filter((c) => c.status === "em_andamento");
  const paraConfirmar = chamados.filter((c) => c.status === "resolvido" && !c.confirmado);
  const emAberto = naFila.length + emAtendimento.length + paraConfirmar.length;

  if (chamados.length === 0 && totalHistorico === 0 && historico !== null) {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <h1 className="text-3xl font-bold">Precisa de ajuda do TI?</h1>
        <p className="mt-3 text-lg text-tinta-2">
          Abra um chamado e acompanhe por aqui a sua vez na fila e as respostas do Departamento de TI.
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
  const aba_ = (id: "abertos" | "historico", rotulo: string, Icone: typeof Plus, n: number) => (
    <button
      type="button"
      role="tab"
      aria-selected={aba === id}
      onClick={() => irPara(id)}
      className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 font-semibold sm:flex-none ${aba === id ? "bg-mar-700 text-white" : "text-tinta-2 hover:bg-fundo hover:text-tinta"}`}
    >
      <Icone className="size-4" aria-hidden="true" /> {rotulo} <span className="font-display">{n}</span>
    </button>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Meus chamados</h1>
        <div role="tablist" aria-label="Quais chamados" className="flex w-full gap-1 rounded-xl bg-superficie p-1 ring-1 ring-linha sm:w-auto">
          {aba_("abertos", "Em aberto", Inbox, emAberto)}
          {aba_("historico", "Histórico", History, totalHistorico)}
        </div>
      </div>

      {aba === "abertos" ? (
        <>
          {emAberto === 0 && (
            <div className="rounded-2xl bg-superficie p-8 text-center ring-1 ring-linha">
              <p className="text-xl font-bold">Nada em aberto.</p>
              <p className="mt-1 text-tinta-2">Os chamados resolvidos ficam no <button type="button" onClick={() => irPara("historico")} className="font-semibold text-acento underline underline-offset-4">Histórico</button>.</p>
              <Link to="/novo" className="btn-primario mt-5"><Plus className="size-5" aria-hidden="true" /> Novo chamado</Link>
            </div>
          )}

          {naFila.length > 0 && (
            <section aria-labelledby="t-fila" className="space-y-4">
              <h2 id="t-fila" className="text-xl font-bold">Aguardando atendimento</h2>
              {naFila.map((c) => (
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
              ))}
              <p className="text-sm text-tinta-2">
                A ordem segue a urgência de cada pedido e, depois, quem pediu primeiro.
              </p>
            </section>
          )}

          {emAtendimento.length > 0 && (
            <section aria-labelledby="t-atend" className="space-y-3">
              <h2 id="t-atend" className="text-xl font-bold">Em atendimento</h2>
              {emAtendimento.map((c) => (
                <LinkChamado key={c.id} id={c.id} para={`/chamado/${c.id}`} className={`flex items-start gap-3 rounded-2xl border-l-8 border-sol bg-superficie p-4 ring-1 ${verId === c.id ? "ring-2 ring-acento" : "ring-linha hover:ring-acento"}`}>
                  <Wrench className="mt-0.5 size-6 shrink-0 text-tinta" aria-hidden="true" />
                  <span>
                    <span className="block font-bold">
                      {c.expand?.responsavel?.name ?? "Um técnico"} está cuidando do seu chamado.
                    </span>
                    <span className="block text-tinta-2">
                      <span className="font-display font-bold text-tinta">{c.protocolo}</span> {resumo(c.descricao, 70)}
                    </span>
                    {novidade(c) && <SeloNovidade />}
                  </span>
                </LinkChamado>
              ))}
            </section>
          )}

          {paraConfirmar.length > 0 && (
            <section aria-labelledby="t-conf">
              <h2 id="t-conf" className="text-xl font-bold">Resolvidos: confirme se deu certo</h2>
              <ul className="divide-y divide-linha">
                {paraConfirmar.map((c) => <LinhaChamado key={c.id} c={c} para={`/chamado/${c.id}`} novidade={novidade(c)} historico selecionado={verId === c.id} />)}
              </ul>
            </section>
          )}
        </>
      ) : (
        <section aria-label="Histórico" className="space-y-3">
          <label className="relative block">
            <span className="sr-only">Pesquisar no histórico</span>
            <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-tinta-2" aria-hidden="true" />
            <input type="search" className="campo pl-12" placeholder="Protocolo ou palavra do problema" value={busca} onChange={(e) => { setBusca(e.target.value); pag.voltarAoInicio(); }} />
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
  );
}

function SeloNovidade() {
  return (
    <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-mar-700 px-2.5 py-0.5 text-xs font-bold text-white">
      <span className="size-2 rounded-full bg-sol" aria-hidden="true" /> Nova resposta do TI
    </span>
  );
}
