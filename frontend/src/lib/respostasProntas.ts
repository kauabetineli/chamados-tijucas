import { useCallback, useEffect, useState } from "react";
import { pb } from "./pb";
import { useRealtime } from "./useRealtime";

/** Resposta pronta do TI (coleção "respostas_prontas", migration 1760000009). Só técnicos leem e editam. */
export interface RespostaPronta {
  id: string;
  texto: string;
  ordem: number;
  /** o que a resposta faz além de mandar o texto (migration 1760000017); vazio = só manda */
  acao?: AcaoPronta | "";
}

export type AcaoPronta = "espera_solicitante" | "espera_peca" | "espera_terceiro" | "resolver";

/** Rótulos das ações (o que acontece com o chamado ao enviar). */
export const ROTULO_ACAO: Record<AcaoPronta, string> = {
  espera_solicitante: "pôr em espera: resposta de quem pediu",
  espera_peca: "pôr em espera: peça",
  espera_terceiro: "pôr em espera: terceiro",
  resolver: "marcar como resolvido",
};

/** O que mudar no chamado para cada ação. */
export function mudancaDaAcao(a: AcaoPronta): Record<string, string> {
  if (a === "resolver") return { status: "resolvido" };
  return { status: "aguardando", aguardando_motivo: a.replace("espera_", "") };
}

/** Respostas prontas na ordem escolhida pelo TI. Atualiza em tempo real (um técnico edita, os outros já veem). */
export function useRespostasProntas() {
  const [lista, setLista] = useState<RespostaPronta[] | null>(null);
  const carregar = useCallback(async () => {
    const r = await pb.collection("respostas_prontas").getFullList<RespostaPronta>({ sort: "ordem,created", requestKey: null });
    setLista(r);
  }, []);
  useEffect(() => { carregar().catch(() => setLista([])); }, [carregar]);
  useRealtime("respostas_prontas", () => carregar().catch(() => {}));
  return { lista, recarregar: carregar };
}
