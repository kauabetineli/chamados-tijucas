import { CheckCircle2, Play, RotateCcw, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { ROTULO_PRIORIDADE } from "../lib/formato";
import { mensagemErro, pb, type Chamado, type Prioridade, type Usuario } from "../lib/pb";
import { COR_PRIORIDADE } from "./Selos";

/** Ações do técnico sobre um chamado: atender, priorizar, atribuir e resolver. */
export function PainelTecnico({ chamado: c, aoMudar }: { chamado: Chamado; aoMudar: () => void }) {
  const { usuario } = useAuth();
  const [tecnicos, setTecnicos] = useState<Usuario[]>([]);
  const [resolvendo, setResolvendo] = useState(false);
  const [diagnostico, setDiagnostico] = useState(c.diagnostico);
  const [solucao, setSolucao] = useState(c.solucao);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    pb.collection("users").getFullList<Usuario>({ filter: 'papel = "tecnico"', sort: "name" }).then(setTecnicos).catch(() => {});
  }, []);

  async function salvar(dados: Partial<Chamado>) {
    setErro("");
    setSalvando(true);
    try {
      await pb.collection("chamados").update(c.id, dados);
      setResolvendo(false);
      aoMudar();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-5 rounded-2xl bg-white p-5 ring-1 ring-linha">
      <h2 className="text-xl font-bold">Atendimento</h2>

      {c.status === "aberto" && (
        <button className="btn-primario w-full" disabled={salvando} onClick={() => salvar({ status: "em_andamento", responsavel: c.responsavel || usuario!.id })}>
          <Play className="size-5" aria-hidden="true" /> Começar atendimento
        </button>
      )}

      {c.status === "em_andamento" && !resolvendo && (
        <div className="space-y-2">
          <button className="btn-sucesso w-full" onClick={() => setResolvendo(true)}>
            <CheckCircle2 className="size-5" aria-hidden="true" /> Resolver
          </button>
          <button className="btn-secundario w-full" disabled={salvando} onClick={() => salvar({ status: "aberto", responsavel: "" })}>
            <Undo2 className="size-5" aria-hidden="true" /> Devolver para a fila
          </button>
        </div>
      )}

      {c.status === "resolvido" && (
        <button className="btn-secundario w-full" disabled={salvando} onClick={() => salvar({ status: "aberto" })}>
          <RotateCcw className="size-5" aria-hidden="true" /> Reabrir
        </button>
      )}

      {resolvendo && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            salvar({ status: "resolvido", diagnostico, solucao });
          }}
        >
          <p className="text-sm text-tinta-2">Esses dois campos alimentam o histórico de soluções do TI.</p>
          <div>
            <label htmlFor="diag" className="rotulo">Qual era a causa?</label>
            <textarea id="diag" required className="campo min-h-20" value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} />
          </div>
          <div>
            <label htmlFor="sol" className="rotulo">O que foi feito?</label>
            <textarea id="sol" required className="campo min-h-20" value={solucao} onChange={(e) => setSolucao(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button className="btn-sucesso flex-1" disabled={salvando}>Marcar como resolvido</button>
            <button type="button" className="btn-secundario" onClick={() => setResolvendo(false)}>Cancelar</button>
          </div>
        </form>
      )}

      <fieldset>
        <legend className="rotulo">Prioridade</legend>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(ROTULO_PRIORIDADE) as Prioridade[]).reverse().map((p) => (
            <label key={p} className="opcao min-h-12 py-2">
              <input type="radio" name="prioridade" checked={c.prioridade === p} onChange={() => salvar({ prioridade: p })} className="sr-only" />
              <span className={`size-3 rounded-full ${COR_PRIORIDADE[p]}`} aria-hidden="true" />
              {ROTULO_PRIORIDADE[p]}
            </label>
          ))}
        </div>
        <p className="ajuda">Sugerida pelo impacto informado na abertura.</p>
      </fieldset>

      <div>
        <label htmlFor="resp" className="rotulo">Responsável</label>
        <select id="resp" className="campo" value={c.responsavel} onChange={(e) => salvar({ responsavel: e.target.value })}>
          <option value="">Ninguém ainda</option>
          {tecnicos.map((t) => (
            <option key={t.id} value={t.id}>{t.id === usuario?.id ? `${t.name} (você)` : t.name}</option>
          ))}
        </select>
      </div>

      {erro && <p role="alert" className="font-semibold text-brasa-700">{erro}</p>}
    </div>
  );
}
