import { ArrowDown, ArrowUp, ChevronsUpDown, Download, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Avatar } from "../../components/Avatar";
import { useCategorias } from "../../components/CamposChamado";
import { IconeCategoria } from "../../components/Icone";
import { PilulaPrioridade, SeloStatus, SeloTeste } from "../../components/Selos";
import { Paginacao, usePaginacao } from "../../components/Paginacao";
import { VisaoTI } from "../../components/VisaoTI";
import { useSetores, useTecnicos } from "../../lib/equipe";
import { atrasado, esperaCurta, horasEsperando } from "../../lib/fila";
import { dataCurta, duracaoHoras, paraData, resumo, ROTULO_PRIORIDADE } from "../../lib/formato";
import { buscarPagina } from "../../lib/paginar";
import { baixarCsvChamados } from "../../lib/planilha";
import { EXPAND_CHAMADO, nomeSolicitante, pb, type Chamado, type Prioridade } from "../../lib/pb";
import { useRealtime } from "../../lib/useRealtime";


const SITUACOES = [
  { valor: "", rotulo: "Em aberto", filtro: 'status != "resolvido"' },
  { valor: "aberto", rotulo: "Aguardando", filtro: 'status = "aberto"' },
  { valor: "em_andamento", rotulo: "Em atendimento", filtro: 'status = "em_andamento"' },
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

const ha = (horas: number) => (horas < 1 / 60 ? "agora mesmo" : `há ${esperaCurta(horas)}`);

/** Tempo que importa para cada situação: espera (aberto), desde o início (andamento) ou até resolver. */
function Tempo({ c }: { c: Chamado }) {
  if (c.status === "resolvido") {
    const ini = paraData(c.created), fim = paraData(c.resolvido_em);
    return <span className="text-tinta-2">{ini && fim ? `resolvido em ${duracaoHoras((fim.getTime() - ini.getTime()) / 3_600_000)}` : "—"}</span>;
  }
  if (c.status === "em_andamento") {
    const ini = paraData(c.iniciado_em);
    return <span className="text-tinta-2">{ini ? `atendendo ${ha((Date.now() - ini.getTime()) / 3_600_000)}` : "—"}</span>;
  }
  return atrasado(c)
    ? <span className="font-semibold text-alerta">atrasado, esperando {ha(horasEsperando(c))}</span>
    : <span className="text-tinta-2">esperando {ha(horasEsperando(c))}</span>;
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
  const navegar = useNavigate();
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

  function Cabecalho({ col, children, className = "" }: { col?: Coluna; children: ReactNode; className?: string }) {
    if (!col) return <th scope="col" className={`px-3 py-3 text-left text-sm font-semibold whitespace-nowrap text-tinta-2 ${className}`}>{children}</th>;
    const ativa = coluna === col;
    const Icone = !ativa ? ChevronsUpDown : desc ? ArrowDown : ArrowUp;
    return (
      <th scope="col" aria-sort={ativa ? (desc ? "descending" : "ascending") : "none"} className={`px-3 py-3 text-left text-sm font-semibold ${className}`}>
        <button
          type="button"
          onClick={() => mudar("ordem", ativa ? (desc ? col : `-${col}`) : `-${col}`)}
          className={`inline-flex items-center gap-1 ${ativa ? "text-tinta" : "text-tinta-2 hover:text-tinta"}`}
        >
          {children} <Icone className="size-3.5" aria-hidden="true" />
        </button>
      </th>
    );
  }

  const select = "campo min-h-11 w-full py-2 pr-9 text-sm md:w-auto";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Todos os chamados</h1>
          <p className="mt-1 text-tinta-2">{itens ? `${total} ${total === 1 ? "chamado" : "chamados"}` : "Carregando..."}</p>
        </div>
        <VisaoTI />
      </div>

      {/* filtros */}
      <div className="space-y-3 rounded-2xl bg-superficie p-4 ring-1 ring-linha">
        {/* celular: uma linha que rola para o lado; PC: quebra linha */}
        {/* py-1/-my-1: folga para o contorno arredondado não ser cortado pela rolagem */}
        <div className="-mx-4 -my-1 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden" role="group" aria-label="Situação">
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
          <button type="button" className="btn-secundario min-h-10 px-3 text-sm" onClick={baixar} disabled={baixando || !total}>
            <Download className="size-4" aria-hidden="true" /> {baixando ? "Gerando..." : "Baixar planilha (CSV)"}
          </button>
        </div>
      </div>

      {itens && itens.length === 0 && (
        <p className="rounded-2xl bg-superficie p-8 text-center text-tinta-2 ring-1 ring-linha">Nenhum chamado com esses filtros.</p>
      )}

      {itens && itens.length > 0 && (
        <>
          {/* PC: tabela */}
          <div aria-busy={carregando} className={`hidden overflow-x-auto rounded-2xl bg-superficie ring-1 ring-linha md:block ${carregando ? "opacity-60" : ""}`}>
            <table className="w-full min-w-[56rem] border-collapse">
              <thead className="border-b border-linha">
                <tr>
                  <Cabecalho col="protocolo">Protocolo</Cabecalho>
                  <Cabecalho col="prioridade">Prioridade</Cabecalho>
                  <Cabecalho col="situacao">Situação</Cabecalho>
                  <Cabecalho className="w-[34%]">Problema</Cabecalho>
                  <Cabecalho>Quem pediu</Cabecalho>
                  <Cabecalho>Responsável</Cabecalho>
                  <Cabecalho col="aberto">Aberto</Cabecalho>
                </tr>
              </thead>
              <tbody className="divide-y divide-linha">
                {itens.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => navegar(`/ti/chamado/${c.id}`)}
                    className="cursor-pointer align-top text-sm hover:bg-mar-50"
                  >
                    <td className="px-3 py-3 whitespace-nowrap">
                      <Link to={`/ti/chamado/${c.id}`} onClick={(e) => e.stopPropagation()} className="font-display text-base font-bold hover:underline">
                        {c.protocolo}
                      </Link>
                      {c.ficticio && <span className="ml-2 align-middle"><SeloTeste ficticio compacto /></span>}
                    </td>
                    <td className="px-3 py-3"><PilulaPrioridade prioridade={c.prioridade} /></td>
                    <td className="px-3 py-3 whitespace-nowrap"><SeloStatus status={c.status} /></td>
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <IconeCategoria nome={c.expand?.categoria?.icone} className="size-4 shrink-0 text-acento" />
                        {c.expand?.categoria?.nome}
                      </span>
                      <span className="mt-0.5 line-clamp-2 text-tinta-2">{c.descricao}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="block font-semibold">{nomeSolicitante(c)}</span>
                      <span className="block text-tinta-2">{c.expand?.setor?.nome ?? "—"}</span>
                    </td>
                    <td className="px-3 py-3"><Responsavel c={c} /></td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="block">{dataCurta(c.created)}</span>
                      <span className="block text-xs"><Tempo c={c} /></span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* celular: lista compacta com os mesmos dados */}
          <ul aria-busy={carregando} className={`space-y-2 md:hidden ${carregando ? "opacity-60" : ""}`}>
            {itens.map((c) => (
              <li key={c.id}>
                <Link to={`/ti/chamado/${c.id}`} className="block rounded-xl bg-superficie p-3 ring-1 ring-linha">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <span className="font-display font-bold">{c.protocolo}</span>
                    <PilulaPrioridade prioridade={c.prioridade} />
                    <span className="ml-auto"><SeloStatus status={c.status} /></span>
                  </span>
                  <span className="mt-1 block truncate font-semibold">{resumo(c.descricao, 90)}</span>
                  <span className="mt-1 flex min-w-0 items-center gap-2 text-sm whitespace-nowrap text-tinta-2">
                    <IconeCategoria nome={c.expand?.categoria?.icone} className="size-4 shrink-0 text-acento" />
                    <span className="min-w-0 truncate">{nomeSolicitante(c)} · {c.expand?.setor?.nome ?? "—"}</span>
                    <span className="ml-auto shrink-0 text-xs"><Tempo c={c} /></span>
                  </span>
                </Link>
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
