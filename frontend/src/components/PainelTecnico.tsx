import { CheckCircle2, Hourglass, MoreHorizontal, ArrowRight, RotateCcw, Undo2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { useAuth } from "../lib/auth";
import { avisar } from "../lib/avisos";
import { paraData, ROTULO_AGUARDANDO, ROTULO_PRIORIDADE, tempoRelativo } from "../lib/formato";
import { mensagemErro, pb, type Chamado, type MotivoAguardando, type Prioridade, type Usuario } from "../lib/pb";
import { EscolhaEspera } from "./EscolhaEspera";
import { RegistroSolucao } from "./RegistroSolucao";
import { SinalPrioridade } from "./Selos";
import { Escolha } from "./Escolha";
import { Avatar } from "./Avatar";

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

  // Toda ação confirma com um aviso rápido (regra 12). Mudança simples (prioridade, começar, pôr em espera) vem com
  // "Desfazer" no aviso; o que mexe com outra pessoa ou tira o chamado de alguém (passar, devolver, reabrir) pede
  // confirmação antes, numa faixa dentro do próprio painel (sem janela por cima).
  const [pedido, setPedido] = useState<{ pergunta: string; detalhe?: string; botao: string; fazer: () => void } | null>(null);
  const confirmar = (pergunta: string, botao: string, fazer: () => void, detalhe?: string) => setPedido({ pergunta, botao, fazer, detalhe });

  async function salvar(dados: Partial<Chamado>, mensagem: string, desfazer?: Partial<Chamado>) {
    setErro("");
    setSalvando(true);
    setPedido(null);
    try {
      await pb.collection("chamados").update(c.id, dados);
      setResolvendo(false);
      setEsperar(false);
      avisar(mensagem, desfazer ? {
        acao: {
          rotulo: "Desfazer",
          fazer: () => {
            pb.collection("chamados").update(c.id, desfazer)
              .then(() => { avisar("Desfeito."); aoMudar(); })
              .catch((err) => avisar(mensagemErro(err), { tipo: "erro" }));
          },
        },
      } : {});
      aoMudar();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  }

  const antes = { status: c.status, responsavel: c.responsavel, prioridade: c.prioridade, aguardando_motivo: c.aguardando_motivo ?? "" };
  const mudarPrioridade = (p: Prioridade) =>
    salvar({ prioridade: p }, `Prioridade do ${c.protocolo}: ${ROTULO_PRIORIDADE[p]}. O lugar na fila foi atualizado.`, { prioridade: antes.prioridade });
  function mudarResponsavel(novo: string) {
    if (novo === c.responsavel) return;
    if (novo === usuario?.id) {
      salvar({ responsavel: novo }, `${c.protocolo} agora está com você.`, { responsavel: antes.responsavel });
    } else if (!novo) {
      confirmar(`Deixar ${c.protocolo} sem responsável?`, "Deixar livre", () => salvar({ responsavel: "" }, `${c.protocolo} ficou sem responsável.`, { responsavel: antes.responsavel }),
        "Ele continua na fila e qualquer um pode pegar.");
    } else {
      const nome = nomeDe(novo);
      confirmar(`Passar ${c.protocolo} para ${nome}?`, `Passar para ${nome}`, () => salvar({ responsavel: novo }, `${c.protocolo} agora está com ${nome}.`, { responsavel: antes.responsavel }),
        `O chamado vai para a lista de ${nome}${c.responsavel === usuario?.id ? " e sai da sua" : ""}.`);
    }
  }
  const devolver = () => confirmar(`Devolver ${c.protocolo} para a fila?`, "Devolver", () => salvar({ status: "aberto", responsavel: "" }, `${c.protocolo} voltou para a fila, sem responsável.`, { status: antes.status, responsavel: antes.responsavel }),
    "Ele fica sem responsável e volta para o lugar dele na fila.");
  const reabrir = () => confirmar(`Reabrir ${c.protocolo}?`, "Reabrir", () => salvar({ status: "aberto" }, `${c.protocolo} reaberto.`),
    "Ele volta para a fila e quem pediu vê que foi reaberto.");
  const comecar = () => salvar({ status: "em_andamento", responsavel: usuario!.id }, deColega ? `${c.protocolo} agora está com você, em atendimento.` : `Atendimento do ${c.protocolo} começado.`,
    { status: antes.status, responsavel: antes.responsavel });
  const porEmEspera = (m: MotivoAguardando) => salvar({ status: "aguardando", aguardando_motivo: m }, `${c.protocolo} em espera: aguardando ${ROTULO_AGUARDANDO[m]}.`,
    { status: "em_andamento", aguardando_motivo: "" });

  const perguntaEl = pedido && (
    <div role="alertdialog" aria-labelledby="pergunta-atendimento" className="space-y-2 rounded-xl bg-sol-50 p-3 ring-1 ring-ambar">
      <p id="pergunta-atendimento" className="font-bold">{pedido.pergunta}</p>
      {pedido.detalhe && <p className="text-sm text-tinta-2">{pedido.detalhe}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" autoFocus className="btn-primario min-h-10 px-4 text-sm" disabled={salvando} onClick={pedido.fazer}>{pedido.botao}</button>
        <button type="button" className="btn-secundario min-h-10 px-4 text-sm" onClick={() => setPedido(null)}>Cancelar</button>
      </div>
    </div>
  );

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

  const seletorResponsavel = (
    <Escolha
              rotulo="Com quem está"
              valor={c.responsavel || ""}
              aoEscolher={mudarResponsavel}
              opcoes={[
                { valor: "", rotulo: "Livre", icone: <span className="size-7 shrink-0 rounded-full border-2 border-dashed border-tinta-2/50" aria-hidden="true" /> },
                // você primeiro, depois os colegas
                ...[...tecnicos].sort((a, b) => (a.id === usuario?.id ? -1 : b.id === usuario?.id ? 1 : 0)).map((t) => ({
                  valor: t.id,
                  rotulo: t.id === usuario?.id ? "Você" : t.name.split(" ")[0],
                  icone: <Avatar id={t.id} nome={t.name} tamanho="sm" destaque={t.id === usuario?.id} />,
                })),
              ]}
            />
  );
  const seletorPrioridade = (
    <Escolha
              rotulo="Prioridade"
              valor={c.prioridade}
              aoEscolher={(p) => mudarPrioridade(p as Prioridade)}
              opcoes={(Object.keys(ROTULO_PRIORIDADE) as Prioridade[]).reverse().map((p) => ({
                valor: p,
                rotulo: ROTULO_PRIORIDADE[p],
                icone: <SinalPrioridade prioridade={p} className="size-4 shrink-0" />,
              }))}
            />
  );

  if (linha) {
    const b = "min-h-10 px-3.5 text-sm";
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {c.status === "aberto" && (
            <button className={`btn-primario ${b}`} disabled={salvando}
              onClick={comecar}>
              {deColega ? "Assumir e começar" : "Começar"} <ArrowRight className="size-5" aria-hidden="true" />
            </button>
          )}
          {c.status === "aguardando" && (
            <button className={`btn-primario ${b}`} disabled={salvando} onClick={() => salvar({ status: "em_andamento" }, `Atendimento do ${c.protocolo} retomado.`)}>
              Retomar <ArrowRight className="size-5" aria-hidden="true" />
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
            <button className={`btn-secundario ${b}`} disabled={salvando} onClick={reabrir}>
              <RotateCcw className="size-5" aria-hidden="true" /> Reabrir
            </button>
          )}
          {/* na mesma linha da ação: com quem está e prioridade (seletores nativos, acessíveis) e o "⋯" com o resto */}
          <div className="contents">
            {seletorResponsavel}
            {seletorPrioridade}
            {emAtendimento && !resolvendo && (
              <span className="ml-auto"><MenuMais>
                <button type="button" role="menuitem" className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold hover:bg-fundo" disabled={salvando}
                  onClick={devolver}>
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
              {paraData(c.aguardando_desde || "") && <span className="text-tinta-2">, {tempoRelativo(c.aguardando_desde!)}</span>}
              {c.aguardando_motivo === "solicitante" && <span className="text-tinta-2">. Volta sozinho quando a pessoa responder.</span>}
            </p>
            <EscolhaEspera nome="motivo-gaveta" valor={c.aguardando_motivo} desabilitado={salvando} aoEscolher={(m) => salvar({ aguardando_motivo: m }, `Agora aguardando ${ROTULO_AGUARDANDO[m]}.`)} />
          </div>
        )}
        {esperar && c.status === "em_andamento" && (
          <div className="space-y-2 rounded-xl p-3 ring-1 ring-linha">
            <p className="text-sm font-semibold">Está aguardando o quê?</p>
            <EscolhaEspera nome="motivo-novo-gaveta" valor="" desabilitado={salvando} aoEscolher={porEmEspera} />
          </div>
        )}
        {perguntaEl}
        {formResolverEl}
        {erro && <p role="alert" className="font-semibold text-alerta">{erro}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-2xl bg-superficie p-5 ring-1 ring-linha">
      <h2 className="sr-only">Atendimento</h2>

      {c.status === "aberto" && (
        // quem toca em "Começar" fica com o chamado (antes ele continuava no nome do colega, em andamento sem ninguém)
        <div className="space-y-1.5">
          <button
            className="btn-primario w-full"
            disabled={salvando}
            onClick={comecar}
          >
            {deColega ? "Assumir e começar" : "Começar atendimento"} <ArrowRight className="size-5" aria-hidden="true" />
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
              {paraData(c.aguardando_desde || "") && <span className="text-tinta-2">, {tempoRelativo(c.aguardando_desde!)}</span>}
              {c.aguardando_motivo === "solicitante" && <span className="block text-tinta-2">Volta sozinho para atendimento quando a pessoa responder.</span>}
            </span>
          </p>
          <EscolhaEspera nome="motivo-painel" valor={c.aguardando_motivo} desabilitado={salvando} aoEscolher={(m) => salvar({ aguardando_motivo: m }, `Agora aguardando ${ROTULO_AGUARDANDO[m]}.`)} />
          <button className="btn-primario w-full" disabled={salvando} onClick={() => salvar({ status: "em_andamento" }, `Atendimento do ${c.protocolo} retomado.`)}>
            Retomar atendimento <ArrowRight className="size-5" aria-hidden="true" />
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
              <EscolhaEspera nome="motivo-novo" valor="" desabilitado={salvando} aoEscolher={porEmEspera} />
              <button type="button" className="btn w-full min-h-10 text-sm text-tinta-2" onClick={() => setEsperar(false)}>Cancelar</button>
            </div>
          ) : (
            <button className="btn-secundario w-full" disabled={salvando} onClick={() => setEsperar(true)}>
              <Hourglass className="size-5" aria-hidden="true" /> Pôr em espera
            </button>
          ))}
          <button className="btn-secundario w-full" disabled={salvando} onClick={devolver}>
            <Undo2 className="size-5" aria-hidden="true" /> Devolver para a fila
          </button>
        </div>
      )}

      {c.status === "resolvido" && (
        <button className="btn-secundario w-full" disabled={salvando} onClick={reabrir}>
          <RotateCcw className="size-5" aria-hidden="true" /> Reabrir
        </button>
      )}

      {perguntaEl}
      {formResolverEl}

      {/* com quem está e prioridade: as mesmas pílulas da gaveta (lista com avatar e sinal) */}
      <div className="flex flex-wrap items-center gap-2 border-t border-linha pt-4">
        {seletorResponsavel}
        {seletorPrioridade}
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
        <div role="menu" className="animar-menu absolute right-0 z-30 mt-1 w-56 origin-top-right rounded-xl bg-superficie p-1 shadow-xl ring-1 ring-linha" onClick={() => setAberto(false)}>
          {children}
        </div>
      )}
    </div>
  );
}
