import { Search } from "lucide-react";
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

/** Base de soluções: o que já foi resolvido, pesquisável pelo problema, causa ou solução. */
export function Historico() {
  const { aberto: verId } = useVerChamado();
  const categorias = useCategorias();
  const [q, setQ] = useState("");
  // vindo de "Ver todos no histórico" (soluções parecidas): já abre filtrado pela categoria
  const [categoria, setCategoria] = useState(() => new URLSearchParams(window.location.search).get("categoria") ?? "");
  // causa e solução são opcionais ao resolver: por padrão o Histórico mostra só o que tem registro
  const [soComSolucao, setSoComSolucao] = useState(true);
  const [itens, setItens] = useState<Chamado[] | null>(null);
  const [total, setTotal] = useState(0);
  const pag = usePaginacao("historico", 10);

  useEffect(() => {
    const t = window.setTimeout(async () => {
      const partes = ['status = "resolvido"'];
      if (soComSolucao) partes.push('(solucao != "" || diagnostico != "")');
      const params: Record<string, string> = {};
      if (q.trim()) {
        partes.push("(descricao ~ {:q} || diagnostico ~ {:q} || solucao ~ {:q} || protocolo ~ {:q})");
        params.q = q.trim();
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
  }, [q, categoria, soComSolucao, pag.pagina, pag.porPagina]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-3xl font-bold">Histórico de soluções</h1>
        <p className="mt-1 text-tinta-2">Antes de começar um atendimento, veja se o problema já foi resolvido antes.</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Pesquisar</span>
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
        <label>
          <span className="sr-only">Categoria</span>
          <select className="campo sm:w-56" value={categoria} onChange={(e) => { setCategoria(e.target.value); pag.voltarAoInicio(); }}>
            <option value="">Todas as categorias</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
      </div>
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" className="size-5 accent-acento" checked={soComSolucao} onChange={(e) => { setSoComSolucao(e.target.checked); pag.voltarAoInicio(); }} />
        Só os que têm causa e solução registradas
      </label>

      {itens === null ? (
        <EsqueletoCartoes quantos={4} rotulo="Carregando o histórico..." />
      ) : itens.length === 0 ? (
        <p className="rounded-2xl bg-superficie p-6 text-center ring-1 ring-linha">
          {q || categoria ? "Nada encontrado com esse filtro." : "Os chamados resolvidos aparecem aqui, com a causa e a solução quando o técnico registrou."}
        </p>
      ) : (
        <>
          <p className="text-sm text-tinta-2">{total} {total === 1 ? "chamado resolvido" : "chamados resolvidos"}</p>
          <ul className="space-y-3">
            {itens.map((c) => (
              <li key={c.id}>
                <LinkChamado id={c.id} para={`/ti/chamado/${c.id}`} className={`block rounded-xl bg-superficie p-4 ring-1 hover:ring-acento ${verId === c.id ? "ring-2 ring-acento" : "ring-linha"}`}>
                  {/* mesmo desenho do cartão da fila: 1 identidade · 2 problema · 3 detalhes */}
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <span className="font-display text-base font-bold">{c.protocolo}</span>
                    <span className="text-sm text-tinta-2">resolvido em {dataCurta(c.resolvido_em)}</span>
                  </div>
                  <p className="mt-1 font-semibold">{c.descricao}</p>
                  <div className="mt-1 flex min-w-0 items-center gap-2 text-sm whitespace-nowrap text-tinta-2">
                    <span className="inline-flex min-w-0 shrink-0 items-center gap-1 sm:shrink" title={c.expand?.categoria?.nome}>
                      <IconeCategoria nome={c.expand?.categoria?.icone} className="size-4 shrink-0 text-acento" />
                      <span className="sr-only truncate sm:not-sr-only">{c.expand?.categoria?.nome}</span>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="min-w-0 truncate">{nomeSolicitante(c)}{c.expand?.setor ? `, ${c.expand.setor.nome}` : ""}</span>
                    {c.expand?.responsavel && <><span aria-hidden="true">·</span><span className="min-w-0 truncate">por {c.expand.responsavel.name}</span></>}
                    {c.ficticio && <span className="ml-auto shrink-0"><SeloTeste ficticio compacto /></span>}
                  </div>
                  {c.diagnostico || c.solucao ? (
                    <div className="mt-3 grid gap-2 border-t border-linha pt-3 sm:grid-cols-2">
                      <p><span className="block text-sm text-tinta-2">Causa</span>{c.diagnostico || "—"}</p>
                      <p><span className="block text-sm text-tinta-2">Solução</span>{c.solucao || "—"}</p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-tinta-2">Resolvido sem registro de causa e solução.</p>
                  )}
                </LinkChamado>
              </li>
            ))}
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
    </div>
  );
}
