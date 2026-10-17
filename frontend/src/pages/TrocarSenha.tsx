import { CheckCircle2, Circle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { TelaAcesso } from "../components/TelaAcesso";
import { senhaLembrada, useAuth } from "../lib/auth";
import { mensagemErro, pb } from "../lib/pb";

/**
 * Primeiro acesso (ou senha trocada pelo TI): a pessoa entrou com a senha provisória
 * e precisa escolher a própria antes de usar o sistema. O servidor também barra
 * abrir chamado enquanto trocar_senha = true.
 */
export function TrocarSenha() {
  const { usuario, sair } = useAuth();
  const lembrada = senhaLembrada();
  const [provisoria, setProvisoria] = useState(lembrada);
  const [nova, setNova] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const regras = [
    { ok: nova.length >= 8, texto: "Pelo menos 8 caracteres" },
    { ok: !!nova && nova !== provisoria, texto: "Diferente da senha provisória" },
    { ok: !!nova && nova === confirmar, texto: "As duas senhas iguais" },
  ];
  const pronta = regras.every((r) => r.ok) && !!provisoria;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!usuario || !pronta) return;
    setErro("");
    setSalvando(true);
    try {
      const atualizado = await pb.collection("users").update(usuario.id, {
        oldPassword: provisoria,
        password: nova,
        passwordConfirm: confirmar,
      });
      // trocar a senha encerra a sessão: entra de novo com a senha nova
      await pb.collection("users").authWithPassword(atualizado.matricula || atualizado.email, nova, { expand: "setor" });
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <TelaAcesso titulo="Crie a sua senha">
      <form onSubmit={salvar} className="space-y-5">
        <p className="text-tinta-2">
          Olá, <b className="text-tinta">{usuario?.name.split(" ")[0]}</b>. A senha que o TI passou é provisória: escolha uma só sua para continuar.
        </p>
        {!lembrada && (
          <div>
            <label htmlFor="provisoria" className="rotulo">Senha provisória</label>
            <input id="provisoria" type="password" autoComplete="current-password" required className="campo" value={provisoria} onChange={(e) => setProvisoria(e.target.value)} />
          </div>
        )}
        <div>
          <label htmlFor="nova" className="rotulo">Nova senha</label>
          <input id="nova" type="password" autoComplete="new-password" required className="campo" value={nova} onChange={(e) => setNova(e.target.value)} />
        </div>
        <div>
          <label htmlFor="confirmar" className="rotulo">Repita a nova senha</label>
          <input id="confirmar" type="password" autoComplete="new-password" required className="campo" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
        </div>
        <ul className="space-y-1 text-sm" aria-label="Regras da senha">
          {regras.map((r) => (
            <li key={r.texto} className={`flex items-center gap-2 ${r.ok ? "font-semibold text-ok" : "text-tinta-2"}`}>
              {r.ok ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <Circle className="size-4" aria-hidden="true" />}
              {r.texto}
            </li>
          ))}
        </ul>
        {erro && <p role="alert" className="font-semibold text-alerta">{erro}</p>}
        <button className="btn-primario w-full" disabled={salvando || !pronta}>{salvando ? "Salvando..." : "Salvar e entrar"}</button>
        <button type="button" onClick={sair} className="btn w-full text-tinta-2 hover:text-tinta">Sair</button>
      </form>
    </TelaAcesso>
  );
}
