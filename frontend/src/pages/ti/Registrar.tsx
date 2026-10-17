import { MessageCircle, Phone, UserRound, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { SeletorAnexos } from "../../components/Anexos";
import { EscolhaCategoria, EscolhaImpacto } from "../../components/CamposChamado";
import { ProgressoEnvio } from "../../components/ProgressoEnvio";
import { criarComProgresso } from "../../lib/envio";
import { avisar } from "../../lib/avisos";
import { mensagemErro, pb, type Chamado, type Impacto, type Origem, type Setor, type Usuario } from "../../lib/pb";

const ORIGENS: { valor: Origem; rotulo: string; Icone: typeof Phone }[] = [
  { valor: "whatsapp", rotulo: "WhatsApp", Icone: MessageCircle },
  { valor: "ligacao", rotulo: "Ligação", Icone: Phone },
  { valor: "presencial", rotulo: "Presencial", Icone: UserRound },
];

/**
 * Registro rápido pelo técnico de um pedido que chegou fora do sistema.
 * É o que garante que TODO atendimento entre na contagem e no histórico.
 */
export function Registrar() {
  const [origem, setOrigem] = useState<Origem>("whatsapp");
  const [busca, setBusca] = useState("");
  const [sugestoes, setSugestoes] = useState<Usuario[]>([]);
  const [solicitante, setSolicitante] = useState<Usuario | null>(null);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [setor, setSetor] = useState("");
  const [categoria, setCategoria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [impacto, setImpacto] = useState<Impacto | "">("so_eu");
  const [resolvido, setResolvido] = useState(false);
  const [diagnostico, setDiagnostico] = useState("");
  const [solucao, setSolucao] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [progresso, setProgresso] = useState<number | null>(null);
  const [preparandoAnexo, setPreparandoAnexo] = useState(false);

  useEffect(() => {
    pb.collection("setores").getFullList<Setor>({ sort: "nome" }).then(setSetores).catch(() => {});
  }, []);

  // busca de servidores cadastrados, a partir de 2 letras
  useEffect(() => {
    if (solicitante || busca.trim().length < 2) return setSugestoes([]);
    const t = window.setTimeout(() => {
      pb.collection("users")
        .getList<Usuario>(1, 6, { filter: pb.filter("name ~ {:q} || email ~ {:q} || matricula ~ {:q}", { q: busca.trim() }), sort: "name", expand: "setor" })
        .then((r) => setSugestoes(r.items))
        .catch(() => {});
    }, 250);
    return () => window.clearTimeout(t);
  }, [busca, solicitante]);

  function escolher(u: Usuario) {
    setSolicitante(u);
    setBusca(u.name);
    if (u.setor) setSetor(u.setor);
    setSugestoes([]);
  }

  function limpar() {
    setSolicitante(null); setBusca(""); setSetor(""); setCategoria(""); setDescricao("");
    setImpacto("so_eu"); setResolvido(false); setDiagnostico(""); setSolucao(""); setArquivos([]);
  }

  async function registrar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    if (!categoria) return setErro("Escolha a categoria.");
    if (!solicitante && !busca.trim()) return setErro("Informe quem pediu.");
    setSalvando(true);
    setProgresso(arquivos.length ? 0 : null);
    try {
      const d = new FormData();
      d.append("origem", origem);
      if (solicitante) d.append("solicitante", solicitante.id);
      else d.append("solicitante_nome", busca.trim());
      d.append("setor", setor);
      d.append("categoria", categoria);
      d.append("descricao", descricao);
      d.append("impacto", impacto);
      d.append("status", resolvido ? "resolvido" : "aberto");
      if (resolvido) { d.append("diagnostico", diagnostico); d.append("solucao", solucao); }
      arquivos.forEach((f) => d.append("anexos", f));
      const c = await criarComProgresso<Chamado>("chamados", d, setProgresso);
      avisar(`Registrado como ${c.protocolo}. ${c.status === "resolvido" ? "Já entrou no histórico." : "Já está na fila."}`, {
        link: { para: `/ti/chamado/${c.id}`, rotulo: "Abrir" },
        duracao: 6000,
      });
      limpar();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
      setProgresso(null);
    }
  }

  return (
    <form onSubmit={registrar} className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Registrar pedido</h1>
        <p className="mt-1 text-tinta-2">Para o que chegou por WhatsApp, ligação ou no corredor. Leva menos de um minuto.</p>
      </div>


      <fieldset>
        <legend className="rotulo text-lg">Como chegou?</legend>
        <div className="grid grid-cols-3 gap-2">
          {ORIGENS.map(({ valor, rotulo, Icone }) => (
            <label key={valor} className="opcao flex-col justify-center gap-1 text-center">
              <input type="radio" name="origem" checked={origem === valor} onChange={() => setOrigem(valor)} className="sr-only" />
              <Icone className="size-6 text-acento" aria-hidden="true" />
              {rotulo}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="relative">
        <label htmlFor="quem" className="rotulo text-lg">Quem pediu?</label>
        <div className="relative">
          <input
            id="quem"
            className="campo pr-12"
            autoComplete="off"
            placeholder="Nome ou matrícula"
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setSolicitante(null); }}
          />
          {busca && (
            <button type="button" onClick={() => { setBusca(""); setSolicitante(null); }} className="absolute top-1/2 right-3 -translate-y-1/2 p-1 text-tinta-2" aria-label="Limpar nome">
              <X className="size-5" />
            </button>
          )}
        </div>
        {sugestoes.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl bg-superficie shadow-lg ring-1 ring-linha">
            {sugestoes.map((u) => (
              <li key={u.id}>
                <button type="button" onClick={() => escolher(u)} className="w-full px-4 py-3 text-left hover:bg-mar-50">
                  <span className="block font-semibold">{u.name}</span>
                  <span className="block text-sm text-tinta-2">{[u.matricula && `mat. ${u.matricula}`, u.expand?.setor?.nome].filter(Boolean).join(" · ") || u.email}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="ajuda">
          {solicitante
            ? "Servidor cadastrado: ele vai acompanhar o chamado pelo sistema."
            : "Se a pessoa não tiver conta, o nome digitado fica registrado assim mesmo."}
        </p>
      </div>

      <div>
        <label htmlFor="setor" className="rotulo text-lg">Setor</label>
        <select id="setor" className="campo" value={setor} onChange={(e) => setSetor(e.target.value)}>
          <option value="">Não informado</option>
          {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
      </div>

      <EscolhaCategoria valor={categoria} onChange={setCategoria} titulo="Categoria" />

      <div>
        <label htmlFor="descricao" className="rotulo text-lg">O que foi pedido?</label>
        <textarea id="descricao" required className="campo min-h-28" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </div>

      <EscolhaImpacto valor={impacto} onChange={setImpacto} />

      <div>
        <p className="rotulo text-lg">Print ou foto (opcional)</p>
        <SeletorAnexos arquivos={arquivos} onChange={setArquivos} aoPreparar={setPreparandoAnexo} />
      </div>

      <div className="rounded-2xl bg-superficie p-5 ring-1 ring-linha">
        <label className="flex cursor-pointer items-center gap-3 font-semibold">
          <input type="checkbox" checked={resolvido} onChange={(e) => setResolvido(e.target.checked)} className="size-6 accent-ok" />
          Já resolvi na hora
        </label>
        {resolvido && (
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="diag" className="rotulo">Qual era a causa?</label>
              <textarea id="diag" required className="campo min-h-20" value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} />
            </div>
            <div>
              <label htmlFor="sol" className="rotulo">O que foi feito?</label>
              <textarea id="sol" required className="campo min-h-20" value={solucao} onChange={(e) => setSolucao(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {erro && <p role="alert" className="font-semibold text-alerta">{erro}</p>}
      <ProgressoEnvio pct={progresso} />
      <button className="btn-primario w-full text-lg" disabled={salvando || preparandoAnexo}>
        {salvando ? "Registrando..." : resolvido ? "Registrar atendimento resolvido" : "Registrar na fila"}
      </button>
    </form>
  );
}
