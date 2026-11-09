import { useEffect, useState } from "react";
import { ROTULO_IMPACTO } from "../lib/formato";
import { emCache } from "../lib/cache";
import { pb, type Categoria, type Impacto } from "../lib/pb";
import { Dica } from "./Dica";
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
  valor, onChange, aoTocar, titulo = "O que está com problema?", grande, classeGrade = "grid-cols-2 sm:grid-cols-4", horizontal,
}: PropsEscolha<string> & { horizontal?: boolean }) {
  const categorias = useCategorias();
  return (
    <fieldset>
      <legend className={grande ? CLASSE_TITULO_GRANDE : "rotulo text-lg"}>{titulo}</legend>
      {/* auto-rows-fr: todos os quadros com a mesma altura (um nome de 2 linhas não deixa a linha dele maior).
          Celular: ícone ao lado do nome, quadros baixos; a partir de sm, ícone em cima */}
      <div className={`grid auto-rows-fr gap-2 ${classeGrade}`}>
        {categorias.map((c) => (
          <label key={c.id} className={horizontal ? "opcao min-h-13 gap-3 py-2.5" : "opcao gap-2.5 px-3 py-2 text-[15px] sm:min-h-24 sm:flex-col sm:items-start sm:gap-2 sm:px-4 sm:py-3 sm:text-base"}>
            <input
              type="radio" name="categoria" value={c.id} checked={valor === c.id} className="sr-only" required
              onChange={() => onChange(c.id)}
              onClick={() => aoTocar?.(c.id)}
            />
            <IconeCategoria nome={c.icone} className={horizontal ? "size-8" : "size-8 shrink-0 sm:size-10"} />
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
  valor, onChange, aoTocar, titulo = "Quem está sendo afetado?", grande, lado,
}: PropsEscolha<Impacto> & { lado?: boolean }) {
  const dica = (
    <Dica rotulo="Quando é urgente">
      Atendimento ao público parado entra como urgente e passa na frente da fila. Use só quando a população está esperando.
    </Dica>
  );
  return (
    <fieldset>
      <legend className={`${grande ? CLASSE_TITULO_GRANDE : "rotulo text-lg"} flex items-center gap-2`}>{titulo} {dica}</legend>
      {/* lado: as 3 opções lado a lado (tela dividida do computador), para economizar altura */}
      <div className={lado ? "grid gap-2 xl:grid-cols-3" : "space-y-2"}>
        {(Object.keys(ROTULO_IMPACTO) as Impacto[]).map((k) => (
          <label key={k} className={lado ? "opcao items-start py-2.5" : "opcao"}>
            <input
              type="radio" name="impacto" value={k} checked={valor === k} className="size-5 shrink-0 accent-acento" required
              onChange={() => onChange(k)}
              onClick={() => aoTocar?.(k)}
            />
            <span>
              <span className="block">{ROTULO_IMPACTO[k]}</span>
              <span className={`block font-normal text-tinta-2 ${lado ? "text-xs" : "text-sm"}`}>{DETALHE_IMPACTO[k]}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
