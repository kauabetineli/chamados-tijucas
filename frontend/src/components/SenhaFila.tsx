import { IconeCategoria } from "./Icone";

interface Props {
  aFrente: number;
  protocolo: string;
  categoria?: string;
  icone?: string;
  /** o pedido, para a pessoa saber qual é o seu */
  descricao?: string;
  /** o TI respondeu depois da última visita */
  novidade?: boolean;
  animar?: boolean;
}

/** A "senha" do chamado na fila: mostra quantos pedidos serão atendidos antes. */
export function SenhaFila({ aFrente, protocolo, categoria, icone, descricao, novidade, animar }: Props) {
  const posicao = aFrente + 1;
  return (
    <div className={`senha flex items-stretch text-noite ${animar ? "animar-chegada" : ""}`}>
      <div className="flex w-[38%] flex-col justify-center py-5 pl-7 pr-3">
        <span className="text-sm font-semibold">Posição na fila</span>
        <span className="font-display text-7xl leading-none font-extrabold tracking-tight">
          {posicao}
          <span className="align-top text-3xl">º</span>
        </span>
      </div>
      <div className="senha-picote flex flex-1 flex-col justify-center gap-1 py-5 pl-5 pr-7">
        <p className="text-lg leading-snug font-bold">
          {aFrente === 0 ? "O seu é o próximo a ser atendido." : `${aFrente} ${aFrente === 1 ? "chamado" : "chamados"} antes do seu.`}
        </p>
        {descricao && <p className="line-clamp-2 text-sm leading-snug italic">“{descricao}”</p>}
        <p className="flex flex-wrap items-center gap-x-1.5 text-sm">
          <IconeCategoria nome={icone} className="size-4 shrink-0" />
          {categoria}
          <span aria-hidden="true">·</span>
          <span className="font-display font-bold whitespace-nowrap">{protocolo}</span>
        </p>
        {novidade && (
          <p className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-noite px-2.5 py-0.5 text-xs font-bold text-sol">
            <span className="size-2 rounded-full bg-sol" aria-hidden="true" /> Nova resposta do TI
          </p>
        )}
      </div>
    </div>
  );
}
