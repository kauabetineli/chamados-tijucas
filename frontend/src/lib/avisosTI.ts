import { useCallback, useEffect, useState } from "react";
import { pb, type Usuario } from "./pb";
import { useRealtime } from "./useRealtime";

/** Aviso do mural do TI (coleção "avisos", migration 1760000008). */
export interface AvisoTI {
  id: string;
  texto: string;
  tipo: "info" | "problema";
  /** some depois desta data/hora ("" = até alguém encerrar) */
  ate: string;
  autor: string;
  created: string;
  expand?: { autor?: Usuario };
}

/** Data do PocketBase ("2026-10-17 15:00:00.000Z") para ISO. */
const iso = (d: Date) => d.toISOString().replace("T", " ");

/** Avisos em vigor (sem prazo ou com prazo no futuro), os de problema primeiro. Atualiza em tempo real. */
export function useAvisosTI() {
  const [avisos, setAvisos] = useState<AvisoTI[] | null>(null);
  const carregar = useCallback(async () => {
    const lista = await pb.collection("avisos").getFullList<AvisoTI>({
      filter: pb.filter('ate = "" || ate > {:agora}', { agora: iso(new Date()) }),
      sort: "-created",
      expand: "autor",
      requestKey: "avisos-ti",
    });
    lista.sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === "problema" ? -1 : 1));
    setAvisos(lista);
  }, []);
  useEffect(() => {
    carregar().catch(() => setAvisos([]));
    // um aviso pode vencer com a tela aberta: confere de minuto em minuto
    const t = window.setInterval(() => carregar().catch(() => {}), 60_000);
    return () => window.clearInterval(t);
  }, [carregar]);
  useRealtime("avisos", () => carregar().catch(() => {}));
  return avisos;
}

export const PRAZOS = [
  { id: "1h", rotulo: "1 hora" },
  { id: "4h", rotulo: "4 horas" },
  { id: "dia", rotulo: "Até o fim do dia" },
  { id: "3d", rotulo: "3 dias" },
  { id: "sem", rotulo: "Até eu encerrar" },
] as const;
export type Prazo = (typeof PRAZOS)[number]["id"];

/** Converte a escolha de prazo em data (ou "" para sem prazo). */
export function dataDoPrazo(p: Prazo): string {
  const d = new Date();
  if (p === "1h") d.setHours(d.getHours() + 1);
  else if (p === "4h") d.setHours(d.getHours() + 4);
  else if (p === "dia") d.setHours(23, 59, 0, 0);
  else if (p === "3d") d.setDate(d.getDate() + 3);
  else return "";
  return iso(d);
}

export async function publicarAviso(texto: string, tipo: AvisoTI["tipo"], prazo: Prazo, autor: string) {
  return pb.collection("avisos").create({ texto, tipo, ate: dataDoPrazo(prazo), autor });
}

/** Encerrar = o prazo vira agora (o aviso some, mas fica registrado). */
export async function encerrarAviso(id: string) {
  return pb.collection("avisos").update(id, { ate: iso(new Date(Date.now() - 1000)) });
}
