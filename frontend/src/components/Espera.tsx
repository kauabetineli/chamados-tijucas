import { Clock, Hourglass } from "lucide-react";
import { atrasado, esperaCurta, horasEsperando, META_ESPERA_HORAS } from "../lib/fila";
import { paraData, ROTULO_PRIORIDADE } from "../lib/formato";
import type { Chamado } from "../lib/pb";

const horasDesde = (s: string) => (Date.now() - (paraData(s)?.getTime() ?? Date.now())) / 3_600_000;

/** "agora", "há 12 min", "há 3 h", "há 2 dias". */
export const ha = (horas: number) => { const t = esperaCurta(horas); return t === "agora" ? t : `há ${t}`; };

/**
 * Há quanto tempo (coluna "Espera"). Na fila: desde a abertura, neutro; FORA DO PRAZO (META_ESPERA_HORAS) fica
 * vermelho com relógio, sem a palavra "atrasado". Em atendimento: desde o início. Em espera: desde que parou.
 */
export function Espera({ c }: { c: Chamado }) {
  if (c.status === "aguardando") {
    const desde = paraData(c.aguardando_desde || "");
    return <span className="inline-flex items-center gap-1"><Hourglass className="size-3.5 shrink-0" aria-hidden="true" />{desde ? ha(horasDesde(c.aguardando_desde!)) : "em espera"}</span>;
  }
  if (c.status === "em_andamento") {
    return <span title="Desde que começou o atendimento">{ha(horasDesde(c.iniciado_em || c.created))}</span>;
  }
  if (atrasado(c)) {
    return (
      <span className="inline-flex items-center gap-1 font-bold text-alerta" title={`Fora do prazo: a meta para ${ROTULO_PRIORIDADE[c.prioridade]} é ${META_ESPERA_HORAS[c.prioridade]} h`}>
        <Clock className="size-3.5 shrink-0" aria-hidden="true" /> {ha(horasEsperando(c))}
        <span className="sr-only">, fora do prazo</span>
      </span>
    );
  }
  return <span>{ha(horasEsperando(c))}</span>;
}
