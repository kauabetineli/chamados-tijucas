import { CheckCircle2, CircleDot, Wrench } from "lucide-react";
import type { Prioridade, Status } from "../lib/pb";
import { ROTULO_PRIORIDADE, ROTULO_STATUS } from "../lib/formato";

const ESTILO_STATUS: Record<Status, string> = {
  aberto: "bg-mar-50 text-mar-700",
  em_andamento: "bg-sol-50 text-tinta ring-1 ring-sol",
  resolvido: "bg-campo-50 text-campo-700",
};
const ICONE_STATUS = { aberto: CircleDot, em_andamento: Wrench, resolvido: CheckCircle2 };

export function SeloStatus({ status }: { status: Status }) {
  const I = ICONE_STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${ESTILO_STATUS[status]}`}>
      <I className="size-4" aria-hidden="true" />
      {ROTULO_STATUS[status]}
    </span>
  );
}

// cor da barra lateral da fila do TI
export const COR_PRIORIDADE: Record<Prioridade, string> = {
  urgente: "bg-brasa",
  alta: "bg-sol",
  normal: "bg-mar",
  baixa: "bg-linha",
};

export function SeloPrioridade({ prioridade }: { prioridade: Prioridade }) {
  const urgente = prioridade === "urgente";
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-sm font-semibold ${urgente ? "text-brasa-700" : "text-tinta-2"}`}
    >
      <span className={`size-2.5 rounded-full ${COR_PRIORIDADE[prioridade]}`} aria-hidden="true" />
      {ROTULO_PRIORIDADE[prioridade]}
    </span>
  );
}
