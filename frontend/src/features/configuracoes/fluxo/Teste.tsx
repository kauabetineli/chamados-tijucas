import { Bloco as BlocoCinza } from "../../../components/Esqueleto";
import { textoMinutos } from "../../../lib/configTI";
import {
  ROTULO_GATILHO, ROTULO_PRIO, ehTempo, opcoesDoCampo, textoAcao,
  type Acao, type Gatilho, type Listas, type TipoAcao,
} from "../../../lib/automacao";
import type { Tecnico } from "../dados";
import type { StatusNo } from "./Canvas";

export interface Resultado {
  gatilho: Gatilho; prioridade: string; prioridade_antes: string; prazo_min: number;
  pessoa: string; pessoa_nome: string; regra: string; giro_regra: string; devolver: boolean;
  efeitos: { tipo: TipoAcao; valor?: string; regra?: string }[];
  fluxos: Record<string, { status: Record<string, StatusNo>; ativas: string[] }>;
  traco: { fluxo?: string; no?: string; texto: string }[];
  conflitos: { fluxo: string; no: string; texto: string }[];
  erros: string[];
}

export type Sim = {
  categoria: string; setor: string; impacto: string; prioridade: string; origem: string; texto: string;
  anexo: string; horario: string; responsavel: string;
};

/** Frase curta do resultado, para o canto do desenho. */
export function resumoResultado(r: Resultado, l: Listas): string {
  const p: string[] = [];
  if (r.gatilho === "novo") p.push(r.pessoa_nome || "fica livre na fila");
  else if (r.pessoa_nome) p.push(`passa para ${r.pessoa_nome}`);
  else if (r.devolver) p.push("volta para a fila");
  if (r.prioridade !== r.prioridade_antes || r.gatilho === "novo") p.push(`prioridade ${ROTULO_PRIO[r.prioridade] ?? r.prioridade}`);
  for (const e of r.efeitos) p.push(textoAcao({ tipo: e.tipo, valor: e.valor ?? "", pessoas: [], modo: "carga" } as Acao, l).toLowerCase());
  return p.length ? p.join(", ") : "nenhuma ação rodou";
}

export function PainelTeste({ gatilho, sim, setSim, listas, res, acender, setAcender, equipe, outroIgual, nomeFluxo }: {
  gatilho: Gatilho; sim: Sim; setSim: (o: Partial<Sim>) => void; listas: Listas; res: Resultado | null;
  acender: boolean; setAcender: (v: boolean) => void; equipe: Tecnico[] | null; outroIgual: () => void;
  nomeFluxo: (id: string) => string;
}) {
  const campos: { k: keyof Sim; rot: string; opcoes: { v: string; rot: string }[] }[] = [
    { k: "categoria", rot: "Categoria", opcoes: listas.categorias },
    { k: "setor", rot: "Setor", opcoes: listas.setores },
    { k: "impacto", rot: "Quem é afetado", opcoes: opcoesDoCampo("impacto", listas) },
    { k: "prioridade", rot: ehTempo(gatilho) || gatilho === "reaberto" ? "Prioridade atual" : "Prioridade pedida", opcoes: [{ v: "", rot: "A do impacto" }, ...opcoesDoCampo("prioridade", listas)] },
    { k: "origem", rot: "Por onde chegou", opcoes: opcoesDoCampo("origem", listas) },
    { k: "anexo", rot: "Foto ou vídeo", opcoes: opcoesDoCampo("anexo", listas) },
    { k: "horario", rot: "Quando", opcoes: opcoesDoCampo("horario", listas) },
    ...(gatilho === "novo" ? [] : [{ k: "responsavel" as const, rot: "Tem responsável", opcoes: opcoesDoCampo("responsavel", listas) }]),
  ];
  const efeitos = (res?.efeitos ?? []).map((e) => ({ t: textoAcao({ tipo: e.tipo, valor: e.valor ?? "", pessoas: [], modo: "carga" } as Acao, listas), regra: e.regra }));
  const mudouPrio = res && res.prioridade !== res.prioridade_antes;

  return (
    <section aria-label="Testar os fluxos" className="space-y-4 rounded-2xl bg-superficie p-4 ring-1 ring-linha">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-[1_1_20rem]">
          <h2 className="font-display text-lg font-extrabold">Testar com um chamado de exemplo</h2>
          <p className="text-sm text-tinta-2">
            Roda todos os fluxos ligados de <b className="text-tinta">“{ROTULO_GATILHO[gatilho]}”</b>, na ordem da lista, com o que está na tela agora. Nada é salvo.
          </p>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
          <input type="checkbox" role="switch" checked={acender} onChange={() => setAcender(!acender)} className="size-5 accent-acento" />
          Acender o caminho no desenho
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid grid-cols-2 content-start gap-2 md:grid-cols-4">
          {campos.map((c) => (
            <label key={c.k} className="flex flex-col gap-0.5 text-sm font-bold">
              {c.rot}
              <select className="campo min-h-11 px-2 text-sm font-semibold" value={sim[c.k]} onChange={(e) => setSim({ [c.k]: e.target.value })}>
                {c.opcoes.map((o) => <option key={o.v} value={o.v}>{o.rot}</option>)}
              </select>
            </label>
          ))}
          <label className="col-span-2 flex flex-col gap-0.5 text-sm font-bold md:col-span-4">
            Descrição
            <input className="campo min-h-11 text-sm font-normal" value={sim.texto} onChange={(e) => setSim({ texto: e.target.value })} placeholder="Ex.: impressora sem toner" />
          </label>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl bg-noite p-4 text-white" aria-live="polite">
            <p className="text-xs font-bold tracking-wider uppercase opacity-85">O sistema faria isto</p>
            {res ? (
              <>
                {res.gatilho === "novo" ? (
                  <p className="mt-1 font-display text-2xl font-extrabold">{res.pessoa_nome || "Fica livre na fila"}</p>
                ) : (
                  <p className="mt-1 font-display text-xl font-extrabold">
                    {res.pessoa_nome ? `Passa para ${res.pessoa_nome}` : res.devolver ? "Volta para a fila" : "Responsável não muda"}
                  </p>
                )}
                {res.regra && <p className="text-sm opacity-90">pelo fluxo “{res.regra}”</p>}
                <p className="mt-1 text-sm">
                  Prioridade {mudouPrio && <>{ROTULO_PRIO[res.prioridade_antes]} → </>}<b className="text-sol">{ROTULO_PRIO[res.prioridade] ?? res.prioridade}</b>
                  {res.gatilho === "novo" && <>, prazo <b className="text-sol">{textoMinutos(res.prazo_min)}</b></>}
                </p>
                {efeitos.map((x, i) => <p key={i} className="mt-1 text-sm opacity-90">+ {x.t}{x.regra ? ` (${x.regra})` : ""}</p>)}
              </>
            ) : <BlocoCinza className="mt-2 h-8 w-40 opacity-40" />}
          </div>
          {res?.giro_regra && (
            <button type="button" className="btn-secundario w-full" onClick={outroIgual}>Abrir outro igual (ver a divisão)</button>
          )}
          {res && res.conflitos.length > 0 && (
            <div className="rounded-xl bg-fundo p-3 text-sm ring-1 ring-linha">
              <p className="font-bold">Conflitos (resolvidos pela regra fixa)</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-tinta-2">{res.conflitos.map((c, i) => <li key={i}>{c.texto}</li>)}</ul>
            </div>
          )}
          {res && res.traco.length > 0 && (
            <details className="text-sm">
              <summary className="min-h-10 cursor-pointer py-2 font-bold text-acento">Passo a passo</summary>
              <ol className="list-decimal space-y-1 pl-5 text-tinta-2">
                {res.traco.map((t, i) => <li key={i}>{t.texto}{t.fluxo && !t.texto.startsWith(nomeFluxo(t.fluxo)) ? ` (${nomeFluxo(t.fluxo)})` : ""}</li>)}
              </ol>
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
        </div>
      </div>
    </section>
  );
}
