import "@xyflow/react/dist/style.css";
import {
  Background, BackgroundVariant, Controls, Handle, MarkerType, MiniMap, Panel, Position, ReactFlow, ReactFlowProvider,
  applyNodeChanges, useReactFlow,
  type Connection, type Edge, type EdgeChange, type Node, type NodeChange, type NodeProps,
} from "@xyflow/react";
import {
  ArrowUp, BellRing, Flag, GitBranch, LayoutGrid, Maximize, MessageSquare, StickyNote, Timer, TriangleAlert, Undo2, UserCheck, Users, Zap,
} from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useState, type DragEvent, type ReactNode } from "react";
import {
  ACOES_POR_GATILHO, CAMPOS, ROTULO_ACAO, ROTULO_CAMPO, novaAcao, novaCondicao, novoId, ordemTopologica, organizar, textoAcao,
  textoCondicao, textoGatilho,
  type Campo, type Fluxo, type Listas, type No, type Saida, type TipoAcao,
} from "../../../lib/automacao";

export type StatusNo = "sim" | "nao" | "ignorada";
export interface TesteFluxo { status: Record<string, StatusNo>; ativas: string[] }

type ItemPaleta = { tipo: "cond"; campo: Campo } | { tipo: "acao"; acao: TipoAcao };
const MIME = "application/dino-bloco";

export const ICONE_ACAO: Record<TipoAcao, typeof Flag> = {
  prioridade: Flag, prazo: Timer, subir: ArrowUp, atribuir: UserCheck, rodizio: Users, devolver: Undo2,
  avisar: BellRing, resposta: MessageSquare, nota: StickyNote,
};

/* ------------------------------------------------------------------ */
/* Blocos (nós)                                                         */
/* ------------------------------------------------------------------ */

interface Ctx { fluxo: Fluxo; listas: Listas; porNo: Record<string, string[]>; teste: TesteFluxo | null }
const CtxFluxo = createContext<Ctx | null>(null);

const PINO = "size-3.5! border-2! bg-superficie!";

function Alerta({ id }: { id: string }) {
  const c = useContext(CtxFluxo)!;
  const p = c.porNo[id];
  if (!p?.length) return null;
  return (
    <span title={p.join(" ")} className="absolute -top-2.5 -right-2.5 grid size-6 place-items-center rounded-full bg-superficie text-alerta ring-2 ring-alerta">
      <TriangleAlert className="size-3.5" aria-hidden="true" /><span className="sr-only">{p.join(" ")}</span>
    </span>
  );
}

function Selo({ st }: { st?: StatusNo }) {
  if (!st) return null;
  const m = {
    sim: { t: "Fez", c: "bg-campo-50 text-ok ring-ok/40" },
    nao: { t: "Não", c: "bg-brasa-50 text-alerta ring-alerta/40" },
    ignorada: { t: "Ignorado", c: "bg-fundo text-tinta-2 ring-linha" },
  }[st];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-extrabold ring-1 ${m.c}`}>{m.t}</span>;
}

function moldura(selected: boolean, testando: boolean, alcancado: boolean) {
  return `relative w-64 rounded-2xl border-2 bg-superficie shadow-sm transition-opacity ${selected ? "border-acento ring-4 ring-acento/25" : "border-linha"} ${testando && !alcancado ? "opacity-55" : ""}`;
}

function NoInicio({ selected }: NodeProps) {
  const c = useContext(CtxFluxo)!;
  return (
    <div className={`relative w-64 rounded-2xl bg-mar-700 px-4 py-3 text-white shadow-md ${selected ? "ring-4 ring-acento/40" : ""}`}>
      <p className="flex items-center gap-1.5 text-xs font-extrabold tracking-wider uppercase opacity-90">
        <Zap className="size-3.5" aria-hidden="true" /> Gatilho
      </p>
      <p className="mt-0.5 font-bold leading-snug">{textoGatilho(c.fluxo)}</p>
      <Handle type="source" position={Position.Bottom} id="segue" className={`${PINO} border-acento!`} />
    </div>
  );
}

function NoCond({ id, selected }: NodeProps) {
  const c = useContext(CtxFluxo)!;
  const n = c.fluxo.nos.find((x) => x.id === id);
  if (!n?.cond) return null;
  const st = c.teste?.status[id];
  return (
    <div className={moldura(!!selected, !!c.teste, !!st)}>
      <Handle type="target" position={Position.Top} id="in" className={`${PINO} border-tinta-2!`} />
      <Alerta id={id} />
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-extrabold tracking-wider text-acento uppercase">
            <GitBranch className="size-3.5" aria-hidden="true" /> Se
          </p>
          <Selo st={st === "sim" ? undefined : st} />
          {st === "sim" && <span className="rounded-full bg-campo-50 px-2 py-0.5 text-xs font-extrabold text-ok ring-1 ring-ok/40">Sim</span>}
        </div>
        <p className="mt-0.5 font-bold leading-snug text-tinta">{textoCondicao(n.cond, c.listas)}?</p>
      </div>
      <div className="flex justify-between border-t border-linha px-3 py-1 text-xs font-extrabold">
        <span className="text-ok">Sim</span><span className="text-alerta">Não</span>
      </div>
      <Handle type="source" position={Position.Bottom} id="sim" style={{ left: "16%" }} className={`${PINO} border-ok!`} />
      <Handle type="source" position={Position.Bottom} id="nao" style={{ left: "84%" }} className={`${PINO} border-alerta!`} />
    </div>
  );
}

function NoAcao({ id, selected }: NodeProps) {
  const c = useContext(CtxFluxo)!;
  const n = c.fluxo.nos.find((x) => x.id === id);
  if (!n?.acao) return null;
  const st = c.teste?.status[id];
  const Icone = ICONE_ACAO[n.acao.tipo];
  return (
    <div className={moldura(!!selected, !!c.teste, !!st)}>
      <Handle type="target" position={Position.Top} id="in" className={`${PINO} border-tinta-2!`} />
      <Alerta id={id} />
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-extrabold tracking-wider text-ok uppercase">
            <Icone className="size-3.5" aria-hidden="true" /> Então
          </p>
          <Selo st={st} />
        </div>
        <p className="mt-0.5 line-clamp-3 font-bold leading-snug text-tinta">{textoAcao(n.acao, c.listas)}</p>
      </div>
      <Handle type="source" position={Position.Bottom} id="segue" className={`${PINO} border-tinta-2!`} />
    </div>
  );
}

const TIPOS_NO = { inicio: NoInicio, cond: NoCond, acao: NoAcao };

/* ------------------------------------------------------------------ */
/* Paleta                                                               */
/* ------------------------------------------------------------------ */

export function Paleta({ fluxo, aoAdicionar }: { fluxo: Fluxo; aoAdicionar: (i: ItemPaleta) => void }) {
  const item = (i: ItemPaleta, rot: string, Icone: typeof Flag, cor: string) => (
    <button key={rot} type="button" draggable
      onDragStart={(e) => { e.dataTransfer.setData(MIME, JSON.stringify(i)); e.dataTransfer.effectAllowed = "copy"; }}
      onClick={() => aoAdicionar(i)}
      title="Arraste para o desenho, ou clique para ligar abaixo do bloco selecionado"
      className={`flex min-h-10 w-full cursor-grab items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm font-bold ring-1 ${cor}`}>
      <Icone className="size-4 shrink-0" aria-hidden="true" />{rot}
    </button>
  );
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <p className="text-xs font-extrabold tracking-wider text-acento uppercase">Pergunta (Se…)</p>
        {CAMPOS.map((k) => item({ tipo: "cond", campo: k }, ROTULO_CAMPO[k], GitBranch, "bg-mar-50 ring-acento/30 text-tinta"))}
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-extrabold tracking-wider text-ok uppercase">Ação (Então…)</p>
        {ACOES_POR_GATILHO[fluxo.gatilho].map((k) => item({ tipo: "acao", acao: k }, ROTULO_ACAO[k], ICONE_ACAO[k], "bg-campo-50 ring-ok/30 text-tinta"))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Canvas                                                               */
/* ------------------------------------------------------------------ */

export interface PropsCanvas {
  fluxo: Fluxo; listas: Listas; porNo: Record<string, string[]>;
  /** resultado do teste para ESTE fluxo; null = não acender o caminho */
  teste: TesteFluxo | null;
  noSel: string; setNoSel: (id: string) => void;
  /** muda o fluxo selecionado; com `aviso`, mostra o aviso com "Desfazer" */
  mudar: (f: (fl: Fluxo) => void, aviso?: string) => void;
  resumoTeste?: ReactNode;
}

export function CanvasFluxo(p: PropsCanvas) {
  return <ReactFlowProvider><Interno {...p} /></ReactFlowProvider>;
}

const COR_SAIDA: Record<Saida, string> = { sim: "var(--color-ok)", nao: "var(--color-alerta)", segue: "var(--color-tinta-2)" };

function Interno({ fluxo, listas, porNo, teste, noSel, setNoSel, mudar, resumoTeste }: PropsCanvas) {
  const rf = useReactFlow();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [ligSel, setLigSel] = useState("");

  // os blocos vêm do fluxo; o React Flow guarda a medida de cada um, então mesclamos com o que ele já tinha
  useEffect(() => {
    setNodes((antes) => fluxo.nos.map((n) => {
      const a = antes.find((x) => x.id === n.id);
      return { ...(a ?? {}), id: n.id, type: n.tipo, position: { x: n.x, y: n.y }, data: {}, deletable: n.tipo !== "inicio", selected: n.id === noSel };
    }));
  }, [fluxo.nos, noSel]);

  const edges: Edge[] = fluxo.ligacoes.map((l) => {
    const ativa = !!teste?.ativas.includes(l.id);
    const cor = COR_SAIDA[l.saida];
    const sel = l.id === ligSel;
    return {
      id: l.id, source: l.de, sourceHandle: l.saida, target: l.para, targetHandle: "in", type: "smoothstep", selected: sel,
      label: l.saida === "segue" ? undefined : l.saida === "sim" ? "Sim" : "Não",
      animated: ativa,
      style: { stroke: cor, strokeWidth: ativa || sel ? 3.5 : 2, opacity: teste && !ativa ? 0.3 : 1 },
      markerEnd: { type: MarkerType.ArrowClosed, color: cor, width: 18, height: 18 },
      labelStyle: { fill: cor, fontWeight: 800 }, labelBgStyle: { fill: "var(--color-superficie)" },
      labelBgPadding: [6, 3] as [number, number], labelBgBorderRadius: 6,
    };
  });

  const saidaDe = (de: string, handle: string | null | undefined): Saida => {
    const n = fluxo.nos.find((x) => x.id === de);
    return n?.tipo === "cond" ? (handle === "nao" ? "nao" : "sim") : "segue";
  };

  const valida = useCallback((c: Connection | Edge) => {
    if (!c.source || !c.target || c.source === c.target || c.target === "inicio") return false;
    const saida = saidaDe(c.source, c.sourceHandle);
    if (fluxo.ligacoes.some((l) => l.de === c.source && l.para === c.target && l.saida === saida)) return false;
    return !!ordemTopologica(fluxo.nos, [...fluxo.ligacoes, { id: "x", de: c.source, saida, para: c.target }]);
  }, [fluxo]); // eslint-disable-line react-hooks/exhaustive-deps

  function onConnect(c: Connection) {
    if (!valida(c)) return;
    const saida = saidaDe(c.source, c.sourceHandle);
    mudar((f) => { f.ligacoes.push({ id: novoId(), de: c.source, saida, para: c.target }); });
  }

  function onNodesChange(ch: NodeChange[]) {
    setNodes((ns) => applyNodeChanges(ch, ns));
    const rem = ch.flatMap((c) => (c.type === "remove" && c.id !== "inicio" ? [c.id] : []));
    if (rem.length) {
      mudar((f) => {
        f.nos = f.nos.filter((n) => !rem.includes(n.id));
        f.ligacoes = f.ligacoes.filter((l) => !rem.includes(l.de) && !rem.includes(l.para));
      }, rem.length > 1 ? "Blocos apagados." : "Bloco apagado.");
      if (rem.includes(noSel)) setNoSel("");
    }
    for (const c of ch) if (c.type === "select" && c.selected) { setNoSel(c.id); setLigSel(""); }
  }

  function onEdgesChange(ch: EdgeChange[]) {
    const rem = ch.flatMap((c) => (c.type === "remove" ? [c.id] : []));
    if (rem.length) mudar((f) => { f.ligacoes = f.ligacoes.filter((l) => !rem.includes(l.id)); }, "Ligação apagada.");
    for (const c of ch) if (c.type === "select") setLigSel(c.selected ? c.id : "");
  }

  /** novo bloco: ligado abaixo do selecionado (ou do gatilho, se o fluxo está vazio) */
  function adicionar(i: ItemPaleta, onde?: { x: number; y: number }) {
    const id = novoId();
    const base = i.tipo === "cond" ? { tipo: "cond" as const, cond: novaCondicao(i.campo) } : { tipo: "acao" as const, acao: novaAcao(i.acao) };
    const origem = onde ? undefined : fluxo.nos.find((n) => n.id === noSel) ?? (fluxo.nos.length === 1 ? fluxo.nos[0] : undefined);
    let saida: Saida = "segue";
    if (origem?.tipo === "cond") saida = fluxo.ligacoes.some((l) => l.de === origem.id && l.saida === "sim") ? "nao" : "sim";
    const maisBaixo = fluxo.nos.reduce((m, n) => Math.max(m, n.y), 0);
    const pos = onde ?? (origem
      ? { x: origem.x + (saida === "sim" ? -150 : saida === "nao" ? 150 : 0), y: origem.y + 170 }
      : { x: 0, y: maisBaixo + 170 });
    const novo: No = { id, x: Math.round(pos.x), y: Math.round(pos.y), ...base };
    mudar((f) => {
      f.nos.push(novo);
      if (origem) f.ligacoes.push({ id: novoId(), de: origem.id, saida, para: id });
    });
    setNoSel(id);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    const raw = e.dataTransfer.getData(MIME);
    if (!raw) return;
    const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    adicionar(JSON.parse(raw) as ItemPaleta, { x: p.x - 128, y: p.y - 40 });
  }

  return (
    <CtxFluxo.Provider value={{ fluxo, listas, porNo, teste }}>
      <div className="flex h-full min-h-0">
        <aside className="hidden w-48 shrink-0 overflow-y-auto border-r border-linha p-3 md:block" aria-label="Blocos para adicionar">
          <p className="mb-3 text-sm text-tinta-2">Arraste para o desenho ou clique para ligar abaixo do bloco selecionado.</p>
          <Paleta fluxo={fluxo} aoAdicionar={(i) => adicionar(i)} />
        </aside>
        <div className="relative min-w-0 flex-1" onDragOver={(e) => { if (e.dataTransfer.types.includes(MIME)) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } }} onDrop={onDrop}>
          <ReactFlow
            nodes={nodes} edges={edges} nodeTypes={TIPOS_NO}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} isValidConnection={valida}
            onNodeDragStop={(_, __, arrastados) => mudar((f) => {
              for (const d of arrastados) { const n = f.nos.find((x) => x.id === d.id); if (n) { n.x = Math.round(d.position.x); n.y = Math.round(d.position.y); } }
            })}
            onPaneClick={() => { setNoSel(""); setLigSel(""); }}
            deleteKeyCode={["Delete", "Backspace"]}
            fitView fitViewOptions={{ padding: 0.25, maxZoom: 1 }} minZoom={0.3} maxZoom={1.5}
            defaultEdgeOptions={{ type: "smoothstep" }} connectionLineStyle={{ stroke: "var(--color-acento)", strokeWidth: 2.5 }}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.6} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className="hidden! lg:block!" />
            <Panel position="top-right" className="flex gap-2">
              <button type="button" className="btn-secundario min-h-10 bg-superficie px-3 text-sm"
                onClick={() => { mudar((f) => { Object.assign(f, organizar(f)); }); window.setTimeout(() => rf.fitView({ padding: 0.25, maxZoom: 1, duration: 300 }), 60); }}>
                <LayoutGrid className="size-4" aria-hidden="true" /><span className="sr-only sm:not-sr-only">Organizar</span>
              </button>
              <button type="button" className="btn-secundario min-h-10 bg-superficie px-3 text-sm" onClick={() => rf.fitView({ padding: 0.25, maxZoom: 1, duration: 300 })}>
                <Maximize className="size-4" aria-hidden="true" /><span className="sr-only sm:not-sr-only">Ver tudo</span>
              </button>
            </Panel>
            <Panel position="top-left" className="md:hidden">
              <label>
                <span className="sr-only">Adicionar bloco</span>
                <select value="" className="campo min-h-11 w-40 bg-superficie font-bold"
                  onChange={(e) => { const v = e.target.value; if (!v) return; const [t, k] = v.split(":"); adicionar(t === "cond" ? { tipo: "cond", campo: k as Campo } : { tipo: "acao", acao: k as TipoAcao }); }}>
                  <option value="">+ Adicionar bloco</option>
                  <optgroup label="Pergunta (Se…)">{CAMPOS.map((k) => <option key={k} value={`cond:${k}`}>{ROTULO_CAMPO[k]}</option>)}</optgroup>
                  <optgroup label="Ação (Então…)">{ACOES_POR_GATILHO[fluxo.gatilho].map((k) => <option key={k} value={`acao:${k}`}>{ROTULO_ACAO[k]}</option>)}</optgroup>
                </select>
              </label>
            </Panel>
            {resumoTeste && <Panel position="bottom-center">{resumoTeste}</Panel>}
          </ReactFlow>
        </div>
      </div>
    </CtxFluxo.Provider>
  );
}
