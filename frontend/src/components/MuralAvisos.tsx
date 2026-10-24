import { AlertTriangle, Info, Megaphone, Plus, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { avisar } from "../lib/avisos";
import { encerrarAviso, PRAZOS, publicarAviso, useAvisosTI, type AvisoTI, type Prazo } from "../lib/avisosTI";
import { tempoRelativo } from "../lib/formato";
import { ehTecnico, mensagemErro } from "../lib/pb";
import { PainelRapido } from "./PainelRapido";

const ESTILO = {
  problema: { Icone: AlertTriangle, caixa: "bg-brasa-50 ring-alerta/40", icone: "text-alerta" },
  info: { Icone: Info, caixa: "bg-mar-50 ring-acento/30", icone: "text-acento" },
};

function horaFim(ate: string) {
  const d = new Date(ate.replace(" ", "T"));
  const hoje = new Date().toDateString() === d.toDateString();
  return hoje
    ? `até ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
    : `até ${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
}

function CartaoAviso({ a, podeEncerrar }: { a: AvisoTI; podeEncerrar: boolean }) {
  const { Icone, caixa, icone } = ESTILO[a.tipo];
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
  return (
    <li className={`flex gap-2.5 rounded-xl p-3 text-sm ring-1 ${caixa}`}>
      <Icone className={`mt-0.5 size-4 shrink-0 ${icone}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="texto-livre font-semibold">{a.texto}</p>
        <p className="mt-0.5 text-xs text-tinta-2">
          {a.expand?.autor?.name?.split(" ")[0] ?? "TI"} · {tempoRelativo(a.created)}{a.ate ? ` · ${horaFim(a.ate)}` : ""}
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

function NovoAviso({ aoFechar }: { aoFechar: () => void }) {
  const { usuario } = useAuth();
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState<AvisoTI["tipo"]>("problema");
  const [prazo, setPrazo] = useState<Prazo>("4h");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function publicar(e?: FormEvent) {
    e?.preventDefault();
    if (!usuario || !texto.trim()) return;
    setErro("");
    setSalvando(true);
    try {
      await publicarAviso(texto.trim(), tipo, prazo, usuario.id);
      avisar("Aviso publicado para todos.");
      aoFechar();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <PainelRapido
      idTitulo="titulo-novo-aviso"
      largura="max-w-md"
      titulo="Novo aviso do TI"
      subtitulo={<p className="mt-0.5 text-sm text-tinta-2">Todos veem no sistema. Bom para evitar vários chamados do mesmo problema.</p>}
      aoTentarFechar={aoFechar}
      rodape={
        <>
          {erro && <p role="alert" className="mb-2 font-semibold text-alerta">{erro}</p>}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <button type="button" className="btn-secundario" onClick={aoFechar}>Cancelar</button>
            <button type="submit" form="form-aviso" className="btn-primario" disabled={salvando || !texto.trim()}>{salvando ? "Publicando..." : "Publicar"}</button>
          </div>
        </>
      }
    >
      <form id="form-aviso" onSubmit={publicar} className="space-y-4">
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
        <div>
          <label htmlFor="aviso-texto" className="rotulo">Mensagem</label>
          <textarea
            id="aviso-texto" className="campo min-h-24" maxLength={240} required autoFocus
            placeholder={tipo === "problema" ? "Ex.: Internet do Paço instável. Já estamos resolvendo." : "Ex.: Sexta, 18h, manutenção no sistema de protocolo."}
            value={texto} onChange={(e) => setTexto(e.target.value)}
          />
          <p className="ajuda text-right">{texto.length}/240</p>
        </div>
        <div>
          <label htmlFor="aviso-prazo" className="rotulo">Some sozinho em</label>
          <select id="aviso-prazo" className="campo" value={prazo} onChange={(e) => setPrazo(e.target.value as Prazo)}>
            {PRAZOS.map((p) => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
          </select>
        </div>
      </form>
    </PainelRapido>
  );
}

/**
 * Mural "Avisos do TI": avisos em vigor para todos; técnicos publicam e encerram.
 * `compacto` (barra lateral recolhida): só o ícone com a quantidade.
 */
export function MuralAvisos({ compacto, aoExpandir, className = "" }: { compacto?: boolean; aoExpandir?: () => void; className?: string }) {
  const { usuario } = useAuth();
  const tecnico = ehTecnico(usuario);
  const avisos = useAvisosTI();
  const [novo, setNovo] = useState(false);
  const temProblema = avisos?.some((a) => a.tipo === "problema");

  if (compacto) {
    if (!avisos?.length) return null;
    return (
      <button type="button" onClick={aoExpandir} className="relative mx-auto grid size-11 place-items-center rounded-xl text-tinta-2 hover:bg-fundo hover:text-tinta" title={`${avisos.length} aviso(s) do TI`} aria-label={`${avisos.length} avisos do TI. Abrir a barra lateral`}>
        <Megaphone className="size-5" aria-hidden="true" />
        <span className={`absolute -top-0.5 -right-0.5 grid size-5 place-items-center rounded-full text-xs font-bold text-white ${temProblema ? "bg-brasa" : "bg-mar-700"}`}>{avisos.length}</span>
      </button>
    );
  }

  // servidor sem avisos: nada a mostrar
  if (!tecnico && !avisos?.length) return null;

  return (
    <section aria-labelledby="titulo-mural" className={className}>
      <div className="mb-2 flex items-center gap-2">
        <h2 id="titulo-mural" className="flex flex-1 items-center gap-1.5 text-xs font-bold tracking-wider text-tinta-2 uppercase">
          <Megaphone className="size-4" aria-hidden="true" /> Avisos do TI
        </h2>
        {tecnico && (
          <button type="button" onClick={() => setNovo(true)} className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-acento hover:bg-mar-50">
            <Plus className="size-4" aria-hidden="true" /> Novo
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
