import { useState, type FormEvent } from "react";
import { irParaProximo } from "../lib/jeitoDeApp";
import { useNavigate, useSearchParams } from "react-router";
import { TelaAcesso } from "../components/TelaAcesso";
import { lembrarSenhaDoLogin } from "../lib/auth";
import { destinoSeguro, mensagemErro, pb } from "../lib/pb";
import { CampoSenha } from "../components/CampoSenha";
import { Dica, idDaDica, RotuloComDica } from "../components/Dica";

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
          <RotuloComDica htmlFor="identidade" dica="Quem tem e-mail cadastrado também pode entrar com ele.">Matrícula</RotuloComDica>
          <input
            id="identidade"
            autoComplete="username"
            enterKeyHint="next"
            onKeyDown={irParaProximo}
            autoCapitalize="none"
            spellCheck={false}
            required
            className="campo"
            inputMode="text"
            aria-describedby={idDaDica("identidade")}
            placeholder="Ex.: 12345"
            value={identidade}
            onChange={(e) => setIdentidade(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="senha" className="rotulo">Senha</label>
          <CampoSenha id="senha" enterKeyHint="go" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
        </div>
        {erro && <p role="alert" className="font-semibold text-alerta">{erro}</p>}
        <button className="btn-primario w-full" disabled={entrando}>{entrando ? "Entrando..." : "Entrar"}</button>
        <p className="text-center">
          <Dica texto="Não consegue entrar?">
            Esqueceu a senha ou ainda não tem acesso? Fale com o Departamento de TI: eles criam a conta e passam uma senha provisória.
          </Dica>
        </p>
      </form>
    </TelaAcesso>
  );
}
