import { IconeCategoria } from "./Icone";

interface Props {
  aFrente: number;
  protocolo: string;
  categoria?: string;
  icone?: string;
  animar?: boolean;
}

/** A "senha" do chamado na fila: mostra quantos pedidos serão atendidos antes. */
export function SenhaFila({ aFrente, protocolo, categoria, icone, animar }: Props) {
  const posicao = aFrente + 1;
  return (
    <div className={`senha flex items-stretch text-tinta ${animar ? "animar-chegada" : ""}`}>
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
        <p className="flex items-center gap-1.5 text-sm">
          <IconeCategoria nome={icone} className="size-4 shrink-0" />
          {categoria}
        </p>
        <p className="font-display text-sm font-bold whitespace-nowrap">{protocolo}</p>
      </div>
    </div>
  );
}
