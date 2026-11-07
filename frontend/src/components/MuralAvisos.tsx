import { AlertTriangle, CheckCircle2, Info, Megaphone, PenLine, Plus, Users, X } from "lucide-react";
import { Dica } from "./Dica";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { avisar } from "../lib/avisos";
import { encerrarAviso, encerrarAvisoCompleto, MODELOS, PRAZOS, publicarAviso, someEm, tambemEstou, useAvisosTI, type AvisoTI, type Prazo } from "../lib/avisosTI";
import { tempoRelativo } from "../lib/formato";
import { ehTecnico, mensagemErro, pb } from "../lib/pb";
import { PainelRapido } from "./PainelRapido";

const ESTILO = {
  problema: { Icone: AlertTriangle, caixa: "bg-brasa-50 ring-alerta/40", icone: "text-alerta" },
  info: { Icone: Info, caixa: "bg-mar-50 ring-acento/30", icone: "text-acento" },
  resolvido: { Icone: CheckCircle2, caixa: "bg-campo-50 ring-ok/30", icone: "text-ok" },
};

const quantasPessoas = (n: number) => `${n} ${n === 1 ? "pessoa disse" : "pessoas disseram"} que também ${n === 1 ? "está" : "estão"} com esse problema`;

/**
 * Encerrar um aviso. Comunicado ou recado de resolvido: encerra direto. Aviso de PROBLEMA: abre a janela que resolve
 * também os chamados ligados a ele e avisa todos que voltou (POST /api/avisos/{id}/encerrar).
 */
function useEncerrar(a: AvisoTI) {
  const [encerrando, setEncerrando] = useState(false);
  const [janela, setJanela] = useState(false);
  async function encerrar() {
    if (a.tipo === "problema") return setJanela(true);
    setEncerrando(true);
    try {
      await encerrarAviso(a.id);
      avisar("Aviso encerrado.");
    } catch (err) {
      avisar(mensagemErro(err), { tipo: "erro" });
      setEncerrando(false);
    }
  }
  return { encerrando, encerrar, janela: janela && <JanelaEncerrar a={a} aoFechar={() => setJanela(false)} /> };
}

function JanelaEncerrar({ a, aoFechar }: { a: AvisoTI; aoFechar: () => void }) {
  const [ligados, setLigados] = useState<number | null>(null);
  const [resolver, setResolver] = useState(true);
  const [mensagem, setMensagem] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  useEffect(() => {
    pb.collection("chamados").getList(1, 1, { filter: pb.filter("aviso = {:a} && status != 'resolvido'", { a: a.id }), fields: "id", requestKey: null })
      .then((r) => setLigados(r.totalItems)).catch(() => setLigados(0));
  }, [a.id]);
  const pessoas = a.tambem_total ?? 0;

  async function confirmar(e?: FormEvent) {
    e?.preventDefault();
    setErro("");
    setSalvando(true);
    try {
      const r = await encerrarAvisoCompleto(a.id, { resolver: resolver && !!ligados, mensagem: mensagem.trim() });
      avisar(r.resolvidos ? `Aviso encerrado. ${r.resolvidos} ${r.resolvidos === 1 ? "chamado resolvido" : "chamados resolvidos"} junto.` : "Aviso encerrado.");
      aoFechar();
    } catch (err) {
      setErro(mensagemErro(err));
      setSalvando(false);
    }
  }

  return (
    <PainelRapido
      idTitulo="titulo-encerrar-aviso"
      largura="max-w-lg"
      titulo="O problema foi resolvido?"
      subtitulo={<p className="mt-0.5 text-sm text-tinta-2 texto-livre">“{a.texto}”</p>}
      aoTentarFechar={aoFechar}
      rodape={
        <>
          {erro && <p role="alert" className="mb-2 font-semibold text-alerta">{erro}</p>}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <button type="button" className="btn-secundario" onClick={aoFechar}>Cancelar</button>
            <button type="submit" form="form-encerrar" className="btn-sucesso" disabled={salvando || ligados === null}>
              {salvando ? "Encerrando..." : "Encerrar aviso"}
            </button>
          </div>
        </>
      }
    >
      <form id="form-encerrar" onSubmit={confirmar} className="space-y-4">
        <div>
          <label htmlFor="msg-resolvido" className="rotulo">Avisar a todos <span className="font-normal text-tinta-2">(opcional)</span></label>
          <textarea id="msg-resolvido" className="campo min-h-20" maxLength={240} value={mensagem} onChange={(e) => setMensagem(e.target.value)}
            placeholder="Ex.: A internet voltou. Se ainda estiver sem, reinicie o computador." />
          <p className="ajuda">
            {mensagem.trim()
              ? `Aparece para todos por 4 horas${pessoas ? `, inclusive para as ${pessoas} ${pessoas === 1 ? "pessoa que disse" : "pessoas que disseram"} que também estavam sem` : ""}.`
              : "Em branco, o aviso só some."}
          </p>
        </div>
        {ligados === null ? null : ligados > 0 ? (
          <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 ring-1 ring-linha hover:ring-acento">
            <input type="checkbox" className="size-5 accent-acento" checked={resolver} onChange={() => setResolver(!resolver)} />
            <span>
              <b>Resolver também {ligados === 1 ? "o chamado ligado" : `os ${ligados} chamados ligados`} a este aviso</b>
              <span className="block text-sm text-tinta-2">Quem abriu recebe a mensagem acima e confirma se deu certo.</span>
            </span>
          </label>
        ) : (
          <p className="text-sm text-tinta-2">Nenhum chamado ligado a este aviso.</p>
        )}
      </form>
    </PainelRapido>
  );
}

/** No chamado (TI): liga ou desliga o chamado de um aviso de problema no ar ("é o problema do aviso"). */
export function LigarAoAviso({ chamadoId, aviso, aoMudar }: { chamadoId: string; aviso?: string; aoMudar: () => void }) {
  const avisos = useAvisosTI();
  const [salvando, setSalvando] = useState(false);
  const problemas = (avisos ?? []).filter((x) => x.tipo === "problema");
  const atual = problemas.find((x) => x.id === aviso);
  if (!avisos || (!aviso && !problemas.length)) return null;

  async function ligar(id: string) {
    setSalvando(true);
    try {
      await pb.collection("chamados").update(chamadoId, { aviso: id });
      avisar(id ? "Ligado ao aviso. Ao encerrar o aviso, ele pode ser resolvido junto." : "Desligado do aviso.");
      aoMudar();
    } catch (err) {
      avisar(mensagemErro(err), { tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-brasa-50 px-3 py-2 text-sm ring-1 ring-alerta/40">
      <AlertTriangle className="size-4 shrink-0 text-alerta" aria-hidden="true" />
      {aviso ? (
        <>
          <span className="min-w-0 flex-1"><b>Faz parte do aviso</b> {atual ? <span className="texto-livre">“{atual.texto}”</span> : "(já encerrado)"}</span>
          <button type="button" className="min-h-9 rounded-lg px-2 font-semibold text-acento hover:bg-superficie" disabled={salvando} onClick={() => ligar("")}>Desligar</button>
        </>
      ) : problemas.length === 1 ? (
        <>
          <span className="texto-livre min-w-0 flex-1">Aviso no ar: “{problemas[0].texto}”</span>
          <button type="button" className="min-h-9 rounded-lg px-2 font-semibold text-acento hover:bg-superficie" disabled={salvando} onClick={() => ligar(problemas[0].id)}>É este problema</button>
        </>
      ) : (
        <label className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="font-semibold">É o problema de um aviso?</span>
          <select className="campo min-h-9 w-auto py-1 text-sm" value="" disabled={salvando} onChange={(e) => e.target.value && ligar(e.target.value)}>
            <option value="">Escolha o aviso</option>
            {problemas.map((x) => <option key={x.id} value={x.id}>{x.texto.slice(0, 60)}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

function CartaoAviso({ a, podeEncerrar }: { a: AvisoTI; podeEncerrar: boolean }) {
  const { Icone, caixa, icone } = ESTILO[a.tipo];
  const { encerrando, encerrar, janela } = useEncerrar(a);
  return (
    <li className={`flex gap-2.5 rounded-xl p-3 text-sm ring-1 ${caixa}`}>
      {janela}
      <Icone className={`mt-0.5 size-4 shrink-0 ${icone}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="texto-livre font-semibold">{a.texto}</p>
        <p className="mt-0.5 text-xs text-tinta-2">
          {a.expand?.autor?.name?.split(" ")[0] ?? "TI"} · {tempoRelativo(a.created)}{a.ate && someEm(a.ate) ? ` · ${someEm(a.ate)}` : ""}
          {podeEncerrar && !!a.tambem_total && <> · <b className="text-tinta">{a.tambem_total}</b> também</>}
        </p>
      </div>
      {podeEncerrar && (
        <button type="button" onClick={encerrar} disabled={encerrando} className="-m-1 grid size-8 shrink-0 place-items-center rounded-lg text-tinta-2 hover:bg-superficie hover:text-tinta" aria-label="Encerrar aviso" title="Encerrar aviso">
          <X className="size-4" />
        </button>
      )}
    </li>
  );
}

/** "Avisar todos": modelo pronto (já traz texto e tipo) + quando some. Dois cliques para o caso comum. */
export function NovoAviso({ aoFechar }: { aoFechar: () => void }) {
  const { usuario } = useAuth();
  const [modelo, setModelo] = useState("");
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState<AvisoTI["tipo"]>("problema");
  const [prazo, setPrazo] = useState<Prazo>("2h");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);

  function escolher(id: string) {
    setModelo(id);
    const m = MODELOS.find((x) => x.id === id);
    if (m) { setTexto(m.texto); setTipo(m.tipo); setPrazo(m.prazo); } else { setTexto(""); }
  }
  // o campo abre com o trecho [entre colchetes] selecionado, pronto para digitar por cima
  useEffect(() => {
    if (!modelo) return;
    const t = campo.current;
    if (!t) return;
    t.focus();
    const i = t.value.indexOf("[");
    const f = t.value.indexOf("]", i);
    if (i >= 0 && f > i) t.setSelectionRange(i, f + 1);
  }, [modelo]);

  const faltaCompletar = /\[[^\]]*\]/.test(texto);

  async function publicar(e?: FormEvent) {
    e?.preventDefault();
    if (!usuario || !texto.trim()) return;
    if (faltaCompletar) { setErro("Complete o trecho entre colchetes."); campo.current?.focus(); return; }
    setErro("");
    setSalvando(true);
    try {
      await publicarAviso(texto.trim(), tipo, prazo, usuario.id);
      avisar("Aviso publicado. Todos já estão vendo.");
      aoFechar();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  }

  const chip = (ativo: boolean) =>
    `inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold ring-1 ${ativo ? "bg-mar-700 text-white ring-acento" : "bg-superficie ring-linha hover:ring-acento"}`;

  return (
    <PainelRapido
      idTitulo="titulo-novo-aviso"
      largura="max-w-lg"
      titulo={
        <span className="inline-flex items-center gap-2.5">
          Avisar todos
          <Dica rotulo="Onde o aviso aparece">Aparece para todos, inclusive em Novo chamado. Evita vários chamados do mesmo problema.</Dica>
        </span>
      }
      aoTentarFechar={aoFechar}
      rodape={
        <>
          {erro && <p role="alert" className="mb-2 font-semibold text-alerta">{erro}</p>}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <button type="button" className="btn-secundario" onClick={aoFechar}>Cancelar</button>
            <button type="submit" form="form-aviso" className="btn-primario" disabled={salvando || !texto.trim()}>
              {salvando ? "Publicando..." : tipo === "problema" ? "Publicar aviso de problema" : "Publicar comunicado"}
            </button>
          </div>
        </>
      }
    >
      <form id="form-aviso" onSubmit={publicar} className="space-y-5">
        <fieldset>
          <legend className="rotulo">O que aconteceu?</legend>
          <div className="flex flex-wrap gap-2">
            {MODELOS.map((m) => (
              <button key={m.id} type="button" aria-pressed={modelo === m.id} onClick={() => escolher(m.id)} className={chip(modelo === m.id)}>
                {m.rotulo}
              </button>
            ))}
            <button type="button" aria-pressed={modelo === "outro"} onClick={() => escolher("outro")} className={chip(modelo === "outro")}>
              <PenLine className="size-4" aria-hidden="true" /> Escrever outro
            </button>
          </div>
        </fieldset>

        {modelo && (
          <>
            {modelo === "outro" && (
              <fieldset>
                <legend className="rotulo">Tipo</legend>
                <div className="grid grid-cols-2 gap-2">
                  {([["problema", "Problema em andamento", AlertTriangle], ["info", "Comunicado", Info]] as const).map(([v, r, I]) => (
                    <label key={v} className="opcao text-sm">
                      <input type="radio" name="tipo-aviso" className="sr-only" checked={tipo === v} onChange={() => setTipo(v)} />
                      <I className={`size-5 shrink-0 ${v === "problema" ? "text-alerta" : "text-acento"}`} aria-hidden="true" /> {r}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <div>
              <label htmlFor="aviso-texto" className="rotulo">Mensagem</label>
              <textarea
                ref={campo}
                id="aviso-texto" className="campo min-h-24" maxLength={240} required
                autoFocus={modelo === "outro"}
                placeholder={tipo === "problema" ? "Ex.: Internet do Paço instável. Já estamos resolvendo." : "Ex.: Sexta, 18h, manutenção no sistema de protocolo."}
                value={texto} onChange={(e) => setTexto(e.target.value)}
              />
              <p className="ajuda flex justify-between gap-2">
                <span>{faltaCompletar ? "Complete o trecho entre colchetes." : ""}</span>
                <span>{texto.length}/240</span>
              </p>
            </div>
            <fieldset>
              <legend className="rotulo">Some sozinho</legend>
              <div className="flex flex-wrap gap-2">
                {PRAZOS.map((p) => (
                  <button key={p.id} type="button" aria-pressed={prazo === p.id} onClick={() => setPrazo(p.id)} className={chip(prazo === p.id)}>
                    {p.id === "sem" ? p.rotulo : p.id === "dia" ? "No fim do dia" : `Em ${p.rotulo}`}
                  </button>
                ))}
              </div>
            </fieldset>
          </>
        )}
      </form>
    </PainelRapido>
  );
}

/**
 * Avisos na barra lateral do PC: UMA linha. Sem aviso, "Avisar todos" (só o TI). Com aviso no ar, a linha fica colorida
 * com o texto, quando some e quantas pessoas disseram que também estão com o problema.
 * `compacto` (barra recolhida): só o ícone (com a quantidade quando há aviso).
 */
export function LinhaAvisos({ compacto }: { compacto?: boolean }) {
  const { usuario } = useAuth();
  const tecnico = ehTecnico(usuario);
  const avisos = useAvisosTI();
  const [novo, setNovo] = useState(false);
  const temProblema = avisos?.some((a) => a.tipo === "problema");
  const janela = novo && <NovoAviso aoFechar={() => setNovo(false)} />;

  if (avisos === null) return null;
  if (!tecnico && !avisos.length) return null;

  if (compacto) {
    return (
      <>
        <button
          type="button"
          onClick={() => setNovo(true)}
          disabled={!tecnico}
          className="relative mx-auto grid size-11 place-items-center rounded-xl text-tinta-2 hover:bg-fundo hover:text-tinta"
          title={avisos.length ? avisos.map((a) => a.texto).join("\n") : "Avisar todos"}
          aria-label={avisos.length ? `${avisos.length} aviso(s) do TI no ar. Avisar todos` : "Avisar todos"}
        >
          <Megaphone className="size-5" aria-hidden="true" />
          {!!avisos.length && (
            <span className={`absolute -top-0.5 -right-0.5 grid size-5 place-items-center rounded-full text-xs font-bold text-white ${temProblema ? "bg-brasa" : "bg-mar-700"}`}>{avisos.length}</span>
          )}
        </button>
        {janela}
      </>
    );
  }

  return (
    <section aria-label="Avisos do TI" className="flex min-h-0 flex-col gap-1.5">
      {avisos.length > 0 && (
        // só a lista rola; o "Avisar todos" fica sempre à vista embaixo
        <ul className="-mx-1 min-h-0 space-y-1.5 overflow-y-auto overscroll-contain px-1 py-0.5" aria-label={`${avisos.length} ${avisos.length === 1 ? "aviso" : "avisos"} no ar`}>
          {avisos.map((a) => <li key={a.id}><LinhaAviso a={a} podeEncerrar={tecnico} /></li>)}
        </ul>
      )}
      {tecnico && (
        <button
          type="button"
          onClick={() => setNovo(true)}
          className="flex min-h-11 w-full shrink-0 items-center gap-3 rounded-xl px-3 text-left font-semibold text-tinta-2 hover:bg-fundo hover:text-tinta"
        >
          <Megaphone className="size-5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">Avisar todos</span>
          {!!avisos.length && <Plus className="size-4 shrink-0" aria-hidden="true" />}
        </button>
      )}
      {janela}
    </section>
  );
}

function LinhaAviso({ a, podeEncerrar }: { a: AvisoTI; podeEncerrar: boolean }) {
  const { Icone, caixa, icone } = ESTILO[a.tipo];
  const { encerrando, encerrar, janela } = useEncerrar(a);
  const fim = someEm(a.ate);
  return (
    <div className={`rounded-xl p-2.5 text-sm ring-1 ${caixa}`}>
      {janela}
      <p className="flex gap-2">
        <Icone className={`mt-0.5 size-4 shrink-0 ${icone}`} aria-hidden="true" />
        <span className="texto-livre line-clamp-2 min-w-0 flex-1 font-semibold" title={a.texto}>{a.texto}</span>
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 pl-6 text-xs text-tinta-2">
        <span>{a.expand?.autor?.name?.split(" ")[0] ?? "TI"} · {tempoRelativo(a.created)}{fim && ` · ${fim}`}</span>
        {!!a.tambem_total && (
          <span className="inline-flex items-center gap-1 font-semibold text-tinta" title={quantasPessoas(a.tambem_total)}>
            <Users className="size-3.5" aria-hidden="true" /> {a.tambem_total} também
          </span>
        )}
        {podeEncerrar && (
          <button type="button" onClick={encerrar} disabled={encerrando} className="ml-auto min-h-8 rounded-lg px-2 font-semibold text-acento hover:bg-superficie">
            {encerrando ? "Encerrando..." : a.tipo === "problema" ? "Resolvido, encerrar" : "Encerrar"}
          </button>
        )}
      </p>
    </div>
  );
}

/**
 * Novo chamado: o servidor vê o aviso de problema ANTES de abrir mais um chamado igual, e pode só dizer
 * "Também estou com esse problema" (o TI vê o número na hora).
 */
export function AvisoNoNovoChamado({ className = "" }: { className?: string }) {
  const avisos = useAvisosTI();
  const [enviando, setEnviando] = useState("");
  const problemas = (avisos ?? []).filter((a) => a.tipo === "problema");
  if (!problemas.length) return null;

  async function tocar(a: AvisoTI) {
    setEnviando(a.id);
    try {
      const r = await tambemEstou(a.id, !a.tambem_eu);
      avisar(r.eu ? "Pronto. O TI já sabe que você também está com esse problema." : "Tudo bem, tiramos o seu nome.");
    } catch (err) {
      avisar(mensagemErro(err), { tipo: "erro" });
    } finally {
      setEnviando("");
    }
  }

  return (
    <section aria-label="O TI já sabe" className={`space-y-2 ${className}`}>
      {problemas.map((a) => (
        <div key={a.id} className="rounded-2xl bg-brasa-50 p-4 ring-1 ring-alerta/40">
          <p className="flex items-center gap-2 font-bold">
            <AlertTriangle className="size-5 shrink-0 text-alerta" aria-hidden="true" /> O TI já sabe
          </p>
          <p className="texto-livre mt-1">{a.texto}</p>
          {!/não precisa abrir chamado/i.test(a.texto) && <p className="mt-1 text-sm text-tinta-2">Se o seu problema é esse, não precisa abrir chamado.</p>}
          <button
            type="button"
            aria-pressed={!!a.tambem_eu}
            disabled={enviando === a.id}
            onClick={() => tocar(a)}
            className={`btn mt-3 w-full sm:w-auto ${a.tambem_eu ? "bg-superficie text-tinta ring-1 ring-linha" : "bg-mar-700 text-white"}`}
          >
            <Users className="size-5" aria-hidden="true" />
            {a.tambem_eu ? "Você já avisou · desfazer" : "Também estou com esse problema"}
          </button>
          {!!a.tambem_total && !(a.tambem_eu && a.tambem_total === 1) && (
            <p className="mt-2 text-sm text-tinta-2">{quantasPessoas(a.tambem_total)}{a.tambem_eu ? ", com você" : ""}.</p>
          )}
        </div>
      ))}
    </section>
  );
}

/**
 * Mural "Avisos do TI" no celular (topo de Meus chamados e da Fila): avisos em vigor para todos; técnicos publicam e encerram.
 * `enxuto` (topo da Fila no celular): sem aviso no ar, vira UMA linha ("Nenhum aviso do TI · Avisar todos").
 */
export function MuralAvisos({ enxuto, className = "" }: { enxuto?: boolean; className?: string }) {
  const { usuario } = useAuth();
  const tecnico = ehTecnico(usuario);
  const avisos = useAvisosTI();
  const [novo, setNovo] = useState(false);

  // servidor sem avisos: nada a mostrar
  if (!tecnico && !avisos?.length) return null;

  if (enxuto && avisos?.length === 0) {
    return (
      <div className={`flex items-center gap-2 text-sm text-tinta-2 ${className}`}>
        <Megaphone className="size-4 shrink-0" aria-hidden="true" />
        <span className="flex-1">Nenhum aviso do TI no ar.</span>
        <button type="button" onClick={() => setNovo(true)} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 font-semibold text-acento hover:bg-mar-50">
          <Plus className="size-4" aria-hidden="true" /> Avisar todos
        </button>
        {novo && <NovoAviso aoFechar={() => setNovo(false)} />}
      </div>
    );
  }

  return (
    <section aria-labelledby="titulo-mural" className={className}>
      <div className="mb-2 flex items-center gap-2">
        <h2 id="titulo-mural" className="flex flex-1 items-center gap-1.5 text-xs font-bold tracking-wider text-tinta-2 uppercase">
          <Megaphone className="size-4" aria-hidden="true" /> Avisos do TI
        </h2>
        {tecnico && (
          <button type="button" onClick={() => setNovo(true)} className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-acento hover:bg-mar-50">
            <Plus className="size-4" aria-hidden="true" /> Avisar todos
          </button>
        )}
      </div>
      {avisos === null ? null : avisos.length === 0 ? (
        <p className="text-xs text-tinta-2">Nenhum aviso no ar.</p>
      ) : (
        <ul className="space-y-2">{avisos.map((a) => <CartaoAviso key={a.id} a={a} podeEncerrar={tecnico} />)}</ul>
      )}
      {novo && <NovoAviso aoFechar={() => setNovo(false)} />}
    </section>
  );
}
