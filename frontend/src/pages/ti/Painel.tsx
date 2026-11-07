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
  avaliacao: { bom: number; ruim: number; confirmados: number };
  por_tecnico: { chave: string; total: number }[];
  resolvidos: number;
  horas_media_resolucao: number;
  horas_media_inicio: number;
  por_origem: { chave: Origem; total: number }[];
  por_categoria: { chave: string; total: number }[];
  por_setor: { chave: string; total: number }[];
  por_dia: { dia: string; total: number }[];
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
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-linha ring-1 ring-linha lg:grid-cols-4">
            <Numero termo={`Chamados nos últimos ${r.dias} dias`} valor={String(r.total)} />
            <Numero termo="Resolvidos no período" valor={String(r.resolvidos)} />
            <Numero termo="Tempo médio até começar" dica="Da abertura até alguém começar a atender. Conta os chamados resolvidos do período." valor={r.resolvidos ? duracaoHoras(r.horas_media_inicio) : "—"} />
            <Numero termo="Tempo médio até resolver" dica="Da abertura até ficar resolvido, com o tempo em espera junto. Conta os chamados resolvidos do período." valor={r.resolvidos ? duracaoHoras(r.horas_media_resolucao) : "—"} />
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
                    ? `${avaliados} de ${r.avaliacao.confirmados} chamados confirmados no período foram avaliados.`
                    : "Nenhum chamado confirmado no período ainda."}
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

function Numero({ termo, valor, dica }: { termo: string; valor: string; dica?: string }) {
  return (
    <div className="bg-superficie p-5">
      <dt className="flex items-center gap-2 text-sm text-tinta-2">{termo}{dica && <Dica rotulo={`Como é calculado: ${termo.toLowerCase()}`}>{dica}</Dica>}</dt>
      <dd className="mt-1 font-display text-4xl font-extrabold">{valor}</dd>
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
  const max = Math.max(1, ...dados.map((d) => d.total));
  const rotulo = (dia: string) => new Date(dia + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return (
    <section className="lg:col-span-2 larga:col-span-4">
      <h2 className="text-xl font-bold">Chamados por dia</h2>
      {brutos.length === 0 ? (
        <p className="mt-3 text-tinta-2">Sem chamados no período.</p>
      ) : (
        <>
          <div className="mt-4 flex h-40 items-end gap-0.5 border-b border-linha" role="img" aria-label="Quantidade de chamados por dia">
            {dados.map((d) => (
              <div key={d.dia} className="group relative flex h-full flex-1 items-end">
                <span className="mx-auto w-full max-w-6 rounded-t bg-mar" style={{ height: `${(d.total / max) * 100}%` }} />
                <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 rounded bg-noite px-2 py-1 text-xs whitespace-nowrap text-white group-hover:block">
                  {rotulo(d.dia)}: {d.total}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-tinta-2">
            <span>{rotulo(dados[0].dia)}</span>
            <span>maior dia: {max}</span>
            <span>{rotulo(dados[dados.length - 1].dia)}</span>
          </div>
        </>
      )}
    </section>
  );
}
