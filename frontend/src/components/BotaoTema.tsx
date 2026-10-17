import { Monitor, Moon, Sun } from "lucide-react";
import { useTema, type Tema } from "../lib/tema";

const PROXIMO: Record<Tema, Tema> = { auto: "claro", claro: "escuro", escuro: "auto" };
const INFO: Record<Tema, { rotulo: string; Icone: typeof Sun }> = {
  auto: { rotulo: "automático", Icone: Monitor },
  claro: { rotulo: "claro", Icone: Sun },
  escuro: { rotulo: "escuro", Icone: Moon },
};

/** Alterna o tema: automático (segue o aparelho) → claro → escuro. */
export function BotaoTema({ className = "" }: { className?: string }) {
  const [tema, setTema] = useTema();
  const { rotulo, Icone } = INFO[tema];
  return (
    <button
      type="button"
      onClick={() => setTema(PROXIMO[tema])}
      className={`grid size-10 place-items-center rounded-lg text-tinta-2 hover:bg-mar-50 hover:text-tinta ${className}`}
      aria-label={`Tema ${rotulo}. Tocar para mudar`}
      title={`Tema ${rotulo}`}
    >
      <Icone className="size-5" aria-hidden="true" />
    </button>
  );
}
