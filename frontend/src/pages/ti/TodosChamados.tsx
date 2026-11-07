import { Bloco } from "../../components/Esqueleto";
import { CabecalhoPagina } from "../../components/CabecalhoPagina";
import { ArrowDown, ArrowUp, ChevronsUpDown, Download, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { LinkChamado, useVerChamado } from "../../lib/verChamado";
import { Avatar } from "../../components/Avatar";
import { EsqueletoCartoes, EsqueletoTabela } from "../../components/Esqueleto";
import { useCategorias } from "../../components/CamposChamado";
import { Espera } from "../../components/Espera";
import { IconeCategoria } from "../../components/Icone";
import { EtiquetaPrioridade, MarcaTeste, SeloStatus } from "../../components/Selos";
import { Paginacao, usePaginacao } from "../../components/Paginacao";
import { VisaoTI } from "../../components/VisaoTI";
import { AlcaColuna, MenuColunas, useColunas, type DefColuna } from "../../components/Colunas";
import { useSetores, useTecnicos } from "../../lib/equipe";
import { esperaCurta } from "../../lib/fila";
import { dataCurta, duracaoHoras, paraData, resumo, ROTULO_AGUARDANDO, ROTULO_PRIORIDADE } from "../../lib/formato";
import { buscarPagina } from "../../lib/paginar";
import { baixarCsvChamados } from "../../lib/planilha";
import { EXPAND_CHAMADO, nomeSolicitante, pb, type Chamado, type Prioridade } from "../../lib/pb";
import { useRealtime } from "../../lib/useRealtime";


const SITUACOES = [
  { valor: "", rotulo: "Em aberto", filtro: 'status != "resolvido"' },
  { valor: "aberto", rotulo: "Na fila", filtro: 'status = "aberto"' },
  { valor: "em_andamento", rotulo: "Em atendimento", filtro: 'status = "em_andamento"' },
  { valor: "aguardando_algo", rotulo: "Em espera", filtro: 'status = "aguardando"' },
  { valor: "resolvido", rotulo: "Resolvidos", filtro: 'status = "resolvido"' },
  { valor: "todos", rotulo: "Todos", filtro: "" },
];

const PERIODOS = [
  { valor: "", rotulo: "Qualquer data" },
  { valor: "7", rotulo: "Últimos 7 dias" },
  { valor: "30", rotulo: "Últimos 30 dias" },
  { valor: "90", rotulo: "Últimos 90 dias" },
];

// colunas que dá para ordenar → campo no banco
const ORDENACOES = { protocolo: "protocolo", prioridade: "peso", situacao: "status", aberto: "created" } as const;
type Coluna = keyof typeof ORDENACOES;

// colunas da tabela do PC (cada técnico ajusta largura, quais aparecem e densidade: components/Colunas.tsx)
const COLUNAS: DefColuna[] = [
  { id: "protocolo", rotulo: "Protocolo", padrao: 136, minimo: 110 },
  { id: "prioridade", rotulo: "Prioridade", padrao: 112, minimo: 96 },
  { id: "situacao", rotulo: "Situação", padrao: 156, minimo: 120 },
  { id: "problema", rotulo: "Problema", padrao: 420, minimo: 200, fixa: true },
  { id: "quem", rotulo: "Quem pediu", padrao: 170, minimo: 120 },
  { id: "setor", rotulo: "Setor (separado)", padrao: 150, minimo: 100, oculta: true },
  { id: "responsavel", rotulo: "Responsável", padrao: 132, minimo: 100 },
  { id: "aberto", rotulo: "Aberto", padrao: 136, minimo: 110 },
];
const ORDENAVEL: Record<string, Coluna | undefined> = { protocolo: "protocolo", prioridade: "prioridade", situacao: "situacao", aberto: "aberto" };

const ha = (horas: number) => (horas < 1 / 60 ? "agora mesmo" : `há ${esperaCurta(horas)}`);

/** Tempo que importa para cada situação: espera (aberto), desde o início (andamento) ou até resolver. */
function Tempo({ c }: { c: Chamado }) {
  if (c.status === "resolvido") {
    const ini = paraData(c.created), fim = paraData(c.resolvido_em);
    return <span className="text-tinta-2">{ini && fim ? `resolvido em ${duracaoHoras((fim.getTime() - ini.getTime()) / 3_600_000)}` : "—"}</span>;
  }
  if (c.status === "aguardando") {
    const ini = paraData(c.aguardando_desde || "");
    return <span className="text-tinta-2">em espera{c.aguardando_motivo ? ` (${ROTULO_AGUARDANDO[c.aguardando_motivo]})` : ""}{ini ? ` ${ha((Date.now() - ini.getTime()) / 3_600_000)}` : ""}</span>;
  }
  if (c.status === "em_andamento") {
    const ini = paraData(c.iniciado_em);
    return <span className="text-tinta-2">{ini ? `atendendo ${ha((Date.now() - ini.getTime()) / 3_600_000)}` : "—"}</span>;
  }
  // na fila: o mesmo sinal da Fila ("há 3 h" neutro; vermelho com relógio só fora do prazo)
  return <span className="text-tinta-2"><Espera c={c} /></span>;
}

function Responsavel({ c }: { c: Chamado }) {
  const r = c.expand?.responsavel;
  if (!r) return <span className="text-tinta-2">—</span>;
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Avatar id={r.id} nome={r.name} tamanho="sm" />
      <span className="truncate">{r.name.split(" ")[0]}</span>
    </span>
  );
}

/**
 * Todos os chamados em tabela, sem a lógica de fila: para o TI consultar, filtrar e exportar.
 * Os filtros ficam no endereço (?situacao=...&categoria=...), então dá para voltar e compartilhar a mesma visão.
 */
export function TodosChamados() {
  const { aberto: verId, abrir } = useVerChamado();
  const [params, setParams] = useSearchParams();
  const categorias = useCategorias();
  const tecnicos = useTecnicos();
  const setores = useSetores();
  const [itens, setItens] = useState<Chamado[] | null>(null);
  const [total, setTotal] = useState(0);
  const pag = usePaginacao("todos-chamados", 25);
  const [busca, setBusca] = useState(params.get("q") ?? "");
  const [baixando, setBaixando] = useState(false);
  const [verFiltros, setVerFiltros] = useState(false); // celular: filtros recolhidos
  const [, setTique] = useState(0);
  const col = useColunas("todos-chamados", COLUNAS);
  const tabela = useRef<HTMLTableElement>(null);

  const f = {
    situacao: params.get("situacao") ?? "",
    prioridade: params.get("prioridade") ?? "",
    categoria: params.get("categoria") ?? "",
    setor: params.get("setor") ?? "",
    responsavel: params.get("responsavel") ?? "",
    periodo: params.get("periodo") ?? "",
    q: params.get("q") ?? "",
    ordem: params.get("ordem") ?? "-aberto",
  };
  const algumFiltro = f.prioridade || f.categoria || f.setor || f.responsavel || f.periodo || f.q || f.situacao;

  function mudar(chave: string, valor: string) {
    const p = new URLSearchParams(params);
    if (valor) p.set(chave, valor); else p.delete(chave);
    setParams(p, { replace: true });
    pag.voltarAoInicio();
  }


  // busca digitada: espera parar de digitar
  useEffect(() => {
    const t = window.setTimeout(() => { if (busca.trim() !== f.q) mudar("q", busca.trim()); }, 300);
    return () => window.clearTimeout(t);
  }, [busca]); // eslint-disable-line react-hooks/exhaustive-deps

  function montarFiltro() {
    const partes: string[] = [];
    const v: Record<string, string> = {};
    const sit = SITUACOES.find((s) => s.valor === f.situacao) ?? SITUACOES[0];
    if (sit.filtro) partes.push(sit.filtro);
    if (f.prioridade) { partes.push("prioridade = {:p}"); v.p = f.prioridade; }
    if (f.categoria) { partes.push("categoria = {:c}"); v.c = f.categoria; }
    if (f.setor) { partes.push("setor = {:s}"); v.s = f.setor; }
    if (f.responsavel === "ninguem") partes.push('responsavel = ""');
    else if (f.responsavel) { partes.push("responsavel = {:r}"); v.r = f.responsavel; }
    if (f.periodo) {
      partes.push("created >= {:d}");
      v.d = new Date(Date.now() - Number(f.periodo) * 86400000).toISOString().replace("T", " ");
    }
    if (f.q) {
      partes.push("(protocolo ~ {:q} || descricao ~ {:q} || solicitante.name ~ {:q} || solicitante_nome ~ {:q} || solucao ~ {:q})");
      v.q = f.q;
    }
    return pb.filter(partes.join(" && "), v);
  }
  const coluna = f.ordem.replace(/^-/, "") as Coluna;
  const desc = f.ordem.startsWith("-");
  const sort = `${desc ? "-" : ""}${ORDENACOES[coluna] ?? "created"}${coluna === "aberto" ? "" : ",-created"}`;

  // cliques rápidos: só a resposta do ÚLTIMO pedido entra na tela (as antigas são ignoradas)
  const ultimoPedido = useRef(0);
  const [carregando, setCarregando] = useState(false);

  async function carregar() {
    const meu = ++ultimoPedido.current;
    setCarregando(true);
    try {
      // só a página pedida vem do banco; requestKey próprio evita o cancelamento automático do SDK
      const r = await buscarPagina<Chamado>("chamados", pag.pagina, pag.porPagina, {
        filter: montarFiltro(), sort, expand: EXPAND_CHAMADO, requestKey: `todos-${meu}`,
      });
      if (meu !== ultimoPedido.current) return;
      setItens(r.itens);
      setTotal(r.total);
      if (r.pagina !== pag.pagina) pag.setPagina(r.pagina);
    } finally {
      if (meu === ultimoPedido.current) setCarregando(false);
    }
  }

  useEffect(() => { carregar().catch(() => setItens((atual) => atual ?? [])); }, [params, pag.pagina, pag.porPagina]); // eslint-disable-line react-hooks/exhaustive-deps
  useRealtime("chamados", () => carregar().catch(() => {}));
  useEffect(() => {
    const t = window.setInterval(() => setTique((n) => n + 1), 60_000);
    return () => window.clearInterval(t);
  }, []);

  async function baixar() {
    setBaixando(true);
    try {
      const lista = await pb.collection("chamados").getFullList<Chamado>({ filter: montarFiltro(), sort, expand: EXPAND_CHAMADO });
      baixarCsvChamados(lista, `chamados-${new Date().toISOString().slice(0, 10)}.csv`);
    } finally {
      setBaixando(false);
    }
  }

  // função (não componente): um componente criado aqui dentro seria remontado a cada render e perderia o arrasto
  function cabecalho(id: string) {
    const d = COLUNAS.find((x) => x.id === id)!;
    const ordem = ORDENAVEL[id];
    const ativa = ordem && coluna === ordem;
    const Icone = !ativa ? ChevronsUpDown : desc ? ArrowDown : ArrowUp;
    const rotulo = id === "setor" ? "Setor" : d.rotulo;
    return (
      <th key={id} scope="col" aria-sort={ordem ? (ativa ? (desc ? "descending" : "ascending") : "none") : undefined}
        className="relative px-3 py-3 text-left text-sm font-semibold whitespace-nowrap text-tinta-2">
        {ordem ? (
          <button
            type="button"
            onClick={() => mudar("ordem", ativa ? (desc ? ordem : `-${ordem}`) : `-${ordem}`)}
            className={`inline-flex max-w-full items-center gap-1 ${ativa ? "text-tinta" : "hover:text-tinta"}`}
          >
            <span className="truncate">{rotulo}</span> <Icone className="size-3.5 shrink-0" aria-hidden="true" />
          </button>
        ) : <span className="block truncate">{rotulo}</span>}
        <AlcaColuna col={col} id={id} tabela={tabela} />
      </th>
    );
  }

  const celula = (c: Chamado, id: string): ReactNode => {
    switch (id) {
      case "protocolo":
        return (
          <span className="whitespace-nowrap">
            <span onClick={(e) => e.stopPropagation()}>
              <LinkChamado id={c.id} para={`/ti/chamado/${c.id}`} className="font-display text-base font-bold hover:underline">{c.protocolo}</LinkChamado>
            </span>
            <span className="ml-1.5"><MarcaTeste ficticio={c.ficticio} /></span>
          </span>
        );
      case "prioridade": return <EtiquetaPrioridade prioridade={c.prioridade} sempre />;
      case "situacao": return <span className="whitespace-nowrap"><SeloStatus status={c.status} /></span>;
      case "problema":
        return (
          <>
            {/* o problema primeiro (como na Fila); a categoria embaixo, menor */}
            <span className="texto-livre line-clamp-2 font-semibold">{c.descricao}</span>
            <span className={`mt-0.5 items-center gap-1.5 text-tinta-2 ${col.densa ? "hidden" : "flex"}`}>
              <IconeCategoria nome={c.expand?.categoria?.icone} className="size-4 shrink-0 text-acento" />
              {c.expand?.categoria?.nome}
            </span>
          </>
        );
      case "quem":
        return (
          <>
            <span className="block truncate font-semibold">{nomeSolicitante(c)}</span>
            {!col.visivel("setor") && !col.densa && <span className="block truncate text-tinta-2">{c.expand?.setor?.nome ?? "—"}</span>}
          </>
        );
      case "setor": return <span className="block truncate">{c.expand?.setor?.nome ?? "—"}</span>;
      case "responsavel": return <Responsavel c={c} />;
      case "aberto":
        return (
          <span className="whitespace-nowrap">
            <span className="block">{dataCurta(c.created)}</span>
            {!col.densa && <span className="block text-xs"><Tempo c={c} /></span>}
          </span>
        );
    }
    return null;
  };

  const select = "campo min-h-11 w-full py-2 pr-9 text-sm md:w-auto";

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Todos os chamados"
        subtitulo={itens ? `${total} ${total === 1 ? "chamado" : "chamados"}` : <Bloco className="mt-1 h-6 w-32" />}
        acoes={<VisaoTI />}
      />

      {/* filtros */}
      <div className="space-y-3 rounded-2xl bg-superficie p-4 ring-1 ring-linha">
        {/* celular: uma linha que rola para o lado; PC: quebra linha */}
        {/* py-1/-my-1: folga para o contorno arredondado não ser cortado pela rolagem */}
        <div className="sem-barra -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden" role="group" aria-label="Situação">
          {SITUACOES.map((s) => (
            <button
              key={s.valor}
              type="button"
              aria-pressed={f.situacao === s.valor}
              onClick={() => mudar("situacao", s.valor)}
              className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold ring-1 ${
                f.situacao === s.valor ? "bg-mar-700 text-white ring-acento" : "ring-linha hover:ring-acento"
              }`}
            >
              {s.rotulo}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 flex-1 md:min-w-56">
            <span className="sr-only">Buscar</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-tinta-2" aria-hidden="true" />
            <input
              type="search"
            enterKeyHint="search"
              className="campo min-h-11 py-2 pl-10 text-sm"
              placeholder="Protocolo, descrição, quem pediu ou solução"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={() => setVerFiltros((v) => !v)}
            aria-expanded={verFiltros}
            className="btn-secundario min-h-11 px-3 text-sm md:hidden"
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            Filtros{[f.prioridade, f.categoria, f.setor, f.responsavel, f.periodo].filter(Boolean).length ? ` (${[f.prioridade, f.categoria, f.setor, f.responsavel, f.periodo].filter(Boolean).length})` : ""}
          </button>
          <div className={`${verFiltros ? "grid" : "hidden"} w-full grid-cols-2 gap-2 md:contents`}>
          <select aria-label="Prioridade" className={select} value={f.prioridade} onChange={(e) => mudar("prioridade", e.target.value)}>
            <option value="">Toda prioridade</option>
            {(["urgente", "alta", "normal", "baixa"] as Prioridade[]).map((p) => <option key={p} value={p}>{ROTULO_PRIORIDADE[p]}</option>)}
          </select>
          <select aria-label="Categoria" className={select} value={f.categoria} onChange={(e) => mudar("categoria", e.target.value)}>
            <option value="">Toda categoria</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <select aria-label="Setor" className={select} value={f.setor} onChange={(e) => mudar("setor", e.target.value)}>
            <option value="">Todo setor</option>
            {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
          <select aria-label="Responsável" className={select} value={f.responsavel} onChange={(e) => mudar("responsavel", e.target.value)}>
            <option value="">Qualquer responsável</option>
            <option value="ninguem">Sem responsável</option>
            {tecnicos.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select aria-label="Período" className={select} value={f.periodo} onChange={(e) => mudar("periodo", e.target.value)}>
            {PERIODOS.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}
          </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {algumFiltro ? (
            <button type="button" onClick={() => { setBusca(""); setParams(new URLSearchParams(), { replace: true }); }} className="inline-flex items-center gap-1 text-sm font-semibold text-acento">
              <X className="size-4" aria-hidden="true" /> Limpar filtros
            </button>
          ) : <span />}
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden md:block"><MenuColunas col={col} /></span>
            <button type="button" className="btn-secundario min-h-10 px-3 text-sm" onClick={baixar} disabled={baixando || !total}>
              <Download className="size-4" aria-hidden="true" /> {baixando ? "Gerando..." : "Baixar planilha (CSV)"}
            </button>
          </div>
        </div>
      </div>

      {itens === null && (
        <>
          <div className="hidden md:block"><EsqueletoTabela /></div>
          <div className="md:hidden"><EsqueletoCartoes quantos={5} rotulo="Carregando chamados..." /></div>
        </>
      )}

      {itens && itens.length === 0 && (
        <p className="rounded-2xl bg-superficie p-8 text-center text-tinta-2 ring-1 ring-linha">Nenhum chamado com esses filtros.</p>
      )}

      {itens && itens.length > 0 && (
        <>
          {/* PC: tabela */}
          <div aria-busy={carregando} className={`hidden overflow-x-auto rounded-2xl bg-superficie ring-1 ring-linha md:block ${carregando ? "opacity-60" : ""}`}>
            {/* larguras de cada técnico (arrastar a borda do título); a tabela rola para o lado se passar da tela */}
            <table ref={tabela} className="table-fixed border-collapse" style={{ width: col.larguraTotal, minWidth: "100%" }}>
              <colgroup>
                {col.visiveis.map((d) => <col key={d.id} style={{ width: col.largura(d.id) }} />)}
              </colgroup>
              <thead className="border-b border-linha">
                <tr>{col.visiveis.map((d) => cabecalho(d.id))}</tr>
              </thead>
              <tbody className="divide-y divide-linha">
                {itens.map((c) => (
                  <tr
                    key={c.id}
                    onClick={(e) => abrir(c.id, e.currentTarget)}
                    aria-selected={verId === c.id}
                    className={`cursor-pointer align-top text-sm hover:bg-mar-50 ${verId === c.id ? "bg-mar-50 outline-2 -outline-offset-2 outline-acento" : ""}`}
                  >
                    {col.visiveis.map((d) => (
                      <td key={d.id} data-col={d.id} className={`overflow-hidden px-3 ${col.densa ? "py-1.5" : "py-3"}`}>
                        <div className="celula min-w-0">{celula(c, d.id)}</div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* celular: lista compacta com os mesmos dados */}
          {/* celular: lista enxuta, o mesmo desenho da Fila (tipo · problema · situação, onde e quem · tempo) */}
          <ul aria-busy={carregando} className={`divide-y divide-linha overflow-hidden rounded-2xl bg-superficie ring-1 ring-linha md:hidden ${carregando ? "opacity-60" : ""}`}>
            {itens.map((c) => (
              <li key={c.id}>
                <LinkChamado id={c.id} para={`/ti/chamado/${c.id}`} className={`flex items-center gap-3 px-3 py-2.5 ${verId === c.id ? "bg-mar-50" : ""}`}>
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-mar-50 text-acento" title={c.expand?.categoria?.nome}>
                    <IconeCategoria nome={c.expand?.categoria?.icone} className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="texto-livre line-clamp-2 leading-snug font-semibold"><EtiquetaPrioridade prioridade={c.prioridade} />{resumo(c.descricao, 120)}</span>
                    <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm whitespace-nowrap text-tinta-2">
                      <SeloStatus status={c.status} />
                      <span className="min-w-0 truncate">· {c.expand?.setor?.nome ?? "—"} · {nomeSolicitante(c)} · <span className="tabular-nums">{c.protocolo}</span> <MarcaTeste ficticio={c.ficticio} /></span>
                    </span>
                  </span>
                  <span className="shrink-0 self-start pt-0.5 text-xs text-tinta-2">{c.status === "resolvido" ? <Tempo c={c} /> : <Espera c={c} />}</span>
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
            rotulo="chamados"
          />
        </>
      )}
    </div>
  );
}
