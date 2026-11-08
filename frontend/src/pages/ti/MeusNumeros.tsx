import { CalendarDays, Hourglass, ListOrdered, ThumbsDown, ThumbsUp, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { Bloco } from "../../components/Esqueleto";
import { useAuth } from "../../lib/auth";
import { useTecnicos } from "../../lib/equipe";
import { duracaoHoras } from "../../lib/formato";
import { ehAdmin, ehObservador, pb } from "../../lib/pb";

interface Periodo { resolvidos: number; horas_media: number; iniciados: number; bom: number; ruim: number }
interface Mes extends Periodo { mes: number }
interface Numeros {
  tecnico: string;
  ano: number;
  anos: number[];
  hoje: Periodo;
  semana: Periodo;
  mes: Periodo;
  agora: { atendendo: number; aguardando: number; na_fila: number };
  por_mes: Mes[];
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/**
 * Números de UM técnico: hoje, 7 dias, mês e o ano mês a mês (meses sem nada aparecem com zero:
 * mostra férias, troca de função ou o começo do piloto sem "buracos" no gráfico).
 * Tocar num mês mostra os detalhes dele. O admin do TI escolhe de qual técnico ver.
 */
export function MeusNumeros() {
  const { usuario } = useAuth();
  // admin e observador (equipe do Dino Desk) podem ver os números de qualquer técnico
  const admin = ehAdmin(usuario) || ehObservador(usuario);
  const tecnicos = useTecnicos();
  const [tecnico, setTecnico] = useState(usuario?.id ?? "");
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const [n, setN] = useState<Numeros | null>(null);
  const [erro, setErro] = useState(false);
  const [mesSel, setMesSel] = useState<number | null>(null);

  useEffect(() => {
    setErro(false);
    setN(null);
    pb.send<Numeros>("/api/painel/tecnico", { query: { ano, tecnico }, requestKey: "meus-numeros" })
      .then((r) => {
        setN(r);
        // abre no mês atual (ou, em ano passado, no último mês com algum resolvido)
        const ultimo = [...r.por_mes].reverse().find((m) => m.resolvidos || m.iniciados)?.mes ?? 12;
        setMesSel(r.ano === anoAtual ? new Date().getMonth() + 1 : ultimo);
      })
      .catch(() => setErro(true));
  }, [ano, tecnico, anoAtual]);

  const eu = tecnico === usuario?.id;
  const nome = eu ? "você" : (tecnicos.find((t) => t.id === tecnico)?.name ?? "").split(" ")[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        {admin && tecnicos.length > 1 && (
          <label className="flex items-center gap-2 text-sm font-semibold">
            Técnico
            <select className="campo min-h-11 w-auto py-2" value={tecnico} onChange={(e) => setTecnico(e.target.value)}>
              {tecnicos.map((t) => <option key={t.id} value={t.id}>{t.id === usuario?.id ? `${t.name} (você)` : t.name}</option>)}
            </select>
          </label>
        )}
        {n && (
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-tinta-2">
            <span className="inline-flex items-center gap-1.5"><Wrench className="size-4" aria-hidden="true" /><b className="text-tinta">{n.agora.atendendo}</b> em atendimento</span>
            <span className="inline-flex items-center gap-1.5"><Hourglass className="size-4" aria-hidden="true" /><b className="text-tinta">{n.agora.aguardando}</b> em espera</span>
            <span className="inline-flex items-center gap-1.5"><ListOrdered className="size-4" aria-hidden="true" /><b className="text-tinta">{n.agora.na_fila}</b> reservados na fila</span>
          </p>
        )}
      </div>

      {erro && <p className="font-semibold text-alerta">Não foi possível carregar os números.</p>}

      {!n ? (
        !erro && (
          <div aria-busy="true" className="space-y-6">
            <span className="sr-only" role="status">Carregando os números...</span>
            <div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((i) => <Bloco key={i} className="h-36 rounded-2xl" />)}</div>
            <Bloco className="h-64 rounded-2xl" />
          </div>
        )
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <CartaoPeriodo titulo="Hoje" p={n.hoje} />
            <CartaoPeriodo titulo="Últimos 7 dias" p={n.semana} />
            <CartaoPeriodo titulo={`Em ${MESES_LONGOS[new Date().getMonth()]}`} p={n.mes} />
          </div>

          <section className="rounded-2xl bg-superficie p-5 ring-1 ring-linha">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Mês a mês</h2>
                <p className="text-sm text-tinta-2">Chamados resolvidos por {nome} em {n.ano}. Toque num mês para ver os detalhes.</p>
              </div>
              <div role="tablist" aria-label="Ano" className="flex rounded-xl bg-fundo p-1">
                {n.anos.map((a) => (
                  <button
                    key={a}
                    role="tab"
                    aria-selected={ano === a}
                    onClick={() => setAno(a)}
                    className={`min-h-10 rounded-lg px-3 text-sm font-semibold ${ano === a ? "bg-mar-700 text-white" : "text-tinta-2 hover:text-tinta"}`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <GraficoMeses meses={n.por_mes} ano={n.ano} selecionado={mesSel} aoEscolher={setMesSel} />
            {mesSel && <DetalheMes m={n.por_mes[mesSel - 1]} ano={n.ano} />}
          </section>
        </>
      )}
    </div>
  );
}

function Avaliacoes({ bom, ruim }: { bom: number; ruim: number }) {
  if (!bom && !ruim) return <span>sem avaliações</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex items-center gap-1" title="Avaliações boas"><ThumbsUp className="size-4 text-ok" aria-hidden="true" /> {bom}</span>
      <span className="inline-flex items-center gap-1" title="Poderia ser melhor"><ThumbsDown className="size-4 text-alerta" aria-hidden="true" /> {ruim}</span>
      <span className="sr-only">{bom} boas e {ruim} "poderia ser melhor"</span>
    </span>
  );
}

function CartaoPeriodo({ titulo, p }: { titulo: string; p: Periodo }) {
  return (
    <div className="rounded-2xl bg-superficie p-5 ring-1 ring-linha">
      <p className="text-sm font-semibold text-tinta-2">{titulo}</p>
      <p className="mt-1 flex items-baseline gap-2">
        <span className="font-display text-4xl font-extrabold">{p.resolvidos}</span>
        <span className="text-tinta-2">{p.resolvidos === 1 ? "resolvido" : "resolvidos"}</span>
      </p>
      <dl className="mt-3 space-y-1 text-sm text-tinta-2">
        <div className="flex justify-between gap-2"><dt>Atendimentos começados</dt><dd className="font-semibold text-tinta">{p.iniciados}</dd></div>
        <div className="flex justify-between gap-2"><dt>Tempo médio até resolver</dt><dd className="font-semibold text-tinta">{p.resolvidos ? duracaoHoras(p.horas_media) : "—"}</dd></div>
        <div className="flex justify-between gap-2"><dt>Avaliações</dt><dd className="font-semibold text-tinta"><Avaliacoes bom={p.bom} ruim={p.ruim} /></dd></div>
      </dl>
    </div>
  );
}

function GraficoMeses({ meses, ano, selecionado, aoEscolher }: { meses: Mes[]; ano: number; selecionado: number | null; aoEscolher: (m: number) => void }) {
  const max = Math.max(1, ...meses.map((m) => m.resolvidos));
  const agora = new Date();
  const futuro = (mes: number) => ano > agora.getFullYear() || (ano === agora.getFullYear() && mes > agora.getMonth() + 1);
  return (
    <div className="mt-5 grid grid-cols-12 gap-1 sm:gap-2" role="radiogroup" aria-label="Mês">
      {meses.map((m) => {
        const sel = selecionado === m.mes;
        const fut = futuro(m.mes);
        return (
          <label
            key={m.mes}
            className={`group flex cursor-pointer flex-col items-center gap-1 rounded-lg pt-1 pb-1.5 ${sel ? "bg-mar-50 ring-2 ring-acento" : "hover:bg-fundo"} ${fut ? "opacity-50" : ""}`}
            title={`${MESES_LONGOS[m.mes - 1]}: ${m.resolvidos} resolvidos`}
          >
            <input type="radio" name="mes" className="sr-only" checked={sel} onChange={() => aoEscolher(m.mes)} />
            <span className={`text-xs font-bold tabular-nums ${m.resolvidos ? "text-tinta" : "text-tinta-2"}`}>{m.resolvidos}</span>
            <span className="flex h-32 w-full items-end justify-center px-0.5 sm:px-1.5">
              <span
                className={`w-full max-w-9 rounded-t ${m.resolvidos ? (sel ? "bg-mar-700" : "bg-mar") : "bg-linha"}`}
                // mês zerado ainda aparece: uma linha fina no chão do gráfico
                style={{ height: m.resolvidos ? `${Math.max(4, (m.resolvidos / max) * 100)}%` : "3px" }}
                aria-hidden="true"
              />
            </span>
            <span className={`text-xs ${sel ? "font-bold text-acento" : "text-tinta-2"}`}>{MESES[m.mes - 1]}</span>
          </label>
        );
      })}
    </div>
  );
}

function DetalheMes({ m, ano }: { m: Mes; ano: number }) {
  return (
    <div className="mt-4 rounded-xl bg-fundo p-4" aria-live="polite">
      <p className="flex items-center gap-2 font-bold">
        <CalendarDays className="size-5 text-acento" aria-hidden="true" />
        <span>{MESES_LONGOS[m.mes - 1][0].toUpperCase() + MESES_LONGOS[m.mes - 1].slice(1)} de {ano}</span>
      </p>
      {!m.resolvidos && !m.iniciados ? (
        <p className="mt-2 text-tinta-2">Nenhum chamado atendido neste mês.</p>
      ) : (
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          <Item termo="Resolvidos" valor={String(m.resolvidos)} />
          <Item termo="Atendimentos começados" valor={String(m.iniciados)} />
          <Item termo="Tempo médio até resolver" valor={m.resolvidos ? duracaoHoras(m.horas_media) : "—"} />
          <div>
            <dt className="text-sm text-tinta-2">Avaliações</dt>
            <dd className="mt-0.5 font-semibold"><Avaliacoes bom={m.bom} ruim={m.ruim} /></dd>
          </div>
        </dl>
      )}
    </div>
  );
}

function Item({ termo, valor }: { termo: string; valor: string }) {
  return (
    <div>
      <dt className="text-sm text-tinta-2">{termo}</dt>
      <dd className="mt-0.5 font-display text-2xl font-extrabold">{valor}</dd>
    </div>
  );
}
