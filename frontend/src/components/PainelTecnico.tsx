import { CheckCircle2, Hourglass, Play, RotateCcw, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useAuth } from "../lib/auth";
import { paraData, ROTULO_AGUARDANDO, ROTULO_PRIORIDADE, tempoRelativo } from "../lib/formato";
import { mensagemErro, pb, type Chamado, type Prioridade, type Usuario } from "../lib/pb";
import { EscolhaEspera } from "./EscolhaEspera";
import { COR_PRIORIDADE } from "./Selos";

/** Ações do técnico sobre um chamado: atender, priorizar, atribuir e resolver. */
export function PainelTecnico({ chamado: c, aoMudar }: { chamado: Chamado; aoMudar: () => void }) {
  const { usuario } = useAuth();
  const [tecnicos, setTecnicos] = useState<Usuario[]>([]);
  const [params] = useSearchParams();
  // vindo do "Resolver..." das ações rápidas da fila: já abre o formulário
  const emAtendimento = c.status === "em_andamento" || c.status === "aguardando";
  const [resolvendo, setResolvendo] = useState(params.get("resolver") === "1" && emAtendimento);
  const [esperar, setEsperar] = useState(false);
  const formResolver = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resolvendo) formResolver.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [resolvendo]);
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
      setEsperar(false);
      aoMudar();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-5 rounded-2xl bg-superficie p-5 ring-1 ring-linha">
      <h2 className="text-xl font-bold">Atendimento</h2>

      {c.status === "aberto" && (
        <button className="btn-primario w-full" disabled={salvando} onClick={() => salvar({ status: "em_andamento", responsavel: c.responsavel || usuario!.id })}>
          <Play className="size-5" aria-hidden="true" /> Começar atendimento
        </button>
      )}

      {c.status === "aguardando" && c.aguardando_motivo && (
        <div className="space-y-3 rounded-xl bg-fundo p-3 ring-1 ring-linha">
          <p className="flex items-start gap-2 text-sm">
            <Hourglass className="mt-0.5 size-4 shrink-0 text-acento" aria-hidden="true" />
            <span>
              <b>Em espera:</b> aguardando {ROTULO_AGUARDANDO[c.aguardando_motivo]}
              {paraData(c.aguardando_desde || "") && <span className="text-tinta-2"> · {tempoRelativo(c.aguardando_desde!)}</span>}
              {c.aguardando_motivo === "solicitante" && <span className="block text-tinta-2">Volta sozinho para atendimento quando a pessoa responder.</span>}
            </span>
          </p>
          <EscolhaEspera nome="motivo-painel" valor={c.aguardando_motivo} desabilitado={salvando} aoEscolher={(m) => salvar({ aguardando_motivo: m })} />
          <button className="btn-primario w-full" disabled={salvando} onClick={() => salvar({ status: "em_andamento" })}>
            <Play className="size-5" aria-hidden="true" /> Retomar atendimento
          </button>
        </div>
      )}

      {emAtendimento && !resolvendo && (
        <div className="space-y-2">
          <button className="btn-sucesso w-full" onClick={() => setResolvendo(true)}>
            <CheckCircle2 className="size-5" aria-hidden="true" /> Resolver
          </button>
          {c.status === "em_andamento" && (esperar ? (
            <div className="space-y-2 rounded-xl p-3 ring-1 ring-linha">
              <p className="text-sm font-semibold">Está aguardando o quê?</p>
              <EscolhaEspera nome="motivo-novo" valor="" desabilitado={salvando} aoEscolher={(m) => salvar({ status: "aguardando", aguardando_motivo: m })} />
              <button type="button" className="btn w-full min-h-10 text-sm text-tinta-2" onClick={() => setEsperar(false)}>Cancelar</button>
            </div>
          ) : (
            <button className="btn-secundario w-full" disabled={salvando} onClick={() => setEsperar(true)}>
              <Hourglass className="size-5" aria-hidden="true" /> Pôr em espera
            </button>
          ))}
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
          ref={formResolver}
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

      {erro && <p role="alert" className="font-semibold text-alerta">{erro}</p>}
    </div>
  );
}
