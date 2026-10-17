import { CheckCircle2, CircleDot, FlaskConical, Wrench } from "lucide-react";
import type { Prioridade, Status } from "../lib/pb";
import { ROTULO_PRIORIDADE, ROTULO_STATUS } from "../lib/formato";

const ESTILO_STATUS: Record<Status, string> = {
  aberto: "bg-mar-50 text-acento",
  em_andamento: "bg-sol-50 text-tinta ring-1 ring-sol",
  resolvido: "bg-campo-50 text-ok",
};
const ICONE_STATUS = { aberto: CircleDot, em_andamento: Wrench, resolvido: CheckCircle2 };

export function SeloStatus({ status }: { status: Status }) {
  const I = ICONE_STATUS[status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold whitespace-nowrap ${ESTILO_STATUS[status]}`}>
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
      className={`inline-flex items-center gap-1.5 text-sm font-semibold ${urgente ? "text-alerta" : "text-tinta-2"}`}
    >
      <span className={`size-2.5 rounded-full ${COR_PRIORIDADE[prioridade]}`} aria-hidden="true" />
      {ROTULO_PRIORIDADE[prioridade]}
    </span>
  );
}

/** Dado fictício, gerado pelas ferramentas de teste (ferramentas/). Não é atendimento real. */
/** `compacto`: no celular mostra só o ícone (cartões de lista). */
export function SeloTeste({ ficticio, compacto }: { ficticio?: boolean; compacto?: boolean }) {
  if (!ficticio) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-dashed border-tinta-2/50 px-2 py-0.5 text-xs font-semibold text-tinta-2"
      title="Dado de teste gerado automaticamente"
      aria-label="Teste"
    >
      <FlaskConical className="size-3.5" aria-hidden="true" /> <span className={compacto ? "hidden sm:inline" : ""}>Teste</span>
    </span>
  );
}

const ESTILO_PILULA: Record<Prioridade, string> = {
  urgente: "bg-brasa-50 text-alerta ring-brasa/40",
  alta: "bg-sol-50 text-tinta ring-sol",
  normal: "bg-mar-50 text-acento ring-mar/30",
  baixa: "bg-superficie text-tinta-2 ring-linha",
};

/**
 * Prioridade em pílula: cor + texto (a cor nunca é a única pista).
 * Nunca quebra linha, para o cartão de chamado ter sempre o mesmo desenho.
 */
export function PilulaPrioridade({ prioridade }: { prioridade: Prioridade }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ring-1 ${ESTILO_PILULA[prioridade]}`}>
      <span className={`size-2 rounded-full ${COR_PRIORIDADE[prioridade]}`} aria-hidden="true" />
      {ROTULO_PRIORIDADE[prioridade]}
    </span>
  );
}
