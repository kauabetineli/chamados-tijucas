import { useCallback, useEffect, useState } from "react";
import type { Listas } from "../../lib/automacao";
import { pb, type Categoria, type Setor } from "../../lib/pb";

/** Técnico como GET /api/ti/equipe devolve. */
export interface Tecnico {
  id: string; nome: string; admin: boolean; bloqueado: boolean; ficticio: boolean; carga: number;
  ausente_de: string; ausente_ate: string; ausencia_motivo: string; sem_automatico: boolean;
  ausente_hoje: boolean; disponivel: boolean;
}

/** Equipe do TI (com carga e ausências). */
export function useEquipe() {
  const [equipe, setEquipe] = useState<Tecnico[] | null>(null);
  const [destino, setDestino] = useState<"fica" | "fila">("fica");
  const recarregar = useCallback(() => {
    pb.send<{ equipe: Tecnico[]; destino_ausencia: "fica" | "fila" }>("/api/ti/equipe", {})
      .then((r) => { setEquipe(r.equipe); setDestino(r.destino_ausencia); })
      .catch(() => setEquipe([]));
  }, []);
  useEffect(recarregar, [recarregar]);
  return { equipe, destino, recarregar };
}

/** Categorias (inclusive ocultas) e setores ativos, para montar as regras. */
export function useListas(equipe: Tecnico[] | null) {
  const [categorias, setCategorias] = useState<Categoria[] | null>(null);
  const [setores, setSetores] = useState<Setor[] | null>(null);
  const [respostas, setRespostas] = useState<string[]>([]);
  useEffect(() => {
    pb.collection("categorias").getFullList<Categoria>({ sort: "ordem,nome" }).then(setCategorias).catch(() => setCategorias([]));
    pb.collection("setores").getFullList<Setor>({ sort: "nome" }).then(setSetores).catch(() => setSetores([]));
    pb.collection("respostas_prontas").getFullList<{ texto: string } & { id: string }>({ sort: "ordem,created" })
      .then((r) => setRespostas(r.map((x) => x.texto))).catch(() => {});
  }, []);
  const listas: Listas = {
    categorias: (categorias ?? []).map((c) => ({ v: c.id, rot: c.ativa ? c.nome : `${c.nome} (oculta)` })),
    setores: (setores ?? []).filter((s) => s.ativo !== false).map((s) => ({ v: s.id, rot: s.nome })),
    pessoas: (equipe ?? []).filter((t) => !t.bloqueado).map((t) => ({ v: t.id, rot: t.nome.split(" ")[0] + (t.nome.includes(" ") ? " " + t.nome.split(" ").slice(-1)[0] : "") })),
  };
  return { listas, respostas, pronto: categorias !== null && setores !== null && equipe !== null };
}
