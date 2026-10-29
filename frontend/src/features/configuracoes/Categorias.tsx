import { ArrowDown, ArrowUp, GripVertical, Lock, Plus, Search, Trash2, TriangleAlert, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { EsqueletoLinhas } from "../../components/Esqueleto";
import { BarraSalvar } from "./BarraSalvar";
import { ICONES, IconeCategoria } from "../../components/Icone";
import { avisar } from "../../lib/avisos";
import { ehBloco, type Automacao, type Regra } from "../../lib/automacao";
import { limparCache } from "../../lib/cache";
import { mensagemErro, pb, type Categoria } from "../../lib/pb";

/** Rascunho de uma categoria ("novo:..." = ainda não existe no banco). */
interface Rasc { id: string; nome: string; icone: string; ativa: boolean; protegida: boolean; sugestoes: string[]; dicas: string[] }

const MAX_SUG = 6;
const MAX_DICAS = 8;
const doBanco = (c: Categoria): Rasc => ({
  id: c.id, nome: c.nome, icone: c.icone || "circle-help", ativa: c.ativa, protegida: !!c.protegida,
  sugestoes: [...(c.sugestoes ?? [])], dicas: [...(c.dicas ?? [])],
});
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Em quantas regras da automação a categoria aparece. */
function usoNasRegras(a: Automacao | null): Record<string, number> {
  const n: Record<string, number> = {};
  if (!a) return n;
  const ver = (r: { conds: Regra["conds"] }) => {
    const ids = new Set(r.conds.filter((c) => c.campo === "categoria").flatMap((c) => c.valores));
    ids.forEach((id) => { n[id] = (n[id] ?? 0) + 1; });
  };
  a.ajustes.forEach(ver); a.tempo.forEach(ver);
  a.quem.forEach((x) => { ver(x); if (ehBloco(x)) x.regras.forEach(ver); });
  return n;
}

export function Categorias() {
  const [salvas, setSalvas] = useState<Rasc[] | null>(null);
  const [lista, setLista] = useState<Rasc[]>([]);
  const [sel, setSel] = useState("");
  const [auto, setAuto] = useState<Automacao | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [tentou, setTentou] = useState(false);
  const arrastando = useRef<number | null>(null);

  function carregar() {
    pb.collection("categorias").getFullList<Categoria>({ sort: "ordem,nome" })
      .then((cs) => { const r = cs.map(doBanco); setSalvas(r); setLista(r); setSel((s) => s && r.some((x) => x.id === s) ? s : r[0]?.id ?? ""); })
      .catch((e) => { avisar(mensagemErro(e), { tipo: "erro" }); setSalvas([]); });
  }
  useEffect(() => {
    carregar();
    pb.send<{ dados: Automacao }>("/api/ti/automacao", {}).then((r) => setAuto(r.dados)).catch(() => {});
  }, []);

  const uso = useMemo(() => usoNasRegras(auto), [auto]);
  const mudancas = useMemo(() => {
    if (!salvas) return 0;
    let n = 0;
    lista.forEach((c, i) => {
      const s = salvas.find((x) => x.id === c.id);
      if (!s || JSON.stringify(s) !== JSON.stringify(c) || salvas.indexOf(s) !== i) n++;
    });
    return n;
  }, [salvas, lista]);

  useEffect(() => {
    if (!mudancas) return;
    const f = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [mudancas]);

  const erros = useMemo(() => {
    const e: Record<string, string> = {};
    const vistos = new Map<string, string>();
    for (const c of lista) {
      const k = semAcento(c.nome.trim());
      if (!k) e[c.id] = "Dê um nome para a categoria.";
      else if (vistos.has(k)) e[c.id] = "Já existe uma categoria com esse nome.";
      vistos.set(k, c.id);
    }
    return e;
  }, [lista]);

  const atual = lista.find((c) => c.id === sel);
  const mudarAtual = (f: (c: Rasc) => Rasc) => setLista((l) => l.map((c) => (c.id === sel ? f({ ...c, sugestoes: [...c.sugestoes], dicas: [...c.dicas] }) : c)));
  const mover = (de: number, para: number) => setLista((l) => {
    if (para < 0 || para >= l.length) return l;
    const n = [...l]; const [x] = n.splice(de, 1); n.splice(para, 0, x); return n;
  });

  function nova() {
    const id = `novo:${Math.random().toString(36).slice(2, 8)}`;
    // entra antes de "Outro" (que fica por último)
    setLista((l) => {
      const iOutro = l.findIndex((c) => c.protegida);
      const n = [...l];
      n.splice(iOutro >= 0 ? iOutro : n.length, 0, { id, nome: "", icone: "circle-help", ativa: true, protegida: false, sugestoes: [], dicas: [] });
      return n;
    });
    setSel(id);
  }

  async function salvar() {
    if (Object.keys(erros).length) { setTentou(true); setSel(Object.keys(erros)[0]); return; }
    setSalvando(true);
    try {
      for (let i = 0; i < lista.length; i++) {
        const c = lista[i];
        const corpo = { nome: c.nome.trim(), icone: c.icone, ativa: c.protegida || c.ativa, ordem: (i + 1) * 10, sugestoes: c.sugestoes, dicas: c.dicas };
        const s = salvas?.find((x) => x.id === c.id);
        if (c.id.startsWith("novo:")) await pb.collection("categorias").create(corpo);
        else if (!s || JSON.stringify(s) !== JSON.stringify(c) || salvas!.indexOf(s) !== i) await pb.collection("categorias").update(c.id, corpo);
      }
      limparCache("categorias");
      avisar("Categorias salvas. Quem abrir um chamado já vê assim.");
      setTentou(false);
      carregar();
    } catch (e) {
      avisar(mensagemErro(e), { tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  }

  if (!salvas) return <EsqueletoLinhas quantos={6} />;

  return (
    <div className="space-y-4">

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* lista */}
        <section className="space-y-3 lg:w-80 lg:shrink-0" aria-labelledby="titulo-lista-cat">
          <div>
            <h2 id="titulo-lista-cat" className="font-display text-xl font-extrabold">Categorias</h2>
            <p className="mt-1 text-sm text-tinta-2">A ordem aqui é a ordem em que aparecem para quem abre o chamado.</p>
          </div>
          <ul className="space-y-1.5">
            {lista.map((c, i) => (
              <li key={c.id} draggable
                onDragStart={() => { arrastando.current = i; }}
                onDragOver={(e) => { if (arrastando.current !== null) e.preventDefault(); }}
                onDrop={(e) => { e.preventDefault(); if (arrastando.current !== null) mover(arrastando.current, i); arrastando.current = null; }}
                className={`flex items-center gap-1 rounded-xl bg-superficie pr-1 ring-1 ${sel === c.id ? "ring-2 ring-acento" : "ring-linha"}`}>
                <span className="hidden cursor-grab px-1 text-tinta-2 md:block" title="Arraste para mudar a ordem"><GripVertical className="size-4" aria-hidden="true" /></span>
                <button type="button" onClick={() => setSel(c.id)} aria-current={sel === c.id ? "true" : undefined}
                  className="flex min-h-12 min-w-0 flex-1 items-center gap-2.5 px-2 text-left">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-mar-50 text-acento"><IconeCategoria nome={c.icone} className="size-5" /></span>
                  <span className={`min-w-0 flex-1 truncate font-semibold ${c.ativa ? "" : "text-tinta-2"}`}>{c.nome || <i className="font-normal text-tinta-2">sem nome</i>}</span>
                  {!c.ativa && !c.protegida && <span className="rounded-full bg-fundo px-2 py-0.5 text-xs font-bold text-tinta-2 ring-1 ring-linha">Oculta</span>}
                  {tentou && erros[c.id] && <TriangleAlert className="size-4 shrink-0 text-alerta" aria-label="Com erro" />}
                </button>
                <button type="button" aria-label={`Subir ${c.nome}`} disabled={i === 0} onClick={() => mover(i, i - 1)}
                  className="grid size-9 place-items-center rounded-lg text-tinta-2 hover:text-tinta disabled:opacity-30"><ArrowUp className="size-4" /></button>
                <button type="button" aria-label={`Descer ${c.nome}`} disabled={i === lista.length - 1} onClick={() => mover(i, i + 1)}
                  className="grid size-9 place-items-center rounded-lg text-tinta-2 hover:text-tinta disabled:opacity-30"><ArrowDown className="size-4" /></button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={nova} className="btn-secundario w-full"><Plus className="size-5" aria-hidden="true" /> Nova categoria</button>
        </section>

        {/* edição */}
        {atual && (
          <EdicaoCategoria key={atual.id} c={atual} uso={uso[atual.id] ?? 0} erro={tentou ? erros[atual.id] : undefined}
            mudar={mudarAtual}
            descartarNova={atual.id.startsWith("novo:") ? () => { setLista((l) => l.filter((x) => x.id !== atual.id)); setSel(lista[0]?.id ?? ""); } : undefined} />
        )}
      </div>
      {mudancas > 0 && (
        <BarraSalvar salvando={salvando} aoSalvar={salvar} rotulo="Salvar categorias" aoDescartar={() => { setLista(salvas); setTentou(false); }}
          texto={`${mudancas === 1 ? "1 categoria alterada" : `${mudancas} categorias alteradas`}, ainda não salva${mudancas > 1 ? "s" : ""}.`} />
      )}
    </div>
  );
}

function EdicaoCategoria({ c, uso, erro, mudar, descartarNova }: {
  c: Rasc; uso: number; erro?: string; mudar: (f: (c: Rasc) => Rasc) => void; descartarNova?: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [novaSug, setNovaSug] = useState("");
  const icones = Object.entries(ICONES).filter(([k, v]) => !busca.trim() || semAcento(v.rot + " " + k).includes(semAcento(busca.trim())));
  const addSug = () => {
    const t = novaSug.trim();
    if (!t || c.sugestoes.length >= MAX_SUG) return;
    if (c.sugestoes.some((s) => semAcento(s) === semAcento(t))) { setNovaSug(""); return; }
    mudar((x) => ({ ...x, sugestoes: [...x.sugestoes, t.slice(0, 120)] }));
    setNovaSug("");
  };

  return (
    <section className="min-w-0 flex-1 space-y-5 rounded-2xl bg-superficie p-4 ring-1 ring-linha md:p-5" aria-label={`Editar ${c.nome || "nova categoria"}`}>
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex min-w-0 flex-[1_1_240px] flex-col gap-1 font-semibold">
          Nome
          <input className="campo" value={c.nome} maxLength={60} aria-invalid={!!erro} autoFocus={!c.nome}
            onChange={(e) => { const v = e.target.value; mudar((x) => ({ ...x, nome: v })); }} />
          {erro && <span role="alert" className="text-sm font-bold text-alerta">{erro}</span>}
        </label>
        {c.protegida ? (
          <p className="flex items-center gap-2 text-sm text-tinta-2"><Lock className="size-4 shrink-0" aria-hidden="true" /> Sempre aparece: é a saída para quando nenhuma outra serve.</p>
        ) : (
          <label className="flex min-h-12 cursor-pointer items-center gap-2.5 font-semibold">
            <input type="checkbox" role="switch" className="size-5 accent-acento" checked={c.ativa} onChange={() => mudar((x) => ({ ...x, ativa: !x.ativa }))} />
            Aparece para quem abre o chamado
          </label>
        )}
        {descartarNova && (
          <button type="button" className="btn-perigo" onClick={descartarNova}><Trash2 className="size-5" aria-hidden="true" /> Desistir desta</button>
        )}
      </div>

      {uso > 0 && (
        <p className="flex items-start gap-2 rounded-xl bg-sol-50 px-3 py-2 text-sm font-semibold text-ambar-tinta">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Usada em {uso} regra{uso > 1 ? "s" : ""} da automação. {c.ativa ? "Mudar o nome não muda as regras." : "Oculta, ninguém escolhe esta categoria: essas regras deixam de valer para chamados novos."}
        </p>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold">Ícone</h3>
          <label className="relative block w-full sm:w-72">
            <span className="sr-only">Procurar ícone</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tinta-2" aria-hidden="true" />
            <input className="campo pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar: impressora, rede, câmera..." />
          </label>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-1.5">
          {icones.map(([k, v]) => (
            <button key={k} type="button" title={v.rot} aria-label={v.rot} aria-pressed={c.icone === k} onClick={() => mudar((x) => ({ ...x, icone: k }))}
              className={`grid size-12 place-items-center rounded-xl ${c.icone === k ? "bg-mar-700 text-white" : "text-tinta ring-1 ring-linha hover:ring-acento"}`}>
              <v.I className="size-6" strokeWidth={1.8} aria-hidden="true" />
            </button>
          ))}
          {!icones.length && <p className="col-span-full text-sm text-tinta-2">Nenhum ícone com esse nome.</p>}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-bold">O que pode ter acontecido <span className="font-normal text-tinta-2">({c.sugestoes.length} de {MAX_SUG})</span></h3>
        <p className="text-sm text-tinta-2">Aparecem como botões no passo “Conte o que está acontecendo”. Um toque já começa a descrição. Até {MAX_SUG}, para caber na tela do celular.</p>
        <div className="flex flex-wrap items-center gap-2">
          {c.sugestoes.map((s) => (
            <span key={s} className="inline-flex min-h-10 items-center rounded-full bg-mar-50 pl-3.5 font-semibold ring-1 ring-acento/30">
              {s}
              <button type="button" aria-label={`Tirar ${s}`} className="grid size-10 place-items-center text-tinta-2 hover:text-tinta"
                onClick={() => mudar((x) => ({ ...x, sugestoes: x.sugestoes.filter((q) => q !== s) }))}>
                <X className="size-4" aria-hidden="true" />
              </button>
            </span>
          ))}
          {c.sugestoes.length < MAX_SUG && (
            <span className="inline-flex flex-wrap items-center gap-2">
              <label><span className="sr-only">Nova sugestão</span>
                <input className="campo w-56" value={novaSug} maxLength={120} placeholder="Ex.: Fazendo barulho"
                  onChange={(e) => setNovaSug(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSug(); } }} />
              </label>
              <button type="button" className="btn-secundario" onClick={addSug} disabled={!novaSug.trim()}>Adicionar</button>
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-bold">Perguntas que ajudam o TI</h3>
        <p className="text-sm text-tinta-2">Aparecem ao lado da descrição, no computador. Um toque coloca a pergunta no texto para a pessoa responder.</p>
        <ul className="space-y-2">
          {c.dicas.map((d, i) => (
            <li key={i} className="flex items-center gap-2">
              <label className="min-w-0 flex-1"><span className="sr-only">Pergunta {i + 1}</span>
                <input className="campo" value={d} maxLength={120} onChange={(e) => { const v = e.target.value; mudar((x) => ({ ...x, dicas: x.dicas.map((q, j) => (j === i ? v : q)) })); }} />
              </label>
              <button type="button" aria-label="Apagar pergunta" onClick={() => mudar((x) => ({ ...x, dicas: x.dicas.filter((_, j) => j !== i) }))}
                className="grid size-12 shrink-0 place-items-center rounded-xl text-tinta-2 ring-1 ring-linha hover:text-alerta">
                <Trash2 className="size-5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        {c.dicas.length < MAX_DICAS && (
          <button type="button" className="btn-secundario" onClick={() => mudar((x) => ({ ...x, dicas: [...x.dicas, ""] }))}>
            <Plus className="size-5" aria-hidden="true" /> Nova pergunta
          </button>
        )}
      </div>
    </section>
  );
}
