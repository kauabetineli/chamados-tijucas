import type { Prioridade } from "../../lib/pb";
import type { FormularioChamado } from "./useNovoChamado";

const ROTULO: Record<Prioridade, string> = { baixa: "Baixa", normal: "Normal", alta: "Alta", urgente: "Urgente" };

/**
 * Prioridade escolhida por quem abre (só aparece se o administrador liberou em Configurações do TI > Fila e atendimento).
 * Começa na que o impacto sugere; subir para Urgente pode pedir um motivo curto.
 */
export function EscolhaPrioridade({ f, faltaMotivo }: { f: FormularioChamado; faltaMotivo?: boolean }) {
  if (!f.escolhePrioridade || !f.impacto) return null;
  return (
    <div className="space-y-2 rounded-2xl bg-fundo p-4 ring-1 ring-linha">
      <p id="rotulo-prioridade" className="font-bold">Prioridade</p>
      <div role="radiogroup" aria-labelledby="rotulo-prioridade" className="grid grid-cols-3 gap-2">
        {f.opcoesPrioridade.map((p) => {
          const on = f.prioridade === p;
          return (
            <button key={p} type="button" role="radio" aria-checked={on} onClick={() => f.setPrioridade(p)}
              className={`min-h-12 rounded-xl px-2 font-bold ${on ? "bg-mar-700 text-white" : "bg-superficie text-tinta ring-1 ring-linha hover:ring-acento"}`}>
              {ROTULO[p]}
            </button>
          );
        })}
      </div>
      <p className="text-sm text-tinta-2">
        {f.prioridade === f.sugerida
          ? `Pela sua resposta, sugerimos ${ROTULO[f.sugerida]}. Se for mais grave, pode subir.`
          : `Você escolheu ${ROTULO[f.prioridade]} (sugerida: ${ROTULO[f.sugerida]}). Vamos saber que foi você quem escolheu.`}
      </p>
      {f.precisaMotivo && (
        <label className="block space-y-1 font-semibold">
          Por que é urgente?
          <input className="campo font-normal" value={f.motivoUrgencia} maxLength={200} placeholder="Ex.: fila de cidadãos esperando no balcão"
            aria-invalid={faltaMotivo || undefined} onChange={(e) => f.setMotivoUrgencia(e.target.value)} />
          {faltaMotivo && <span role="alert" className="block text-sm font-bold text-alerta">Conte em poucas palavras por que é urgente.</span>}
        </label>
      )}
    </div>
  );
}
