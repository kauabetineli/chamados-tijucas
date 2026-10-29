import { ArrowDown, ArrowUp, Copy, GripVertical, History, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { Bloco as BlocoCinza } from "../../components/Esqueleto";
import { avisar } from "../../lib/avisos";
import { textoMinutos } from "../../lib/configTI";
import {
  ACOES_POR_ETAPA, AUTOMACAO_VAZIA, CAMPOS_POR_ETAPA, ROTULO_ACAO, ROTULO_CAMPO, ehBloco, novaAcao, novaCondicao, novoId, opcoesDoCampo,
  textoAcao,
  type Acao, type Automacao as TAutomacao, type Bloco, type Campo, type Etapa, type ItemQuem, type Listas, type Regra, type TipoAcao,
} from "../../lib/automacao";
import { dataHora } from "../../lib/formato";
import { mensagemErro, pb } from "../../lib/pb";
import { AssistenteRegra } from "./AssistenteRegra";
import { BarraSalvar } from "./BarraSalvar";
import { BotaoIcone, CartaoRegra, ChipsCondicoes, MarcaResultado, type Marca } from "./CartaoRegra";
import type { Tecnico } from "./dados";

/* ------------------------------------------------------------------ */
/* Estado: rascunho x versão salva                                     */
/* ------------------------------------------------------------------ */

interface Versao { id: string; quando: string; autor: string; resumo: string }
interface Resultado {
  prioridade: string; prazo_min: number; pessoa: string; pessoa_nome: string; regra: string; giro_regra: string;
  efeitos: { tipo: TipoAcao; valor?: string; regra?: string }[];
  status: Record<string, Marca>;
  traco: { etapa: number; texto: string }[];
}

const clonar = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const PRIO_ROT: Record<string, string> = { baixa: "Baixa", normal: "Normal", alta: "Alta", urgente: "Urgente" };

/** Todas as regras e blocos, com o texto delas, para comparar rascunho e versão salva. */
function itens(a: TAutomacao): Map<string, string> {
  const m = new Map<string, string>();
  const por = (r: Regra | Bloco) => m.set(r.id, JSON.stringify(r));
  a.ajustes.forEach(por); a.tempo.forEach(por);
  a.quem.forEach((x) => { por(ehBloco(x) ? { ...x, regras: [] } : x); if (ehBloco(x)) x.regras.forEach(por); });
  return m;
}

/** "2 regras novas, 1 apagada" */
function diferencas(salvo: TAutomacao, rasc: TAutomacao): { total: number; resumo: string } {
  const a = itens(salvo); const b = itens(rasc);
  let novas = 0; let apagadas = 0; let alteradas = 0;
  for (const [id, t] of b) { if (!a.has(id)) novas++; else if (a.get(id) !== t) alteradas++; }
  for (const id of a.keys()) if (!b.has(id)) apagadas++;
  const ordem = JSON.stringify([salvo.ajustes.map((r) => r.id), salvo.quem.map((r) => r.id), salvo.tempo.map((r) => r.id)])
    !== JSON.stringify([rasc.ajustes.map((r) => r.id), rasc.quem.map((r) => r.id), rasc.tempo.map((r) => r.id)]);
  const senao = JSON.stringify(salvo.senao) !== JSON.stringify(rasc.senao);
  const partes = [
    novas && `${novas} regra${novas > 1 ? "s" : ""} nova${novas > 1 ? "s" : ""}`,
    alteradas && `${alteradas} alterada${alteradas > 1 ? "s" : ""}`,
    apagadas && `${apagadas} apagada${apagadas > 1 ? "s" : ""}`,
    ordem && !novas && !apagadas && "mudou a ordem",
    senao && "mudou o “se ninguém foi escolhido”",
  ].filter(Boolean) as string[];
  const total = novas + alteradas + apagadas + (ordem && !novas && !apagadas ? 1 : 0) + (senao ? 1 : 0);
  const txt = partes.join(", ");
  return { total, resumo: txt ? txt.charAt(0).toUpperCase() + txt.slice(1) : "" };
}

/* ------------------------------------------------------------------ */
/* Arrastar: da paleta (condição, ação, bloco) ou uma regra (ordem)     */
/* ------------------------------------------------------------------ */

type Arraste =
  | { tipo: "cond"; campo: Campo }
  | { tipo: "acao"; acao: TipoAcao }
  | { tipo: "bloco" }
  | { tipo: "regra"; lista: string; idx: number };

/** chave da lista: "ajustes" | "quem" | "tempo" | "bloco:<id>" */
function pegarLista(d: TAutomacao, chave: string): (Regra | ItemQuem)[] {
  if (chave.startsWith("bloco:")) return (d.quem.find((x) => x.id === chave.slice(6)) as Bloco).regras;
  return d[chave as Etapa];
}

const ETAPA_DA_LISTA = (chave: string): Etapa => (chave.startsWith("bloco:") ? "quem" : (chave as Etapa));

/* ------------------------------------------------------------------ */

export function Automacao({ equipe, listas, respostas, pronto }: {
  equipe: Tecnico[] | null; listas: Listas; respostas: string[]; pronto: boolean;
}) {
  const [salvo, setSalvo] = useState<TAutomacao | null>(null);
  const [rasc, setRasc] = useState<TAutomacao>(AUTOMACAO_VAZIA);
  const [versao, setVersao] = useState("");
  const [historico, setHistorico] = useState<Versao[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [assistente, setAssistente] = useState<Etapa | null>(null);
  const [novaId, setNovaId] = useState("");
  const [alvo, setAlvo] = useState("");
  const arraste = useRef<Arraste | null>(null);

  const carregar = useCallback(() => {
    pb.send<{ versao: string; dados: TAutomacao; historico: Versao[] }>("/api/ti/automacao", {})
      .then((r) => { setSalvo(r.dados); setRasc(clonar(r.dados)); setVersao(r.versao); setHistorico(r.historico); })
      .catch((e) => { avisar(mensagemErro(e), { tipo: "erro" }); setSalvo(AUTOMACAO_VAZIA); });
  }, []);
  useEffect(carregar, [carregar]);

  const dif = useMemo(() => (salvo ? diferencas(salvo, rasc) : { total: 0, resumo: "" }), [salvo, rasc]);

  // sair da página com alterações pendentes: o navegador pergunta
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

  async function salvar() {
    setSalvando(true);
    try {
      const r = await pb.send<{ versao: string; dados: TAutomacao }>("/api/ti/automacao", {
        method: "POST", body: { dados: rasc, resumo: dif.resumo || "Alterou as regras", base: versao },
      });
      setSalvo(r.dados); setRasc(clonar(r.dados)); setVersao(r.versao);
      avisar("Automação salva. Os próximos chamados já seguem estas regras.");
      pb.send<{ historico: Versao[] }>("/api/ti/automacao", {}).then((x) => setHistorico(x.historico)).catch(() => {});
    } catch (e) {
      avisar(mensagemErro(e), { tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  }

  /* ---------- teste ---------- */
  const [testar, setTestar] = useState(true);
  const [sim, setSim] = useState({ categoria: "", setor: "", impacto: "so_eu", prioridade: "", origem: "sistema", texto: "", anexo: "nao", horario: "expediente" });
  const [giro, setGiro] = useState<Record<string, number>>({});
  const [res, setRes] = useState<Resultado | null>(null);
  useEffect(() => {
    if (!pronto) return;
    setSim((s) => ({ ...s, categoria: s.categoria || listas.categorias[0]?.v || "", setor: s.setor || listas.setores[0]?.v || "" }));
  }, [pronto]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!salvo) return;
    const t = window.setTimeout(() => {
      pb.send<Resultado>("/api/ti/automacao/testar", { method: "POST", body: { dados: rasc, chamado: sim, giro }, requestKey: "testar-automacao" })
        .then(setRes).catch(() => {});
    }, 250);
    return () => window.clearTimeout(t);
  }, [rasc, sim, giro, salvo]);
  const marca = (id: string): Marca => (testar && res ? res.status[id] ?? "pulada" : undefined);

  const indisponiveis = useMemo(() => new Set((equipe ?? []).filter((t) => !t.disponivel).map((t) => t.id)), [equipe]);

  /* ---------- operações em listas ---------- */
  const mudarRegra = (chave: string, id: string, r: Regra | Bloco) =>
    mudar((d) => { const l = pegarLista(d, chave); const i = l.findIndex((x) => x.id === id); if (i >= 0) l[i] = r; });
  const apagar = (chave: string, id: string) =>
    mudar((d) => { const l = pegarLista(d, chave); const i = l.findIndex((x) => x.id === id); if (i >= 0) l.splice(i, 1); }, "Regra apagada.");
  const duplicar = (chave: string, id: string) =>
    mudar((d) => {
      const l = pegarLista(d, chave); const i = l.findIndex((x) => x.id === id); if (i < 0) return;
      const c = clonar(l[i]); c.id = novoId(); c.nome = c.nome ? `${c.nome} (cópia)` : "";
      if (ehBloco(c as ItemQuem)) (c as Bloco).regras.forEach((r) => { r.id = novoId(); });
      l.splice(i + 1, 0, c);
    }, "Regra duplicada.");
  const mover = (chave: string, idx: number, para: number) =>
    mudar((d) => { const l = pegarLista(d, chave); if (para < 0 || para >= l.length) return; const [x] = l.splice(idx, 1); l.splice(para, 0, x); });

  function criarPeloAssistente(etapa: Etapa, regra: Regra) {
    mudar((d) => { (d[etapa] as (Regra | ItemQuem)[]).push(regra); },
      `Regra criada na etapa ${{ ajustes: "1 (Prioridade, prazo e avisos)", quem: "2 (Quem atende)", tempo: "4 (Com o passar do tempo)" }[etapa]}.`);
    setAssistente(null);
    setNovaId(regra.id);
    window.setTimeout(() => document.getElementById(`regra-${regra.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  }

  /* ---------- arrastar e soltar ---------- */
  const comecar = (a: Arraste) => (e: DragEvent) => {
    arraste.current = a;
    try { e.dataTransfer.setData("text/plain", "dino"); e.dataTransfer.effectAllowed = "copyMove"; } catch { /* navegador antigo */ }
  };
  const terminar = () => { arraste.current = null; setAlvo(""); };

  /** soltar em cima de uma regra: condição/ação entram nela; outra regra da mesma lista muda de lugar */
  function soltarNaRegra(chave: string, idx: number) {
    return {
      onDragOver: (e: DragEvent) => {
        const a = arraste.current; if (!a) return;
        const etapa = ETAPA_DA_LISTA(chave);
        const aceita = (a.tipo === "cond" && CAMPOS_POR_ETAPA[etapa].includes(a.campo))
          || (a.tipo === "acao" && ACOES_POR_ETAPA[etapa].includes(a.acao))
          || (a.tipo === "regra" && a.lista === chave);
        if (!aceita) return;
        e.preventDefault(); e.stopPropagation();
        const k = `${chave}#${idx}`; if (alvo !== k) setAlvo(k);
      },
      onDragLeave: () => setAlvo(""),
      onDrop: (e: DragEvent) => {
        e.preventDefault(); e.stopPropagation();
        const a = arraste.current; terminar(); if (!a) return;
        if (a.tipo === "regra") return mover(chave, a.idx, idx);
        mudar((d) => {
          const r = pegarLista(d, chave)[idx] as Regra;
          if (a.tipo === "cond") r.conds.push(novaCondicao(a.campo, listas));
          if (a.tipo === "acao") r.acoes.push(novaAcao(a.acao, listas, respostas));
        });
      },
    };
  }

  /** soltar no título de uma etapa: condição/ação viram uma regra nova; bloco entra na etapa 2 */
  function soltarNaEtapa(etapa: Etapa) {
    return {
      onDragOver: (e: DragEvent) => {
        const a = arraste.current; if (!a) return;
        const aceita = (a.tipo === "cond" && CAMPOS_POR_ETAPA[etapa].includes(a.campo))
          || (a.tipo === "acao" && ACOES_POR_ETAPA[etapa].includes(a.acao))
          || (a.tipo === "bloco" && etapa === "quem");
        if (!aceita) return;
        e.preventDefault();
        if (alvo !== `et-${etapa}`) setAlvo(`et-${etapa}`);
      },
      onDragLeave: () => setAlvo(""),
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        const a = arraste.current; terminar(); if (!a || a.tipo === "regra") return;
        const id = novoId();
        mudar((d) => {
          if (a.tipo === "bloco") {
            d.quem.push({ tipo: "bloco", id, nome: "", ativa: true, conds: [], senao: { tipo: "continua" }, regras: [] });
            return;
          }
          const r: Regra = {
            id, nome: "", ativa: true,
            conds: a.tipo === "cond" ? [novaCondicao(a.campo, listas)] : [],
            acoes: a.tipo === "acao" ? [novaAcao(a.acao, listas, respostas)] : [],
            ...(etapa === "tempo" ? { gatilho: "sem_inicio" as const, minutos: 60 } : etapa === "quem" ? { tipo: "regra" as const } : {}),
          };
          (d[etapa] as (Regra | ItemQuem)[]).push(r);
        });
        setNovaId(id);
      },
    };
  }

  if (!salvo || !pronto) {
    return (
      <div aria-busy="true" className="space-y-3">
        <span className="sr-only" role="status">Carregando a automação...</span>
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-3 rounded-2xl bg-superficie p-4 ring-1 ring-linha">
            <BlocoCinza className="h-6 w-64" /><BlocoCinza className="h-4 w-4/5" /><BlocoCinza className="h-20 w-full" />
          </div>
        ))}
      </div>
    );
  }

  const cartao = (chave: string, r: Regra, idx: number, total: number, dentro = false) => (
    <div id={`regra-${r.id}`} key={r.id}>
      <CartaoRegra
        regra={r} etapa={ETAPA_DA_LISTA(chave)} listas={listas} respostas={respostas} indisponiveis={indisponiveis}
        marca={marca(r.id)} dentro={dentro} destacada={novaId === r.id} alvo={alvo === `${chave}#${idx}`}
        ordenavel={total > 1 && chave !== "ajustes"} primeira={idx === 0} ultima={idx === total - 1}
        aoMudar={(n) => mudarRegra(chave, r.id, n)} aoApagar={() => apagar(chave, r.id)} aoDuplicar={() => duplicar(chave, r.id)}
        aoMover={(dlt) => mover(chave, idx, idx + dlt)}
        arrastar={chave !== "ajustes" ? { onDragStart: comecar({ tipo: "regra", lista: chave, idx }), onDragEnd: terminar } : undefined}
        soltar={soltarNaRegra(chave, idx)}
      />
    </div>
  );

  const opcoesPessoa = listas.pessoas;

  return (
    <div className="space-y-4">
      <datalist id="respostas-prontas">{respostas.map((t) => <option key={t} value={t} />)}</datalist>


      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        {/* paleta (só com mouse: no celular cada regra tem "+ Se" e "+ Então") */}
        <aside className="hidden w-56 shrink-0 space-y-4 rounded-2xl bg-superficie p-4 ring-1 ring-linha xl:sticky xl:top-4 xl:block xl:max-h-[calc(100dvh-2rem)] xl:overflow-y-auto">
          <div>
            <h2 className="font-display text-lg font-extrabold">Blocos</h2>
            <p className="mt-1 text-sm text-tinta-2">Arraste para dentro de uma regra ou para o título de uma etapa.</p>
          </div>
          <Paleta titulo="Se (condição)" cor="text-acento">
            {(Object.keys(ROTULO_CAMPO) as Campo[]).filter((k) => CAMPOS_POR_ETAPA.ajustes.includes(k)).map((k) => (
              <ItemPaleta key={k} estilo="bg-mar-50 ring-acento/40" aoComecar={comecar({ tipo: "cond", campo: k })} aoTerminar={terminar}>{ROTULO_CAMPO[k]}</ItemPaleta>
            ))}
          </Paleta>
          <Paleta titulo="Então (ação)" cor="text-ok">
            {(Object.keys(ROTULO_ACAO) as TipoAcao[]).map((k) => (
              <ItemPaleta key={k} estilo="bg-campo-50 ring-ok/40" aoComecar={comecar({ tipo: "acao", acao: k })} aoTerminar={terminar}
                dica={`Vale na${(["ajustes", "quem", "tempo"] as Etapa[]).filter((e) => ACOES_POR_ETAPA[e].includes(k)).length > 1 ? "s" : ""} etapa${(["ajustes", "quem", "tempo"] as Etapa[]).filter((e) => ACOES_POR_ETAPA[e].includes(k)).length > 1 ? "s" : ""} ${(["ajustes", "quem", "tempo"] as Etapa[]).filter((e) => ACOES_POR_ETAPA[e].includes(k)).map((e) => ({ ajustes: 1, quem: 2, tempo: 4 }[e])).join(" e ")}`}>
                {ROTULO_ACAO[k]}
              </ItemPaleta>
            ))}
          </Paleta>
          <Paleta titulo="Organizar" cor="text-ambar-tinta">
            <ItemPaleta estilo="bg-sol-50 ring-ambar" aoComecar={comecar({ tipo: "bloco" })} aoTerminar={terminar}>Bloco de regras</ItemPaleta>
          </Paleta>
        </aside>

        {/* etapas */}
        <section className="min-w-0 flex-1 space-y-2" aria-label="Etapas da automação">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-extrabold">O caminho de um chamado</h2>
              <p className="mt-1 max-w-2xl text-tinta-2">Todo chamado novo passa pelas etapas 1, 2 e 3, nessa ordem. A etapa 4 fica de olho nos chamados abertos e age com o passar do tempo.</p>
            </div>
            <button type="button" className="btn-primario" onClick={() => setAssistente("quem")}>
              <Plus className="size-5" aria-hidden="true" /> Nova regra
            </button>
          </div>

          <TituloEtapa num={1} titulo="Prioridade, prazo e avisos" alvo={alvo === "et-ajustes"} soltar={soltarNaEtapa("ajustes")}
            ajuda="Todas as regras que combinarem são aplicadas. Se duas mudarem a prioridade, vale a maior; se duas mudarem o prazo, vale o menor." />
          {rasc.ajustes.map((r, i) => cartao("ajustes", r, i, rasc.ajustes.length))}
          {!rasc.ajustes.length && <Vazio>Nenhuma regra: o chamado fica com a prioridade que veio da abertura.</Vazio>}
          <BotaoNova aoClicar={() => setAssistente("ajustes")}>Nova regra de prioridade, prazo ou aviso</BotaoNova>
          <Seta />

          <TituloEtapa num={2} titulo="Quem atende" alvo={alvo === "et-quem"} soltar={soltarNaEtapa("quem")}
            ajuda="De cima para baixo, vale a primeira regra que escolher uma pessoa disponível. Use blocos para agrupar regras de um mesmo assunto."
            extra={
              <button type="button" className="min-h-11 rounded-xl border-2 border-dashed border-ambar bg-sol-50 px-3.5 font-bold text-ambar-tinta"
                onClick={() => { const id = novoId(); mudar((d) => { d.quem.push({ tipo: "bloco", id, nome: "", ativa: true, conds: [], senao: { tipo: "continua" }, regras: [] }); }); setNovaId(id); }}>
                + Bloco de regras
              </button>
            } />
          {rasc.quem.map((it, i) => ehBloco(it) ? (
            <CartaoBloco key={it.id} b={it} idx={i} total={rasc.quem.length} listas={listas} marca={marca(it.id)} marcaFim={testar && res ? res.status[`fim:${it.id}`] : undefined}
              destacado={novaId === it.id} opcoesPessoa={opcoesPessoa}
              aoMudar={(b) => mudarRegra("quem", it.id, b)} aoApagar={() => apagar("quem", it.id)} aoDuplicar={() => duplicar("quem", it.id)}
              aoMover={(dlt) => mover("quem", i, i + dlt)}
              aoNovaDentro={() => { const id = novoId(); mudar((d) => { (d.quem[i] as Bloco).regras.push({ id, nome: "", ativa: true, tipo: "regra", conds: [], acoes: [novaAcao("atribuir", listas, respostas)] }); }); setNovaId(id); }}
              soltar={soltarNaRegra("quem", i)} arrastar={{ onDragStart: comecar({ tipo: "regra", lista: "quem", idx: i }), onDragEnd: terminar }} alvo={alvo === `quem#${i}`}
            >
              {it.regras.map((r, j) => cartao(`bloco:${it.id}`, r, j, it.regras.length, true))}
            </CartaoBloco>
          ) : cartao("quem", it, i, rasc.quem.length))}
          {!rasc.quem.length && <Vazio>Nenhuma regra: todo chamado vai para o passo 3.</Vazio>}
          <BotaoNova aoClicar={() => setAssistente("quem")}>Nova regra de quem atende</BotaoNova>
          <Seta />

          <TituloEtapa num={3} titulo="Se ninguém foi escolhido" ajuda="Quando nenhuma regra da etapa 2 escolheu uma pessoa." />
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-superficie p-4 ring-1 ring-linha">
            <MarcaResultado marca={testar && res ? res.status.senao ?? "pulada" : undefined} />
            <label className="flex flex-wrap items-center gap-2.5 font-bold">
              O chamado
              <select className="campo w-auto font-bold" value={rasc.senao.tipo === "pessoa" ? rasc.senao.pessoa ?? "" : ""}
                onChange={(e) => { const v = e.target.value; mudar((d) => { d.senao = v ? { tipo: "pessoa", pessoa: v } : { tipo: "livre" }; }); }}>
                <option value="">fica livre na fila</option>
                {opcoesPessoa.map((p) => <option key={p.v} value={p.v}>vai para {p.rot}</option>)}
              </select>
            </label>
            <span className="text-sm text-tinta-2">Vale também quando a pessoa escolhida está ausente.</span>
          </div>
          <Seta />

          <TituloEtapa num={4} titulo="Com o passar do tempo" alvo={alvo === "et-tempo"} soltar={soltarNaEtapa("tempo")}
            ajuda="O sistema confere os chamados abertos a cada 5 minutos. Cada regra age uma vez em cada chamado." />
          {rasc.tempo.map((r, i) => cartao("tempo", r, i, rasc.tempo.length))}
          {!rasc.tempo.length && <Vazio>Nenhuma regra de tempo.</Vazio>}
          <BotaoNova aoClicar={() => setAssistente("tempo")}>Nova regra de tempo</BotaoNova>

          <Historico historico={historico} />
        </section>

        {/* testar */}
        <PainelTeste
          sim={sim} setSim={(o) => { setSim((s) => ({ ...s, ...o })); setGiro({}); }} listas={listas} res={res}
          testar={testar} setTestar={setTestar} equipe={equipe}
          outroIgual={() => res?.giro_regra && setGiro((g) => ({ ...g, [res.giro_regra]: (g[res.giro_regra] ?? 0) + 1 }))}
        />
      </div>

      {dif.total > 0 && (
        <BarraSalvar salvando={salvando} aoSalvar={salvar} aoDescartar={() => setRasc(clonar(salvo))}
          texto={<>Alterações não salvas: {dif.resumo.toLowerCase()}. <span className="font-normal opacity-90">Os chamados novos ainda seguem a versão anterior.</span></>} />
      )}
      {assistente && (
        <AssistenteRegra listas={listas} respostas={respostas} inicio={assistente}
          aoCriar={criarPeloAssistente} aoFechar={() => setAssistente(null)} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Peças                                                                */
/* ------------------------------------------------------------------ */

function Paleta({ titulo, cor, children }: { titulo: string; cor: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className={`text-xs font-extrabold tracking-wider uppercase ${cor}`}>{titulo}</p>
      {children}
    </div>
  );
}

function ItemPaleta({ estilo, aoComecar, aoTerminar, dica, children }: {
  estilo: string; aoComecar: (e: DragEvent) => void; aoTerminar: () => void; dica?: string; children: ReactNode;
}) {
  return (
    <div draggable onDragStart={aoComecar} onDragEnd={aoTerminar} title={dica}
      className={`flex min-h-10 cursor-grab items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-bold ring-1 ${estilo}`}>
      <GripVertical className="size-4 shrink-0 text-tinta-2" aria-hidden="true" />{children}
    </div>
  );
}

function TituloEtapa({ num, titulo, ajuda, extra, alvo, soltar }: {
  num: number; titulo: string; ajuda: string; extra?: ReactNode; alvo?: boolean;
  soltar?: { onDragOver: (e: DragEvent) => void; onDrop: (e: DragEvent) => void; onDragLeave: () => void };
}) {
  return (
    <div {...soltar} className={`flex flex-wrap items-center gap-3 rounded-2xl p-4 ring-1 ${num > 1 ? "mt-3" : ""} ${alvo ? "bg-mar-50 ring-2 ring-acento" : "bg-superficie ring-linha"}`}>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-noite font-display font-extrabold text-white">{num}</span>
      <div className="min-w-0 flex-[1_1_260px]">
        <h3 className="text-lg font-extrabold">{titulo}</h3>
        <p className="text-sm text-tinta-2">{ajuda}</p>
      </div>
      {extra}
    </div>
  );
}

function Vazio({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border-2 border-dashed border-linha bg-superficie px-4 py-3 text-sm text-tinta-2">{children}</p>;
}

function BotaoNova({ aoClicar, children }: { aoClicar: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={aoClicar}
      className="flex min-h-12 w-full items-center gap-2 rounded-xl border-2 border-dashed border-acento/60 bg-superficie px-4 text-left font-bold text-acento hover:bg-mar-50">
      <Plus className="size-5" aria-hidden="true" /> {children}
    </button>
  );
}

function Seta() {
  return <p aria-hidden="true" className="py-0.5 pl-5 text-lg leading-none text-tinta-2/60">↓</p>;
}

function CartaoBloco({ b, idx, total, listas, marca, marcaFim, destacado, opcoesPessoa, aoMudar, aoApagar, aoDuplicar, aoMover, aoNovaDentro, soltar, arrastar, alvo, children }: {
  b: Bloco; idx: number; total: number; listas: Listas; marca: Marca; marcaFim: Marca; destacado: boolean;
  opcoesPessoa: { v: string; rot: string }[];
  aoMudar: (b: Bloco) => void; aoApagar: () => void; aoDuplicar: () => void; aoMover: (d: -1 | 1) => void; aoNovaDentro: () => void;
  soltar: { onDragOver: (e: DragEvent) => void; onDrop: (e: DragEvent) => void; onDragLeave: () => void };
  arrastar: { onDragStart: (e: DragEvent) => void; onDragEnd: () => void };
  alvo: boolean; children: ReactNode;
}) {
  const senao = b.senao.tipo === "pessoa" ? `p:${b.senao.pessoa ?? ""}` : b.senao.tipo;
  return (
    <section id={`regra-${b.id}`} aria-label={`Bloco ${b.nome || "sem nome"}`}
      className={`rounded-2xl border-2 ${destacado ? "border-acento" : "border-ambar"} ${b.ativa ? "" : "opacity-60"}`}>
      <div {...soltar} className={`flex items-start gap-2 rounded-t-xl p-3 pl-2 ${alvo ? "bg-mar-50" : "bg-sol-50"}`}>
        <span draggable onDragStart={arrastar.onDragStart} onDragEnd={arrastar.onDragEnd} title="Arraste para mudar a ordem"
          className="hidden h-9 w-6 shrink-0 cursor-grab place-items-center text-tinta-2 md:grid">
          <GripVertical className="size-5" aria-hidden="true" />
        </span>
        <MarcaResultado marca={marca} />
        <div className="min-w-0 flex-1 space-y-2">
          <label className="flex items-center gap-2">
            <span className="shrink-0 text-xs font-extrabold tracking-wider text-ambar-tinta uppercase">Bloco</span>
            <span className="sr-only">Nome do bloco</span>
            <input value={b.nome} placeholder="Dê um nome (ex.: Saúde e Educação)" onChange={(e) => aoMudar({ ...b, nome: e.target.value })}
              className="min-w-0 flex-1 border-b border-dashed border-ambar bg-transparent py-1 font-bold placeholder:font-semibold placeholder:text-tinta-2" />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-12 shrink-0 text-xs font-extrabold tracking-wider text-acento uppercase">Se</span>
            <ChipsCondicoes conds={b.conds} etapa="quem" listas={listas} aoMudar={(conds) => aoMudar({ ...b, conds })} />
          </div>
          <p className="text-sm text-tinta-2">As regras abaixo só são verificadas para chamados deste bloco, de cima para baixo.</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <label className="flex min-h-9 cursor-pointer items-center gap-1.5 text-sm font-semibold text-tinta-2">
            <input type="checkbox" role="switch" checked={b.ativa} onChange={() => aoMudar({ ...b, ativa: !b.ativa })} className="size-5 accent-acento" />
            Ligado
          </label>
          <div className="flex gap-1">
            {total > 1 && (
              <>
                <BotaoIcone rotulo="Mover o bloco para cima" desabilitado={idx === 0} aoClicar={() => aoMover(-1)}><ArrowUp className="size-4" /></BotaoIcone>
                <BotaoIcone rotulo="Mover o bloco para baixo" desabilitado={idx === total - 1} aoClicar={() => aoMover(1)}><ArrowDown className="size-4" /></BotaoIcone>
              </>
            )}
            <BotaoIcone rotulo="Duplicar o bloco" aoClicar={aoDuplicar}><Copy className="size-4" /></BotaoIcone>
            <BotaoIcone rotulo="Apagar o bloco" aoClicar={aoApagar}><Trash2 className="size-4" /></BotaoIcone>
          </div>
        </div>
      </div>
      <div className="space-y-2 p-2 sm:pl-6">
        {children}
        {!b.regras.length && <Vazio>Nenhuma regra dentro do bloco ainda.</Vazio>}
        <button type="button" onClick={aoNovaDentro}
          className="min-h-11 rounded-xl border-2 border-dashed border-ambar px-3.5 font-bold text-ambar-tinta hover:bg-sol-50">
          + Regra dentro do bloco
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2.5 rounded-b-xl border-t-2 border-ambar bg-sol-50 px-3.5 py-2.5">
        <MarcaResultado marca={marcaFim} />
        <span className="text-xs font-extrabold tracking-wider text-ambar-tinta uppercase">Se nenhuma regra do bloco servir</span>
        <label>
          <span className="sr-only">O que fazer se nenhuma regra do bloco servir</span>
          <select className="min-h-10 rounded-lg bg-superficie px-2 font-bold ring-1 ring-ambar" value={senao}
            onChange={(e) => {
              const v = e.target.value;
              aoMudar({ ...b, senao: v.startsWith("p:") ? { tipo: "pessoa", pessoa: v.slice(2) } : { tipo: v as "continua" | "livre" } });
            }}>
            <option value="continua">continua para as regras de baixo</option>
            <option value="livre">fica livre na fila</option>
            {opcoesPessoa.map((p) => <option key={p.v} value={`p:${p.v}`}>vai para {p.rot}</option>)}
          </select>
        </label>
      </div>
    </section>
  );
}

function Historico({ historico }: { historico: Versao[] }) {
  if (!historico.length) return null;
  return (
    <details className="mt-6 rounded-2xl bg-superficie p-4 ring-1 ring-linha">
      <summary className="flex min-h-10 cursor-pointer items-center gap-2 font-bold">
        <History className="size-5 text-acento" aria-hidden="true" /> Histórico de alterações
      </summary>
      <ol className="mt-3 divide-y divide-linha">
        {historico.map((v, i) => (
          <li key={v.id} className="py-2.5">
            <p className="font-semibold">{v.resumo || "Alterou as regras"}{i === 0 && <span className="ml-2 rounded-full bg-campo-50 px-2 py-0.5 text-xs font-bold text-ok">em vigor</span>}</p>
            <p className="text-sm text-tinta-2">{dataHora(v.quando)}{v.autor ? ` · ${v.autor}` : ""}</p>
          </li>
        ))}
      </ol>
    </details>
  );
}

type Sim = { categoria: string; setor: string; impacto: string; prioridade: string; origem: string; texto: string; anexo: string; horario: string };

function PainelTeste({ sim, setSim, listas, res, testar, setTestar, equipe, outroIgual }: {
  sim: Sim; setSim: (o: Partial<Sim>) => void; listas: Listas; res: Resultado | null;
  testar: boolean; setTestar: (v: boolean) => void; equipe: Tecnico[] | null; outroIgual: () => void;
}) {
  const campos: { k: keyof Sim; rot: string; opcoes: { v: string; rot: string }[] }[] = [
    { k: "categoria", rot: "Categoria", opcoes: listas.categorias },
    { k: "setor", rot: "Setor", opcoes: listas.setores },
    { k: "impacto", rot: "Quem é afetado", opcoes: opcoesDoCampo("impacto", listas) },
    { k: "prioridade", rot: "Prioridade pedida", opcoes: [{ v: "", rot: "A do impacto" }, ...opcoesDoCampo("prioridade", listas)] },
    { k: "origem", rot: "Por onde chegou", opcoes: opcoesDoCampo("origem", listas) },
    { k: "anexo", rot: "Foto ou vídeo", opcoes: opcoesDoCampo("anexo", listas) },
    { k: "horario", rot: "Quando chegou", opcoes: opcoesDoCampo("horario", listas) },
  ];
  const extras = (res?.efeitos ?? []).map((e) => textoAcao({ tipo: e.tipo, valor: e.valor } as Acao, listas));
  return (
    <aside aria-label="Testar as regras" className="space-y-3 rounded-2xl bg-superficie p-4 ring-1 ring-linha xl:sticky xl:top-4 xl:w-80 xl:shrink-0">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-extrabold">Testar</h2>
        <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-semibold">
          <input type="checkbox" role="switch" checked={testar} onChange={() => setTestar(!testar)} className="size-5 accent-acento" />
          Mostrar nas regras
        </label>
      </div>
      <p className="text-sm text-tinta-2">
        Monte um chamado de exemplo. Nas regras aparece <b className="text-ok">✓ aplicada</b>, <b>– não combinou</b> ou <b>· não chegou a ser verificada</b>. Nada é salvo.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {campos.map((c) => (
          <label key={c.k} className="flex flex-col gap-0.5 text-sm font-bold">
            {c.rot}
            <select className="campo min-h-11 px-2 text-sm font-semibold" value={sim[c.k]} onChange={(e) => setSim({ [c.k]: e.target.value })}>
              {c.opcoes.map((o) => <option key={o.v} value={o.v}>{o.rot}</option>)}
            </select>
          </label>
        ))}
      </div>
      <label className="flex flex-col gap-0.5 text-sm font-bold">
        Descrição
        <input className="campo min-h-11 text-sm font-normal" value={sim.texto} onChange={(e) => setSim({ texto: e.target.value })} placeholder="Ex.: impressora sem toner" />
      </label>
      <div className="rounded-xl bg-noite p-4 text-white" aria-live="polite">
        <p className="text-xs font-bold tracking-wider uppercase opacity-85">Resultado</p>
        {res ? (
          <>
            <p className="mt-1 font-display text-2xl font-extrabold">{res.pessoa_nome || "Fica livre na fila"}</p>
            {res.regra && <p className="text-sm opacity-90">pela regra “{res.regra}”</p>}
            <p className="mt-1 text-sm">Prioridade <b className="text-sol">{PRIO_ROT[res.prioridade] ?? res.prioridade}</b> · prazo <b className="text-sol">{textoMinutos(res.prazo_min)}</b></p>
            {extras.map((x, i) => <p key={i} className="mt-1 text-sm opacity-90">+ {x}</p>)}
          </>
        ) : <BlocoCinza className="mt-2 h-8 w-40 opacity-40" />}
      </div>
      {res?.giro_regra && (
        <button type="button" className="btn-secundario w-full" onClick={outroIgual}>Abrir outro igual (ver a divisão)</button>
      )}
      {res && res.traco.length > 0 && (
        <details className="text-sm">
          <summary className="min-h-10 cursor-pointer py-2 font-bold text-acento">Passo a passo</summary>
          <ol className="list-decimal space-y-1 pl-5 text-tinta-2">{res.traco.map((t, i) => <li key={i}>{t.texto}</li>)}</ol>
        </details>
      )}
      <div className="space-y-1.5 border-t border-linha pt-3">
        <p className="text-xs font-bold tracking-wider text-tinta-2 uppercase">Equipe hoje</p>
        {(equipe ?? []).filter((t) => !t.bloqueado).map((t) => (
          <p key={t.id} className="flex items-center gap-2 text-sm">
            <span className={`size-2.5 shrink-0 rounded-full ${t.disponivel ? "bg-campo" : t.ausente_hoje ? "bg-brasa" : "bg-ambar"}`} aria-hidden="true" />
            <b>{t.nome}</b>
            <span className="text-tinta-2">{t.ausente_hoje ? "ausente" : t.sem_automatico ? "não recebe automáticos" : `${t.carga} chamado${t.carga === 1 ? "" : "s"}`}</span>
          </p>
        ))}
      </div>
    </aside>
  );
}
