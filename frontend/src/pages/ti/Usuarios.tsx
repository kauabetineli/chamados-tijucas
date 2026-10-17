import { Check, Copy, KeyRound, Pencil, Search, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Paginacao, usePaginacao } from "../../components/Paginacao";
import { SeloTeste } from "../../components/Selos";
import { mensagemErro, pb, type Setor } from "../../lib/pb";

/** Usuário como as rotas /api/ti/usuarios devolvem (ver docs/API.md). */
interface UsuarioTI { id: string; nome: string; email: string; setor: string; setor_nome: string; ramal: string; papel: string; ficticio: boolean }
interface RespostaUsuario {
  usuario: UsuarioTI;
  senha_provisoria: string | null;
}

/** Senha provisória mostrada uma única vez, com botão de copiar. */
function CartaoSenha({ r, aoFechar }: { r: RespostaUsuario; aoFechar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const texto = `Dino Desk\nE-mail: ${r.usuario.email}\nSenha provisória: ${r.senha_provisoria}`;
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      // http sem HTTPS pode bloquear a área de transferência: a senha continua visível na tela
    }
  }
  return (
    <div role="status" className="rounded-2xl bg-campo-50 p-5 ring-1 ring-ok/30">
      <p className="font-semibold text-ok">Pronto: {r.usuario.nome}</p>
      <p className="mt-1 text-sm text-tinta-2">Passe a senha para a pessoa. Ela aparece só agora.</p>
      <dl className="mt-3 space-y-1">
        <div className="flex gap-2"><dt className="text-tinta-2">E-mail:</dt><dd className="font-semibold break-all">{r.usuario.email}</dd></div>
        <div className="flex items-baseline gap-2">
          <dt className="text-tinta-2">Senha:</dt>
          <dd className="font-display text-2xl font-extrabold tracking-wide select-all">{r.senha_provisoria}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={copiar} className="btn-secundario">
          {copiado ? <Check className="size-5" aria-hidden="true" /> : <Copy className="size-5" aria-hidden="true" />}
          {copiado ? "Copiado" : "Copiar e-mail e senha"}
        </button>
        <button type="button" onClick={aoFechar} className="btn px-3 text-tinta-2 hover:text-tinta">Fechar</button>
      </div>
    </div>
  );
}

function NovoUsuario({ setores, aoCriar }: { setores: Setor[]; aoCriar: (r: RespostaUsuario) => void }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [setor, setSetor] = useState("");
  const [ramal, setRamal] = useState("");
  const [papel, setPapel] = useState<"solicitante" | "tecnico">("solicitante");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function criar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    try {
      const r = await pb.send<RespostaUsuario>("/api/ti/usuarios", {
        method: "POST",
        body: { nome, email, setor, ramal, papel },
      });
      aoCriar(r);
      setNome(""); setEmail(""); setSetor(""); setRamal(""); setPapel("solicitante");
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={criar} className="space-y-4 rounded-2xl bg-superficie p-5 ring-1 ring-linha md:p-6">
      <h2 className="flex items-center gap-2 text-xl font-bold">
        <UserPlus className="size-6 text-acento" aria-hidden="true" /> Novo usuário
      </h2>
      <div>
        <label htmlFor="u-nome" className="rotulo">Nome</label>
        <input id="u-nome" required className="campo" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" />
      </div>
      <div>
        <label htmlFor="u-email" className="rotulo">E-mail</label>
        <input id="u-email" type="email" required className="campo" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
      </div>
      <div>
        <label htmlFor="u-setor" className="rotulo">Setor</label>
        <select id="u-setor" className="campo" value={setor} onChange={(e) => setSetor(e.target.value)}>
          <option value="">Escolha o setor</option>
          {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="u-ramal" className="rotulo">Ramal da sala <span className="font-normal text-tinta-2">(opcional)</span></label>
        <input id="u-ramal" inputMode="numeric" maxLength={20} className="campo" value={ramal} onChange={(e) => setRamal(e.target.value)} autoComplete="off" />
      </div>
      <fieldset>
        <legend className="rotulo">Perfil</legend>
        <div className="grid grid-cols-2 gap-2">
          {([["solicitante", "Servidor"], ["tecnico", "Técnico do TI"]] as const).map(([v, r]) => (
            <label key={v} className="opcao justify-center text-center">
              <input type="radio" name="papel" className="sr-only" checked={papel === v} onChange={() => setPapel(v)} />
              {r}
            </label>
          ))}
        </div>
        {papel === "tecnico" && <p className="ajuda">Técnico vê a fila, todos os chamados e pode criar usuários.</p>}
      </fieldset>
      {erro && <p role="alert" className="font-semibold text-alerta">{erro}</p>}
      <button className="btn-primario w-full" disabled={salvando}>
        {salvando ? "Criando..." : "Criar e gerar senha"}
      </button>
    </form>
  );
}

/** Edição rápida de setor e ramal, dentro da lista. */
function EditarUsuario({ u, setores, aoSalvar, aoCancelar }: {
  u: UsuarioTI;
  setores: Setor[];
  aoSalvar: () => void;
  aoCancelar: () => void;
}) {
  const [setor, setSetor] = useState(u.setor);
  const [ramal, setRamal] = useState(u.ramal);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    try {
      await pb.send(`/api/ti/usuarios/${u.id}`, { method: "PATCH", body: { setor, ramal } });
      aoSalvar();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="mt-3 grid w-full gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end">
      <div>
        <label htmlFor={`setor-${u.id}`} className="rotulo text-sm">Setor</label>
        <select id={`setor-${u.id}`} className="campo" value={setor} onChange={(e) => setSetor(e.target.value)}>
          <option value="">Sem setor</option>
          {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={`ramal-${u.id}`} className="rotulo text-sm">Ramal</label>
        <input id={`ramal-${u.id}`} inputMode="numeric" maxLength={20} className="campo" value={ramal} onChange={(e) => setRamal(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button className="btn-primario" disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</button>
        <button type="button" className="btn px-3 text-tinta-2" onClick={aoCancelar}>Cancelar</button>
      </div>
      {erro && <p role="alert" className="font-semibold text-alerta sm:col-span-3">{erro}</p>}
    </form>
  );
}

/** Gestão de contas pelo TI: criar usuário e gerar nova senha provisória. */
export function Usuarios() {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [lista, setLista] = useState<UsuarioTI[] | null>(null);
  const [q, setQ] = useState("");
  const [esconderTeste, setEsconderTeste] = useState(false);
  const pag = usePaginacao("usuarios", 25);
  const [total, setTotal] = useState(0);
  const [resultado, setResultado] = useState<RespostaUsuario | null>(null);
  const [confirmando, setConfirmando] = useState("");
  const [editando, setEditando] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    pb.collection("setores").getFullList<Setor>({ sort: "nome" }).then(setSetores).catch(() => {});
  }, []);

  const carregar = useCallback(async () => {
    const query: Record<string, string> = {};
    if (q.trim()) query.q = q.trim();
    if (esconderTeste) query.ocultar_teste = "1";
    // paginado no servidor: só a página pedida vem do banco
    query.pagina = String(pag.pagina);
    query.por_pagina = String(pag.porPagina);
    try {
      const r = await pb.send<{ itens: UsuarioTI[]; total: number; pagina: number }>("/api/ti/usuarios", { query });
      setLista(r.itens);
      setTotal(r.total);
      if (r.pagina !== pag.pagina) pag.setPagina(r.pagina);
    } catch {
      setLista([]);
    }
  }, [q, esconderTeste, pag.pagina, pag.porPagina]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = window.setTimeout(carregar, 250);
    return () => window.clearTimeout(t);
  }, [carregar]);

  function mostrar(r: RespostaUsuario) {
    setResultado(r);
    setConfirmando("");
    window.scrollTo({ top: 0, behavior: "smooth" });
    carregar();
  }

  async function novaSenha(u: UsuarioTI) {
    setErro("");
    try {
      mostrar(await pb.send<RespostaUsuario>(`/api/ti/usuarios/${u.id}/senha`, { method: "POST" }));
    } catch (err) {
      setErro(mensagemErro(err));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Usuários</h1>
        <p className="mt-1 text-tinta-2">Crie a conta do servidor e passe a senha provisória. Esqueceu a senha? Gere uma nova.</p>
      </div>

      {resultado?.senha_provisoria && <CartaoSenha r={resultado} aoFechar={() => setResultado(null)} />}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <NovoUsuario setores={setores} aoCriar={mostrar} />

        <section className="space-y-3" aria-label="Lista de usuários">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative flex-1">
              <span className="sr-only">Pesquisar usuário</span>
              <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-tinta-2" aria-hidden="true" />
              <input type="search" className="campo pl-12" placeholder="Nome ou e-mail" value={q} onChange={(e) => { setQ(e.target.value); pag.voltarAoInicio(); }} />
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-tinta-2">
              <input type="checkbox" className="size-5 accent-acento" checked={esconderTeste} onChange={(e) => { setEsconderTeste(e.target.checked); pag.voltarAoInicio(); }} />
              Esconder contas de teste
            </label>
          </div>
          {erro && <p role="alert" className="font-semibold text-alerta">{erro}</p>}
          {lista === null ? (
            <p className="text-tinta-2">Carregando...</p>
          ) : lista.length === 0 ? (
            <p className="text-tinta-2">Nenhum usuário encontrado.</p>
          ) : (
            <ul className="divide-y divide-linha rounded-2xl bg-superficie ring-1 ring-linha">
              {lista.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {u.nome || "(sem nome)"}
                      {u.papel === "tecnico" && <span className="rounded-full bg-mar-50 px-2 py-0.5 text-xs font-semibold text-acento">TI</span>}
                      <SeloTeste ficticio={u.ficticio} />
                    </p>
                    <p className="truncate text-sm text-tinta-2">
                      {u.email}{u.setor_nome ? ` · ${u.setor_nome}` : ""}{u.ramal ? ` · ramal ${u.ramal}` : ""}
                    </p>
                  </div>
                  {editando !== u.id && (
                    <button type="button" className="btn-secundario min-h-10 px-3 text-sm" onClick={() => { setEditando(u.id); setConfirmando(""); }}>
                      <Pencil className="size-4" aria-hidden="true" /> Editar
                    </button>
                  )}
                  {confirmando === u.id ? (
                    <span className="flex items-center gap-2">
                      <button type="button" className="btn-primario min-h-10 px-3 text-sm" onClick={() => novaSenha(u)}>Gerar nova senha</button>
                      <button type="button" className="btn min-h-10 px-2 text-sm text-tinta-2" onClick={() => setConfirmando("")}>Cancelar</button>
                    </span>
                  ) : (
                    <button type="button" className="btn-secundario min-h-10 px-3 text-sm" onClick={() => setConfirmando(u.id)}>
                      <KeyRound className="size-4" aria-hidden="true" /> Nova senha
                    </button>
                  )}
                  {editando === u.id && (
                    <EditarUsuario u={u} setores={setores} aoCancelar={() => setEditando("")} aoSalvar={() => { setEditando(""); carregar(); }} />
                  )}
                </li>
              ))}
            </ul>
          )}
          {lista && lista.length > 0 && (
            <Paginacao
              pagina={pag.pagina}
              porPagina={pag.porPagina}
              total={total}
              aoMudarPagina={pag.setPagina}
              aoMudarPorPagina={pag.setPorPagina}
              rotulo="usuários"
            />
          )}
        </section>
      </div>
    </div>
  );
}
