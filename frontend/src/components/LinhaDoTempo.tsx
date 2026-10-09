import { Lock, Send } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { dataHora } from "../lib/formato";
import { ehTecnico, mensagemErro, pb, type Interacao } from "../lib/pb";
import { useRealtime } from "../lib/useRealtime";

export function LinhaDoTempo({ chamadoId, solicitanteId }: { chamadoId: string; solicitanteId: string }) {
  const { usuario } = useAuth();
  const tecnico = ehTecnico(usuario);
  const [itens, setItens] = useState<Interacao[]>([]);
  const [texto, setTexto] = useState("");
  const [interno, setInterno] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    const lista = await pb.collection("interacoes").getFullList<Interacao>({
      filter: pb.filter("chamado = {:id}", { id: chamadoId }),
      sort: "created",
      expand: "autor",
    });
    setItens(lista);
  }, [chamadoId]);

  useEffect(() => { carregar().catch(() => {}); }, [carregar]);
  useRealtime("interacoes", () => carregar().catch(() => {}));

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    setEnviando(true);
    setErro("");
    try {
      await pb.collection("interacoes").create({ chamado: chamadoId, texto, interno: tecnico && interno });
      setTexto("");
      setInterno(false);
      await carregar();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section aria-labelledby="titulo-conversa">
      <h2 id="titulo-conversa" className="mb-3 text-xl font-bold">Conversa e andamento</h2>
      <ol className="space-y-3">
        {itens.map((i) => {
          if (i.tipo !== "comentario") {
            return (
              <li key={i.id} className="flex gap-2 text-sm text-tinta-2">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-linha" aria-hidden="true" />
                <span>
                  {i.texto}
                  {i.expand?.autor && <> ({i.expand.autor.name})</>}
                  <span className="ml-1 whitespace-nowrap">{dataHora(i.created)}</span>
                </span>
              </li>
            );
          }
          const doSolicitante = i.autor === solicitanteId;
          return (
            <li key={i.id} className={`flex ${doSolicitante ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  i.interno
                    ? "border-2 border-dashed border-tinta-2/40 bg-white"
                    : doSolicitante
                      ? "bg-white ring-1 ring-linha"
                      : "bg-mar-50"
                }`}
              >
                <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
                  {i.interno && <Lock className="size-4" aria-label="Nota interna" />}
                  {i.expand?.autor?.name ?? "Usuário"}
                  {!doSolicitante && !i.interno && <span className="font-normal text-tinta-2">(TI)</span>}
                </p>
                <p className="whitespace-pre-wrap">{i.texto}</p>
                <p className="mt-1 text-xs text-tinta-2">{dataHora(i.created)}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <form onSubmit={enviar} className="mt-4 space-y-2">
        <label htmlFor="mensagem" className="sr-only">Mensagem</label>
        <textarea
          id="mensagem"
          className="campo min-h-24"
          placeholder={tecnico ? "Escreva para o solicitante" : "Escreva para o TI"}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-3">
          {tecnico && (
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={interno} onChange={(e) => setInterno(e.target.checked)} className="size-5 accent-mar-700" />
              Nota interna (só o TI vê)
            </label>
          )}
          <button className="btn-primario ml-auto" disabled={enviando || !texto.trim()}>
            <Send className="size-5" aria-hidden="true" /> Enviar mensagem
          </button>
        </div>
        {erro && <p className="text-sm font-semibold text-brasa-700">{erro}</p>}
      </form>
    </section>
  );
}
