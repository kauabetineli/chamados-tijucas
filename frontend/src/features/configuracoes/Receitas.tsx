import { Clock, SlidersHorizontal, User, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { PainelRapido } from "../../components/PainelRapido";
import { textoMinutos } from "../../lib/configTI";
import {
  MINUTOS_GATILHO, PRAZOS_REGRA, PRIORIDADES, novoId, opcoesAvisar,
  type Acao, type Condicao, type Etapa, type Listas, type Regra,
} from "../../lib/automacao";

/**
 * Modo simples da automação: em vez de etapas, blocos e condições, a pessoa escolhe uma SITUAÇÃO
 * ("Mandar para uma pessoa", "Dividir entre a equipe"…) e preenche poucas caixas.
 * Cada situação vira uma regra comum do mesmo modelo de dados, então o modo avançado continua enxergando tudo.
 */

export type Receita = "pessoa" | "dividir" | "ajustar" | "parado";

const PRIO_ROT: Record<string, string> = { baixa: "Baixa", normal: "Normal", alta: "Alta", urgente: "Urgente" };

const DADOS: Record<Receita, { titulo: string; resumo: string; exemplo: string; icone: ReactNode }> = {
  pessoa: {
    titulo: "Mandar para uma pessoa",
    resumo: "Um tipo de chamado vai sempre para a mesma pessoa.",
    exemplo: "Ex.: tudo sobre impressora fica com quem cuida delas.",
    icone: <User className="size-6" aria-hidden="true" />,
  },
  dividir: {
    titulo: "Dividir entre a equipe",
    resumo: "Os chamados são repartidos entre as pessoas que você escolher.",
    exemplo: "Ex.: os chamados de um setor vão para quem estiver com menos trabalho.",
    icone: <Users className="size-6" aria-hidden="true" />,
  },
  ajustar: {
    titulo: "Mudar a prioridade ou o prazo",
    resumo: "Certos chamados já entram mais urgentes ou com prazo diferente.",
    exemplo: "Ex.: chamados de um setor sempre com prazo mais curto.",
    icone: <SlidersHorizontal className="size-6" aria-hidden="true" />,
  },
  parado: {
    titulo: "Agir quando um chamado ficar parado",
    resumo: "Se ninguém começar a atender em um tempo, o sistema avisa ou sobe a prioridade.",
    exemplo: "Ex.: depois de 30 minutos sem atendimento, avisar toda a equipe.",
    icone: <Clock className="size-6" aria-hidden="true" />,
  },
};

const ORDEM: Receita[] = ["pessoa", "dividir", "ajustar", "parado"];

/** As quatro situações para escolher, em cartões. */
export function CartoesReceita({ aoEscolher }: { aoEscolher: (r: Receita) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {ORDEM.map((k) => (
        <button key={k} type="button" onClick={() => aoEscolher(k)}
          className="flex min-h-28 items-start gap-3 rounded-2xl bg-superficie p-4 text-left ring-1 ring-linha hover:ring-2 hover:ring-acento">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-mar-50 text-acento">{DADOS[k].icone}</span>
          <span className="min-w-0">
            <span className="block text-lg font-extrabold">{DADOS[k].titulo}</span>
            <span className="mt-0.5 block text-tinta-2">{DADOS[k].resumo}</span>
            <span className="mt-1 block text-sm text-tinta-2/90">{DADOS[k].exemplo}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface Estado {
  categoria: string; setor: string; pessoa: string; pessoas: string[]; modo: "carga" | "sequencia";
  prio: string; prazo: string; minutos: number; prioFiltro: string; fazer: string; tentou: boolean;
}

const SEL = "campo min-h-12 w-full font-semibold";

function Pergunta({ rot, ajuda, children }: { rot: string; ajuda?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="font-bold">{rot}</span>
      {children}
      {ajuda && <span className="block text-sm text-tinta-2">{ajuda}</span>}
    </label>
  );
}

function cond(campo: "categoria" | "setor" | "prioridade", valor: string): Condicao {
  return { campo, op: "e", valores: [valor] };
}

export function FormReceita({ receita, listas, aoCriar, aoFechar }: {
  receita: Receita; listas: Listas; aoCriar: (etapa: Etapa, regra: Regra) => void; aoFechar: () => void;
}) {
  const [e, setE] = useState<Estado>({
    categoria: "", setor: "", pessoa: "", pessoas: listas.pessoas.map((p) => p.v), modo: "carga",
    prio: "", prazo: "", minutos: MINUTOS_GATILHO.sem_inicio[1], prioFiltro: "", fazer: "avisar:equipe", tentou: false,
  });
  const set = (o: Partial<Estado>) => setE((x) => ({ ...x, ...o }));
  const d = DADOS[receita];

  const rot = (lista: { v: string; rot: string }[], v: string) => lista.find((o) => o.v === v)?.rot ?? "…";
  const quais = (() => {
    const p = [e.categoria && `da categoria ${rot(listas.categorias, e.categoria)}`, e.setor && `do setor ${rot(listas.setores, e.setor)}`].filter(Boolean);
    return p.length ? `Os chamados ${p.join(" e ")}` : "Todos os chamados";
  })();

  const fazerTexto = e.fazer === "subir" ? "sobe a prioridade um nível"
    : `avisa ${e.fazer === "avisar:equipe" ? "toda a equipe" : rot(listas.pessoas, e.fazer.slice(7))} no celular`;

  let frase = "";
  let erro = "";
  if (receita === "pessoa") {
    frase = `${quais} vão para ${e.pessoa ? rot(listas.pessoas, e.pessoa) : "…"}.`;
    if (!e.pessoa) erro = "Escolha quem vai atender.";
  } else if (receita === "dividir") {
    frase = `${quais} são divididos entre ${e.pessoas.map((id) => rot(listas.pessoas, id)).join(", ") || "…"}, ${e.modo === "carga" ? "indo para quem tiver menos chamados" : "um de cada vez"}.`;
    if (e.pessoas.length < 2) erro = "Escolha pelo menos duas pessoas.";
  } else if (receita === "ajustar") {
    const o = [e.prio && `prioridade ${PRIO_ROT[e.prio]}`, e.prazo && `prazo de ${textoMinutos(parseInt(e.prazo, 10))}`].filter(Boolean);
    frase = `${quais} ficam com ${o.join(" e ") || "…"}.`;
    if (!o.length) erro = "Escolha o que mudar: a prioridade, o prazo ou os dois.";
  } else {
    frase = `Se ninguém começar a atender${e.prioFiltro ? ` um chamado ${PRIO_ROT[e.prioFiltro].toLowerCase()}` : ""} em ${textoMinutos(e.minutos)}, o sistema ${fazerTexto}.`;
  }

  function criar() {
    if (erro) return set({ tentou: true });
    const filtros: Condicao[] = [e.categoria && cond("categoria", e.categoria), e.setor && cond("setor", e.setor)].filter(Boolean) as Condicao[];
    const base = { id: novoId(), nome: "", ativa: true };
    if (receita === "pessoa") {
      return aoCriar("quem", { ...base, tipo: "regra", conds: filtros, acoes: [{ tipo: "atribuir", valor: e.pessoa }] });
    }
    if (receita === "dividir") {
      return aoCriar("quem", { ...base, tipo: "regra", conds: filtros, acoes: [{ tipo: "rodizio", pessoas: e.pessoas, modo: e.modo }] });
    }
    if (receita === "ajustar") {
      const acoes: Acao[] = [];
      if (e.prio) acoes.push({ tipo: "prioridade", valor: e.prio });
      if (e.prazo) acoes.push({ tipo: "prazo", valor: e.prazo });
      return aoCriar("ajustes", { ...base, conds: filtros, acoes });
    }
    const acao: Acao = e.fazer === "subir" ? { tipo: "subir" } : { tipo: "avisar", valor: e.fazer.slice(7) };
    return aoCriar("tempo", {
      ...base, gatilho: "sem_inicio", minutos: e.minutos,
      conds: e.prioFiltro ? [cond("prioridade", e.prioFiltro)] : [], acoes: [acao],
    });
  }

  const filtros = (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-lg font-extrabold">Quais chamados?</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <Pergunta rot="Categoria">
          <select className={SEL} value={e.categoria} onChange={(x) => set({ categoria: x.target.value })}>
            <option value="">Qualquer categoria</option>
            {listas.categorias.map((o) => <option key={o.v} value={o.v}>{o.rot}</option>)}
          </select>
        </Pergunta>
        <Pergunta rot="Setor de quem pediu">
          <select className={SEL} value={e.setor} onChange={(x) => set({ setor: x.target.value })}>
            <option value="">Qualquer setor</option>
            {listas.setores.map((o) => <option key={o.v} value={o.v}>{o.rot}</option>)}
          </select>
        </Pergunta>
      </div>
      <p className="text-sm text-tinta-2">
        {e.categoria || e.setor ? "Só os chamados que combinarem com tudo o que você escolheu." : "Deixando em “qualquer”, a regra vale para todos os chamados."}
      </p>
    </fieldset>
  );

  return (
    <PainelRapido
      idTitulo="titulo-receita" largura="max-w-2xl" aoTentarFechar={aoFechar}
      titulo={d.titulo}
      subtitulo={<p className="mt-0.5 text-sm text-tinta-2">{d.resumo}</p>}
      rodape={
        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <button type="button" className="btn-secundario" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="btn-primario" onClick={criar}>Criar regra</button>
        </div>
      }
    >
      <div className="space-y-5">
        {receita !== "parado" && filtros}

        {receita === "pessoa" && (
          <Pergunta rot="Quem vai atender?">
            <select className={SEL} value={e.pessoa} onChange={(x) => set({ pessoa: x.target.value })}>
              <option value="">Escolher…</option>
              {listas.pessoas.map((o) => <option key={o.v} value={o.v}>{o.rot}</option>)}
            </select>
          </Pergunta>
        )}

        {receita === "dividir" && (
          <fieldset className="space-y-3">
            <legend className="mb-1 text-lg font-extrabold">Dividir entre quem?</legend>
            <div className="flex flex-wrap gap-2">
              {listas.pessoas.map((p) => {
                const on = e.pessoas.includes(p.v);
                return (
                  <button key={p.v} type="button" aria-pressed={on}
                    onClick={() => set({ pessoas: on ? e.pessoas.filter((q) => q !== p.v) : [...e.pessoas, p.v] })}
                    className={`min-h-11 rounded-full px-4 font-bold ${on ? "bg-campo-700 text-white" : "border-2 border-dashed border-ok/50 text-ok"}`}>
                    {p.rot}
                  </button>
                );
              })}
            </div>
            <Pergunta rot="Como dividir?">
              <select className={SEL} value={e.modo} onChange={(x) => set({ modo: x.target.value as Estado["modo"] })}>
                <option value="carga">Para quem estiver com menos chamados</option>
                <option value="sequencia">Um de cada vez, em sequência</option>
              </select>
            </Pergunta>
            <p className="text-sm text-tinta-2">Quem estiver ausente ou marcado para não receber chamados automáticos é pulado.</p>
          </fieldset>
        )}

        {receita === "ajustar" && (
          <fieldset className="space-y-3">
            <legend className="mb-1 text-lg font-extrabold">O que mudar?</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <Pergunta rot="Prioridade">
                <select className={SEL} value={e.prio} onChange={(x) => set({ prio: x.target.value })}>
                  <option value="">Não mudar</option>
                  {PRIORIDADES.map((p) => <option key={p} value={p}>{PRIO_ROT[p]}</option>)}
                </select>
              </Pergunta>
              <Pergunta rot="Prazo para resolver">
                <select className={SEL} value={e.prazo} onChange={(x) => set({ prazo: x.target.value })}>
                  <option value="">Não mudar</option>
                  {PRAZOS_REGRA.map((m) => <option key={m} value={String(m)}>{textoMinutos(m)}</option>)}
                </select>
              </Pergunta>
            </div>
          </fieldset>
        )}

        {receita === "parado" && (
          <>
            <fieldset className="space-y-3">
              <legend className="mb-1 text-lg font-extrabold">Quando agir?</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <Pergunta rot="Se ninguém começar a atender em">
                  <select className={SEL} value={String(e.minutos)} onChange={(x) => set({ minutos: parseInt(x.target.value, 10) })}>
                    {MINUTOS_GATILHO.sem_inicio.map((m) => <option key={m} value={m}>{textoMinutos(m)}</option>)}
                  </select>
                </Pergunta>
                <Pergunta rot="Só para chamados de prioridade">
                  <select className={SEL} value={e.prioFiltro} onChange={(x) => set({ prioFiltro: x.target.value })}>
                    <option value="">Qualquer prioridade</option>
                    {PRIORIDADES.map((p) => <option key={p} value={p}>{PRIO_ROT[p]}</option>)}
                  </select>
                </Pergunta>
              </div>
            </fieldset>
            <Pergunta rot="O que o sistema faz?" ajuda="O aviso chega no celular de quem recebe os alertas do TI.">
              <select className={SEL} value={e.fazer} onChange={(x) => set({ fazer: x.target.value })}>
                <option value="avisar:equipe">Avisa toda a equipe</option>
                {opcoesAvisar(listas).filter((o) => o.v !== "equipe" && o.v !== "responsavel").map((o) => (
                  <option key={o.v} value={`avisar:${o.v}`}>Avisa {o.rot}</option>
                ))}
                <option value="subir">Sobe a prioridade um nível</option>
              </select>
            </Pergunta>
          </>
        )}

        <div className="rounded-xl bg-mar-50 p-4 ring-1 ring-acento/30" aria-live="polite">
          <p className="text-sm font-extrabold tracking-wider text-acento uppercase">Vai ficar assim</p>
          <p className="mt-1 text-lg font-semibold">{frase}</p>
        </div>
        {e.tentou && erro && <p role="alert" className="font-bold text-alerta">{erro}</p>}
      </div>
    </PainelRapido>
  );
}
