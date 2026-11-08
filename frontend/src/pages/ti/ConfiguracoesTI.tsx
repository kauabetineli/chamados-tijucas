import { AbasPagina, CabecalhoPagina } from "../../components/CabecalhoPagina";
import { ListOrdered, Shapes, Users, Workflow } from "lucide-react";
import { useState } from "react";
import { Navigate, useSearchParams } from "react-router";
import { Automacao } from "../../features/configuracoes/Automacao";
import { Categorias } from "../../features/configuracoes/Categorias";
import { useEquipe, useListas } from "../../features/configuracoes/dados";
import { Equipe } from "../../features/configuracoes/Equipe";
import { FilaAtendimento } from "../../features/configuracoes/FilaAtendimento";
import { useAuth } from "../../lib/auth";
import { ehAdmin, ehObservador } from "../../lib/pb";

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

  // observador (equipe do Dino Desk): vê as configurações, com tudo travado
  const soLeitura = ehObservador(usuario);
  if (!ehAdmin(usuario) && !soLeitura) return <Navigate to="/ti" replace />;

  const ir = (id: Aba) => {
    setAbertas((s) => new Set(s).add(id));
    setParams(id === "automacao" ? {} : { aba: id }, { replace: true });
  };

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Configurações"
        subtitulo={soLeitura ? "Só leitura: você vê como está configurado, sem mudar." : undefined}
        abas={<AbasPagina rotulo="Configurações" itens={ABAS.map((a) => ({
          rotulo: <><a.I className="size-4" aria-hidden="true" /><span className="md:hidden">{a.curto}</span><span className="hidden md:inline">{a.rotulo}</span></>,
          ativo: aba === a.id,
          aoClicar: () => ir(a.id),
        }))} />}
      />
      {ABAS.map((a) => (abertas.has(a.id) || aba === a.id) && (
        <div key={a.id} id={`painel-${a.id}`} hidden={aba !== a.id} aria-label={a.rotulo} className={a.id === "automacao" ? "" : "max-w-[76rem]"}>
          <fieldset disabled={soLeitura} className="min-w-0">
          {a.id === "automacao" && <Automacao equipe={equipe} listas={listas} respostas={respostas} pronto={pronto} />}
          {a.id === "equipe" && <Equipe equipe={equipe} recarregar={recarregar} />}
          {a.id === "categorias" && <Categorias />}
          {a.id === "fila" && <FilaAtendimento />}
          </fieldset>
        </div>
      ))}
    </div>
  );
}
