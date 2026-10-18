import { useState, type FormEvent } from "react";
import { irParaProximo } from "../lib/jeitoDeApp";
import { useNavigate, useSearchParams } from "react-router";
import { TelaAcesso } from "../components/TelaAcesso";
import { lembrarSenhaDoLogin } from "../lib/auth";
import { destinoSeguro, mensagemErro, pb } from "../lib/pb";

/**
 * Login pela MATRÍCULA (ou e-mail, para quem tiver). Não existe "criar conta":
 * o administrador do TI cria a conta e entrega uma senha provisória.
 */
export function Entrar() {
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const voltar = params.get("voltar");
  const [identidade, setIdentidade] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setEntrando(true);
    try {
      const id = identidade.trim();
      // matrícula é só número; com @ é e-mail (em minúsculas, como o TI cadastra)
      const { record } = await pb.collection("users").authWithPassword(id.includes("@") ? id.toLowerCase() : id, senha, { expand: "setor" });
      if (record.trocar_senha) lembrarSenhaDoLogin(senha);
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
          <label htmlFor="identidade" className="rotulo">Matrícula</label>
          <input
            id="identidade"
            autoComplete="username"
            enterKeyHint="next"
            onKeyDown={irParaProximo}
            autoCapitalize="none"
            spellCheck={false}
            required
            className="campo"
            placeholder="Ex.: 12345"
            value={identidade}
            onChange={(e) => setIdentidade(e.target.value)}
          />
          <p className="ajuda">Quem tem e-mail cadastrado também pode entrar com ele.</p>
        </div>
        <div>
          <label htmlFor="senha" className="rotulo">Senha</label>
          <input id="senha" type="password" enterKeyHint="go" autoComplete="current-password" required className="campo" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </div>
        {erro && <p role="alert" className="font-semibold text-alerta">{erro}</p>}
        <button className="btn-primario w-full" disabled={entrando}>{entrando ? "Entrando..." : "Entrar"}</button>
        <p className="text-center text-sm text-tinta-2">
          Ainda não tem acesso ou esqueceu a senha? Fale com o Departamento de TI.
        </p>
      </form>
    </TelaAcesso>
  );
}
