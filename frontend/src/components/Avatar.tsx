import { corDe, iniciais } from "../lib/equipe";

/** Bolinha com as iniciais e a cor fixa do técnico. `destaque` = é você (contorno). */
export function Avatar({ id, nome, tamanho = "md", destaque }: {
  id: string;
  nome?: string;
  tamanho?: "sm" | "md" | "lg";
  destaque?: boolean;
}) {
  const t = { sm: "size-7 text-xs", md: "size-9 text-sm", lg: "size-11 text-base" }[tamanho];
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-bold text-white ${t} ${destaque ? "ring-2 ring-sol ring-offset-2 ring-offset-superficie" : ""}`}
      style={{ backgroundColor: corDe(id) }}
      title={nome}
      aria-hidden="true"
    >
      {iniciais(nome)}
    </span>
  );
}

/** Selo de chamado sem dono. */
export function SeloLivre() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-dashed border-linha px-2.5 py-0.5 text-sm font-semibold text-tinta-2">
      Livre
    </span>
  );
}
