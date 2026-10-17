import { Send } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { ProgressoEnvio } from "../../components/ProgressoEnvio";
import { ROTULO_IMPACTO } from "../../lib/formato";
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

  // resumo do que já foi escolhido, na barra do botão (some o que ainda falta)
  const resumo = [
    f.categoriaEscolhida?.nome,
    f.impacto ? ROTULO_IMPACTO[f.impacto] : "",
    f.arquivos.length ? `${f.arquivos.length} ${f.arquivos.length === 1 ? "anexo" : "anexos"}` : "",
  ].filter(Boolean);

  return (
    <form onSubmit={enviar} className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-3xl font-bold">Novo chamado</h1>
        {f.setor && (
          <p className="text-tinta-2">
            Para <span className="font-semibold text-tinta">{f.setor}</span>
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-8">
        <div className="space-y-7 rounded-2xl bg-superficie p-6 ring-1 ring-linha">
          {esquerda.map((e) => <e.Componente key={e.id} {...props} />)}
        </div>
        <div className="space-y-6 rounded-2xl bg-superficie p-6 ring-1 ring-linha">
          {direita.map((e) => <e.Componente key={e.id} {...props} />)}
        </div>
      </div>

      {/* barra do envio: presa no pé da tela, o botão nunca some (monitor pequeno, muitos anexos) */}
      <div className="sticky bottom-4 z-10 rounded-2xl bg-superficie/95 p-3 shadow-lg ring-1 ring-linha backdrop-blur">
        <div className="mb-2 px-2 empty:hidden"><ProgressoEnvio pct={f.progresso} /></div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 pl-2 text-sm">
            {erro ? (
              <span role="alert" className="font-semibold text-alerta">{erro}</span>
            ) : resumo.length ? (
              <span className="font-semibold">{resumo.join(" · ")}</span>
            ) : (
              <span className="text-tinta-2">Escolha o problema, conte o que acontece e diga quem é afetado.</span>
            )}
          </p>
          <button className="btn-primario px-6 text-lg" disabled={f.enviando || f.preparandoAnexo}>
            <Send className="size-5" aria-hidden="true" />
            {f.enviando ? "Enviando..." : f.preparandoAnexo ? "Preparando anexo..." : "Enviar chamado"}
          </button>
        </div>
      </div>
    </form>
  );
}
