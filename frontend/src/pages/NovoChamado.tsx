import { Assistente } from "../features/novo-chamado/Assistente";
import { Painel } from "../features/novo-chamado/Painel";
import { useNovoChamado } from "../features/novo-chamado/useNovoChamado";
import { useMediaQuery } from "../lib/useMediaQuery";

/**
 * Abrir chamado. As etapas ficam em features/novo-chamado/etapas.tsx.
 * Celular: passo a passo. Computador (768 px ou mais): tela dividida.
 */
export function NovoChamado() {
  const f = useNovoChamado();
  const computador = useMediaQuery("(min-width: 768px)");
  return computador ? <Painel f={f} /> : <Assistente f={f} />;
}
