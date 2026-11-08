import { AbasPagina, CabecalhoPagina } from "../../components/CabecalhoPagina";
import { useTelaLarga } from "../../lib/moldes";
import { Dica, idDaDica, RotuloComDica } from "../../components/Dica";
import {
  Ban, Building2, Check, Copy, Eye, KeyRound, Lock, Pencil, Phone, Plus, Printer, Search, ShieldCheck, UserPlus, Users,
} from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { Avatar } from "../../components/Avatar";
import { EsqueletoLinhas } from "../../components/Esqueleto";
import { PainelRapido, RodapeRascunho, RotuloSecao } from "../../components/PainelRapido";
import { Paginacao, usePaginacao } from "../../components/Paginacao";
import { SeloTeste } from "../../components/Selos";
import { useAuth } from "../../lib/auth";
import { avisar } from "../../lib/avisos";
import { limparCache } from "../../lib/cache";
import { ehAdmin, geraObservador, mensagemErro, pb } from "../../lib/pb";

/** Pessoa como as rotas /api/ti/usuarios devolvem (ver docs/API.md). */
interface PessoaTI {
  id: string; nome: string; matricula: string; email: string;
  /** observador: equipe do Dino Desk (só leitura); criada só pelo superusuário */
  papel: "solicitante" | "tecnico" | "observador"; admin: boolean;
  setor: string; setor_nome: string; setor_ramal: string; ramal: string;
  trocar_senha: boolean; bloqueado: boolean; ficticio: boolean;
}
interface SetorTI { id: string; nome: string; predio: string; ramal: string; ativo: boolean; pessoas: number }
interface RespostaPessoa { usuario: PessoaTI; senha_provisoria: string | null }

const enderecoDoSistema = () => window.location.origin.replace(/^https?:\/\//, "");

function useSetoresTI() {
  const [setores, setSetores] = useState<SetorTI[] | null>(null);
  const recarregar = useCallback(() => {
    pb.send<{ itens: SetorTI[] }>("/api/ti/setores", {}).then((r) => setSetores(r.itens)).catch(() => setSetores([]));
  }, []);
  useEffect(recarregar, [recarregar]);
  return { setores, recarregar };
}

/* ------------------------------------------------------------------ */
/* Senha provisória: aparece UMA vez, com copiar e imprimir bilhete     */
/* ------------------------------------------------------------------ */

function JanelaSenha({ r, nova, aoFechar }: { r: RespostaPessoa; nova: boolean; aoFechar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const login = r.usuario.matricula || r.usuario.email;
  const texto = `Dino Desk (${enderecoDoSistema()})\nMatrícula: ${login}\nSenha provisória: ${r.senha_provisoria}\nNo primeiro acesso, você vai criar a sua própria senha.`;
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      // sem HTTPS o navegador pode bloquear a área de transferência: a senha continua na tela
    }
  }
  return (
    <PainelRapido
      idTitulo="titulo-senha"
      largura="max-w-md"
      titulo={nova ? `Conta criada: ${r.usuario.nome}` : `Nova senha: ${r.usuario.nome}`}
      subtitulo={<p className="mt-0.5 text-sm text-tinta-2">Entregue estes dados à pessoa. A senha aparece só agora.</p>}
      aoTentarFechar={aoFechar}
      rodape={
        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <button type="button" onClick={() => window.print()} className="btn-secundario">
            <Printer className="size-5" aria-hidden="true" /> Imprimir
          </button>
          <button type="button" onClick={copiar} className="btn-secundario">
            {copiado ? <Check className="size-5" aria-hidden="true" /> : <Copy className="size-5" aria-hidden="true" />}
            {copiado ? "Copiado" : "Copiar"}
          </button>
          <button type="button" onClick={aoFechar} className="btn-primario col-span-2">Pronto</button>
        </div>
      }
    >
      {/* bilhete: é o que sai na impressão (o resto da tela some no print) */}
      <div className="bilhete-senha space-y-3 rounded-xl bg-fundo p-4 ring-1 ring-linha">
        <p className="text-sm text-tinta-2">Dino Desk · {enderecoDoSistema()}</p>
        <div>
          <p className="text-sm text-tinta-2">{r.usuario.matricula ? "Matrícula" : "E-mail"}</p>
          <p className="font-display text-2xl font-extrabold">{login}</p>
        </div>
        <div>
          <p className="text-sm text-tinta-2">Senha provisória</p>
          <p className="font-mono text-3xl font-bold tracking-wider select-all">{r.senha_provisoria}</p>
        </div>
        <p className="text-sm">No primeiro acesso, a pessoa cria a própria senha.</p>
      </div>
    </PainelRapido>
  );
}

/* ------------------------------------------------------------------ */
/* Formulário de pessoa (criar e editar)                                */
/* ------------------------------------------------------------------ */

type DadosPessoa = {
  nome: string; matricula: string; email: string; setor: string; ramal: string;
  papel: "solicitante" | "tecnico" | "observador"; admin: boolean; bloqueado: boolean;
};

/** Campo do formulário: a ajuda vai no "i" ao lado do rótulo (o campo usa aria-describedby={idDaDica(id)}). */
function Campo({ id, rotulo, opcional, ajuda, children }: { id: string; rotulo: string; opcional?: boolean; ajuda?: ReactNode; children: ReactNode }) {
  const texto = <>{rotulo} {opcional && <span className="font-normal text-tinta-2">(opcional)</span>}</>;
  return (
    <div>
      {ajuda
        ? <RotuloComDica htmlFor={id} dica={ajuda} nome={rotulo}>{texto}</RotuloComDica>
        : <label htmlFor={id} className="rotulo">{texto}</label>}
      {children}
    </div>
  );
}

type PropsJanelaPessoa = Parameters<typeof JanelaPessoaEditar>[0];

/** Conta da equipe do Dino Desk (observador): o TI vê e pode bloquear; o resto é com o superusuário. */
function JanelaPessoa(props: PropsJanelaPessoa) {
  const p = props.pessoa;
  const { usuario } = useAuth();
  // a própria equipe do Dino Desk (admin com equipe_projeto) edita a conta normalmente
  if (p?.papel === "observador" && !geraObservador(usuario)) return <JanelaObservador p={p} fixo={props.fixo} aoFechar={props.aoFechar} aoSalvo={props.aoSalvo} />;
  return <JanelaPessoaEditar {...props} />;
}

function JanelaObservador({ p, fixo, aoFechar, aoSalvo }: { p: PessoaTI; fixo?: boolean; aoFechar: () => void; aoSalvo: (msg: string) => void }) {
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  async function alternar() {
    setErro("");
    setSalvando(true);
    try {
      await pb.send(`/api/ti/usuarios/${p.id}`, { method: "PATCH", body: { bloqueado: !p.bloqueado } });
      aoSalvo(p.bloqueado ? `${p.nome} pode entrar de novo.` : `${p.nome} foi bloqueado.`);
      aoFechar();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  }
  return (
    <PainelRapido
      idTitulo="titulo-observador"
      fixo={fixo}
      titulo={p.nome}
      subtitulo={<p className="mt-0.5 text-sm text-tinta-2">Matrícula {p.matricula || "—"}</p>}
      aoTentarFechar={aoFechar}
      rodape={
        <>
          {erro && <p role="alert" className="mb-2 font-semibold text-alerta">{erro}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secundario" onClick={aoFechar}>Fechar</button>
            <button type="button" className={p.bloqueado ? "btn-primario" : "btn-perigo"} disabled={salvando} onClick={alternar}>
              {p.bloqueado ? "Desbloquear" : "Bloquear"}
            </button>
          </div>
        </>
      }
    >
      <div className="space-y-3">
        <Selos p={p} />
        <p>Conta da <b>equipe do Dino Desk</b> (projeto de extensão da UNIVALI). Ela vê tudo o que o TI vê, mas não muda nada: não abre, não responde, não atribui e não salva configurações.</p>
        <p className="text-sm text-tinta-2">Quem cria, edita e troca a senha desta conta é a equipe do projeto. O TI pode bloquear a qualquer momento.</p>
      </div>
    </PainelRapido>
  );
}

function JanelaPessoaEditar({ pessoa, setorInicial, setores, eu, aoFechar, aoSalvo, aoSenha, fixo }: {
  /** tela larga: coluna ao lado da lista, em vez de janela */
  fixo?: boolean;
  /** sem pessoa = criar */
  pessoa?: PessoaTI;
  setorInicial?: string;
  setores: SetorTI[];
  eu: string;
  aoFechar: () => void;
  aoSalvo: (msg: string) => void;
  aoSenha: (r: RespostaPessoa, nova: boolean) => void;
}) {
  const inicial: DadosPessoa = {
    nome: pessoa?.nome ?? "",
    matricula: pessoa?.matricula ?? "",
    email: pessoa?.email ?? "",
    setor: pessoa?.setor ?? setorInicial ?? "",
    ramal: pessoa?.ramal ?? "",
    papel: pessoa?.papel ?? "solicitante",
    admin: pessoa?.admin ?? false,
    bloqueado: pessoa?.bloqueado ?? false,
  };
  const [d, setD] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [confirmarSenha, setConfirmarSenha] = useState(false);
  const [erro, setErro] = useState("");
  const editando = !!pessoa;
  const souEu = pessoa?.id === eu;
  const { usuario } = useAuth();
  const mudados = (Object.keys(inicial) as (keyof DadosPessoa)[]).filter((k) => d[k] !== inicial[k]);
  const muda = <K extends keyof DadosPessoa>(k: K, v: DadosPessoa[K]) => { setSaindo(false); setD((x) => ({ ...x, [k]: v })); };
  const setorEscolhido = setores.find((s) => s.id === d.setor);
  const opcoesSetor = setores.filter((s) => s.ativo || s.id === d.setor);

  async function salvar(e?: FormEvent) {
    e?.preventDefault();
    setErro("");
    // servidor sem setor abre chamado "sem lugar": o TI não sabe aonde ir. Obrigatório ao criar (ou ao tirar o setor)
    if (d.papel === "solicitante" && !d.setor && (!editando || mudados.includes("setor") || mudados.includes("papel"))) {
      setErro("Escolha o setor da pessoa: é para lá que o TI vai quando ela abrir um chamado.");
      document.getElementById("p-setor")?.focus();
      return;
    }
    setSalvando(true);
    try {
      if (editando) {
        if (!mudados.length) return aoFechar();
        const corpo: Partial<DadosPessoa> = {};
        for (const k of mudados) (corpo as Record<string, unknown>)[k] = d[k];
        await pb.send(`/api/ti/usuarios/${pessoa.id}`, { method: "PATCH", body: corpo });
        aoSalvo(`${d.nome}: alterações salvas.`);
        aoFechar();
      } else {
        const r = await pb.send<RespostaPessoa>("/api/ti/usuarios", { method: "POST", body: d });
        aoSalvo(`Conta de ${r.usuario.nome} criada.`);
        aoFechar();
        aoSenha(r, true);
      }
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  }

  async function novaSenha() {
    if (!pessoa) return;
    setErro("");
    try {
      const r = await pb.send<RespostaPessoa>(`/api/ti/usuarios/${pessoa.id}/senha`, { method: "POST" });
      aoSalvo(`Nova senha provisória gerada para ${pessoa.nome}.`);
      aoFechar();
      aoSenha(r, false);
    } catch (err) {
      setErro(mensagemErro(err));
    }
  }

  const rodape = editando ? (
    <>
      {erro && <p role="alert" className="mb-2 font-semibold text-alerta">{erro}</p>}
      <RodapeRascunho
        mudancas={mudados.length}
        saindo={saindo}
        salvando={salvando}
        rotuloSalvar="Salvar alterações"
        aoSalvar={() => salvar()}
        aoDescartar={() => setD(inicial)}
        aoContinuar={() => setSaindo(false)}
        aoSairSemSalvar={aoFechar}
        semMudancas={<div className="flex justify-end"><button type="button" className="btn-secundario" onClick={aoFechar}>Fechar</button></div>}
      />
    </>
  ) : saindo ? (
    <RodapeRascunho
      mudancas={1}
      saindo
      salvando={false}
      rotuloSalvar=""
      aoSalvar={() => {}}
      aoDescartar={() => {}}
      aoContinuar={() => setSaindo(false)}
      aoSairSemSalvar={aoFechar}
      semMudancas={null}
    />
  ) : (
    <>
      {erro && <p role="alert" className="mb-2 font-semibold text-alerta">{erro}</p>}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <button type="button" className="btn-secundario" onClick={aoFechar}>Cancelar</button>
        <button type="submit" form="form-pessoa" className="btn-primario" disabled={salvando}>
          {salvando ? "Criando..." : "Criar e gerar senha"}
        </button>
      </div>
    </>
  );

  return (
    <PainelRapido
      idTitulo="titulo-pessoa"
      fixo={fixo}
      largura="max-w-lg md:max-w-2xl"
      titulo={editando ? pessoa.nome : (
        <span className="inline-flex items-center gap-2.5">
          Nova pessoa
          <Dica rotulo="Como a pessoa entra">A pessoa entra com a matrícula e uma senha provisória, e cria a própria senha no primeiro acesso.</Dica>
        </span>
      )}
      subtitulo={editando ? (
        <p className="mt-0.5 text-sm text-tinta-2">Matrícula {pessoa.matricula || "—"}{pessoa.ficticio ? " · conta de teste" : ""}</p>
      ) : undefined}
      aoTentarFechar={() => {
        if (salvando) return;
        if (editando ? !mudados.length : !d.nome && !d.matricula) return aoFechar();
        setSaindo((s) => !s);
      }}
      rodape={rodape}
    >
      <form id="form-pessoa" onSubmit={salvar} className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Campo id="p-nome" rotulo="Nome completo">
            <input id="p-nome" required className="campo" value={d.nome} onChange={(e) => muda("nome", e.target.value)} autoComplete="off" autoFocus={!editando} />
          </Campo>
        </div>
        <Campo id="p-matricula" rotulo="Matrícula" ajuda="É o login. Só números, até 8 dígitos.">
          <input
            id="p-matricula" aria-describedby={idDaDica("p-matricula")} required inputMode="numeric" maxLength={8} pattern="[0-9]{1,8}"
            className="campo font-display text-lg tracking-wider" value={d.matricula}
            onChange={(e) => muda("matricula", e.target.value.replace(/\D/g, "").slice(0, 8))} autoComplete="off"
          />
        </Campo>
        <Campo id="p-setor" rotulo="Setor">
          <select id="p-setor" className="campo" value={d.setor} onChange={(e) => muda("setor", e.target.value)}>
            <option value="">{d.papel === "solicitante" ? "Escolha o setor" : "Sem setor"}</option>
            {opcoesSetor.map((s) => <option key={s.id} value={s.id}>{s.nome}{s.ativo ? "" : " (inativo)"}</option>)}
          </select>
        </Campo>
        <Campo id="p-email" rotulo="E-mail" opcional ajuda="Se tiver, a pessoa recebe os avisos do chamado por e-mail.">
          <input id="p-email" aria-describedby={idDaDica("p-email")} type="email" className="campo" value={d.email} onChange={(e) => muda("email", e.target.value)} autoComplete="off" />
        </Campo>
        <Campo id="p-ramal" rotulo="Ramal, se for diferente do setor">
          <input id="p-ramal" inputMode="numeric" maxLength={20} className="campo" placeholder={setorEscolhido?.ramal ? `Do setor: ${setorEscolhido.ramal}` : ""} value={d.ramal} onChange={(e) => muda("ramal", e.target.value)} autoComplete="off" />
        </Campo>

        <fieldset className="md:col-span-2">
          <legend className="rotulo">Tipo de conta</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              ["solicitante", "Servidor", "Abre e acompanha os próprios chamados"],
              ["tecnico", "Técnico do TI", "Atende a fila, registra e resolve"],
              // só para a equipe do Dino Desk (admin com equipe_projeto); o TI da Prefeitura não vê esta opção
              ...(geraObservador(usuario) || d.papel === "observador"
                ? [["observador", "Equipe do Dino Desk", "Vê tudo o que o TI vê, sem mudar nada"] as const]
                : []),
            ] as const).map(([v, r, ajuda]) => (
              <label key={v} className="opcao">
                <input type="radio" name="papel" className="sr-only" checked={d.papel === v} disabled={souEu} onChange={() => { muda("papel", v); if (v === "solicitante") muda("admin", false); }} />
                <span>
                  {r}
                  <span className="block text-sm font-normal text-tinta-2">{ajuda}</span>
                </span>
              </label>
            ))}
          </div>
          {d.papel === "tecnico" && (
            <label className="mt-2 flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 ring-1 ring-linha hover:ring-acento">
              <input type="checkbox" className="size-5 accent-acento" checked={d.admin} disabled={souEu} onChange={(e) => muda("admin", e.target.checked)} />
              <span>
                <span className="flex items-center gap-1.5 font-semibold">
                  <ShieldCheck className="size-4 text-acento" aria-hidden="true" /> Administrador do TI
                  <Dica rotulo="O que o administrador pode fazer">Cria setores e contas, gera senhas e bloqueia acessos.</Dica>
                </span>
              </span>
            </label>
          )}
          {souEu && <p className="ajuda">Você não pode mudar o seu próprio tipo de conta.</p>}
        </fieldset>

        {editando && (
          <section className="space-y-2 md:col-span-2" aria-labelledby="sec-acesso">
            <RotuloSecao id="sec-acesso" alterado={d.bloqueado !== inicial.bloqueado}>Acesso</RotuloSecao>
            <div className="flex flex-col gap-3 rounded-xl p-3 ring-1 ring-linha sm:flex-row sm:items-center">
              <p className="flex-1 text-sm">
                {pessoa.trocar_senha
                  ? <><b>Senha provisória:</b> a pessoa ainda não criou a própria senha.</>
                  : <><b>Senha própria</b> já criada.</>}
              </p>
              {confirmarSenha ? (
                <span className="flex gap-2">
                  <button type="button" className="btn-primario min-h-10 px-3 text-sm" onClick={novaSenha}>Gerar agora</button>
                  <button type="button" className="btn min-h-10 px-2 text-sm text-tinta-2" onClick={() => setConfirmarSenha(false)}>Cancelar</button>
                </span>
              ) : (
                <button type="button" className="btn-secundario min-h-10 px-3 text-sm" onClick={() => setConfirmarSenha(true)} disabled={mudados.length > 0} title={mudados.length ? "Salve ou descarte as alterações antes" : undefined}>
                  <KeyRound className="size-4" aria-hidden="true" /> Nova senha provisória
                </button>
              )}
            </div>
            {!souEu && (
              <label className={`flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 ${d.bloqueado ? "bg-brasa-50 ring-alerta" : "ring-linha hover:ring-acento"}`}>
                <input type="checkbox" className="mt-1 size-5 accent-acento" checked={d.bloqueado} onChange={(e) => muda("bloqueado", e.target.checked)} />
                <span>
                  <span className="flex items-center gap-1.5 font-semibold"><Ban className="size-4" aria-hidden="true" /> Bloquear acesso</span>
                  <span className="block text-sm text-tinta-2">A pessoa não consegue entrar (ex.: saiu da Prefeitura). Os chamados dela continuam no histórico.</span>
                </span>
              </label>
            )}
          </section>
        )}
      </form>
    </PainelRapido>
  );
}

/* ------------------------------------------------------------------ */
/* Formulário de setor                                                  */
/* ------------------------------------------------------------------ */

function JanelaSetor({ setor, aoFechar, aoSalvo, fixo }: { setor?: SetorTI; aoFechar: () => void; aoSalvo: (msg: string) => void; fixo?: boolean }) {
  const inicial = { nome: setor?.nome ?? "", predio: setor?.predio ?? "", ramal: setor?.ramal ?? "", ativo: setor?.ativo ?? true };
  const [d, setD] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const muda = <K extends keyof typeof inicial>(k: K, v: (typeof inicial)[K]) => setD((x) => ({ ...x, [k]: v }));

  async function salvar(e?: FormEvent) {
    e?.preventDefault();
    setErro("");
    setSalvando(true);
    try {
      if (setor) {
        await pb.send(`/api/ti/setores/${setor.id}`, { method: "PATCH", body: d });
        aoSalvo(`Setor ${d.nome} atualizado.`);
      } else {
        const r = await pb.send<{ criado: boolean; setor: SetorTI }>("/api/ti/setores", { method: "POST", body: d });
        aoSalvo(r.criado ? `Setor ${r.setor.nome} criado.` : `O setor ${r.setor.nome} já existia.`);
      }
      limparCache("setores");
      aoFechar();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <PainelRapido
      fixo={fixo}
      idTitulo="titulo-setor"
      largura="max-w-md"
      titulo={setor ? `Setor ${setor.nome}` : "Novo setor"}
      aoTentarFechar={aoFechar}
      rodape={
        <>
          {erro && <p role="alert" className="mb-2 font-semibold text-alerta">{erro}</p>}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <button type="button" className="btn-secundario" onClick={aoFechar}>Cancelar</button>
            <button type="submit" form="form-setor" className="btn-primario" disabled={salvando}>{salvando ? "Salvando..." : setor ? "Salvar" : "Criar setor"}</button>
          </div>
        </>
      }
    >
      <form id="form-setor" onSubmit={salvar} className="space-y-4">
        <Campo id="s-nome" rotulo="Nome do setor">
          <input id="s-nome" required className="campo" value={d.nome} onChange={(e) => muda("nome", e.target.value)} autoFocus placeholder="Ex.: Tributação" />
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="s-ramal" rotulo="Ramal" opcional ajuda="Vale para todas as pessoas do setor.">
            <input id="s-ramal" aria-describedby={idDaDica("s-ramal")} inputMode="numeric" maxLength={20} className="campo font-display text-lg" value={d.ramal} onChange={(e) => muda("ramal", e.target.value)} />
          </Campo>
          <Campo id="s-predio" rotulo="Prédio" opcional>
            <input id="s-predio" className="campo" value={d.predio} onChange={(e) => muda("predio", e.target.value)} placeholder="Ex.: Paço Municipal" />
          </Campo>
        </div>
        {setor && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 ring-linha hover:ring-acento">
            <input type="checkbox" className="mt-1 size-5 accent-acento" checked={d.ativo} onChange={(e) => muda("ativo", e.target.checked)} />
            <span>
              <span className="font-semibold">Setor ativo</span>
              <span className="block text-sm text-tinta-2">Desmarque se o setor deixou de existir: ele some da lista de escolha, mas o histórico fica.</span>
            </span>
          </label>
        )}
      </form>
    </PainelRapido>
  );
}

/* ------------------------------------------------------------------ */
/* Abas                                                                 */
/* ------------------------------------------------------------------ */

function Selos({ p }: { p: PessoaTI }) {
  return (
    <>
      {p.papel === "tecnico" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-mar-50 px-2 py-0.5 text-xs font-bold text-acento">
          {p.admin && <ShieldCheck className="size-3.5" aria-hidden="true" />}{p.admin ? "Admin do TI" : "Técnico"}
        </span>
      )}
      {p.papel === "observador" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-sol-50 px-2 py-0.5 text-xs font-bold text-tinta ring-1 ring-sol">
          <Eye className="size-3.5" aria-hidden="true" /> Equipe do Dino Desk · só leitura
        </span>
      )}
      {p.bloqueado && (
        <span className="inline-flex items-center gap-1 rounded-full bg-brasa-50 px-2 py-0.5 text-xs font-bold text-alerta">
          <Lock className="size-3.5" aria-hidden="true" /> Bloqueado
        </span>
      )}
      {!p.bloqueado && p.trocar_senha && (
        <span className="rounded-full bg-sol-50 px-2 py-0.5 text-xs font-bold text-tinta ring-1 ring-sol" title="Ainda não criou a própria senha">
          Senha provisória
        </span>
      )}
      <SeloTeste ficticio={p.ficticio} />
    </>
  );
}

function AbaPessoas({ setores, admin, setorFiltro, aoFiltrarSetor, recarregarTudo, versao, aoEditar, aoNova }: {
  setores: SetorTI[];
  admin: boolean;
  setorFiltro: string;
  aoFiltrarSetor: (id: string) => void;
  recarregarTudo: number;
  versao: number;
  aoEditar: (p: PessoaTI) => void;
  aoNova: () => void;
}) {
  const [lista, setLista] = useState<PessoaTI[] | null>(null);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [esconderTeste, setEsconderTeste] = useState(false);
  const pag = usePaginacao("usuarios", 25);

  const carregar = useCallback(async () => {
    const query: Record<string, string> = { pagina: String(pag.pagina), por_pagina: String(pag.porPagina) };
    if (q.trim()) query.q = q.trim();
    if (setorFiltro) query.setor = setorFiltro;
    if (esconderTeste) query.ocultar_teste = "1";
    try {
      const r = await pb.send<{ itens: PessoaTI[]; total: number; pagina: number }>("/api/ti/usuarios", { query, requestKey: "pessoas" });
      setLista(r.itens);
      setTotal(r.total);
      if (r.pagina !== pag.pagina) pag.setPagina(r.pagina);
    } catch (err) {
      if (!(err as { isAbort?: boolean })?.isAbort) setLista([]);
    }
  }, [q, setorFiltro, esconderTeste, pag.pagina, pag.porPagina, recarregarTudo, versao]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = window.setTimeout(carregar, 200);
    return () => window.clearTimeout(t);
  }, [carregar]);

  return (
    <section className="space-y-3" aria-label="Pessoas">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Pesquisar pessoa</span>
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-tinta-2" aria-hidden="true" />
          <input type="search" enterKeyHint="search" className="campo pl-12" placeholder="Nome, matrícula ou e-mail" value={q} onChange={(e) => { setQ(e.target.value); pag.voltarAoInicio(); }} />
        </label>
        <label className="md:w-56">
          <span className="sr-only">Filtrar por setor</span>
          <select className="campo" value={setorFiltro} onChange={(e) => { aoFiltrarSetor(e.target.value); pag.voltarAoInicio(); }}>
            <option value="">Todos os setores</option>
            {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </label>
        {admin && (
          <button type="button" className="btn-primario" onClick={aoNova}>
            <UserPlus className="size-5" aria-hidden="true" /> Nova pessoa
          </button>
        )}
      </div>
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-semibold text-tinta-2">
        <input type="checkbox" className="size-5 accent-acento" checked={esconderTeste} onChange={(e) => { setEsconderTeste(e.target.checked); pag.voltarAoInicio(); }} />
        Esconder contas de teste
      </label>

      {lista === null ? (
        <EsqueletoLinhas quantos={6} rotulo="Carregando pessoas..." />
      ) : lista.length === 0 ? (
        <div className="rounded-2xl bg-superficie p-8 text-center ring-1 ring-linha">
          <p className="font-semibold">Ninguém encontrado.</p>
          {admin && setorFiltro && <button type="button" className="btn-secundario mt-3" onClick={aoNova}><UserPlus className="size-5" aria-hidden="true" /> Adicionar pessoa neste setor</button>}
        </div>
      ) : (
        <ul className="divide-y divide-linha overflow-hidden rounded-2xl bg-superficie ring-1 ring-linha">
          {lista.map((p) => {
            const ramal = p.ramal || p.setor_ramal;
            const conteudo = (
              <>
                <Avatar id={p.id} nome={p.nome} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
                    <span className={p.bloqueado ? "text-tinta-2 line-through" : ""}>{p.nome || "(sem nome)"}</span>
                    <Selos p={p} />
                  </span>
                  <span className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-tinta-2">
                    <span>Mat. <b className="font-display text-tinta">{p.matricula || "—"}</b></span>
                    {p.setor_nome && <span className="inline-flex items-center gap-1"><Building2 className="size-3.5" aria-hidden="true" />{p.setor_nome}</span>}
                    {ramal && <span className="inline-flex items-center gap-1"><Phone className="size-3.5" aria-hidden="true" />{ramal}{!p.ramal && " (setor)"}</span>}
                    {p.email && <span className="truncate">{p.email}</span>}
                  </span>
                </span>
                {admin && <Pencil className="size-4 shrink-0 text-tinta-2" aria-hidden="true" />}
              </>
            );
            return (
              <li key={p.id}>
                {admin ? (
                  <button type="button" onClick={() => aoEditar(p)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-fundo" aria-label={`Editar ${p.nome}`}>
                    {conteudo}
                  </button>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3">{conteudo}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {lista && lista.length > 0 && (
        <Paginacao pagina={pag.pagina} porPagina={pag.porPagina} total={total} aoMudarPagina={pag.setPagina} aoMudarPorPagina={pag.setPorPagina} rotulo="pessoas" />
      )}
    </section>
  );
}

function AbaSetores({ setores, admin, aoEditar, aoNovo, aoVerPessoas, aoAdicionarPessoa }: {
  setores: SetorTI[];
  admin: boolean;
  aoEditar: (s: SetorTI) => void;
  aoNovo: () => void;
  aoVerPessoas: (s: SetorTI) => void;
  aoAdicionarPessoa: (s: SetorTI) => void;
}) {
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const visiveis = setores.filter((s) => s.ativo || mostrarInativos);
  const inativos = setores.length - setores.filter((s) => s.ativo).length;
  return (
    <section className="space-y-3" aria-label="Setores">
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1 text-tinta-2">
          O ramal do setor vale para todas as pessoas dele (dá para pôr um ramal próprio na pessoa).
        </p>
        {inativos > 0 && (
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-tinta-2">
            <input type="checkbox" className="size-5 accent-acento" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} />
            Mostrar inativos ({inativos})
          </label>
        )}
        {admin && (
          <button type="button" className="btn-primario" onClick={aoNovo}>
            <Plus className="size-5" aria-hidden="true" /> Novo setor
          </button>
        )}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visiveis.map((s) => (
          <li key={s.id} className={`flex flex-col rounded-2xl bg-superficie p-4 ring-1 ring-linha ${s.ativo ? "" : "opacity-60"}`}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-bold">{s.nome}</p>
                <p className="text-sm text-tinta-2">{s.predio || "Prédio não informado"}{s.ativo ? "" : " · inativo"}</p>
              </div>
              {admin && (
                <button type="button" onClick={() => aoEditar(s)} className="grid size-10 place-items-center rounded-full text-tinta-2 hover:bg-fundo hover:text-tinta" aria-label={`Editar setor ${s.nome}`}>
                  <Pencil className="size-4" />
                </button>
              )}
            </div>
            <div className="mt-3 flex items-end justify-between gap-2">
              <p className="text-sm text-tinta-2">
                Ramal
                <span className={`block font-display text-2xl font-extrabold ${s.ramal ? "text-tinta" : "text-tinta-2"}`}>{s.ramal || "—"}</span>
              </p>
              <button type="button" onClick={() => aoVerPessoas(s)} className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-acento hover:bg-mar-50">
                <Users className="size-4" aria-hidden="true" /> {s.pessoas} {s.pessoas === 1 ? "pessoa" : "pessoas"}
              </button>
            </div>
            {admin && s.ativo && (
              <button type="button" onClick={() => aoAdicionarPessoa(s)} className="btn-secundario mt-3 min-h-10 text-sm">
                <UserPlus className="size-4" aria-hidden="true" /> Adicionar pessoa
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Página                                                               */
/* ------------------------------------------------------------------ */

/**
 * Pessoas e setores. Só o ADMINISTRADOR DO TI cria e edita (setores, contas, senhas, bloqueio);
 * os outros técnicos consultam. Não existe "criar conta" público: a conta nasce aqui,
 * com matrícula e senha provisória que a pessoa troca no primeiro acesso.
 */
export function Usuarios() {
  const { usuario } = useAuth();
  const admin = ehAdmin(usuario);
  const eu = usuario?.id ?? "";
  // tela larga (admin): pessoa e setor abrem numa coluna ao lado da lista, não numa janela por cima
  const larga = useTelaLarga();
  const lado = larga && admin;
  const [params, setParams] = useSearchParams();
  const aba = params.get("aba") === "setores" ? "setores" : "pessoas";
  const setorFiltro = params.get("setor") ?? "";
  const { setores, recarregar } = useSetoresTI();
  const [versao, setVersao] = useState(0);
  const [pessoa, setPessoa] = useState<{ p?: PessoaTI; setor?: string } | null>(null);
  const [setor, setSetor] = useState<{ s?: SetorTI } | null>(null);
  const [senha, setSenha] = useState<{ r: RespostaPessoa; nova: boolean } | null>(null);

  const irPara = (novaAba: "pessoas" | "setores", setorId = "") => {
    const p = new URLSearchParams();
    if (novaAba === "setores") p.set("aba", "setores");
    if (setorId) p.set("setor", setorId);
    setParams(p, { replace: true });
  };
  const depoisDeSalvar = (msg: string) => { avisar(msg); setVersao((v) => v + 1); recarregar(); };
  const totalPessoas = (setores ?? []).reduce((n, s) => n + s.pessoas, 0);


  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Pessoas e setores"
        subtitulo={admin ? undefined : "Consulta. Só o administrador do TI cria e edita contas e setores."}
        abas={<AbasPagina rotulo="O que ver" itens={[
          { rotulo: "Pessoas", ativo: aba === "pessoas", aoClicar: () => irPara("pessoas"), numero: setores ? totalPessoas : undefined },
          { rotulo: "Setores", ativo: aba === "setores", aoClicar: () => irPara("setores"), numero: setores?.filter((s) => s.ativo).length },
        ]} />}
      />


      <div className={lado ? "grid grid-cols-[minmax(0,1fr)_34rem] items-start gap-6" : ""}>
        <div className="min-w-0">
        {setores === null ? (
          <EsqueletoLinhas quantos={6} rotulo="Carregando..." />
        ) : aba === "pessoas" ? (
          <AbaPessoas
            setores={setores}
            admin={admin}
            setorFiltro={setorFiltro}
            aoFiltrarSetor={(id) => irPara("pessoas", id)}
            recarregarTudo={totalPessoas}
            versao={versao}
            aoEditar={(p) => { setSetor(null); setPessoa({ p }); }}
            aoNova={() => { setSetor(null); setPessoa({ setor: setorFiltro }); }}
          />
        ) : (
          <AbaSetores
            setores={setores}
            admin={admin}
            aoEditar={(s) => { setPessoa(null); setSetor({ s }); }}
            aoNovo={() => { setPessoa(null); setSetor({}); }}
            aoVerPessoas={(s) => irPara("pessoas", s.id)}
            aoAdicionarPessoa={(s) => setPessoa({ setor: s.id })}
          />
        )}
        </div>
        {lado && (
          <div className="sticky top-6">
            {pessoa && setores ? (
              <JanelaPessoa
                key={pessoa.p?.id ?? `nova-${pessoa.setor ?? ""}`}
                fixo
                pessoa={pessoa.p}
                setorInicial={pessoa.setor}
                setores={setores}
                eu={eu}
                aoFechar={() => setPessoa(null)}
                aoSalvo={depoisDeSalvar}
                aoSenha={(r, nova) => { setSenha({ r, nova }); if (nova) irPara("pessoas", r.usuario.setor); }}
              />
            ) : setor ? (
              <JanelaSetor key={setor.s?.id ?? "novo"} fixo setor={setor.s} aoFechar={() => setSetor(null)} aoSalvo={depoisDeSalvar} />
            ) : (
              <div className="grid min-h-64 place-items-center rounded-2xl border-2 border-dashed border-linha p-8 text-center">
                <div>
                  <p className="font-bold">{aba === "pessoas" ? "Escolha uma pessoa na lista" : "Escolha um setor na lista"}</p>
                  <p className="mt-1 text-sm text-tinta-2">Os dados aparecem aqui para ver e editar.</p>
                  <button type="button" className="btn-secundario mt-4" onClick={() => (aba === "pessoas" ? setPessoa({ setor: setorFiltro }) : setSetor({}))}>
                    {aba === "pessoas" ? "Nova pessoa" : "Novo setor"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {!lado && pessoa && setores && (
        <JanelaPessoa
          pessoa={pessoa.p}
          setorInicial={pessoa.setor}
          setores={setores}
          eu={eu}
          aoFechar={() => setPessoa(null)}
          aoSalvo={depoisDeSalvar}
          aoSenha={(r, nova) => { setSenha({ r, nova }); if (nova) irPara("pessoas", r.usuario.setor); }}
        />
      )}
      {!lado && setor && <JanelaSetor setor={setor.s} aoFechar={() => setSetor(null)} aoSalvo={depoisDeSalvar} />}
      {senha && <JanelaSenha r={senha.r} nova={senha.nova} aoFechar={() => setSenha(null)} />}
    </div>
  );
}
