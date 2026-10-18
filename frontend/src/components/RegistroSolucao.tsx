import { BookOpen } from "lucide-react";

/**
 * "Guardar causa e solução no Histórico?" ao resolver (painel do chamado e Registrar).
 * DESLIGADO por padrão: problema de rotina, que o TI já sabe resolver, fecha sem escrever nada.
 * Ligado, os dois campos ficam obrigatórios e alimentam o Histórico e as "soluções parecidas".
 */
export function RegistroSolucao({ ligado, aoLigar, diagnostico, aoDiagnostico, solucao, aoSolucao, prefixo = "res" }: {
  ligado: boolean;
  aoLigar: (v: boolean) => void;
  diagnostico: string;
  aoDiagnostico: (v: string) => void;
  solucao: string;
  aoSolucao: (v: string) => void;
  /** prefixo dos ids (dois formulários na mesma página não colidem) */
  prefixo?: string;
}) {
  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 ring-linha hover:ring-acento">
        <input type="checkbox" className="mt-1 size-5 accent-acento" checked={ligado} onChange={(e) => aoLigar(e.target.checked)} />
        <span>
          <span className="flex items-center gap-1.5 font-semibold"><BookOpen className="size-4 text-acento" aria-hidden="true" /> Guardar causa e solução no Histórico</span>
          <span className="block text-sm text-tinta-2">Opcional. Vale para o que não é rotina: na próxima vez, quem atender vê como foi resolvido.</span>
        </span>
      </label>
      {ligado && (
        <div className="grid gap-3 lg:grid-cols-2">
          <div>
            <label htmlFor={`${prefixo}-diag`} className="rotulo">Qual era a causa?</label>
            <textarea id={`${prefixo}-diag`} required className="campo min-h-20" value={diagnostico} onChange={(e) => aoDiagnostico(e.target.value)} />
          </div>
          <div>
            <label htmlFor={`${prefixo}-sol`} className="rotulo">O que foi feito?</label>
            <textarea id={`${prefixo}-sol`} required className="campo min-h-20" value={solucao} onChange={(e) => aoSolucao(e.target.value)} />
          </div>
        </div>
      )}
    </div>
  );
}
