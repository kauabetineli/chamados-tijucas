import { useEffect, useState } from "react";
import { ROTULO_IMPACTO } from "../lib/formato";
import { emCache } from "../lib/cache";
import { pb, type Categoria, type Impacto } from "../lib/pb";
import { IconeCategoria } from "./Icone";

export function useCategorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  useEffect(() => {
    emCache("categorias", () => pb.collection("categorias").getFullList<Categoria>({ filter: "ativa = true", sort: "ordem,nome" }))
      .then(setCategorias).catch(() => {});
  }, []);
  return categorias;
}

interface PropsEscolha<T> {
  valor: T | "";
  onChange: (v: T) => void;
  /** chamado a cada toque, mesmo na opção já marcada (o passo a passo usa para avançar) */
  aoTocar?: (v: T) => void;
  titulo?: string;
  /** título grande, de tela inteira (passo a passo no celular) */
  grande?: boolean;
  /** classes da grade de opções (a tela dividida usa menos colunas) */
  classeGrade?: string;
}

const CLASSE_TITULO_GRANDE = "mb-5 font-display text-2xl font-bold";

export function EscolhaCategoria({
  valor, onChange, aoTocar, titulo = "O que está com problema?", grande, classeGrade = "grid-cols-2 sm:grid-cols-4",
}: PropsEscolha<string>) {
  const categorias = useCategorias();
  return (
    <fieldset>
      <legend className={grande ? CLASSE_TITULO_GRANDE : "rotulo text-lg"}>{titulo}</legend>
      <div className={`grid gap-2 ${classeGrade}`}>
        {categorias.map((c) => (
          <label key={c.id} className="opcao flex-col items-start gap-2 sm:min-h-24">
            <input
              type="radio" name="categoria" value={c.id} checked={valor === c.id} className="sr-only" required
              onChange={() => onChange(c.id)}
              onClick={() => aoTocar?.(c.id)}
            />
            <IconeCategoria nome={c.icone} className="size-7 text-acento" />
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

export function EscolhaImpacto({
  valor, onChange, aoTocar, titulo = "Quem está sendo afetado?", grande,
}: PropsEscolha<Impacto>) {
  return (
    <fieldset>
      <legend className={grande ? CLASSE_TITULO_GRANDE : "rotulo text-lg"}>{titulo}</legend>
      <div className="space-y-2">
        {(Object.keys(ROTULO_IMPACTO) as Impacto[]).map((k) => (
          <label key={k} className="opcao">
            <input
              type="radio" name="impacto" value={k} checked={valor === k} className="size-5 shrink-0 accent-acento" required
              onChange={() => onChange(k)}
              onClick={() => aoTocar?.(k)}
            />
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
