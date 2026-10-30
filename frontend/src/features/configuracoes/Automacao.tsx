import { History, Plus, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Bloco as BlocoCinza } from "../../components/Esqueleto";
import { avisar } from "../../lib/avisos";
import {
  AUTOMACAO_VAZIA, nomeFluxo, novoFluxo, novoId, organizar, problemasDoFluxo, textoGatilho,
  type Automacao as TAutomacao, type Fluxo, type Listas, type Problemas,
} from "../../lib/automacao";
import { dataHora } from "../../lib/formato";
import { mensagemErro, pb } from "../../lib/pb";
import { BarraSalvar } from "./BarraSalvar";
import type { Tecnico } from "./dados";
import { CanvasFluxo } from "./fluxo/Canvas";
import { Inspetor } from "./fluxo/Inspetor";
import { PainelTeste, resumoResultado, type Resultado, type Sim } from "./fluxo/Teste";

/**
 * Automação dos chamados em FLUXOS independentes (como jobs): cada um começa num gatilho e segue blocos ligados
 * (perguntas com saídas Sim/Não e ações). O motor e as regras de conflito estão em backend/pb_hooks/lib/automacao.js.
 */

interface Versao { id: string; quando: string; autor: string; resumo: string }

const clonar = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** "1 fluxo novo, 2 alterados" */
function diferencas(salvo: TAutomacao, rasc: TAutomacao): { total: number; resumo: string } {
  const antes = new Map(salvo.fluxos.map((f) => [f.id, JSON.stringify(f)]));
  let novos = 0; let alterados = 0; let apagados = 0;
  for (const f of rasc.fluxos) { const s = antes.get(f.id); if (s === undefined) novos++; else if (s !== JSON.stringify(f)) alterados++; }
  for (const f of salvo.fluxos) if (!rasc.fluxos.some((x) => x.id === f.id)) apagados++;
  const ids = (a: TAutomacao, b: TAutomacao) => a.fluxos.map((f) => f.id).filter((id) => b.fluxos.some((x) => x.id === id)).join();
  const ordem = ids(salvo, rasc) !== ids(rasc, salvo);
  const senao = JSON.stringify(salvo.senao) !== JSON.stringify(rasc.senao);
  const partes = [
    novos && `${novos} fluxo${novos > 1 ? "s" : ""} novo${novos > 1 ? "s" : ""}`,
    alterados && `${alterados} alterado${alterados > 1 ? "s" : ""}`,
    apagados && `${apagados} apagado${apagados > 1 ? "s" : ""}`,
    ordem && "mudou a ordem",
    senao && "mudou o “se nenhum fluxo escolher alguém”",
  ].filter(Boolean) as string[];
  const txt = partes.join(", ");
  return { total: novos + alterados + apagados + (ordem ? 1 : 0) + (senao ? 1 : 0), resumo: txt ? txt.charAt(0).toUpperCase() + txt.slice(1) : "" };
}

/** Dois blocos no mesmo lugar = fluxo sem posições. */
function empilhado(f: Fluxo): boolean {
  const vistos = new Set<string>();
  for (const n of f.nos) { const k = `${n.x},${n.y}`; if (vistos.has(k)) return true; vistos.add(k); }
  return false;
}

const SIM_INICIAL: Sim = { categoria: "", setor: "", impacto: "so_eu", prioridade: "", origem: "sistema", texto: "", anexo: "nao", horario: "expediente", responsavel: "nao" };

export function Automacao({ equipe, listas, respostas, pronto }: {
  equipe: Tecnico[] | null; listas: Listas; respostas: string[]; pronto: boolean;
}) {
  const [salvo, setSalvo] = useState<TAutomacao | null>(null);
  const [rasc, setRasc] = useState<TAutomacao>(AUTOMACAO_VAZIA);
  const [versao, setVersao] = useState("");
  const [historico, setHistorico] = useState<Versao[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [sel, setSel] = useState("");
  const [noSel, setNoSel] = useState("");

  const carregar = useCallback(() => {
    pb.send<{ versao: string; dados: TAutomacao; historico: Versao[] }>("/api/ti/automacao", {})
      .then((r) => {
        // blocos sem posição (criados pela API ou pelas ferramentas) ficam empilhados: arruma antes de mostrar
        r.dados.fluxos = r.dados.fluxos.map((f) => (empilhado(f) ? organizar(f) : f));
        setSalvo(r.dados); setRasc(clonar(r.dados)); setVersao(r.versao); setHistorico(r.historico);
        setSel((s) => (r.dados.fluxos.some((f) => f.id === s) ? s : r.dados.fluxos[0]?.id ?? ""));
      })
      .catch((e) => { avisar(mensagemErro(e), { tipo: "erro" }); setSalvo(AUTOMACAO_VAZIA); });
  }, []);
  useEffect(carregar, [carregar]);

  const dif = useMemo(() => (salvo ? diferencas(salvo, rasc) : { total: 0, resumo: "" }), [salvo, rasc]);

  useEffect(() => {
    if (!dif.total) return;
    const f = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [dif.total]);

  /** muda o rascunho; com `aviso`, mostra o aviso com "Desfazer" */
  const mudar = useCallback((f: (d: TAutomacao) => void, aviso?: string) => {
    setRasc((antes) => {
      const d = clonar(antes);
      f(d);
      if (aviso) avisar(aviso, { tipo: "info", acao: { rotulo: "Desfazer", fazer: () => setRasc(antes) } });
      return d;
    });
  }, []);
  const mudarFluxo = useCallback((f: (fl: Fluxo) => void, aviso?: string) => {
    mudar((d) => { const fl = d.fluxos.find((x) => x.id === sel); if (fl) f(fl); }, aviso);
  }, [mudar, sel]);

  const indisponiveis = useMemo(() => new Set((equipe ?? []).filter((t) => !t.disponivel).map((t) => t.id)), [equipe]);
  const problemas = useMemo(() => {
    const m: Record<string, Problemas> = {};
    for (const f of rasc.fluxos) m[f.id] = problemasDoFluxo(f, listas, indisponiveis);
    return m;
  }, [rasc, listas, indisponiveis]);
  const comErro = rasc.fluxos.filter((f) => problemas[f.id]?.erros.length);

  async function salvar() {
    if (comErro.length) { avisar(`Corrija o fluxo “${nomeFluxo(comErro[0])}” antes de salvar.`, { tipo: "erro" }); return; }
    setSalvando(true);
    try {
      const r = await pb.send<{ versao: string; dados: TAutomacao }>("/api/ti/automacao", {
        method: "POST", body: { dados: rasc, resumo: dif.resumo || "Alterou os fluxos", base: versao },
      });
      setSalvo(r.dados); setRasc(clonar(r.dados)); setVersao(r.versao);
      avisar("Automação salva. Os próximos chamados já seguem estes fluxos.");
      pb.send<{ historico: Versao[] }>("/api/ti/automacao", {}).then((x) => setHistorico(x.historico)).catch(() => {});
    } catch (e) {
      avisar(mensagemErro(e), { tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  }

  const fluxo = rasc.fluxos.find((f) => f.id === sel);
  const idx = rasc.fluxos.findIndex((f) => f.id === sel);
  const no = fluxo?.nos.find((n) => n.id === noSel);

  /* ---------- teste ---------- */
  const [sim, setSim] = useState<Sim>(SIM_INICIAL);
  const [giro, setGiro] = useState<Record<string, number>>({});
  const [res, setRes] = useState<Resultado | null>(null);
  const [acender, setAcender] = useState(true);
  const gatilho = fluxo?.gatilho ?? "novo";
  useEffect(() => {
    if (!pronto) return;
    setSim((s) => ({ ...s, categoria: s.categoria || listas.categorias[0]?.v || "", setor: s.setor || listas.setores[0]?.v || "" }));
  }, [pronto]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!salvo) return;
    const t = window.setTimeout(() => {
      pb.send<Resultado>("/api/ti/automacao/testar", { method: "POST", body: { dados: rasc, gatilho, chamado: sim, giro }, requestKey: "testar-automacao" })
        .then(setRes).catch(() => {});
    }, 250);
    return () => window.clearTimeout(t);
  }, [rasc, sim, giro, gatilho, salvo]);

  /* ---------- fluxos ---------- */
  function selecionar(id: string) { setSel(id); setNoSel(""); }
  function criarFluxo() {
    const f = novoFluxo();
    mudar((d) => { d.fluxos.push(f); });
    selecionar(f.id);
  }
  function duplicarFluxo() {
    if (!fluxo) return;
    const c = clonar(fluxo); c.id = novoId(); c.nome = `${nomeFluxo(fluxo)} (cópia)`;
    mudar((d) => { d.fluxos.splice(idx + 1, 0, c); }, "Fluxo duplicado.");
    selecionar(c.id);
  }
  function apagarFluxo() {
    if (!fluxo) return;
    const vizinho = rasc.fluxos[idx + 1]?.id ?? rasc.fluxos[idx - 1]?.id ?? "";
    mudar((d) => { d.fluxos = d.fluxos.filter((f) => f.id !== fluxo.id); }, `Fluxo “${nomeFluxo(fluxo)}” apagado.`);
    selecionar(vizinho);
  }
  function moverFluxo(dlt: -1 | 1) {
    mudar((d) => { const i = d.fluxos.findIndex((f) => f.id === sel); const j = i + dlt; if (i < 0 || j < 0 || j >= d.fluxos.length) return; [d.fluxos[i], d.fluxos[j]] = [d.fluxos[j], d.fluxos[i]]; });
  }
  function apagarNo(id: string) {
    mudarFluxo((f) => { f.nos = f.nos.filter((n) => n.id !== id); f.ligacoes = f.ligacoes.filter((l) => l.de !== id && l.para !== id); }, "Bloco apagado.");
    setNoSel("");
  }

  if (!salvo || !pronto) {
    return (
      <div aria-busy="true" className="space-y-3">
        <span className="sr-only" role="status">Carregando a automação...</span>
        <BlocoCinza className="h-24 w-full" />
        <BlocoCinza className="h-[30rem] w-full" />
      </div>
    );
  }

  const testeDoFluxo = acender && res && fluxo && res.gatilho === fluxo.gatilho ? res.fluxos[fluxo.id] ?? { status: {}, ativas: [] } : null;
  const prob = fluxo ? problemas[fluxo.id] : undefined;

  return (
    <div className="space-y-4">
      {/* fluxos */}
      <section aria-label="Fluxos" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-[1_1_28rem]">
            <h2 className="font-display text-xl font-extrabold">Fluxos</h2>
            <p className="mt-1 text-tinta-2">
              Cada fluxo é independente: começa num gatilho e segue os blocos ligados. Fluxos com o mesmo gatilho rodam na ordem dos números;
              se dois escolherem pessoas diferentes, vale o primeiro. Na prioridade vale a maior e no prazo, o menor.
            </p>
          </div>
          <button type="button" className="btn-primario" onClick={criarFluxo}><Plus className="size-5" aria-hidden="true" /> Novo fluxo</button>
        </div>
        {rasc.fluxos.length ? (
          <ul className="flex flex-wrap gap-2">
            {rasc.fluxos.map((f, i) => {
              const ativo = f.id === sel;
              const p = problemas[f.id];
              const ruim = (p?.erros.length ?? 0) + Object.keys(p?.porNo ?? {}).length > 0;
              return (
                <li key={f.id}>
                  <button type="button" onClick={() => selecionar(f.id)} aria-current={ativo ? "true" : undefined}
                    className={`flex min-h-14 max-w-80 items-center gap-2.5 rounded-xl px-3 py-2 text-left ring-1 ${ativo ? "bg-mar-50 ring-2 ring-acento" : "bg-superficie ring-linha hover:ring-acento"} ${f.ativo ? "" : "opacity-60"}`}>
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-noite text-sm font-extrabold text-white">{i + 1}</span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-bold">
                        <span className="truncate">{nomeFluxo(f)}</span>
                        {ruim && <TriangleAlert className="size-4 shrink-0 text-alerta" aria-label="Tem algo para corrigir" />}
                      </span>
                      <span className="block truncate text-sm text-tinta-2">{f.ativo ? textoGatilho(f) : "Desligado"}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-xl border-2 border-dashed border-linha bg-superficie px-4 py-3 text-tinta-2">
            Nenhum fluxo ainda: todo chamado novo fica livre na fila, com a prioridade que veio na abertura. Clique em <b>Novo fluxo</b> para começar.
          </p>
        )}
        <label className="flex flex-wrap items-center gap-2.5 font-semibold">
          Chamado novo que nenhum fluxo mandou para alguém
          <select className="campo w-auto font-bold" value={rasc.senao.tipo === "pessoa" ? rasc.senao.pessoa : ""}
            onChange={(e) => { const v = e.target.value; mudar((d) => { d.senao = v ? { tipo: "pessoa", pessoa: v } : { tipo: "livre", pessoa: "" }; }); }}>
            <option value="">fica livre na fila</option>
            {listas.pessoas.map((p) => <option key={p.v} value={p.v}>vai para {p.rot}</option>)}
          </select>
        </label>
      </section>

      {/* editor */}
      {fluxo && prob && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="h-[min(76dvh,52rem)] min-h-[30rem] overflow-hidden rounded-2xl bg-superficie ring-1 ring-linha">
            <CanvasFluxo
              key={fluxo.id}
              fluxo={fluxo} listas={listas} porNo={prob.porNo} teste={testeDoFluxo}
              noSel={noSel} setNoSel={setNoSel} mudar={mudarFluxo}
              resumoTeste={testeDoFluxo && res ? <ResumoTeste>{resumoResultado(res, listas)}</ResumoTeste> : undefined}
            />
          </div>
          <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <Inspetor
              fluxo={fluxo} no={no} listas={listas} respostas={respostas} problemas={prob}
              posicao={{ i: idx, total: rasc.fluxos.length }}
              mudar={mudarFluxo} aoApagarNo={apagarNo} aoApagarFluxo={apagarFluxo} aoDuplicarFluxo={duplicarFluxo} aoMoverFluxo={moverFluxo}
              aoFechar={() => setNoSel("")}
            />
          </div>
        </div>
      )}

      {fluxo && (
        <PainelTeste
          gatilho={gatilho} sim={sim} setSim={(o) => { setSim((s) => ({ ...s, ...o })); setGiro({}); }} listas={listas} res={res}
          acender={acender} setAcender={setAcender} equipe={equipe}
          outroIgual={() => res?.giro_regra && setGiro((g) => ({ ...g, [res.giro_regra]: (g[res.giro_regra] ?? 0) + 1 }))}
          nomeFluxo={(id) => nomeFluxo(rasc.fluxos.find((f) => f.id === id) ?? fluxo)}
        />
      )}

      <Historico historico={historico} />

      {dif.total > 0 && (
        <BarraSalvar salvando={salvando} aoSalvar={salvar} aoDescartar={() => { setRasc(clonar(salvo)); setNoSel(""); if (!salvo.fluxos.some((f) => f.id === sel)) setSel(salvo.fluxos[0]?.id ?? ""); }}
          desabilitado={comErro.length > 0}
          texto={comErro.length
            ? <>Corrija o fluxo “{nomeFluxo(comErro[0])}” para salvar: {problemas[comErro[0].id].erros[0]}</>
            : <>Alterações não salvas: {dif.resumo.toLowerCase()}. <span className="font-normal opacity-90">Os chamados ainda seguem a versão anterior.</span></>} />
      )}
    </div>
  );
}

function ResumoTeste({ children }: { children: ReactNode }) {
  return (
    <p className="max-w-[min(36rem,80vw)] rounded-full bg-noite px-4 py-2 text-sm font-semibold text-white shadow-lg">
      <span className="opacity-80">Teste: </span>{children}
    </p>
  );
}

function Historico({ historico }: { historico: Versao[] }) {
  if (!historico.length) return null;
  return (
    <details className="rounded-2xl bg-superficie p-4 ring-1 ring-linha">
      <summary className="flex min-h-10 cursor-pointer items-center gap-2 font-bold">
        <History className="size-5 text-acento" aria-hidden="true" /> Histórico de alterações
      </summary>
      <ol className="mt-3 divide-y divide-linha">
        {historico.map((v, i) => (
          <li key={v.id} className="py-2.5">
            <p className="font-semibold">{v.resumo || "Alterou os fluxos"}{i === 0 && <span className="ml-2 rounded-full bg-campo-50 px-2 py-0.5 text-xs font-bold text-ok">em vigor</span>}</p>
            <p className="text-sm text-tinta-2">{dataHora(v.quando)}{v.autor ? ` · ${v.autor}` : ""}</p>
          </li>
        ))}
      </ol>
    </details>
  );
}
