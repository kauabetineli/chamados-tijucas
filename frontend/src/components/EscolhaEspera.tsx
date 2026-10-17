import { Building, MessageCircleQuestion, Package } from "lucide-react";
import { ROTULO_AGUARDANDO } from "../lib/formato";
import type { MotivoAguardando } from "../lib/pb";

export const MOTIVOS: { id: MotivoAguardando; Icone: typeof Package; curto: string }[] = [
  { id: "peca", Icone: Package, curto: "Peça" },
  { id: "solicitante", Icone: MessageCircleQuestion, curto: "Resposta" },
  { id: "terceiro", Icone: Building, curto: "Terceiro" },
];

/**
 * O que o chamado está esperando: peça, resposta de quem pediu ou terceiro/fornecedor.
 * "Resposta" volta sozinho para atendimento quando a pessoa responde (hook no servidor).
 */
export function EscolhaEspera({ valor, aoEscolher, nome = "motivo-espera", desabilitado }: {
  valor: MotivoAguardando | "" | undefined;
  aoEscolher: (m: MotivoAguardando) => void;
  nome?: string;
  desabilitado?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="O que está aguardando" className="grid grid-cols-3 gap-1.5">
      {MOTIVOS.map(({ id, Icone, curto }) => (
        <label
          key={id}
          title={`Aguardando ${ROTULO_AGUARDANDO[id]}`}
          className={`flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center text-xs font-semibold ring-1 ${
            valor === id ? "bg-mar-50 text-acento ring-2 ring-acento" : "text-tinta-2 ring-linha hover:text-tinta hover:ring-acento"
          }`}
        >
          <input type="radio" name={nome} className="sr-only" checked={valor === id} disabled={desabilitado} onChange={() => aoEscolher(id)} />
          <Icone className="size-5" aria-hidden="true" />
          {curto}
        </label>
      ))}
    </div>
  );
}
