import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { TelaAcesso } from "../components/TelaAcesso";
import { destinoSeguro, mensagemErro, pb } from "../lib/pb";

export function Entrar() {
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const voltar = params.get("voltar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setEntrando(true);
    try {
      const { record } = await pb.collection("users").authWithPassword(email.trim(), senha, { expand: "setor" });
      navegar(destinoSeguro(voltar) ?? (record.papel === "tecnico" ? "/ti" : "/"), { replace: true });
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setEntrando(false);
    }
  }

  return (
    <TelaAcesso titulo="Entrar">
      <form onSubmit={entrar} className="space-y-5">
        <div>
          <label htmlFor="email" className="rotulo">E-mail</label>
          <input id="email" type="email" autoComplete="email" required className="campo" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="senha" className="rotulo">Senha</label>
          <input id="senha" type="password" autoComplete="current-password" required className="campo" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </div>
        {erro && <p role="alert" className="font-semibold text-alerta">{erro}</p>}
        <button className="btn-primario w-full" disabled={entrando}>{entrando ? "Entrando..." : "Entrar"}</button>
        <p className="text-center">
          Primeiro acesso? <Link to={`/cadastro${voltar ? `?voltar=${encodeURIComponent(voltar)}` : ""}`} className="font-semibold text-acento underline underline-offset-4">Criar conta</Link>
        </p>
        <p className="text-center text-sm text-tinta-2">Esqueceu a senha? Fale com o Departamento de TI.</p>
      </form>
    </TelaAcesso>
  );
}
