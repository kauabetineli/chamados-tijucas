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
      {/* celular: bilhete mais baixo; o "º" fica colado no número (nowrap) e a coluna cresce com ele (2 ou 3 dígitos, texto Maior) */}
      <div className="flex min-w-[30%] shrink-0 flex-col justify-center py-3.5 pr-3 pl-5 md:w-[38%] md:py-5 md:pr-3 md:pl-7">
        <span className="text-xs leading-tight font-semibold md:text-sm">Posição na fila</span>
        <span className={`mt-0.5 font-display leading-none font-extrabold tracking-tight whitespace-nowrap md:text-7xl ${posicao >= 100 ? "text-4xl" : "text-5xl"}`}>
          {posicao}
          <span className="align-top text-2xl md:text-3xl">º</span>
        </span>
      </div>
      <div className="senha-picote flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-3.5 pr-5 pl-4 md:gap-1 md:py-5 md:pr-7 md:pl-5">
        <p className="leading-snug font-bold md:text-lg">
          {aFrente === 0 ? "O seu é o próximo a ser atendido." : `${aFrente} ${aFrente === 1 ? "chamado" : "chamados"} antes do seu.`}
        </p>
        {descricao && <p className="line-clamp-1 text-sm leading-snug italic md:line-clamp-2">“{descricao}”</p>}
        <p className="flex flex-wrap items-center gap-x-1.5 text-sm">
          <IconeCategoria nome={icone} className="size-4 md:size-5" />
          {categoria}
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
