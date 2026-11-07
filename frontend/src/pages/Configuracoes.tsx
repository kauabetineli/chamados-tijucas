import { ArrowLeft, Building2, CheckCircle2, Circle, KeyRound, LogOut, Mail, Monitor, Moon, Phone, Sun } from "lucide-react";
import { Dica } from "../components/Dica";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router";
import { irParaProximo } from "../lib/jeitoDeApp";
import { useTamanhoTexto, type TamanhoTexto } from "../lib/tamanhoTexto";
import { useTema, type Tema } from "../lib/tema";
import { useAuth } from "../lib/auth";
import { avisar } from "../lib/avisos";
import { ehAdmin, mensagemErro, pb, ramalDe, type Usuario } from "../lib/pb";
import { CampoSenha } from "../components/CampoSenha";

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
        <CampoSenha id="s-atual" enterKeyHint="next" onKeyDown={irParaProximo} autoComplete="current-password" required value={atual} onChange={(e) => setAtual(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="s-nova" className="rotulo">Nova senha</label>
          <CampoSenha id="s-nova" enterKeyHint="next" onKeyDown={irParaProximo} autoComplete="new-password" required value={nova} onChange={(e) => setNova(e.target.value)} />
        </div>
        <div>
          <label htmlFor="s-conf" className="rotulo">Repita a nova senha</label>
          <CampoSenha id="s-conf" enterKeyHint="go" autoComplete="new-password" required value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
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

/** Configurações (a engrenagem de "Você"): aparência deste aparelho, conta (senha e meus dados) e sair. */
export function Configuracoes() {
  const { usuario, sair } = useAuth();
  const [u, setU] = useState<Usuario | null>(usuario);
  useEffect(() => {
    if (!usuario) return;
    pb.collection("users").getOne<Usuario>(usuario.id, { expand: "setor", requestKey: null }).then(setU).catch(() => {});
  }, [usuario?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    document.title = "Configurações | Dino Desk";
    return () => { document.title = "Dino Desk"; };
  }, []);
  if (!u) return null;
  const ramal = ramalDe(u);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex min-h-[4.5rem] items-start gap-2">
        <Link to="/perfil" className="-ml-2 grid size-11 place-items-center rounded-full text-acento hover:bg-mar-50" aria-label="Voltar para Você">
          <ArrowLeft className="size-6" aria-hidden="true" />
        </Link>
        <h1 className="text-3xl font-bold">Configurações</h1>
      </div>

      <section aria-labelledby="c-aparencia" className="space-y-2">
        <h2 id="c-aparencia" className="px-1 text-sm font-bold tracking-wide text-tinta-2 uppercase">Aparência</h2>
        <div className="space-y-5 rounded-2xl bg-superficie p-4 ring-1 ring-linha">
          <EscolhaTema />
          <TamanhoDoTexto />
        </div>
      </section>

      <section aria-labelledby="c-conta" className="space-y-2">
        <h2 id="c-conta" className="px-1 text-sm font-bold tracking-wide text-tinta-2 uppercase">Conta</h2>
        <div className="rounded-2xl bg-superficie px-5 py-2 ring-1 ring-linha">
          <dl className="divide-y divide-linha">
            <Linha Icone={KeyRound} rotulo="Matrícula (o seu login)">{u.matricula || <span className="text-tinta-2">não cadastrada (entre com o e-mail)</span>}</Linha>
            <Linha Icone={Building2} rotulo="Setor">{u.expand?.setor?.nome || <span className="text-tinta-2">sem setor</span>}</Linha>
            <Linha Icone={Phone} rotulo={u.ramal ? "Ramal" : "Ramal do setor"}>{ramal || <span className="text-tinta-2">não cadastrado</span>}</Linha>
            <Linha Icone={Mail} rotulo="E-mail">{u.email || <span className="text-tinta-2">sem e-mail (os avisos ficam só no sistema)</span>}</Linha>
          </dl>
        </div>
        <p className="px-1 text-sm text-tinta-2">
          Algum dado errado? {ehAdmin(u) ? "Corrija em Pessoas e setores." : "Peça ao administrador do TI para corrigir."}
        </p>
        <TrocarMinhaSenha u={u} />
      </section>

      <div className="border-t border-linha pt-5">
        <button type="button" onClick={sair} className="btn-perigo w-full sm:w-auto">
          <LogOut className="size-5" aria-hidden="true" /> Sair da conta
        </button>
      </div>
    </div>
  );
}

/** Tema deste aparelho: Automático (segue o aparelho), Claro ou Escuro. */
function EscolhaTema() {
  const [tema, setTema] = useTema();
  const opcoes: { id: Tema; rotulo: string; Icone: typeof Sun }[] = [
    { id: "auto", rotulo: "Automático", Icone: Monitor },
    { id: "claro", rotulo: "Claro", Icone: Sun },
    { id: "escuro", rotulo: "Escuro", Icone: Moon },
  ];
  return (
    <div className="space-y-2">
      <h3 id="t-tema" className="font-bold">Tema</h3>
      <div role="radiogroup" aria-labelledby="t-tema" className="grid grid-cols-3 gap-1 rounded-xl bg-fundo p-1">
        {opcoes.map((o) => (
          <label
            key={o.id}
            className={`flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg px-2 text-sm font-semibold ${
              tema === o.id ? "bg-superficie text-tinta ring-2 ring-acento" : "text-tinta-2 hover:text-tinta"
            }`}
          >
            <input type="radio" name="tema" className="sr-only" checked={tema === o.id} onChange={() => setTema(o.id)} />
            <o.Icone className={`size-5 ${tema === o.id ? "text-acento" : ""}`} aria-hidden="true" />
            {o.rotulo}
          </label>
        ))}
      </div>
      <p className="text-sm text-tinta-2">{tema === "auto" ? "Segue o tema do aparelho." : tema === "escuro" ? "Fundo preto, bom para a bateria em telas AMOLED." : "Sempre claro."}</p>
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
      <h3 id="t-texto" className="flex items-center gap-2 font-bold">
        Tamanho do texto
        <Dica rotulo="Ajuda sobre tamanho do texto">Deixa a tela inteira maior ou menor. Vale só neste aparelho.</Dica>
      </h3>
      <div role="radiogroup" aria-labelledby="t-texto" className="grid grid-cols-3 gap-1 rounded-xl bg-fundo p-1">
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
    </section>
  );
}
