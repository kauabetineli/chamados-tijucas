import { ListOrdered, Shapes, Users, Workflow } from "lucide-react";
import { useState } from "react";
import { Navigate, useSearchParams } from "react-router";
import { Automacao } from "../../features/configuracoes/Automacao";
import { Categorias } from "../../features/configuracoes/Categorias";
import { useEquipe, useListas } from "../../features/configuracoes/dados";
import { Equipe } from "../../features/configuracoes/Equipe";
import { FilaAtendimento } from "../../features/configuracoes/FilaAtendimento";
import { useAuth } from "../../lib/auth";
import { ehAdmin } from "../../lib/pb";

const ABAS = [
  { id: "automacao", rotulo: "Automação dos chamados", curto: "Automação", I: Workflow },
  { id: "equipe", rotulo: "Equipe e ausências", curto: "Equipe", I: Users },
  { id: "categorias", rotulo: "Categorias", curto: "Categorias", I: Shapes },
  { id: "fila", rotulo: "Fila e atendimento", curto: "Fila", I: ListOrdered },
] as const;
type Aba = (typeof ABAS)[number]["id"];

/**
 * Configurações do TI (só o administrador): automação, equipe e ausências, categorias e a fila.
 * As abas já abertas continuam montadas (escondidas): trocar de aba não perde o que não foi salvo.
 */
export function ConfiguracoesTI() {
  const { usuario } = useAuth();
  const [params, setParams] = useSearchParams();
  const pedida = params.get("aba");
  const aba: Aba = ABAS.some((a) => a.id === pedida) ? (pedida as Aba) : "automacao";
  const [abertas, setAbertas] = useState<Set<Aba>>(() => new Set([aba]));
  const { equipe, recarregar } = useEquipe();
  const { listas, respostas, pronto } = useListas(equipe);

  if (!ehAdmin(usuario)) return <Navigate to="/ti" replace />;

  const ir = (id: Aba) => {
    setAbertas((s) => new Set(s).add(id));
    setParams(id === "automacao" ? {} : { aba: id }, { replace: true });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold">Configurações do TI</h1>
        <p className="mt-1 text-tinta-2">Como os chamados chegam, para quem vão e em que ordem são atendidos.</p>
      </div>
      <div role="tablist" aria-label="Configurações" className="sem-barra -mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:w-fit md:rounded-xl md:bg-superficie md:p-1 md:ring-1 md:ring-linha">
        {ABAS.map((a) => (
          <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} aria-controls={`painel-${a.id}`} onClick={() => ir(a.id)}
            className={`flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-4 font-semibold ${aba === a.id ? "bg-mar-700 text-white" : "text-tinta-2 ring-1 ring-linha hover:bg-fundo hover:text-tinta md:ring-0"}`}>
            <a.I className="size-4" aria-hidden="true" />
            <span className="md:hidden">{a.curto}</span><span className="hidden md:inline">{a.rotulo}</span>
          </button>
        ))}
      </div>
      {ABAS.map((a) => (abertas.has(a.id) || aba === a.id) && (
        <div key={a.id} id={`painel-${a.id}`} role="tabpanel" hidden={aba !== a.id} aria-label={a.rotulo}>
          {a.id === "automacao" && <Automacao equipe={equipe} listas={listas} respostas={respostas} pronto={pronto} />}
          {a.id === "equipe" && <Equipe equipe={equipe} recarregar={recarregar} />}
          {a.id === "categorias" && <Categorias />}
          {a.id === "fila" && <FilaAtendimento />}
        </div>
      ))}
    </div>
  );
}
