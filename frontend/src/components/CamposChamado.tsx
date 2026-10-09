import { useEffect, useState } from "react";
import { ROTULO_IMPACTO } from "../lib/formato";
import { pb, type Categoria, type Impacto } from "../lib/pb";
import { IconeCategoria } from "./Icone";

export function useCategorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  useEffect(() => {
    pb.collection("categorias").getFullList<Categoria>({ filter: "ativa = true", sort: "ordem,nome" }).then(setCategorias).catch(() => {});
  }, []);
  return categorias;
}

export function EscolhaCategoria({ valor, onChange, titulo = "O que está com problema?" }: { valor: string; onChange: (id: string) => void; titulo?: string }) {
  const categorias = useCategorias();
  return (
    <fieldset>
      <legend className="rotulo text-lg">{titulo}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {categorias.map((c) => (
          <label key={c.id} className="opcao flex-col items-start gap-2 sm:min-h-24">
            <input type="radio" name="categoria" value={c.id} checked={valor === c.id} onChange={() => onChange(c.id)} className="sr-only" required />
            <IconeCategoria nome={c.icone} className="size-7 text-mar-700" />
            <span className="leading-tight">{c.nome}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const DETALHE_IMPACTO: Record<Impacto, string> = {
  so_eu: "Consigo continuar trabalhando de outro jeito, ou só eu fui afetado.",
  setor: "Várias pessoas do setor estão sem conseguir trabalhar.",
  publico: "A população está esperando: atendimento, protocolo ou serviço parado.",
};

export function EscolhaImpacto({ valor, onChange }: { valor: Impacto | ""; onChange: (v: Impacto) => void }) {
  return (
    <fieldset>
      <legend className="rotulo text-lg">Quem está sendo afetado?</legend>
      <div className="space-y-2">
        {(Object.keys(ROTULO_IMPACTO) as Impacto[]).map((k) => (
          <label key={k} className="opcao">
            <input type="radio" name="impacto" value={k} checked={valor === k} onChange={() => onChange(k)} className="size-5 shrink-0 accent-mar-700" required />
            <span>
              <span className="block">{ROTULO_IMPACTO[k]}</span>
              <span className="block text-sm font-normal text-tinta-2">{DETALHE_IMPACTO[k]}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
