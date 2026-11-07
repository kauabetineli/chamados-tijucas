import { AlertTriangle, Info, Megaphone, PenLine, Plus, Users, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { avisar } from "../lib/avisos";
import { encerrarAviso, MODELOS, PRAZOS, publicarAviso, someEm, tambemEstou, useAvisosTI, type AvisoTI, type Prazo } from "../lib/avisosTI";
import { tempoRelativo } from "../lib/formato";
import { ehTecnico, mensagemErro } from "../lib/pb";
import { PainelRapido } from "./PainelRapido";

const ESTILO = {
  problema: { Icone: AlertTriangle, caixa: "bg-brasa-50 ring-alerta/40", icone: "text-alerta" },
  info: { Icone: Info, caixa: "bg-mar-50 ring-acento/30", icone: "text-acento" },
};

const quantasPessoas = (n: number) => `${n} ${n === 1 ? "pessoa disse" : "pessoas disseram"} que também ${n === 1 ? "está" : "estão"} com esse problema`;

function useEncerrar(a: AvisoTI) {
  const [encerrando, setEncerrando] = useState(false);
  async function encerrar() {
    setEncerrando(true);
    try {
      await encerrarAviso(a.id);
      avisar("Aviso encerrado.");
    } catch (err) {
      avisar(mensagemErro(err), { tipo: "erro" });
      setEncerrando(false);
    }
  }
  return { encerrando, encerrar };
}

function CartaoAviso({ a, podeEncerrar }: { a: AvisoTI; podeEncerrar: boolean }) {
  const { Icone, caixa, icone } = ESTILO[a.tipo];
  const { encerrando, encerrar } = useEncerrar(a);
  return (
    <li className={`flex gap-2.5 rounded-xl p-3 text-sm ring-1 ${caixa}`}>
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
      titulo="Avisar todos"
      subtitulo={<p className="mt-0.5 text-sm text-tinta-2">Aparece para todos, inclusive em Novo chamado. Evita vários chamados do mesmo problema.</p>}
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
    <section aria-label="Avisos do TI" className="space-y-1.5">
      {avisos.map((a) => <LinhaAviso key={a.id} a={a} podeEncerrar={tecnico} />)}
      {tecnico && (
        <button
          type="button"
          onClick={() => setNovo(true)}
          className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left font-semibold text-tinta-2 hover:bg-fundo hover:text-tinta"
        >
          <Megaphone className="size-5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">Avisar todos</span>
          {!avisos.length && <span className="text-xs font-normal">nenhum no ar</span>}
          {!!avisos.length && <Plus className="size-4 shrink-0" aria-hidden="true" />}
        </button>
      )}
      {janela}
    </section>
  );
}

function LinhaAviso({ a, podeEncerrar }: { a: AvisoTI; podeEncerrar: boolean }) {
  const { Icone, caixa, icone } = ESTILO[a.tipo];
  const { encerrando, encerrar } = useEncerrar(a);
  const fim = someEm(a.ate);
  return (
    <div className={`rounded-xl p-2.5 text-sm ring-1 ${caixa}`}>
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
            {encerrando ? "Encerrando..." : "Resolvido, encerrar"}
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
        <p className="text-xs text-tinta-2">Nenhum aviso agora. Algo fora do ar? Avise todos por aqui.</p>
      ) : (
        <ul className="space-y-2">{avisos.map((a) => <CartaoAviso key={a.id} a={a} podeEncerrar={tecnico} />)}</ul>
      )}
      {novo && <NovoAviso aoFechar={() => setNovo(false)} />}
    </section>
  );
}
