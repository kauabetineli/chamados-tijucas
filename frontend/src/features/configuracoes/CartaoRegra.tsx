import { ArrowDown, ArrowUp, Copy, GripVertical, Pencil, Trash2, TriangleAlert, X } from "lucide-react";
import { useState, type DragEvent, type ReactNode } from "react";
import { textoMinutos } from "../../lib/configTI";
import {
  ACOES_POR_ETAPA, CAMPOS_POR_ETAPA, MINUTOS_GATILHO, PRAZOS_REGRA, PRIORIDADES, ROTULO_ACAO, ROTULO_CAMPO, ROTULO_GATILHO,
  avisosDaRegra, nomeAuto, novaAcao, novaCondicao, opcoesAvisar, opcoesDoCampo, rotuloValor,
  type Acao, type Campo, type Condicao, type Etapa, type Gatilho, type Listas, type Regra, type TipoAcao,
} from "../../lib/automacao";

export type Marca = "sim" | "nao" | "pulada" | "off" | undefined;

const ROTULO_PRIO: Record<string, string> = { baixa: "Baixa", normal: "Normal", alta: "Alta", urgente: "Urgente" };

/** Resultado do teste ao lado da regra: ✓ aplicada, – não combinou, · não chegou a ser verificada. */
export function MarcaResultado({ marca }: { marca: Marca }) {
  if (!marca || marca === "off") return null;
  const m = {
    sim: { s: "✓", t: "Aplicada no teste", c: "bg-campo-700 text-white" },
    nao: { s: "–", t: "Não combinou no teste", c: "bg-superficie text-tinta-2 ring-2 ring-linha" },
    pulada: { s: "·", t: "Não chegou a ser verificada no teste", c: "bg-superficie text-tinta-2/70 border-2 border-dashed border-linha" },
  }[marca];
  return (
    <span title={m.t} className={`mt-1 grid size-7 shrink-0 place-items-center rounded-full text-sm font-extrabold ${m.c}`}>
      <span aria-hidden="true">{m.s}</span><span className="sr-only">{m.t}</span>
    </span>
  );
}

/** <select> que funciona como botão de "acrescentar": volta para a opção vazia depois de escolher. */
export function SelectAcrescentar({ rotulo, rotuloAcessivel, opcoes, aoEscolher, cor }: {
  rotulo: string; rotuloAcessivel: string; opcoes: { v: string; rot: string }[]; aoEscolher: (v: string) => void; cor: "mar" | "campo";
}) {
  return (
    <label>
      <span className="sr-only">{rotuloAcessivel}</span>
      <select
        value=""
        onChange={(e) => { if (e.target.value) aoEscolher(e.target.value); }}
        className={`min-h-10 w-28 rounded-lg border-2 border-dashed bg-superficie px-2 font-semibold ${cor === "mar" ? "border-acento/50 text-acento" : "border-ok/50 text-ok"}`}
      >
        <option value="">{rotulo}</option>
        {opcoes.map((o) => <option key={o.v} value={o.v}>{o.rot}</option>)}
      </select>
    </label>
  );
}

const CHIP_COND = "inline-flex flex-wrap items-center gap-1.5 rounded-lg bg-mar-50 py-1 pl-2.5 pr-1 font-semibold text-tinta ring-1 ring-acento/40";
const CHIP_ACAO = "inline-flex flex-wrap items-center gap-1.5 rounded-lg bg-campo-50 py-1 pl-2.5 pr-1 font-semibold text-tinta ring-1 ring-ok/40";
const SEL = "rounded-md border-0 bg-superficie px-1.5 py-1 font-semibold text-tinta ring-1 ring-linha";

export function ChipsCondicoes({ conds, etapa, listas, aoMudar }: {
  conds: Condicao[]; etapa: Etapa; listas: Listas; aoMudar: (c: Condicao[]) => void;
}) {
  const mudar = (j: number, f: (c: Condicao) => Condicao | null) => {
    const novo = conds.map((c, i) => (i === j ? f({ ...c, valores: [...c.valores] }) : c)).filter(Boolean) as Condicao[];
    aoMudar(novo);
  };
  return (
    <>
      {!conds.length && <span className="rounded-lg border-2 border-dashed border-linha px-2.5 py-1.5 text-sm text-tinta-2">qualquer chamado</span>}
      {conds.map((c, j) => {
        const opcoes = opcoesDoCampo(c.campo, listas);
        const restantes = opcoes.filter((o) => !c.valores.includes(o.v));
        const varios = c.valores.length > 1;
        return (
          <span key={j} className="contents">
            {j > 0 && <span className="text-sm font-bold">e</span>}
            <span className={CHIP_COND}>
              {ROTULO_CAMPO[c.campo]}
              <label>
                <span className="sr-only">Comparação</span>
                <select className={SEL} value={c.op} onChange={(e) => mudar(j, (x) => ({ ...x, op: e.target.value as Condicao["op"] }))}>
                  {c.campo === "texto" ? (
                    <><option value="contem">contém alguma destas</option><option value="nao_contem">não contém</option></>
                  ) : (
                    <><option value="e">{varios ? "é um destes" : "é"}</option><option value="nao_e">{varios ? "não é nenhum destes" : "não é"}</option></>
                  )}
                </select>
              </label>
              {c.valores.map((v) => (
                <span key={v} className="inline-flex min-h-7 items-center rounded-full bg-mar-700 pl-2.5 text-sm text-white">
                  {rotuloValor(c.campo, v, listas)}
                  <button type="button" aria-label={`Tirar ${rotuloValor(c.campo, v, listas)}`} className="grid size-7 place-items-center"
                    onClick={() => mudar(j, (x) => ({ ...x, valores: x.valores.filter((q) => q !== v) }))}>
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </span>
              ))}
              {c.campo === "texto" ? (
                <PalavraNova aoAcrescentar={(w) => mudar(j, (x) => ({ ...x, valores: [...x.valores, w] }))} />
              ) : restantes.length > 0 && (
                <label>
                  <span className="sr-only">Mais um valor em {ROTULO_CAMPO[c.campo]}</span>
                  <select value="" className="w-24 rounded-full border-2 border-dashed border-acento/60 bg-superficie px-1.5 py-0.5 text-sm font-semibold text-acento"
                    onChange={(e) => { const v = e.target.value; if (v) mudar(j, (x) => ({ ...x, valores: [...x.valores, v] })); }}>
                    <option value="">{c.valores.length ? "+ ou" : "escolher"}</option>
                    {restantes.map((o) => <option key={o.v} value={o.v}>{o.rot}</option>)}
                  </select>
                </label>
              )}
              <button type="button" aria-label={`Tirar a condição ${ROTULO_CAMPO[c.campo]}`} className="grid size-8 place-items-center rounded-md text-tinta-2 hover:text-tinta"
                onClick={() => mudar(j, () => null)}>
                <X className="size-4" aria-hidden="true" />
              </button>
            </span>
          </span>
        );
      })}
      <SelectAcrescentar
        rotulo="+ Se" rotuloAcessivel="Acrescentar condição" cor="mar"
        opcoes={CAMPOS_POR_ETAPA[etapa].map((k) => ({ v: k, rot: ROTULO_CAMPO[k] }))}
        aoEscolher={(k) => aoMudar([...conds, novaCondicao(k as Campo, listas)])}
      />
    </>
  );
}

function PalavraNova({ aoAcrescentar }: { aoAcrescentar: (w: string) => void }) {
  const [t, setT] = useState("");
  const ok = () => { const w = t.trim(); if (w) { aoAcrescentar(w); setT(""); } };
  return (
    <label className="inline-flex items-center gap-1">
      <span className="sr-only">Nova palavra</span>
      <input value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ok(); } }} onBlur={ok}
        placeholder="+ palavra" className="w-28 rounded-full border-2 border-dashed border-acento/60 bg-superficie px-2.5 py-0.5 text-sm" />
    </label>
  );
}

export function ChipsAcoes({ acoes, etapa, listas, respostas, aoMudar }: {
  acoes: Acao[]; etapa: Etapa; listas: Listas; respostas: string[]; aoMudar: (a: Acao[]) => void;
}) {
  const mudar = (j: number, f: (a: Acao) => Acao | null) => aoMudar(acoes.map((a, i) => (i === j ? f({ ...a }) : a)).filter(Boolean) as Acao[]);
  return (
    <>
      {acoes.map((a, j) => (
        <span key={j} className={CHIP_ACAO}>
          {ROTULO_ACAO[a.tipo]}
          {a.tipo === "prioridade" && (
            <Sel rotulo="Prioridade" valor={a.valor ?? ""} aoMudar={(v) => mudar(j, (x) => ({ ...x, valor: v }))}
              opcoes={PRIORIDADES.map((p) => ({ v: p, rot: ROTULO_PRIO[p] }))} />
          )}
          {a.tipo === "prazo" && (
            <Sel rotulo="Prazo" valor={a.valor ?? ""} aoMudar={(v) => mudar(j, (x) => ({ ...x, valor: v }))}
              opcoes={PRAZOS_REGRA.map((m) => ({ v: String(m), rot: textoMinutos(m) }))} />
          )}
          {a.tipo === "avisar" && (
            <Sel rotulo="Quem avisar" valor={a.valor ?? ""} aoMudar={(v) => mudar(j, (x) => ({ ...x, valor: v }))} opcoes={opcoesAvisar(listas)} />
          )}
          {a.tipo === "atribuir" && (
            <Sel rotulo="Pessoa" valor={a.valor ?? ""} aoMudar={(v) => mudar(j, (x) => ({ ...x, valor: v }))}
              opcoes={[...(listas.pessoas.some((p) => p.v === a.valor) ? [] : [{ v: a.valor ?? "", rot: "escolher…" }]), ...listas.pessoas]} />
          )}
          {(a.tipo === "resposta" || a.tipo === "nota") && (
            <label className="inline-flex">
              <span className="sr-only">{a.tipo === "nota" ? "Texto da nota interna" : "Mensagem para quem pediu"}</span>
              <input
                value={a.valor ?? ""} list={a.tipo === "resposta" ? "respostas-prontas" : undefined}
                onChange={(e) => { const v = e.target.value; mudar(j, (x) => ({ ...x, valor: v })); }}
                placeholder={a.tipo === "nota" ? "Ex.: ver toner no almoxarifado" : "Mensagem (ou escolha uma resposta pronta)"}
                className="w-64 max-w-full rounded-md bg-superficie px-2 py-1 font-normal ring-1 ring-linha"
              />
            </label>
          )}
          {a.tipo === "rodizio" && (
            <>
              {listas.pessoas.map((p) => {
                const on = (a.pessoas ?? []).includes(p.v);
                return (
                  <button key={p.v} type="button" aria-pressed={on}
                    onClick={() => mudar(j, (x) => ({ ...x, pessoas: on ? (x.pessoas ?? []).filter((q) => q !== p.v) : [...(x.pessoas ?? []), p.v] }))}
                    className={`min-h-8 rounded-full px-2.5 text-sm font-bold ${on ? "bg-campo-700 text-white" : "bg-superficie text-tinta-2 border-2 border-dashed border-ok/50"}`}>
                    {p.rot}
                  </button>
                );
              })}
              <Sel rotulo="Como dividir" valor={a.modo ?? "carga"} aoMudar={(v) => mudar(j, (x) => ({ ...x, modo: v as Acao["modo"] }))}
                opcoes={[{ v: "carga", rot: "quem tiver menos chamados" }, { v: "sequencia", rot: "um de cada vez" }]} />
            </>
          )}
          <button type="button" aria-label={`Tirar a ação ${ROTULO_ACAO[a.tipo]}`} className="grid size-8 place-items-center rounded-md text-tinta-2 hover:text-tinta"
            onClick={() => mudar(j, () => null)}>
            <X className="size-4" aria-hidden="true" />
          </button>
        </span>
      ))}
      <SelectAcrescentar
        rotulo="+ Então" rotuloAcessivel="Acrescentar ação" cor="campo"
        opcoes={ACOES_POR_ETAPA[etapa].map((k) => ({ v: k, rot: ROTULO_ACAO[k] }))}
        aoEscolher={(k) => aoMudar([...acoes, novaAcao(k as TipoAcao, listas, respostas)])}
      />
    </>
  );
}

function Sel({ rotulo, valor, opcoes, aoMudar }: { rotulo: string; valor: string; opcoes: { v: string; rot: string }[]; aoMudar: (v: string) => void }) {
  return (
    <label>
      <span className="sr-only">{rotulo}</span>
      <select className={`${SEL} max-w-64`} value={valor} onChange={(e) => aoMudar(e.target.value)}>
        {opcoes.map((o) => <option key={o.v} value={o.v}>{o.rot}</option>)}
      </select>
    </label>
  );
}

export interface PropsCartao {
  regra: Regra;
  etapa: Etapa;
  listas: Listas;
  respostas: string[];
  indisponiveis: Set<string>;
  marca?: Marca;
  avisoExtra?: string;
  dentro?: boolean;
  destacada?: boolean;
  alvo?: boolean;
  ordenavel: boolean;
  primeira: boolean;
  ultima: boolean;
  aoMudar: (r: Regra) => void;
  aoApagar: () => void;
  aoDuplicar: () => void;
  aoMover: (d: -1 | 1) => void;
  arrastar?: { onDragStart: (e: DragEvent) => void; onDragEnd: () => void };
  soltar?: { onDragOver: (e: DragEvent) => void; onDrop: (e: DragEvent) => void; onDragLeave: () => void };
}

export function CartaoRegra(p: PropsCartao) {
  const { regra: r, etapa, listas } = p;
  const avisos = [...avisosDaRegra(r, listas, p.indisponiveis), ...(p.avisoExtra ? [p.avisoExtra] : [])];
  const borda = p.alvo ? "ring-2 ring-acento bg-mar-50" : p.destacada ? "ring-2 ring-acento" : p.marca === "sim" ? "ring-2 ring-ok" : "ring-1 ring-linha";
  return (
    <article
      {...p.soltar}
      aria-label={r.nome || nomeAuto(r, listas)}
      className={`bg-superficie p-3 ${p.dentro ? "rounded-r-xl border-l-8 border-ambar" : "rounded-2xl"} ${borda} ${r.ativa ? "" : "opacity-60"}`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {p.arrastar && (
          <span draggable onDragStart={p.arrastar.onDragStart} onDragEnd={p.arrastar.onDragEnd} title="Arraste para mudar a ordem"
            className="hidden h-9 w-6 shrink-0 cursor-grab place-items-center text-tinta-2 md:grid">
            <GripVertical className="size-5" aria-hidden="true" />
          </span>
        )}
        <MarcaResultado marca={p.marca} />
        <label className="flex min-w-0 flex-[1_1_14rem] items-center gap-1.5 border-b border-dashed border-linha">
          <span className="sr-only">Nome da regra</span>
          <input value={r.nome} placeholder={nomeAuto(r, listas)} onChange={(e) => p.aoMudar({ ...r, nome: e.target.value })}
            className="min-w-0 flex-1 bg-transparent py-1 font-bold placeholder:font-semibold placeholder:text-tinta-2" />
          <Pencil className="size-4 shrink-0 text-tinta-2" aria-hidden="true" />
        </label>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <label className="mr-1 flex min-h-9 cursor-pointer items-center gap-1.5 text-sm font-semibold text-tinta-2">
            <input type="checkbox" role="switch" checked={r.ativa} onChange={() => p.aoMudar({ ...r, ativa: !r.ativa })} className="size-5 accent-acento" />
            Ligada
          </label>
          {p.ordenavel && (
            <>
              <BotaoIcone rotulo="Mover para cima" desabilitado={p.primeira} aoClicar={() => p.aoMover(-1)}><ArrowUp className="size-4" /></BotaoIcone>
              <BotaoIcone rotulo="Mover para baixo" desabilitado={p.ultima} aoClicar={() => p.aoMover(1)}><ArrowDown className="size-4" /></BotaoIcone>
            </>
          )}
          <BotaoIcone rotulo="Duplicar a regra" aoClicar={p.aoDuplicar}><Copy className="size-4" /></BotaoIcone>
          <BotaoIcone rotulo="Apagar a regra" aoClicar={p.aoApagar}><Trash2 className="size-4" /></BotaoIcone>
        </div>
      </div>
      <div className="mt-2 space-y-2 md:pl-8">
        {avisos.map((a) => (
          <p key={a} className="flex items-start gap-2 rounded-lg bg-sol-50 px-2.5 py-1.5 text-sm font-semibold text-ambar-tinta">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {a}
          </p>
        ))}
        <Linha rotulo="Se" cor="text-acento">
          {etapa === "tempo" && <Gatilho r={r} aoMudar={p.aoMudar} />}
          <ChipsCondicoes conds={r.conds} etapa={etapa} listas={listas} aoMudar={(conds) => p.aoMudar({ ...r, conds })} />
        </Linha>
        <Linha rotulo="Então" cor="text-ok">
          <ChipsAcoes acoes={r.acoes} etapa={etapa} listas={listas} respostas={p.respostas} aoMudar={(acoes) => p.aoMudar({ ...r, acoes })} />
        </Linha>
      </div>
    </article>
  );
}

function Linha({ rotulo, cor, children }: { rotulo: string; cor: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`w-12 shrink-0 text-xs font-extrabold uppercase tracking-wider ${cor}`}>{rotulo}</span>
      {children}
    </div>
  );
}

function Gatilho({ r, aoMudar }: { r: Regra; aoMudar: (r: Regra) => void }) {
  const g = r.gatilho ?? "sem_inicio";
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 rounded-lg bg-noite py-1 pl-2.5 pr-1 font-semibold text-white">
      <label>
        <span className="sr-only">Situação</span>
        <select value={g} className="rounded-md bg-superficie px-1.5 py-1 font-semibold text-tinta"
          onChange={(e) => { const v = e.target.value as Gatilho; aoMudar({ ...r, gatilho: v, minutos: MINUTOS_GATILHO[v][1] ?? MINUTOS_GATILHO[v][0] ?? 0 }); }}>
          {(Object.keys(ROTULO_GATILHO) as Gatilho[]).map((k) => <option key={k} value={k}>{ROTULO_GATILHO[k]}</option>)}
        </select>
      </label>
      {MINUTOS_GATILHO[g].length > 0 && (
        <label>
          <span className="sr-only">Tempo</span>
          <select value={String(r.minutos ?? 0)} className="rounded-md bg-superficie px-1.5 py-1 font-semibold text-tinta"
            onChange={(e) => aoMudar({ ...r, minutos: parseInt(e.target.value, 10) })}>
            {MINUTOS_GATILHO[g].map((m) => <option key={m} value={m}>{textoMinutos(m)}</option>)}
          </select>
        </label>
      )}
    </span>
  );
}

export function BotaoIcone({ rotulo, aoClicar, desabilitado, children }: { rotulo: string; aoClicar: () => void; desabilitado?: boolean; children: ReactNode }) {
  return (
    <button type="button" aria-label={rotulo} title={rotulo} disabled={desabilitado} onClick={aoClicar}
      className="grid size-9 place-items-center rounded-lg text-tinta-2 ring-1 ring-linha hover:text-tinta disabled:opacity-40">
      {children}
    </button>
  );
}
