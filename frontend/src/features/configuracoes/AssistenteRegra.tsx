import { X } from "lucide-react";
import { useState } from "react";
import { PainelRapido } from "../../components/PainelRapido";
import { textoMinutos } from "../../lib/configTI";
import {
  CAMPOS_POR_ETAPA, MINUTOS_GATILHO, PRAZOS_REGRA, PRIORIDADES, ROTULO_CAMPO, novoId, opcoesAvisar, opcoesDoCampo, rotuloValor,
  type Acao, type Campo, type Etapa, type Gatilho, type Listas, type Regra,
} from "../../lib/automacao";

/**
 * "Nova regra" como UMA frase: Quando [gatilho] e [campo] for [valor] (+ e também…), Então [ação] [valor].
 * O sistema escolhe a etapa sozinho: gatilho de tempo → etapa 4; atribuir/dividir → etapa 2; o resto → etapa 1.
 */

type GatilhoFrase = "novo" | Gatilho;
type AcaoFrase = "atribuir" | "rodizio" | "prioridade" | "prazo" | "avisar" | "resposta" | "nota" | "subir" | "devolver";

const GATILHOS: { k: GatilhoFrase; rot: string }[] = [
  { k: "novo", rot: "chegar um chamado novo" },
  { k: "sem_inicio", rot: "ninguém começar o atendimento em" },
  { k: "vencido", rot: "um chamado passar do prazo" },
  { k: "espera", rot: "quem pediu não responder em" },
];

const ACOES: { k: AcaoFrase; rot: string; novo?: boolean; tempo?: boolean }[] = [
  { k: "atribuir", rot: "mandar para", novo: true },
  { k: "rodizio", rot: "dividir entre a equipe", novo: true },
  { k: "prioridade", rot: "mudar a prioridade para", novo: true },
  { k: "prazo", rot: "mudar o prazo para", novo: true },
  { k: "avisar", rot: "avisar no celular", novo: true, tempo: true },
  { k: "resposta", rot: "responder a quem pediu com", novo: true, tempo: true },
  { k: "nota", rot: "deixar uma nota interna", novo: true, tempo: true },
  { k: "subir", rot: "subir a prioridade um nível", tempo: true },
  { k: "devolver", rot: "devolver para a fila, sem responsável", tempo: true },
];

const PRIO_ROT: Record<string, string> = { baixa: "Baixa", normal: "Normal", alta: "Alta", urgente: "Urgente" };

interface CondFrase { campo: Campo; valor: string }
interface Estado {
  gat: GatilhoFrase; minutos: number; conds: CondFrase[];
  acao: AcaoFrase; valor: string; pessoas: string[]; modo: "carga" | "sequencia"; nome: string; tentou: boolean;
}

function valorInicial(acao: AcaoFrase, l: Listas, respostas: string[]): string {
  switch (acao) {
    case "atribuir": return l.pessoas[0]?.v ?? "";
    case "prioridade": return "alta";
    case "prazo": return "120";
    case "avisar": return "equipe";
    case "resposta": return respostas[0] ?? "Recebemos o seu chamado e já vamos verificar.";
    default: return "";
  }
}

function porNome(lista: { v: string; rot: string }[], nome: string) {
  return (lista.find((o) => o.rot.toLowerCase().startsWith(nome.toLowerCase())) ?? lista[0])?.v ?? "";
}

export function AssistenteRegra({ listas, respostas, inicio = "quem", aoCriar, aoFechar }: {
  listas: Listas; respostas: string[];
  /** etapa do botão que abriu: escolhe o começo da frase */
  inicio?: Etapa;
  aoCriar: (etapa: Etapa, regra: Regra) => void;
  aoFechar: () => void;
}) {
  const acao0: AcaoFrase = inicio === "ajustes" ? "prioridade" : inicio === "tempo" ? "avisar" : "atribuir";
  const inicial: Estado = {
    gat: inicio === "tempo" ? "sem_inicio" : "novo", minutos: inicio === "tempo" ? 30 : 0, conds: [], acao: acao0, valor: valorInicial(acao0, listas, respostas),
    pessoas: listas.pessoas.slice(0, 2).map((p) => p.v), modo: "carga", nome: "", tentou: false,
  };
  const [w, setW] = useState<Estado>(inicial);
  const set = (o: Partial<Estado>) => setW((x) => ({ ...x, ...o }));

  const modelos: { rot: string; w: Partial<Estado> }[] = [
    { rot: "Uma categoria vai para uma pessoa", w: { gat: "novo", minutos: 0, conds: [{ campo: "categoria", valor: porNome(listas.categorias, "Impressora") }], acao: "atribuir", valor: listas.pessoas[0]?.v ?? "" } },
    { rot: "Dividir um setor entre a equipe", w: { gat: "novo", minutos: 0, conds: [{ campo: "setor", valor: listas.setores[0]?.v ?? "" }], acao: "rodizio", valor: "", pessoas: listas.pessoas.map((p) => p.v) } },
    { rot: "Prazo curto para um setor", w: { gat: "novo", minutos: 0, conds: [{ campo: "setor", valor: listas.setores[0]?.v ?? "" }], acao: "prazo", valor: "120" } },
    { rot: "Avisar quando um urgente ficar parado", w: { gat: "sem_inicio", minutos: 30, conds: [{ campo: "prioridade", valor: "urgente" }], acao: "avisar", valor: "equipe" } },
  ];

  const ehTempo = w.gat !== "novo";
  const etapa: Etapa = ehTempo ? "tempo" : w.acao === "atribuir" || w.acao === "rodizio" ? "quem" : "ajustes";
  const camposOk = CAMPOS_POR_ETAPA[ehTempo ? "tempo" : "ajustes"];
  const acoesOk = ACOES.filter((a) => (ehTempo ? a.tempo : a.novo));
  const minutosOk = ehTempo ? MINUTOS_GATILHO[w.gat as Gatilho] : [];

  function opcoesValor(): { v: string; rot: string }[] | null {
    switch (w.acao) {
      case "atribuir": return listas.pessoas;
      case "prioridade": return PRIORIDADES.map((p) => ({ v: p, rot: PRIO_ROT[p] }));
      case "prazo": return PRAZOS_REGRA.map((m) => ({ v: String(m), rot: textoMinutos(m) }));
      case "avisar": return opcoesAvisar(listas);
      default: return null;
    }
  }
  const valores = opcoesValor();
  const ehTexto = w.acao === "resposta" || w.acao === "nota";

  // frase "Em resumo"
  const g = GATILHOS.find((x) => x.k === w.gat)!;
  const condTxt = w.conds.map((c) => ROTULO_CAMPO[c.campo].toLowerCase() + (c.campo === "texto" ? ` contiver "${c.valor}"` : ` for ${rotuloValor(c.campo, c.valor, listas)}`)).join(" e ");
  const nomePessoa = (id: string) => listas.pessoas.find((p) => p.v === id)?.rot ?? "…";
  const a = ACOES.find((x) => x.k === w.acao)!;
  const oQue =
    w.acao === "avisar" ? `avisar ${(opcoesAvisar(listas).find((o) => o.v === w.valor)?.rot ?? "").toLowerCase()} no celular`
      : w.acao === "rodizio" ? `dividir entre ${w.pessoas.map(nomePessoa).join(", ") || "…"}, ${w.modo === "carga" ? "indo para quem tiver menos chamados" : "um de cada vez"}`
      : ehTexto ? `${a.rot}${w.acao === "nota" ? "" : ""} “${w.valor || "…"}”`
      : valores ? `${a.rot} ${valores.find((o) => o.v === w.valor)?.rot ?? "…"}`
      : a.rot;
  const frase = `Quando ${g.rot}${minutosOk.length ? " " + textoMinutos(w.minutos) : ""}${w.conds.length ? " e " + condTxt : ""}, ${oQue}.`;

  let erro = "";
  if (w.conds.some((c) => !c.valor.trim())) erro = "Complete ou tire a condição sem valor.";
  else if (w.acao === "rodizio" && w.pessoas.length < 2) erro = "Escolha pelo menos duas pessoas para dividir.";
  else if (w.acao === "atribuir" && !w.valor) erro = "Escolha para quem vai.";
  else if (ehTexto && !w.valor.trim()) erro = "Escreva a mensagem.";

  function mudarGat(k: GatilhoFrase) {
    const tempo = k !== "novo";
    const valida = ACOES.find((x) => x.k === w.acao)?.[tempo ? "tempo" : "novo"];
    const mins = tempo ? MINUTOS_GATILHO[k as Gatilho] : [];
    set({
      gat: k, minutos: mins[1] ?? mins[0] ?? 0,
      conds: w.conds.filter((c) => !tempo || CAMPOS_POR_ETAPA.tempo.includes(c.campo)),
      ...(valida ? {} : { acao: "avisar", valor: "equipe" }),
    });
  }

  function criar() {
    if (erro) return set({ tentou: true });
    let acao: Acao;
    if (w.acao === "rodizio") acao = { tipo: "rodizio", pessoas: w.pessoas, modo: w.modo };
    else if (w.acao === "subir" || w.acao === "devolver") acao = { tipo: w.acao };
    else acao = { tipo: w.acao, valor: w.valor.trim() };
    const regra: Regra = {
      id: novoId(), nome: w.nome.trim(), ativa: true,
      conds: w.conds.map((c) => ({ campo: c.campo, op: c.campo === "texto" ? "contem" : "e", valores: [c.valor.trim()] })),
      acoes: [acao],
      ...(etapa === "tempo" ? { gatilho: w.gat as Gatilho, minutos: w.minutos } : etapa === "quem" ? { tipo: "regra" as const } : {}),
    };
    aoCriar(etapa, regra);
  }

  const CX = "min-h-12 rounded-xl border-2 px-2.5 font-bold";
  const AZUL = `${CX} border-acento/40 bg-mar-50 text-tinta`;
  const VERDE = `${CX} border-ok/40 bg-campo-50 text-tinta`;

  return (
    <PainelRapido
      idTitulo="titulo-nova-regra" largura="max-w-3xl" aoTentarFechar={aoFechar}
      titulo="Nova regra"
      subtitulo={<p className="mt-0.5 text-sm text-tinta-2">Complete a frase escolhendo nas caixas. O sistema coloca a regra na etapa certa sozinho.</p>}
      rodape={
        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <button type="button" className="btn-secundario" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="btn-primario" onClick={criar}>Criar regra</button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-semibold text-tinta-2">Começar de um modelo (opcional)</p>
          <div className="flex flex-wrap gap-2">
            {modelos.map((m) => (
              <button key={m.rot} type="button" onClick={() => set({ ...m.w, modo: "carga", tentou: false })}
                className="min-h-10 rounded-full bg-fundo px-3.5 text-sm font-semibold ring-1 ring-linha hover:ring-acento">
                {m.rot}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3.5 rounded-2xl p-4 text-lg ring-1 ring-linha">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="w-20 font-extrabold text-acento">Quando</span>
            <label><span className="sr-only">Quando</span>
              <select className={AZUL} value={w.gat} onChange={(e) => mudarGat(e.target.value as GatilhoFrase)}>
                {GATILHOS.map((x) => <option key={x.k} value={x.k}>{x.rot}</option>)}
              </select>
            </label>
            {minutosOk.length > 0 && (
              <label><span className="sr-only">Há quanto tempo</span>
                <select className={AZUL} value={String(w.minutos)} onChange={(e) => set({ minutos: parseInt(e.target.value, 10) })}>
                  {minutosOk.map((m) => <option key={m} value={m}>{textoMinutos(m)}</option>)}
                </select>
              </label>
            )}
          </div>

          {w.conds.map((c, j) => {
            const mudar = (o: Partial<CondFrase>) => set({ conds: w.conds.map((x, i) => (i === j ? { ...x, ...o } : x)) });
            const opcoes = opcoesDoCampo(c.campo, listas);
            return (
              <div key={j} className="flex flex-wrap items-center gap-2.5">
                <span className="w-20 font-extrabold text-acento">e</span>
                <label><span className="sr-only">Campo</span>
                  <select className={AZUL} value={c.campo} onChange={(e) => {
                    const k = e.target.value as Campo;
                    mudar({ campo: k, valor: k === "texto" ? "" : opcoesDoCampo(k, listas)[0]?.v ?? "" });
                  }}>
                    {camposOk.map((k) => <option key={k} value={k}>{ROTULO_CAMPO[k]}</option>)}
                  </select>
                </label>
                <span>{c.campo === "texto" ? "contiver" : "for"}</span>
                {c.campo === "texto" ? (
                  <label><span className="sr-only">Palavra</span>
                    <input className={`${AZUL} w-44 font-semibold`} value={c.valor} placeholder="ex.: toner" onChange={(e) => mudar({ valor: e.target.value })} />
                  </label>
                ) : (
                  <label><span className="sr-only">Valor</span>
                    <select className={`${AZUL} max-w-72`} value={c.valor} onChange={(e) => mudar({ valor: e.target.value })}>
                      {opcoes.map((o) => <option key={o.v} value={o.v}>{o.rot}</option>)}
                    </select>
                  </label>
                )}
                <button type="button" aria-label="Tirar esta condição" onClick={() => set({ conds: w.conds.filter((_, i) => i !== j) })}
                  className="grid size-10 place-items-center rounded-lg text-tinta-2 hover:bg-fundo hover:text-tinta">
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>
            );
          })}

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="hidden w-20 sm:block" />
            <button type="button" className="min-h-10 rounded-xl border-2 border-dashed border-acento/60 px-3.5 text-base font-bold text-acento"
              onClick={() => {
                const campo: Campo = w.conds.length ? "setor" : ehTempo ? "prioridade" : "categoria";
                const valor = campo === "prioridade" ? "urgente" : opcoesDoCampo(campo, listas)[0]?.v ?? "";
                set({ conds: [...w.conds, { campo, valor }] });
              }}>
              {w.conds.length ? "+ e também…" : "+ só para alguns chamados (opcional)"}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 border-t border-dashed border-linha pt-3.5">
            <span className="w-20 font-extrabold text-ok">Então</span>
            <label><span className="sr-only">O que fazer</span>
              <select className={VERDE} value={w.acao} onChange={(e) => { const k = e.target.value as AcaoFrase; set({ acao: k, valor: valorInicial(k, listas, respostas) }); }}>
                {acoesOk.map((x) => <option key={x.k} value={x.k}>{x.rot}</option>)}
              </select>
            </label>
            {valores && (
              <label><span className="sr-only">Valor da ação</span>
                <select className={`${VERDE} max-w-80`} value={w.valor} onChange={(e) => set({ valor: e.target.value })}>
                  {!valores.some((o) => o.v === w.valor) && <option value="">escolher…</option>}
                  {valores.map((o) => <option key={o.v} value={o.v}>{o.rot}</option>)}
                </select>
              </label>
            )}
          </div>
          {ehTexto && (
            <label className="block sm:pl-[5.6rem]">
              <span className="sr-only">{w.acao === "nota" ? "Texto da nota" : "Mensagem"}</span>
              <input className={`${VERDE} w-full font-semibold`} list="respostas-prontas" value={w.valor}
                placeholder={w.acao === "nota" ? "Ex.: conferir o toner no almoxarifado" : "Mensagem ou resposta pronta"}
                onChange={(e) => set({ valor: e.target.value })} />
            </label>
          )}
          {w.acao === "rodizio" && (
            <div className="flex flex-wrap items-center gap-2 sm:pl-[5.6rem]">
              {listas.pessoas.map((p) => {
                const on = w.pessoas.includes(p.v);
                return (
                  <button key={p.v} type="button" aria-pressed={on}
                    onClick={() => set({ pessoas: on ? w.pessoas.filter((q) => q !== p.v) : [...w.pessoas, p.v] })}
                    className={`min-h-10 rounded-full px-3.5 text-base font-bold ${on ? "bg-campo-700 text-white" : "border-2 border-dashed border-ok/50 text-ok"}`}>
                    {p.rot}
                  </button>
                );
              })}
              <label><span className="sr-only">Como dividir</span>
                <select className="min-h-10 rounded-xl border-2 border-ok/40 bg-superficie px-2 text-base font-bold" value={w.modo}
                  onChange={(e) => set({ modo: e.target.value as Estado["modo"] })}>
                  <option value="carga">indo para quem tiver menos chamados</option>
                  <option value="sequencia">um de cada vez</option>
                </select>
              </label>
            </div>
          )}
        </div>

        <p className="text-tinta-2"><b className="text-tinta">Em resumo:</b> {frase}</p>
        <label className="flex flex-wrap items-center gap-2.5 font-semibold">
          Nome (opcional)
          <input className="campo min-w-0 flex-1 font-normal" value={w.nome} onChange={(e) => set({ nome: e.target.value })} placeholder="Ex.: Impressoras vão para o Rafael" />
        </label>
        {w.tentou && erro && <p role="alert" className="font-bold text-alerta">{erro}</p>}
      </div>
    </PainelRapido>
  );
}
