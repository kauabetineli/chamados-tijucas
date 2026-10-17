import { useCallback, useEffect, useState } from "react";
import { pb } from "./pb";
import { useRealtime } from "./useRealtime";

/** Resposta pronta do TI (coleção "respostas_prontas", migration 1760000009). Só técnicos leem e editam. */
export interface RespostaPronta {
  id: string;
  texto: string;
  ordem: number;
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
