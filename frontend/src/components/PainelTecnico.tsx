import { CheckCircle2, ChevronDown, Hourglass, MoreHorizontal, Play, RotateCcw, Undo2, UserRound } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { useAuth } from "../lib/auth";
import { avisar } from "../lib/avisos";
import { paraData, ROTULO_AGUARDANDO, ROTULO_PRIORIDADE, tempoRelativo } from "../lib/formato";
import { mensagemErro, pb, type Chamado, type Prioridade, type Usuario } from "../lib/pb";
import { EscolhaEspera } from "./EscolhaEspera";
import { RegistroSolucao } from "./RegistroSolucao";
import { COR_PRIORIDADE } from "./Selos";

/**
 * Ações do técnico sobre um chamado: atender, priorizar, atribuir e resolver.
 * `linha` (gaveta do chamado no PC): as ações numa linha só, com prioridade e responsável em seletores compactos.
 */
export function PainelTecnico({ chamado: c, aoMudar, linha }: { chamado: Chamado; aoMudar: () => void; linha?: boolean }) {
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
  // causa e solução são opcionais: o formulário já vem ligado só se o chamado tinha registro (ex.: reaberto)
  const [comRegistro, setComRegistro] = useState(!!(c.diagnostico || c.solucao));
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const deColega = !!c.responsavel && c.responsavel !== usuario?.id;
  const nomeDe = (id: string) => (id === usuario?.id ? "você" : tecnicos.find((t) => t.id === id)?.name.split(" ")[0] ?? c.expand?.responsavel?.name?.split(" ")[0] ?? "um colega");

  useEffect(() => {
    pb.collection("users").getFullList<Usuario>({ filter: 'papel = "tecnico"', sort: "name" }).then(setTecnicos).catch(() => {});
  }, []);

  // toda ação confirma com um aviso rápido (regra 12): antes, prioridade e responsável mudavam sem nenhum retorno
  async function salvar(dados: Partial<Chamado>, mensagem: string) {
    setErro("");
    setSalvando(true);
    try {
      await pb.collection("chamados").update(c.id, dados);
      setResolvendo(false);
      setEsperar(false);
      avisar(mensagem);
      aoMudar();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  }

  const formResolverEl = resolvendo && (
    <form
      ref={formResolver}
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const guardou = comRegistro && !!(diagnostico.trim() || solucao.trim());
        salvar(comRegistro
          ? { status: "resolvido", diagnostico: diagnostico.trim(), solucao: solucao.trim() }
          : { status: "resolvido", diagnostico: "", solucao: "" },
          `${c.protocolo} resolvido.${guardou ? " A solução foi para Soluções." : ""}${c.solicitante ? " Quem pediu vai confirmar se deu certo." : ""}`);
      }}
    >
      <RegistroSolucao ligado={comRegistro} aoLigar={setComRegistro} diagnostico={diagnostico} aoDiagnostico={setDiagnostico} solucao={solucao} aoSolucao={setSolucao} prefixo="painel" />
      <div className="flex gap-2">
        <button className="btn-sucesso flex-1" disabled={salvando}>Marcar como resolvido</button>
        <button type="button" className="btn-secundario" onClick={() => setResolvendo(false)}>Cancelar</button>
      </div>
    </form>
  );

  if (linha) {
    const b = "min-h-10 px-3.5 text-sm";
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {c.status === "aberto" && (
            <button className={`btn-primario ${b}`} disabled={salvando}
              onClick={() => salvar({ status: "em_andamento", responsavel: usuario!.id }, deColega ? `${c.protocolo} agora está com você, em atendimento.` : `Atendimento do ${c.protocolo} começado.`)}>
              <Play className="size-5" aria-hidden="true" /> {deColega ? "Assumir e começar" : "Começar"}
            </button>
          )}
          {c.status === "aguardando" && (
            <button className={`btn-primario ${b}`} disabled={salvando} onClick={() => salvar({ status: "em_andamento" }, `Atendimento do ${c.protocolo} retomado.`)}>
              <Play className="size-5" aria-hidden="true" /> Retomar
            </button>
          )}
          {emAtendimento && !resolvendo && (
            <button className={`btn-sucesso ${b}`} onClick={() => setResolvendo(true)}>
              <CheckCircle2 className="size-5" aria-hidden="true" /> Resolver
            </button>
          )}
          {c.status === "em_andamento" && !resolvendo && (
            <button className={`btn-secundario ${b}`} disabled={salvando} aria-expanded={esperar} onClick={() => setEsperar(!esperar)}>
              <Hourglass className="size-5" aria-hidden="true" /> Pôr em espera
            </button>
          )}
          {c.status === "resolvido" && (
            <button className={`btn-secundario ${b}`} disabled={salvando} onClick={() => salvar({ status: "aberto" }, `${c.protocolo} reaberto.`)}>
              <RotateCcw className="size-5" aria-hidden="true" /> Reabrir
            </button>
          )}
          {/* primeira linha: com quem está e prioridade como chips (seletores nativos, acessíveis) e o "⋯" com o resto;
              embaixo, os botões de ação. Numa linha só não cabia na gaveta. */}
          <div className="order-first flex w-full flex-wrap items-center gap-1.5">
            <label className="relative inline-flex">
              <span className="sr-only">Com quem está</span>
              <UserRound className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-tinta-2" aria-hidden="true" />
              <select
                className="min-h-10 cursor-pointer appearance-none rounded-full bg-superficie py-1.5 pr-7 pl-7.5 text-sm font-semibold ring-1 ring-linha hover:ring-acento focus:ring-2 focus:ring-acento focus:outline-none"
                value={c.responsavel}
                onChange={(e) => salvar({ responsavel: e.target.value }, e.target.value ? `${c.protocolo} agora está com ${nomeDe(e.target.value)}.` : `${c.protocolo} ficou sem responsável.`)}
              >
                <option value="">Livre</option>
                {tecnicos.map((t) => <option key={t.id} value={t.id}>{t.id === usuario?.id ? "Você" : t.name.split(" ")[0]}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-tinta-2" aria-hidden="true" />
            </label>
            <label className="relative inline-flex">
              <span className="sr-only">Prioridade</span>
              <span className={`pointer-events-none absolute top-1/2 left-3 size-2.5 -translate-y-1/2 rounded-full ${COR_PRIORIDADE[c.prioridade]}`} aria-hidden="true" />
              <select
                className="min-h-10 cursor-pointer appearance-none rounded-full bg-superficie py-1.5 pr-7 pl-7.5 text-sm font-semibold ring-1 ring-linha hover:ring-acento focus:ring-2 focus:ring-acento focus:outline-none"
                value={c.prioridade}
                onChange={(e) => { const p = e.target.value as Prioridade; salvar({ prioridade: p }, `Prioridade do ${c.protocolo}: ${ROTULO_PRIORIDADE[p]}. O lugar na fila foi atualizado.`); }}
              >
                {(Object.keys(ROTULO_PRIORIDADE) as Prioridade[]).reverse().map((p) => <option key={p} value={p}>{ROTULO_PRIORIDADE[p]}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-tinta-2" aria-hidden="true" />
            </label>
            {emAtendimento && !resolvendo && (
              <span className="ml-auto"><MenuMais>
                <button type="button" role="menuitem" className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold hover:bg-fundo" disabled={salvando}
                  onClick={() => salvar({ status: "aberto", responsavel: "" }, `${c.protocolo} voltou para a fila, sem responsável.`)}>
                  <Undo2 className="size-4" aria-hidden="true" /> Devolver para a fila
                </button>
              </MenuMais></span>
            )}
          </div>
        </div>
        {c.status === "aguardando" && c.aguardando_motivo && (
          <div className="space-y-2 rounded-xl bg-fundo p-3 ring-1 ring-linha">
            <p className="text-sm">
              <b>Em espera:</b> aguardando {ROTULO_AGUARDANDO[c.aguardando_motivo]}
              {paraData(c.aguardando_desde || "") && <span className="text-tinta-2"> · {tempoRelativo(c.aguardando_desde!)}</span>}
              {c.aguardando_motivo === "solicitante" && <span className="text-tinta-2">. Volta sozinho quando a pessoa responder.</span>}
            </p>
            <EscolhaEspera nome="motivo-gaveta" valor={c.aguardando_motivo} desabilitado={salvando} aoEscolher={(m) => salvar({ aguardando_motivo: m }, `Agora aguardando ${ROTULO_AGUARDANDO[m]}.`)} />
          </div>
        )}
        {esperar && c.status === "em_andamento" && (
          <div className="space-y-2 rounded-xl p-3 ring-1 ring-linha">
            <p className="text-sm font-semibold">Está aguardando o quê?</p>
            <EscolhaEspera nome="motivo-novo-gaveta" valor="" desabilitado={salvando} aoEscolher={(m) => salvar({ status: "aguardando", aguardando_motivo: m }, `${c.protocolo} em espera: aguardando ${ROTULO_AGUARDANDO[m]}.`)} />
          </div>
        )}
        {formResolverEl}
        {erro && <p role="alert" className="font-semibold text-alerta">{erro}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-2xl bg-superficie p-5 ring-1 ring-linha">
      <h2 className="text-xl font-bold">Atendimento</h2>

      {c.status === "aberto" && (
        // quem toca em "Começar" fica com o chamado (antes ele continuava no nome do colega, em andamento sem ninguém)
        <div className="space-y-1.5">
          <button
            className="btn-primario w-full"
            disabled={salvando}
            onClick={() => salvar({ status: "em_andamento", responsavel: usuario!.id }, deColega ? `${c.protocolo} agora está com você, em atendimento.` : `Atendimento do ${c.protocolo} começado.`)}
          >
            <Play className="size-5" aria-hidden="true" /> {deColega ? "Assumir e começar" : "Começar atendimento"}
          </button>
          {deColega && <p className="text-center text-sm text-tinta-2">Hoje está com {nomeDe(c.responsavel)}.</p>}
        </div>
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
          <EscolhaEspera nome="motivo-painel" valor={c.aguardando_motivo} desabilitado={salvando} aoEscolher={(m) => salvar({ aguardando_motivo: m }, `Agora aguardando ${ROTULO_AGUARDANDO[m]}.`)} />
          <button className="btn-primario w-full" disabled={salvando} onClick={() => salvar({ status: "em_andamento" }, `Atendimento do ${c.protocolo} retomado.`)}>
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
              <EscolhaEspera nome="motivo-novo" valor="" desabilitado={salvando} aoEscolher={(m) => salvar({ status: "aguardando", aguardando_motivo: m }, `${c.protocolo} em espera: aguardando ${ROTULO_AGUARDANDO[m]}.`)} />
              <button type="button" className="btn w-full min-h-10 text-sm text-tinta-2" onClick={() => setEsperar(false)}>Cancelar</button>
            </div>
          ) : (
            <button className="btn-secundario w-full" disabled={salvando} onClick={() => setEsperar(true)}>
              <Hourglass className="size-5" aria-hidden="true" /> Pôr em espera
            </button>
          ))}
          <button className="btn-secundario w-full" disabled={salvando} onClick={() => salvar({ status: "aberto", responsavel: "" }, `${c.protocolo} voltou para a fila, sem responsável.`)}>
            <Undo2 className="size-5" aria-hidden="true" /> Devolver para a fila
          </button>
        </div>
      )}

      {c.status === "resolvido" && (
        <button className="btn-secundario w-full" disabled={salvando} onClick={() => salvar({ status: "aberto" }, `${c.protocolo} reaberto.`)}>
          <RotateCcw className="size-5" aria-hidden="true" /> Reabrir
        </button>
      )}

      {formResolverEl}

      <fieldset>
        <legend className="rotulo">Prioridade</legend>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(ROTULO_PRIORIDADE) as Prioridade[]).reverse().map((p) => (
            <label key={p} className="opcao min-h-12 py-2">
              <input type="radio" name="prioridade" checked={c.prioridade === p} onChange={() => salvar({ prioridade: p }, `Prioridade do ${c.protocolo}: ${ROTULO_PRIORIDADE[p]}. O lugar na fila foi atualizado.`)} className="sr-only" />
              <span className={`size-3 rounded-full ${COR_PRIORIDADE[p]}`} aria-hidden="true" />
              {ROTULO_PRIORIDADE[p]}
            </label>
          ))}
        </div>
        <p className="ajuda">Sugerida pelo impacto informado na abertura.</p>
      </fieldset>

      <div>
        <label htmlFor="resp" className="rotulo">Responsável</label>
        <select id="resp" className="campo" value={c.responsavel} onChange={(e) => salvar({ responsavel: e.target.value }, e.target.value ? `${c.protocolo} agora está com ${nomeDe(e.target.value)}.` : `${c.protocolo} ficou sem responsável.`)}>
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

/** "⋯": ações que se usam pouco, para a linha de ações não crescer. Fecha ao clicar fora, com Esc ou ao escolher. */
function MenuMais({ children }: { children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("pointerdown", fora); document.removeEventListener("keydown", tecla); };
  }, [aberto]);
  return (
    <div ref={caixa} className="relative">
      <button type="button" aria-label="Mais ações" aria-haspopup="menu" aria-expanded={aberto} onClick={() => setAberto(!aberto)}
        className="grid size-10 place-items-center rounded-full text-tinta-2 hover:bg-fundo hover:text-tinta">
        <MoreHorizontal className="size-5" aria-hidden="true" />
      </button>
      {aberto && (
        <div role="menu" className="absolute right-0 z-30 mt-1 w-56 rounded-xl bg-superficie p-1 shadow-xl ring-1 ring-linha" onClick={() => setAberto(false)}>
          {children}
        </div>
      )}
    </div>
  );
}
