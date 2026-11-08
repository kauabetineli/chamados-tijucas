import { AbasPagina, CabecalhoPagina } from "../../components/CabecalhoPagina";
import { Dica } from "../../components/Dica";
import { Download, QrCode, ThumbsDown, ThumbsUp } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { useEffect, useState } from "react";
import { Bloco } from "../../components/Esqueleto";
import { duracaoHoras, ROTULO_ORIGEM } from "../../lib/formato";
import { baixarCsvChamados } from "../../lib/planilha";
import { EXPAND_CHAMADO, pb, type Chamado, type Origem } from "../../lib/pb";
import { MeusNumeros } from "./MeusNumeros";

interface Resumo {
  dias: number;
  total: number;
  agora: { aberto: number; em_andamento: number; aguardando: number };
  avaliacao: { bom: number; ruim: number; confirmados: number; automaticos?: number };
  por_tecnico: { chave: string; total: number }[];
  resolvidos: number;
  horas_media_resolucao: number;
  horas_media_inicio: number;
  por_origem: { chave: Origem; total: number }[];
  por_categoria: { chave: string; total: number }[];
  por_setor: { chave: string; total: number }[];
  por_dia: { dia: string; total: number }[];
  /** mesmo tamanho de período, logo antes (para comparar) */
  anterior?: { total: number; resolvidos: number; horas_media_resolucao: number; horas_media_inicio: number };
  /** começou dentro do prazo × fora (inclui os que ainda não começaram e já passaram) */
  prazo?: { dentro: number; fora: number };
}

/** "↑ 12%" sobre o período anterior; `menorMelhor` para tempos. Sem base anterior, nada. */
function variacao(atual: number, antes: number | undefined, menorMelhor = false) {
  if (!antes || !atual) return undefined;
  const pct = Math.round(((atual - antes) / antes) * 100);
  if (pct === 0) return { texto: "igual ao período anterior", bom: true };
  return { texto: `${pct > 0 ? "↑" : "↓"} ${Math.abs(pct)}% sobre o período anterior`, bom: menorMelhor ? pct < 0 : pct > 0 };
}

const PERIODOS = [7, 30, 90];

/**
 * Indicadores. Aba "Equipe": o atendimento todo, com os números do piloto (quanto entra pelo sistema,
 * satisfação). Aba "Meus números": o dia, a semana, o mês e o ano de quem está logado.
 */
export function Painel() {
  const [params, setParams] = useSearchParams();
  const aba = params.get("aba") === "meus" ? "meus" : "equipe";
  const irPara = (a: "equipe" | "meus") => {
    const p = new URLSearchParams(params);
    if (a === "meus") p.set("aba", "meus"); else p.delete("aba");
    setParams(p, { replace: true });
  };
  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Painel"
        abas={<AbasPagina rotulo="Quais números" itens={[
          { rotulo: "Equipe", ativo: aba === "equipe", aoClicar: () => irPara("equipe") },
          { rotulo: "Meus números", ativo: aba === "meus", aoClicar: () => irPara("meus") },
        ]} />}
      />
      {aba === "meus" ? <MeusNumeros /> : <PainelEquipe />}
    </div>
  );
}

function PainelEquipe() {
  const [dias, setDias] = useState(30);
  const [r, setR] = useState<Resumo | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    setErro(false);
    pb.send<Resumo>("/api/painel/resumo", { query: { dias } }).then(setR).catch(() => setErro(true));
  }, [dias]);

  async function baixarCsv() {
    const desde = new Date(Date.now() - dias * 86400000).toISOString().replace("T", " ");
    const lista = await pb.collection("chamados").getFullList<Chamado>({
      filter: pb.filter("created >= {:d}", { d: desde }),
      sort: "created",
      expand: EXPAND_CHAMADO,
    });
    baixarCsvChamados(lista, `chamados-ultimos-${dias}-dias.csv`);
  }

  const pctSistema = r && r.total
    ? Math.round(((r.por_origem.find((o) => o.chave === "sistema")?.total ?? 0) / r.total) * 100)
    : 0;
  const avaliados = r ? r.avaliacao.bom + r.avaliacao.ruim : 0;
  const pctBom = r && avaliados ? Math.round((r.avaliacao.bom / avaliados) * 100) : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <div role="tablist" aria-label="Período" className="flex rounded-xl bg-superficie p-1 ring-1 ring-linha">
            {PERIODOS.map((p) => (
              <button
                key={p}
                role="tab"
                aria-selected={dias === p}
                onClick={() => setDias(p)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${dias === p ? "bg-mar-700 text-white" : "text-tinta-2"}`}
              >
                {p} dias
              </button>
            ))}
          </div>
          <Link to="/ti/qrcodes" className="btn-secundario min-h-11">
            <QrCode className="size-5" aria-hidden="true" /> QR code para abrir chamado
          </Link>
          <button className="btn-secundario min-h-11" onClick={baixarCsv}>
            <Download className="size-5" aria-hidden="true" /> Baixar planilha
          </button>
        </div>
      </div>

      {erro && <p className="font-semibold text-alerta">Não foi possível carregar os indicadores.</p>}
      {!r ? (
        !erro && (
          <div aria-busy="true" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <span className="sr-only" role="status">Carregando os indicadores...</span>
            {[0, 1, 2, 3].map((i) => <Bloco key={i} className="h-28 rounded-2xl" />)}
            <Bloco className="h-64 rounded-2xl sm:col-span-2 lg:col-span-4" />
          </div>
        )
      ) : (
        <>
          {/* tela larga: os 4 números e o piloto lado a lado (molde "painel", lib/moldes.ts) */}
          <div className="space-y-8 larga:grid larga:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] larga:items-start larga:gap-6 larga:space-y-0">
          <div className="space-y-3">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-linha ring-1 ring-linha lg:grid-cols-5">
            {/* o que mais importa para quem pede: começou no prazo? (primeiro e ocupa a linha toda no celular) */}
            <Numero termo="Começaram no prazo" className="col-span-2 lg:col-span-1"
              dica="Chamados do período que alguém começou a atender até o prazo da prioridade. Os que ainda não começaram e já passaram do prazo contam como fora."
              valor={r.prazo && r.prazo.dentro + r.prazo.fora ? `${Math.round((r.prazo.dentro / (r.prazo.dentro + r.prazo.fora)) * 100)}%` : "—"}
              nota={r.prazo && r.prazo.dentro + r.prazo.fora ? `${r.prazo.fora} fora do prazo` : undefined} />
            <Numero termo={`Chegaram (${r.dias} dias)`} valor={String(r.total)} delta={variacao(r.total, r.anterior?.total)} neutro />
            <Numero termo="Resolvidos" valor={String(r.resolvidos)} delta={variacao(r.resolvidos, r.anterior?.resolvidos)} />
            <Numero termo="Até começar (média)" dica="Da abertura até alguém começar a atender. Conta os chamados resolvidos do período." valor={r.resolvidos ? duracaoHoras(r.horas_media_inicio) : "—"} delta={variacao(r.horas_media_inicio, r.anterior?.horas_media_inicio, true)} />
            <Numero termo="Até resolver (média)" dica="Da abertura até ficar resolvido, com o tempo em espera junto. Conta os chamados resolvidos do período." valor={r.resolvidos ? duracaoHoras(r.horas_media_resolucao) : "—"} delta={variacao(r.horas_media_resolucao, r.anterior?.horas_media_resolucao, true)} />
          </dl>
          <p className="text-tinta-2">
            Agora: <strong className="text-tinta">{r.agora.aberto}</strong> na fila,{" "}
            <strong className="text-tinta">{r.agora.em_andamento}</strong> em atendimento e{" "}
            <strong className="text-tinta">{r.agora.aguardando}</strong> em espera (peça, resposta ou terceiro).
          </p>
          </div>

          {/* números que o piloto acompanha (AC2): pedidos que passam pelo sistema e satisfação de quem pediu */}
          <section aria-labelledby="t-piloto" className="space-y-3">
            <h2 id="t-piloto" className="text-xl font-bold">Piloto</h2>
            <MetaPiloto total={r.total} dias={r.dias} />
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-superficie p-5 ring-1 ring-linha">
                <p className="flex items-center gap-2 text-sm text-tinta-2">
                  Abertos pelo próprio servidor
                  <Dica rotulo="O que conta aqui">
                    O resto o TI registrou ao receber por WhatsApp, ligação ou no corredor. Para a meta do piloto, compare o total do período ({r.total}) com a contagem manual da equipe.
                  </Dica>
                </p>
                <p className="mt-1 font-display text-4xl font-extrabold">{r.total ? `${pctSistema}%` : "—"}</p>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-linha" aria-hidden="true">
                  <div className="h-full rounded-full bg-campo" style={{ width: `${pctSistema}%` }} />
                </div>
              </div>
              <div className="rounded-2xl bg-superficie p-5 ring-1 ring-linha">
                <p className="flex items-center gap-2 text-sm text-tinta-2">
                  Satisfação de quem pediu
                  <Dica rotulo="Como é a satisfação">De quem confirmou que deu certo e avaliou o atendimento como bom ou “poderia ser melhor”.</Dica>
                </p>
                <p className="mt-1 font-display text-4xl font-extrabold">{avaliados ? `${pctBom}%` : "—"}</p>
                <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="inline-flex items-center gap-1.5"><ThumbsUp className="size-4 text-ok" aria-hidden="true" /><b>{r.avaliacao.bom}</b> bom</span>
                  <span className="inline-flex items-center gap-1.5"><ThumbsDown className="size-4 text-alerta" aria-hidden="true" /><b>{r.avaliacao.ruim}</b> poderia ser melhor</span>
                </p>
                <p className="mt-2 text-sm text-tinta-2">
                  {r.avaliacao.confirmados
                    ? `${avaliados} de ${r.avaliacao.confirmados} chamados confirmados por quem pediu foram avaliados.`
                    : "Ninguém confirmou um chamado no período ainda."}
                  {!!r.avaliacao.automaticos && ` ${r.avaliacao.automaticos} ${r.avaliacao.automaticos === 1 ? "foi considerado resolvido" : "foram considerados resolvidos"} sem resposta (não entram na conta).`}
                </p>
              </div>
            </div>
          </section>

          </div>

          <div className="grid gap-8 lg:grid-cols-2 larga:grid-cols-4">
            <Barras
              titulo="Como os pedidos chegaram"
              nota={r.total ? `${pctSistema}% foram abertos pelo próprio servidor no sistema.` : undefined}
              dados={r.por_origem.map((o) => ({ rotulo: ROTULO_ORIGEM[o.chave] ?? o.chave, total: o.total }))}
            />
            <Barras titulo="Por categoria" dados={r.por_categoria.map((o) => ({ rotulo: o.chave, total: o.total }))} />
            <Barras titulo="Por setor" dados={r.por_setor.map((o) => ({ rotulo: o.chave, total: o.total }))} />
            <Barras titulo="Resolvidos por técnico" dados={r.por_tecnico.map((o) => ({ rotulo: o.chave, total: o.total }))} />
            <PorDia dados={r.por_dia} dias={r.dias} />
          </div>
        </>
      )}
    </div>
  );
}

function Numero({ termo, valor, dica, delta, neutro, nota, className = "" }: {
  termo: string; valor: string; dica?: string;
  /** comparação com o período anterior; `neutro`: mais ou menos não é bom nem ruim (ex.: quantos chegaram) */
  delta?: { texto: string; bom: boolean }; neutro?: boolean; nota?: string; className?: string;
}) {
  return (
    <div className={`bg-superficie p-5 ${className}`}>
      <dt className="flex items-center gap-2 text-sm text-tinta-2">{termo}{dica && <Dica rotulo={`Como é calculado: ${termo.toLowerCase()}`}>{dica}</Dica>}</dt>
      <dd className="mt-1 font-display text-3xl font-extrabold whitespace-nowrap sm:text-4xl">{valor}</dd>
      {delta && <dd className={`mt-1 text-sm font-semibold ${neutro ? "text-tinta-2" : delta.bom ? "text-ok" : "text-alerta"}`}>{delta.texto}</dd>}
      {nota && <dd className="mt-1 text-sm text-tinta-2">{nota}</dd>}
    </div>
  );
}

// barras horizontais de uma série só: o título nomeia a série, sem legenda
function Barras({ titulo, nota, dados }: { titulo: string; nota?: string; dados: { rotulo: string; total: number }[] }) {
  const max = Math.max(1, ...dados.map((d) => d.total));
  return (
    <section>
      <h2 className="text-xl font-bold">{titulo}</h2>
      {nota && <p className="mt-1 text-tinta-2">{nota}</p>}
      {dados.length === 0 ? (
        <p className="mt-3 text-tinta-2">Sem chamados no período.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {dados.map((d) => (
            <li key={d.rotulo} className="grid grid-cols-[minmax(0,9rem)_1fr_2.5rem] items-center gap-3" title={`${d.rotulo}: ${d.total}`}>
              <span className="truncate text-sm">{d.rotulo}</span>
              <span className="h-3 rounded-r bg-mar" style={{ width: `${(d.total / max) * 100}%` }} aria-hidden="true" />
              <span className="text-right font-semibold tabular-nums">{d.total}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PorDia({ dados: brutos, dias }: { dados: { dia: string; total: number }[]; dias: number }) {
  // preenche os dias sem chamado com zero, para o eixo do tempo ficar contínuo
  const porDia = new Map(brutos.map((d) => [d.dia, d.total]));
  const dados = Array.from({ length: dias }, (_, i) => {
    const d = new Date(Date.now() - (dias - 1 - i) * 86400000);
    const dia = d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    return { dia, total: porDia.get(dia) ?? 0 };
  });
  // 30 dias ou mais: por semana (barras de um dia ficavam soltas e não mostravam tendência)
  const semanal = dias >= 30;
  const serie = semanal
    ? dados.reduce<{ dia: string; total: number }[]>((acc, d, i) => {
        if (i % 7 === (dados.length % 7)) acc.push({ dia: d.dia, total: 0 });
        if (!acc.length) acc.push({ dia: d.dia, total: 0 });
        acc[acc.length - 1].total += d.total;
        return acc;
      }, [])
    : dados;
  const max = Math.max(1, ...serie.map((d) => d.total));
  const rotulo = (dia: string) => new Date(dia + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return (
    <section className="lg:col-span-2 larga:col-span-4">
      <h2 className="text-xl font-bold">{semanal ? "Chamados por semana" : "Chamados por dia"}</h2>
      {brutos.length === 0 ? (
        <p className="mt-3 text-tinta-2">Sem chamados no período.</p>
      ) : (
        <>
          <div className={`mt-4 flex h-40 items-end border-b border-linha ${semanal ? "gap-2" : "gap-0.5"}`} role="img" aria-label={semanal ? "Quantidade de chamados por semana" : "Quantidade de chamados por dia"}>
            {serie.map((d) => (
              <div key={d.dia} className={`group relative flex h-full flex-1 ${semanal ? "flex-col items-center justify-end" : "items-end"}`}>
                {semanal && <span className="mb-1 text-xs font-semibold text-tinta-2">{d.total}</span>}
                <span className={`mx-auto w-full rounded-t bg-mar ${semanal ? "max-w-16" : "max-w-6"}`} style={{ height: `${(d.total / max) * 100}%` }} />
                <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 rounded bg-noite px-2 py-1 text-xs whitespace-nowrap text-white group-hover:block">
                  {semanal ? `semana de ${rotulo(d.dia)}` : rotulo(d.dia)}: {d.total}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-tinta-2">
            <span>{rotulo(serie[0].dia)}</span>
            <span>{semanal ? "maior semana" : "maior dia"}: {max}</span>
            <span>{rotulo(dados[dados.length - 1].dia)}</span>
          </div>
        </>
      )}
    </section>
  );
}

/**
 * Meta do piloto (AC2): 50% dos pedidos que chegam ao TI registrados no sistema. O sistema só conhece o que foi
 * registrado; o total real vem da contagem manual da equipe no mesmo período, digitada aqui.
 * A contagem fica guardada só neste navegador (localStorage), por período.
 */
function MetaPiloto({ total, dias }: { total: number; dias: number }) {
  const chave = `dinodesk:contagem-manual-${dias}`;
  const ler = () => { try { return localStorage.getItem(chave) ?? ""; } catch { return ""; } };
  const [manual, setManual] = useState(ler);
  useEffect(() => { setManual(ler()); }, [chave]); // eslint-disable-line react-hooks/exhaustive-deps
  function mudar(v: string) {
    const limpo = v.replace(/\D/g, "").slice(0, 6);
    setManual(limpo);
    try { if (limpo) localStorage.setItem(chave, limpo); else localStorage.removeItem(chave); } catch { /* sem armazenamento */ }
  }
  const n = Number(manual);
  const pct = n > 0 ? Math.round((total / n) * 100) : null;
  const bateu = pct !== null && pct >= 50;
  return (
    <div className="rounded-2xl bg-superficie p-5 ring-1 ring-linha">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm text-tinta-2">
            Meta: 50% dos pedidos registrados no sistema
            <Dica rotulo="Como a meta é calculada">
              Chamados no sistema nos últimos {dias} dias ({total}) divididos pela contagem manual de pedidos que a equipe fez no mesmo período. A contagem fica salva só neste navegador.
            </Dica>
          </p>
          <p className={`mt-1 font-display text-4xl font-extrabold ${bateu ? "text-ok" : ""}`}>{pct === null ? "—" : `${pct}%`}</p>
        </div>
        <label className="text-sm font-semibold">
          Contagem manual da equipe ({dias} dias)
          <input
            inputMode="numeric"
            value={manual}
            onChange={(e) => mudar(e.target.value)}
            placeholder="Ex.: 400"
            className="campo mt-1 block w-40"
          />
        </label>
      </div>
      <div className="relative mt-3 h-3 rounded-full bg-linha" aria-hidden="true">
        <div className={`h-full rounded-full ${bateu ? "bg-campo" : "bg-acento"}`} style={{ width: `${Math.min(100, pct ?? 0)}%` }} />
        {/* tema-fixo: a marca dos 50% acompanha a cor do texto (clara no escuro) de propósito */}
        <span className="absolute -top-1 left-1/2 h-5 w-0.5 bg-tinta-2" title="Meta: 50%" />
      </div>
      <p className="mt-2 text-sm text-tinta-2">
        {pct === null ? "Digite a contagem manual para ver o resultado." : bateu ? "Meta alcançada." : `Faltam ${Math.max(0, Math.ceil(n / 2) - total)} chamados registrados para chegar a 50%.`}
      </p>
    </div>
  );
}
