import { useEffect, useState } from "react";
import { emCache } from "./cache";
import { pb, type Chamado, type Usuario, type Setor } from "./pb";

/** Técnicos do TI (papel = "tecnico"), em ordem alfabética. */
export function useTecnicos() {
  const [tecnicos, setTecnicos] = useState<Usuario[]>([]);
  useEffect(() => {
    emCache("tecnicos", () => pb.collection("users").getFullList<Usuario>({ filter: 'papel = "tecnico"', sort: "name" }))
      .then(setTecnicos).catch(() => {});
  }, []);
  return tecnicos;
}

/** Setores (todos, em ordem alfabética), com cache curto. */
export function useSetores() {
  const [setores, setSetores] = useState<Setor[]>([]);
  useEffect(() => {
    emCache("setores", () => pb.collection("setores").getFullList<Setor>({ sort: "nome" })).then(setSetores).catch(() => {});
  }, []);
  return setores;
}

/** "Kauã Betineli Correia" → "KC". */
export function iniciais(nome?: string) {
  const partes = (nome || "?").trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "?") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

// cores de avatar com texto branco legível; nenhuma vermelha (vermelho = urgente)
const CORES = ["#00658c", "#006b34", "#6b3fa0", "#8a5300", "#2f4f8f", "#0f6b6b", "#7a2e5a", "#113227"];

/** Cor fixa por pessoa (a mesma em todas as telas). */
export function corDe(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CORES[h % CORES.length];
}

/**
 * Atribui o chamado a um técnico, ou devolve para a fila (tecnicoId = "").
 * Devolver um chamado em andamento volta ele para "aberto".
 * A troca fica registrada na linha do tempo pelo servidor.
 */
export async function atribuir(c: Chamado, tecnicoId: string) {
  const dados: Partial<Chamado> = { responsavel: tecnicoId };
  if (!tecnicoId && c.status === "em_andamento") dados.status = "aberto";
  return pb.collection("chamados").update<Chamado>(c.id, dados);
}
