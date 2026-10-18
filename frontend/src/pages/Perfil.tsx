import { Building2, CheckCircle2, Circle, KeyRound, LogOut, Mail, Phone, ShieldCheck, Wrench } from "lucide-react";
import { irParaProximo } from "../lib/jeitoDeApp";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router";
import { Avatar } from "../components/Avatar";
import { BotaoTema } from "../components/BotaoTema";
import { useTamanhoTexto, type TamanhoTexto } from "../lib/tamanhoTexto";
import { useAuth } from "../lib/auth";
import { avisar } from "../lib/avisos";
import { ehAdmin, ehTecnico, mensagemErro, pb, ramalDe, type Usuario } from "../lib/pb";

function Linha({ Icone, rotulo, children }: { Icone: typeof Mail; rotulo: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <Icone className="mt-0.5 size-5 shrink-0 text-acento" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-sm text-tinta-2">{rotulo}</dt>
        <dd className="font-semibold break-words">{children}</dd>
      </div>
    </div>
  );
}

/** Números rápidos: do servidor (chamados que abriu) ou do técnico (que atendeu). */
function Numeros({ u }: { u: Usuario }) {
  const tecnico = ehTecnico(u);
  const [n, setN] = useState<{ a: number; b: number } | null>(null);
  useEffect(() => {
    const contar = (filter: string) => pb.collection("chamados").getList(1, 1, { filter, fields: "id", requestKey: null }).then((r) => r.totalItems);
    const f = (s: string) => pb.filter(s, { u: u.id });
    Promise.all(tecnico
      ? [contar(f('responsavel = {:u} && status = "em_andamento"')), contar(f('responsavel = {:u} && status = "resolvido"'))]
      : [contar(f('solicitante = {:u} && (status != "resolvido" || confirmado = false)')), contar(f('solicitante = {:u} && status = "resolvido"'))],
    ).then(([a, b]) => setN({ a, b })).catch(() => {});
  }, [u.id, tecnico]);

  const cartao = (valor: number | undefined, rotulo: string, para: string) => (
    <Link to={para} className="rounded-2xl bg-superficie p-4 ring-1 ring-linha hover:ring-acento">
      <span className="block font-display text-3xl font-extrabold">{valor ?? "–"}</span>
      <span className="text-sm font-semibold text-tinta-2">{rotulo}</span>
    </Link>
  );
  return (
    <div className="grid grid-cols-2 gap-3">
      {tecnico ? (
        <>
          {cartao(n?.a, "atendendo agora", "/ti")}
          {cartao(n?.b, "resolvidos por você", "/ti/historico")}
        </>
      ) : (
        <>
          {cartao(n?.a, "em aberto", "/")}
          {cartao(n?.b, "resolvidos", "/?aba=historico")}
        </>
      )}
    </div>
  );
}

function TrocarMinhaSenha({ u }: { u: Usuario }) {
  const [aberto, setAberto] = useState(false);
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const regras = [
    { ok: nova.length >= 8, texto: "Pelo menos 8 caracteres" },
    { ok: !!nova && nova !== atual, texto: "Diferente da senha atual" },
    { ok: !!nova && nova === confirmar, texto: "As duas senhas iguais" },
  ];

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!regras.every((r) => r.ok) || !atual) return;
    setErro("");
    setSalvando(true);
    try {
      const r = await pb.collection("users").update(u.id, { oldPassword: atual, password: nova, passwordConfirm: confirmar });
      // trocar a senha encerra a sessão: entra de novo com a nova
      await pb.collection("users").authWithPassword(r.matricula || r.email, nova, { expand: "setor" });
      avisar("Senha trocada.");
      setAberto(false); setAtual(""); setNova(""); setConfirmar("");
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) {
    return (
      <button type="button" className="btn-secundario w-full sm:w-auto" onClick={() => setAberto(true)}>
        <KeyRound className="size-5" aria-hidden="true" /> Trocar minha senha
      </button>
    );
  }
  return (
    <form onSubmit={salvar} className="space-y-4 rounded-2xl bg-superficie p-5 ring-1 ring-linha">
      <h2 className="text-lg font-bold">Trocar minha senha</h2>
      <div>
        <label htmlFor="s-atual" className="rotulo">Senha atual</label>
        <input id="s-atual" type="password" enterKeyHint="next" onKeyDown={irParaProximo} autoComplete="current-password" required className="campo" value={atual} onChange={(e) => setAtual(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="s-nova" className="rotulo">Nova senha</label>
          <input id="s-nova" type="password" enterKeyHint="next" onKeyDown={irParaProximo} autoComplete="new-password" required className="campo" value={nova} onChange={(e) => setNova(e.target.value)} />
        </div>
        <div>
          <label htmlFor="s-conf" className="rotulo">Repita a nova senha</label>
          <input id="s-conf" type="password" enterKeyHint="go" autoComplete="new-password" required className="campo" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
        </div>
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
      <div className="flex flex-wrap gap-2">
        <button className="btn-primario" disabled={salvando || !atual || !regras.every((r) => r.ok)}>{salvando ? "Salvando..." : "Salvar nova senha"}</button>
        <button type="button" className="btn-secundario" onClick={() => { setAberto(false); setErro(""); }}>Cancelar</button>
      </div>
    </form>
  );
}

/** Meu perfil: quem eu sou no sistema (dados que o TI cadastrou), meus números e trocar a senha. */
export function Perfil() {
  const { usuario, sair } = useAuth();
  const [u, setU] = useState<Usuario | null>(usuario);

  // dados frescos (o admin pode ter mudado setor ou ramal)
  useEffect(() => {
    if (!usuario) return;
    pb.collection("users").getOne<Usuario>(usuario.id, { expand: "setor", requestKey: null }).then(setU).catch(() => {});
  }, [usuario?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.title = "Meu perfil | Dino Desk";
    return () => { document.title = "Dino Desk"; };
  }, []);

  if (!u) return null;
  const tipo = ehAdmin(u) ? "Administrador do TI" : ehTecnico(u) ? "Técnico do TI" : "Servidor";
  const TipoIcone = ehAdmin(u) ? ShieldCheck : ehTecnico(u) ? Wrench : Building2;
  const ramal = ramalDe(u);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="flex items-center gap-4">
        <Avatar id={u.id} nome={u.name} tamanho="lg" />
        <div className="min-w-0">
          <h1 className="text-3xl font-bold break-words">{u.name}</h1>
          <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-mar-50 px-3 py-1 text-sm font-bold text-acento">
            <TipoIcone className="size-4" aria-hidden="true" /> {tipo}
          </p>
        </div>
      </section>

      <Numeros u={u} />

      <section className="rounded-2xl bg-superficie px-5 py-2 ring-1 ring-linha">
        <dl className="divide-y divide-linha">
          <Linha Icone={KeyRound} rotulo="Matrícula (o seu login)">{u.matricula || <span className="text-tinta-2">não cadastrada (entre com o e-mail)</span>}</Linha>
          <Linha Icone={Building2} rotulo="Setor">{u.expand?.setor?.nome || <span className="text-tinta-2">sem setor</span>}</Linha>
          <Linha Icone={Phone} rotulo={u.ramal ? "Ramal" : "Ramal do setor"}>{ramal || <span className="text-tinta-2">não cadastrado</span>}</Linha>
          <Linha Icone={Mail} rotulo="E-mail">{u.email || <span className="text-tinta-2">sem e-mail (os avisos ficam só no sistema)</span>}</Linha>
        </dl>
      </section>
      <p className="text-sm text-tinta-2">
        Algum dado errado? {ehAdmin(u) ? "Corrija em Pessoas e setores." : "Peça ao administrador do TI para corrigir."}
      </p>

      <TrocarMinhaSenha u={u} />

      <TamanhoDoTexto />

      <section className="flex flex-wrap items-center justify-between gap-3 border-t border-linha pt-5">
        <span className="flex items-center gap-2 text-sm font-semibold text-tinta-2">Tema da tela <BotaoTema /></span>
        <button type="button" onClick={sair} className="btn-perigo">
          <LogOut className="size-5" aria-hidden="true" /> Sair da conta
        </button>
      </section>
    </div>
  );
}

/** Tamanho do texto da tela inteira (no lugar do zoom de pinça). Vale só neste aparelho. */
function TamanhoDoTexto() {
  const { tamanho, mudar } = useTamanhoTexto();
  const opcoes: { id: TamanhoTexto; rotulo: string; letra: string }[] = [
    { id: "normal", rotulo: "Normal", letra: "text-base" },
    { id: "grande", rotulo: "Grande", letra: "text-xl" },
    { id: "maior", rotulo: "Maior", letra: "text-2xl" },
  ];
  return (
    <section aria-labelledby="t-texto" className="space-y-2">
      <h2 id="t-texto" className="text-lg font-bold">Tamanho do texto</h2>
      <div role="radiogroup" aria-labelledby="t-texto" className="grid grid-cols-3 gap-1 rounded-xl bg-superficie p-1 ring-1 ring-linha">
        {opcoes.map((o) => (
          <label
            key={o.id}
            className={`flex min-h-14 cursor-pointer flex-col items-center justify-center rounded-lg px-2 font-semibold ${
              tamanho === o.id ? "bg-mar-700 text-white" : "text-tinta-2 hover:bg-fundo hover:text-tinta"
            }`}
          >
            <input type="radio" name="tamanho-texto" className="sr-only" checked={tamanho === o.id} onChange={() => mudar(o.id)} />
            <span className={`font-display leading-none font-extrabold ${o.letra}`} aria-hidden="true">A</span>
            <span className="text-xs">{o.rotulo}</span>
          </label>
        ))}
      </div>
      <p className="text-sm text-tinta-2">Deixa a tela inteira maior ou menor. Vale só neste aparelho.</p>
    </section>
  );
}
