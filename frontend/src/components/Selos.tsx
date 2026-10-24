import { CheckCircle2, ChevronsUp, ChevronUp, Circle, CircleDot, FlaskConical, Hourglass } from "lucide-react";
import type { Prioridade, Status } from "../lib/pb";
import { ROTULO_PRIORIDADE, ROTULO_STATUS } from "../lib/formato";

/*
  SISTEMA DE SINAIS (docs/ARQUITETURA.md, "Sinais das listas"): um sinal = um significado, sempre no mesmo lugar.
  - Prioridade: etiqueta SÓ para Urgente (vermelha cheia) e Alta (âmbar). Normal e Baixa não aparecem nas listas:
    a ordem da fila já diz isso.
  - Situação: ícone + texto, sem fundo. Verde só para resolvido; azul para "em andamento".
  - Espera: texto neutro "há 3 h"; vermelho com relógio só fora do prazo (pages/ti/Fila.tsx).
  - Com quem: avatar; círculo tracejado = livre.
  Cores: vermelho = ação agora (Urgente, fora do prazo); âmbar = Alta; azul = você e o que dá para tocar; verde = resolvido.
*/

const ESTILO_STATUS: Record<Status, string> = {
  aberto: "text-tinta-2",
  em_andamento: "text-acento",
  aguardando: "text-tinta-2",
  resolvido: "text-ok",
};
const ICONE_STATUS = { aberto: Circle, em_andamento: CircleDot, aguardando: Hourglass, resolvido: CheckCircle2 };

/** Situação do chamado: ícone + texto, sem fundo (nunca concorre com a prioridade). */
export function SeloStatus({ status }: { status: Status }) {
  const I = ICONE_STATUS[status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold whitespace-nowrap ${ESTILO_STATUS[status]}`}>
      <I className="size-4" aria-hidden="true" />
      {ROTULO_STATUS[status]}
    </span>
  );
}

// cor do pontinho de cada prioridade nos seletores (Prioridade no painel do técnico e no menu de ações)
export const COR_PRIORIDADE: Record<Prioridade, string> = {
  urgente: "bg-brasa",
  alta: "bg-ambar",
  normal: "bg-mar",
  baixa: "bg-linha",
};

/** Prioridade em texto com pontinho (cabeçalhos e seletores). */
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

/** Marca discreta de dado de teste dentro de uma linha de lista (só o frasco). */
export function MarcaTeste({ ficticio }: { ficticio?: boolean }) {
  if (!ficticio) return null;
  return <FlaskConical className="inline size-3.5 shrink-0 align-[-2px] text-tinta-2" role="img" aria-label="Teste" />;
}

/**
 * Etiqueta de prioridade. Nas listas aparece SÓ para Urgente e Alta (`sempre` mostra Normal e Baixa em texto
 * simples, para colunas e cabeçalhos onde a ausência confundiria). Cor + ícone + texto: a cor nunca é a única pista.
 * Fica na frente do título do chamado, na mesma linha.
 */
export function EtiquetaPrioridade({ prioridade, sempre }: { prioridade: Prioridade; sempre?: boolean }) {
  if (prioridade === "urgente") {
    return (
      <span className="mr-1.5 inline-flex shrink-0 items-center gap-0.5 rounded-md bg-brasa-700 px-1.5 align-[1px] text-xs leading-5 font-bold whitespace-nowrap text-white">
        <ChevronsUp className="size-3.5" aria-hidden="true" /> Urgente
      </span>
    );
  }
  if (prioridade === "alta") {
    return (
      <span className="mr-1.5 inline-flex shrink-0 items-center gap-0.5 rounded-md bg-sol-50 px-1.5 align-[1px] text-xs leading-5 font-bold whitespace-nowrap text-ambar-tinta ring-1 ring-ambar ring-inset">
        <ChevronUp className="size-3.5" aria-hidden="true" /> Alta
      </span>
    );
  }
  return sempre ? <span className="text-sm text-tinta-2">{ROTULO_PRIORIDADE[prioridade]}</span> : null;
}

/** Nome antigo: hoje é a mesma etiqueta, sempre visível (menus e colunas). */
export function PilulaPrioridade({ prioridade }: { prioridade: Prioridade }) {
  return <EtiquetaPrioridade prioridade={prioridade} sempre />;
}
