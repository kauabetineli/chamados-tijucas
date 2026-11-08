import { CabecalhoPagina } from "../../components/CabecalhoPagina";
import { useMediaQuery } from "../../lib/useMediaQuery";
import { definirPadraoDoPainel } from "../../lib/moldes";
import { ChevronRight, History, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { LinkChamado, useVerChamado } from "../../lib/verChamado";
import { IconeCategoria } from "../../components/Icone";
import { EsqueletoCartoes } from "../../components/Esqueleto";
import { useCategorias } from "../../components/CamposChamado";
import { Paginacao, usePaginacao } from "../../components/Paginacao";
import { SeloTeste } from "../../components/Selos";
import { dataCurta } from "../../lib/formato";
import { buscarPagina } from "../../lib/paginar";
import { EXPAND_CHAMADO, nomeSolicitante, pb, type Chamado } from "../../lib/pb";

/**
 * Base de soluções: o que já foi resolvido, para consultar ANTES de atender.
 *
 * Começa pela pergunta "que tipo de problema?" (as categorias, com quantas soluções cada uma tem) ou pela busca,
 * em vez de despejar uma lista longa de cara. A lista aparece depois de escolher a categoria, buscar ou tocar em
 * "Ver todos". No cartão, a SOLUÇÃO vem em destaque (é o que o técnico procura) e os textos longos são encurtados:
 * o chamado completo abre ao tocar.
 */
export function Historico() {
  const { aberto: verId } = useVerChamado();
  const categorias = useCategorias();
  const [q, setQ] = useState("");
  // vindo de "Ver todos no histórico" (soluções parecidas): já abre filtrado pela categoria
  const [categoria, setCategoria] = useState(() => new URLSearchParams(window.location.search).get("categoria") ?? "");
  // PC: começa já com as mais recentes de todas (a categoria vira filtro). Celular: escolhe o tipo primeiro.
  const noPc = useMediaQuery("(min-width: 768px)");
  const [verTodos, setVerTodos] = useState(() => window.matchMedia("(min-width: 768px)").matches);
  // causa e solução são opcionais ao resolver: por padrão o Histórico mostra só o que tem registro
  const [soComSolucao, setSoComSolucao] = useState(true);
  const [itens, setItens] = useState<Chamado[] | null>(null);
  const [total, setTotal] = useState(0);
  const [contagem, setContagem] = useState<Record<string, number> | null>(null);
  // tela larga: sem nada clicado, o painel ao lado mostra a primeira solução da lista (lib/moldes.ts)
  const idPrimeira = itens?.[0]?.id ?? null;
  useEffect(() => {
    definirPadraoDoPainel(idPrimeira ? { id: idPrimeira, etiqueta: "Solução mais recente" } : null);
  }, [idPrimeira]);
  useEffect(() => () => definirPadraoDoPainel(null), []);
  const pag = usePaginacao("historico", 10);

  const busca = q.trim();
  const mostrarLista = !!busca || !!categoria || verTodos;
  const filtroBase = soComSolucao ? 'status = "resolvido" && (solucao != "" || diagnostico != "")' : 'status = "resolvido"';

  // quantas soluções cada tipo de problema tem (e o total), para a tela inicial
  useEffect(() => {
    if (!categorias.length) return;
    let vivo = true;
    const contar = (filtro: string, chave: string) =>
      pb.collection("chamados").getList(1, 1, { filter: filtro, fields: "id", requestKey: `historico-${chave}` }).then((r) => r.totalItems);
    Promise.all([
      contar(filtroBase, "todos").then((n) => ["", n] as const),
      ...categorias.map((c) => contar(pb.filter(`${filtroBase} && categoria = {:c}`, { c: c.id }), c.id).then((n) => [c.id, n] as const)),
    ])
      .then((pares) => { if (vivo) setContagem(Object.fromEntries(pares)); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [categorias, filtroBase]);

  useEffect(() => {
    if (!mostrarLista) return;
    const t = window.setTimeout(async () => {
      const partes = [filtroBase];
      const params: Record<string, string> = {};
      if (busca) {
        partes.push("(descricao ~ {:q} || diagnostico ~ {:q} || solucao ~ {:q} || protocolo ~ {:q})");
        params.q = busca;
      }
      if (categoria) { partes.push("categoria = {:c}"); params.c = categoria; }
      try {
        const r = await buscarPagina<Chamado>("chamados", pag.pagina, pag.porPagina, {
          filter: pb.filter(partes.join(" && "), params),
          sort: "-resolvido_em",
          expand: EXPAND_CHAMADO,
        });
        setItens(r.itens);
        setTotal(r.total);
        if (r.pagina !== pag.pagina) pag.setPagina(r.pagina);
      } catch (err) {
        // pedido cancelado porque veio outro (digitando rápido): mantém a lista
        if (!(err as { isAbort?: boolean })?.isAbort) setItens([]);
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [mostrarLista, busca, categoria, filtroBase, pag.pagina, pag.porPagina]); // eslint-disable-line react-hooks/exhaustive-deps

  const escolher = (id: string) => { setCategoria((atual) => (atual === id ? "" : id)); setItens(null); pag.voltarAoInicio(); };
  const voltarAoInicio = () => { setQ(""); setCategoria(""); setVerTodos(noPc); setItens(null); pag.voltarAoInicio(); };
  const nomeCategoria = categorias.find((c) => c.id === categoria)?.nome;

  return (
    <div className="max-w-3xl space-y-5 larga:max-w-none">
      <CabecalhoPagina titulo="Soluções" />

      <label className="relative block">
        <span className="sr-only">Pesquisar no histórico</span>
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-tinta-2" aria-hidden="true" />
        <input
          type="search"
          enterKeyHint="search"
          className="campo pl-12"
          placeholder="Ex.: spooler, senha bloqueada, 2026-00012"
          value={q}
          onChange={(e) => { setQ(e.target.value); pag.voltarAoInicio(); }}
        />
      </label>

      {!mostrarLista ? (
        // tela inicial: escolher o tipo de problema (como no "Novo chamado")
        <section aria-labelledby="titulo-tipos" className="space-y-3">
          <h2 id="titulo-tipos" className="font-display text-lg font-bold">Que tipo de problema?</h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {categorias.map((c) => {
              const n = contagem?.[c.id];
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => escolher(c.id)}
                    className="flex h-full min-h-24 w-full flex-col items-start justify-between gap-2 rounded-xl bg-superficie p-3 text-left ring-1 ring-linha hover:ring-acento"
                  >
                    <IconeCategoria nome={c.icone} className="size-9" />
                    <span>
                      <span className="block font-semibold leading-tight">{c.nome}</span>
                      {/* número que ainda não chegou não aparece como 0 */}
                      <span className={`block text-sm text-tinta-2 ${n === undefined ? "invisible" : ""}`}>
                        {n === 1 ? "1 solução" : `${n ?? 0} soluções`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button type="button" className="btn-secundario w-full sm:w-auto" onClick={() => { setVerTodos(true); pag.voltarAoInicio(); }}>
            <History className="size-5" aria-hidden="true" />
            Ver todos os resolvidos{contagem?.[""] !== undefined ? ` (${contagem[""]})` : ""}
          </button>
        </section>
      ) : (
        <>
          {/* filtro escolhido + troca rápida de categoria (celular: faixa que rola para o lado; PC: quebra a linha) */}
          <div className="sem-barra -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:overflow-visible md:px-0" role="group" aria-label="Tipo de problema">
            <button type="button" onClick={voltarAoInicio} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-superficie px-4 text-sm font-semibold text-tinta-2 ring-1 ring-linha hover:ring-acento">
              <X className="size-4" aria-hidden="true" /> Limpar
            </button>
            {categorias.map((c) => {
              const ativa = categoria === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={ativa}
                  onClick={() => escolher(c.id)}
                  className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold whitespace-nowrap ring-1 ${
                    ativa ? "bg-mar-700 text-white ring-transparent" : "bg-superficie text-tinta-2 ring-linha hover:ring-acento"
                  }`}
                >
                  <IconeCategoria nome={c.icone} className="size-5" />
                  {c.nome}
                </button>
              );
            })}
          </div>
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="size-5 accent-acento" checked={soComSolucao} onChange={(e) => { setSoComSolucao(e.target.checked); setItens(null); pag.voltarAoInicio(); }} />
            Só os que têm causa e solução registradas
          </label>

          {itens === null ? (
            <EsqueletoCartoes quantos={4} rotulo="Carregando o histórico..." />
          ) : itens.length === 0 ? (
            <p className="rounded-2xl bg-superficie p-6 text-center ring-1 ring-linha">
              Nada encontrado{nomeCategoria ? ` em ${nomeCategoria}` : ""}{busca ? ` para "${busca}"` : ""}.
            </p>
          ) : (
            <>
              <p className="text-sm text-tinta-2">
                {total} {total === 1 ? "chamado resolvido" : "chamados resolvidos"}{nomeCategoria ? ` em ${nomeCategoria}` : ""}
              </p>
              <ul className="space-y-3">
                {itens.map((c) => <CartaoHistorico key={c.id} c={c} selecionado={verId === c.id} />)}
              </ul>
              <Paginacao
                pagina={pag.pagina}
                porPagina={pag.porPagina}
                total={total}
                aoMudarPagina={pag.setPagina}
                aoMudarPorPagina={pag.setPorPagina}
                rotulo="resolvidos"
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

/** textos acima disso aparecem encurtados no cartão; o "Ler tudo" avisa que o chamado tem o texto inteiro */
const LONGO = 160;

function CartaoHistorico({ c, selecionado }: { c: Chamado; selecionado: boolean }) {
  const temRegistro = !!(c.diagnostico || c.solucao);
  const longo = (c.diagnostico?.length ?? 0) > LONGO || (c.solucao?.length ?? 0) > LONGO;
  return (
    <li>
      <LinkChamado id={c.id} para={`/ti/chamado/${c.id}`} className={`block rounded-xl bg-superficie p-4 ring-1 hover:ring-acento ${selecionado ? "ring-2 ring-acento" : "ring-linha"}`}>
        {/* mesmo desenho do cartão da fila: 1 identidade · 2 problema · 3 detalhes */}
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-display text-base font-bold">{c.protocolo}</span>
          <span className="text-sm text-tinta-2">resolvido em {dataCurta(c.resolvido_em)}</span>
          {c.ficticio && <span className="ml-auto"><SeloTeste ficticio compacto /></span>}
        </div>
        <p className="texto-livre mt-1 line-clamp-2 font-semibold">{c.descricao}</p>
        <div className="mt-1 flex min-w-0 items-center gap-2 text-sm whitespace-nowrap text-tinta-2">
          <IconeCategoria nome={c.expand?.categoria?.icone} className="size-5" />
          <span className="min-w-0 truncate">
            {nomeSolicitante(c)}{c.expand?.setor ? `, ${c.expand.setor.nome}` : ""}
            {c.expand?.responsavel ? `, por ${c.expand.responsavel.name}` : ""}
          </span>
        </div>
        {temRegistro ? (
          <div className="mt-3 space-y-2">
            {c.solucao && (
              <div className="rounded-lg bg-campo-50 px-3 py-2">
                <span className="block text-xs font-bold tracking-wide text-ok uppercase">Solução</span>
                <p className="texto-livre line-clamp-4 whitespace-pre-line">{c.solucao}</p>
              </div>
            )}
            {c.diagnostico && (
              <p className="texto-livre line-clamp-2 text-sm text-tinta-2 whitespace-pre-line">
                <span className="font-semibold text-tinta">Causa: </span>{c.diagnostico}
              </p>
            )}
            {longo && (
              <span className="inline-flex items-center gap-0.5 text-sm font-semibold text-acento">
                Ler tudo <ChevronRight className="size-4" aria-hidden="true" />
              </span>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-tinta-2">Resolvido sem registro de causa e solução.</p>
        )}
      </LinkChamado>
    </li>
  );
}
