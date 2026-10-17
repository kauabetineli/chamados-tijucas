import { Send } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { ProgressoEnvio } from "../../components/ProgressoEnvio";
import { mensagemErro } from "../../lib/pb";
import { ETAPAS } from "./etapas";
import type { FormularioChamado } from "./useNovoChamado";

/** Computador: tela dividida. Escolhas rápidas à esquerda, escrita e anexos à direita. */
export function Painel({ f }: { f: FormularioChamado }) {
  const navegar = useNavigate();
  const [erro, setErro] = useState("");
  const esquerda = ETAPAS.filter((e) => e.coluna === "esquerda");
  const direita = ETAPAS.filter((e) => e.coluna === "direita");
  const props = { f, modo: "painel" as const, avancar: () => {}, irPara: () => {} };

  // arquivo solto fora da área de anexo não pode fazer o navegador sair da página e perder o texto
  useEffect(() => {
    const bloquear = (e: DragEvent) => { if (e.dataTransfer?.types.includes("Files")) e.preventDefault(); };
    window.addEventListener("dragover", bloquear);
    window.addEventListener("drop", bloquear);
    return () => { window.removeEventListener("dragover", bloquear); window.removeEventListener("drop", bloquear); };
  }, []);

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro("");
    const pendente = ETAPAS.filter((e) => e.coluna).find((e) => !e.pronta(f));
    if (pendente) return setErro(pendente.falta);
    try {
      const c = await f.enviar();
      navegar(`/chamado/${c.id}`, { state: { novo: true } });
    } catch (err) {
      setErro(mensagemErro(err));
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-3xl font-bold">Novo chamado</h1>
        {f.setor && (
          <p className="text-tinta-2">
            Para <span className="font-semibold text-tinta">{f.setor}</span>
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
        <div className="space-y-10 rounded-2xl bg-superficie p-6 ring-1 ring-linha lg:p-8">
          {esquerda.map((e) => <e.Componente key={e.id} {...props} />)}
        </div>
        <div className="space-y-8 rounded-2xl bg-superficie p-6 ring-1 ring-linha lg:p-8">
          {direita.map((e) => <e.Componente key={e.id} {...props} />)}
          {erro && <p role="alert" className="font-semibold text-alerta">{erro}</p>}
          <ProgressoEnvio pct={f.progresso} />
          <button className="btn-primario flex w-full items-center justify-center gap-2 text-lg" disabled={f.enviando || f.preparandoAnexo}>
            <Send className="size-5" aria-hidden="true" />
            {f.enviando ? "Enviando..." : f.preparandoAnexo ? "Preparando anexo..." : "Enviar chamado"}
          </button>
        </div>
      </div>
    </form>
  );
}
