import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { SeletorAnexos } from "../components/Anexos";
import { EscolhaCategoria, EscolhaImpacto } from "../components/CamposChamado";
import { useAuth } from "../lib/auth";
import { mensagemErro, pb, type Chamado, type Impacto } from "../lib/pb";

export function NovoChamado() {
  const { usuario } = useAuth();
  const navegar = useNavigate();
  // ?local=... vem do QR code colado na sala ou no equipamento
  const [params] = useSearchParams();
  const [categoria, setCategoria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [impacto, setImpacto] = useState<Impacto | "">("");
  const [local, setLocal] = useState(params.get("local") ?? "");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function abrir(e: FormEvent) {
    e.preventDefault();
    setErro("");
    if (!categoria) return setErro("Escolha o que está com problema.");
    setEnviando(true);
    try {
      const dados = new FormData();
      dados.append("categoria", categoria);
      dados.append("descricao", descricao);
      dados.append("impacto", impacto);
      dados.append("local", local);
      arquivos.forEach((f) => dados.append("anexos", f));
      const c = await pb.collection("chamados").create<Chamado>(dados);
      navegar(`/chamado/${c.id}`, { state: { novo: true } });
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  }

  const setor = usuario?.expand?.setor?.nome;

  return (
    <form onSubmit={abrir} className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-3xl font-bold">Abrir chamado</h1>

      <EscolhaCategoria valor={categoria} onChange={setCategoria} />

      <div>
        <label htmlFor="descricao" className="rotulo text-lg">Conte o que está acontecendo</label>
        <textarea
          id="descricao"
          required
          className="campo min-h-32"
          placeholder="Ex.: a impressora da recepção mostra uma luz laranja e não imprime desde hoje cedo."
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
      </div>

      <EscolhaImpacto valor={impacto} onChange={setImpacto} />

      <div>
        <label htmlFor="local" className="rotulo text-lg">Onde?</label>
        <input id="local" className="campo" placeholder="Sala, andar ou equipamento" value={local} onChange={(e) => setLocal(e.target.value)} />
        {setor && <p className="ajuda">Seu setor: {setor}</p>}
      </div>

      <div>
        <p className="rotulo text-lg">Foto ou vídeo (opcional)</p>
        <p className="ajuda mb-3 mt-0">Uma foto da tela ou da mensagem de erro ajuda o TI a chegar com a solução.</p>
        <SeletorAnexos arquivos={arquivos} onChange={setArquivos} />
      </div>

      {erro && <p role="alert" className="font-semibold text-brasa-700">{erro}</p>}
      <button className="btn-primario w-full text-lg" disabled={enviando}>
        {enviando ? "Enviando..." : "Abrir chamado"}
      </button>
    </form>
  );
}
