import { useCallback, useEffect, useState } from "react";
import { pb, type Usuario } from "./pb";
import { useRealtime } from "./useRealtime";

/** Aviso do mural do TI (coleção "avisos", migration 1760000008). */
export interface AvisoTI {
  id: string;
  texto: string;
  /** "resolvido": o recado de que o problema acabou (publicado ao encerrar um aviso de problema) */
  tipo: "info" | "problema" | "resolvido";
  /** some depois desta data/hora ("" = até alguém encerrar) */
  ate: string;
  autor: string;
  created: string;
  /** "Também estou sem": total e se eu já toquei (a lista de quem tocou só o TI recebe) */
  tambem_total?: number;
  tambem_eu?: boolean;
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
  { id: "1h", rotulo: "1 h" },
  { id: "2h", rotulo: "2 h" },
  { id: "dia", rotulo: "Fim do dia" },
  { id: "3d", rotulo: "3 dias" },
  { id: "sem", rotulo: "Quando eu encerrar" },
] as const;
export type Prazo = (typeof PRAZOS)[number]["id"];

/** Converte a escolha de prazo em data (ou "" para sem prazo). */
export function dataDoPrazo(p: Prazo): string {
  const d = new Date();
  if (p === "1h") d.setHours(d.getHours() + 1);
  else if (p === "2h") d.setHours(d.getHours() + 2);
  else if (p === "dia") d.setHours(23, 59, 0, 0);
  else if (p === "3d") d.setDate(d.getDate() + 3);
  else return "";
  return iso(d);
}

/**
 * Modelos prontos do "Avisar todos": o texto e o tipo já vêm prontos; [entre colchetes] é o que falta completar
 * (o campo já abre com esse trecho selecionado).
 */
export const MODELOS: { id: string; rotulo: string; tipo: AvisoTI["tipo"]; prazo: Prazo; texto: string }[] = [
  { id: "internet", rotulo: "Internet fora do ar", tipo: "problema", prazo: "2h",
    texto: "A internet está fora do ar em [onde?]. Já estamos resolvendo; não precisa abrir chamado." },
  { id: "sistema", rotulo: "Sistema parado", tipo: "problema", prazo: "2h",
    texto: "O sistema [qual?] está parado. Já estamos verificando; não precisa abrir chamado." },
  { id: "impressoras", rotulo: "Impressoras", tipo: "problema", prazo: "2h",
    texto: "As impressoras de [onde?] estão com problema. Já estamos resolvendo; não precisa abrir chamado." },
  { id: "manutencao", rotulo: "Manutenção programada", tipo: "info", prazo: "3d",
    texto: "Manutenção programada em [dia e hora]. Alguns sistemas podem ficar fora do ar." },
];

/** "some em 1h52" / "some às 18:00" / "" (sem prazo). */
export function someEm(ate: string): string {
  if (!ate) return "";
  const d = new Date(ate.replace(" ", "T"));
  const min = Math.round((d.getTime() - Date.now()) / 60000);
  if (min <= 0) return "";
  if (min < 60) return `some em ${min} min`;
  if (min < 12 * 60) return `some em ${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
  return `some em ${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
}

/** Servidor: "Também estou com esse problema" (de novo = desfaz). */
export async function tambemEstou(id: string, sim: boolean) {
  return pb.send<{ total: number; eu: boolean }>(`/api/avisos/${id}/tambem`, { method: sim ? "POST" : "DELETE" });
}

export async function publicarAviso(texto: string, tipo: AvisoTI["tipo"], prazo: Prazo, autor: string) {
  return pb.collection("avisos").create({ texto, tipo, ate: dataDoPrazo(prazo), autor });
}

/** Encerrar = o prazo vira agora (o aviso some, mas fica registrado). */
/** Encerra pelo servidor: resolve os chamados ligados e publica o recado de resolvido para todos. */
export function encerrarAvisoCompleto(id: string, corpo: { resolver: boolean; mensagem: string }) {
  return pb.send<{ resolvidos: number; aviso_resolvido: string; pessoas: number }>(`/api/avisos/${id}/encerrar`, { method: "POST", body: corpo });
}

export async function encerrarAviso(id: string) {
  return pb.collection("avisos").update(id, { ate: iso(new Date(Date.now() - 1000)) });
}
