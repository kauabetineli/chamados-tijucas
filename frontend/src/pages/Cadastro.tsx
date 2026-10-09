import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { TelaAcesso } from "../components/TelaAcesso";
import { destinoSeguro, mensagemErro, pb, type Setor } from "../lib/pb";

export function Cadastro() {
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const voltar = params.get("voltar");
  const [setores, setSetores] = useState<Setor[]>([]);
  const [form, setForm] = useState({ name: "", email: "", setor: "", telefone: "", password: "" });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    pb.collection("setores").getFullList<Setor>({ sort: "nome", filter: "ativo = true" }).then(setSetores).catch(() => {});
  }, []);

  const mudar = (campo: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [campo]: e.target.value });

  async function criar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    try {
      await pb.collection("users").create({ ...form, email: form.email.trim(), passwordConfirm: form.password });
      await pb.collection("users").authWithPassword(form.email.trim(), form.password, { expand: "setor" });
      navegar(destinoSeguro(voltar) ?? "/", { replace: true });
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <TelaAcesso titulo="Criar conta">
      <form onSubmit={criar} className="space-y-5">
        <div>
          <label htmlFor="nome" className="rotulo">Nome completo</label>
          <input id="nome" required autoComplete="name" className="campo" value={form.name} onChange={mudar("name")} />
        </div>
        <div>
          <label htmlFor="email" className="rotulo">E-mail</label>
          <input id="email" type="email" required autoComplete="email" className="campo" value={form.email} onChange={mudar("email")} />
          <p className="ajuda">De preferência o e-mail da Prefeitura. É por ele que você recebe os avisos.</p>
        </div>
        <div>
          <label htmlFor="setor" className="rotulo">Setor</label>
          <select id="setor" required className="campo" value={form.setor} onChange={mudar("setor")}>
            <option value="">Escolha o seu setor</option>
            {setores.map((s) => (
              <option key={s.id} value={s.id}>{s.nome}{s.predio ? ` (${s.predio})` : ""}</option>
            ))}
          </select>
          <p className="ajuda">Não achou o seu setor? Peça ao TI para cadastrá-lo.</p>
        </div>
        <div>
          <label htmlFor="telefone" className="rotulo">Ramal ou telefone (opcional)</label>
          <input id="telefone" inputMode="tel" className="campo" value={form.telefone} onChange={mudar("telefone")} />
        </div>
        <div>
          <label htmlFor="senha" className="rotulo">Senha</label>
          <input id="senha" type="password" required minLength={8} autoComplete="new-password" className="campo" value={form.password} onChange={mudar("password")} />
          <p className="ajuda">Pelo menos 8 caracteres.</p>
        </div>
        {erro && <p role="alert" className="font-semibold text-brasa-700">{erro}</p>}
        <button className="btn-primario w-full" disabled={salvando}>{salvando ? "Criando..." : "Criar conta"}</button>
        <p className="text-center">
          Já tem conta? <Link to="/entrar" className="font-semibold text-mar-700 underline underline-offset-4">Entrar</Link>
        </p>
      </form>
    </TelaAcesso>
  );
}
