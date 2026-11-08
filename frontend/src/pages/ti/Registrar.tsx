import { CabecalhoPagina } from "../../components/CabecalhoPagina";
import { CheckCircle2, ClipboardList, ListOrdered, MessageCircle, Phone, RotateCcw, Send, UserRound, X } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAnexos } from "../../components/Anexos";
import { useCategorias } from "../../components/CamposChamado";
import { Bloco } from "../../components/Esqueleto";
import { CaixaComAnexos, Passo, RodapeEnviar } from "../../components/FormularioPassos";
import { IconeCategoria } from "../../components/Icone";
import { ProgressoEnvio } from "../../components/ProgressoEnvio";
import { RegistroSolucao } from "../../components/RegistroSolucao";
import { SeloStatus } from "../../components/Selos";
import { useAuth } from "../../lib/auth";
import { avisar } from "../../lib/avisos";
import { criarComProgresso } from "../../lib/envio";
import { resumo, ROTULO_IMPACTO, ROTULO_ORIGEM } from "../../lib/formato";
import { EXPAND_CHAMADO, mensagemErro, nomeSolicitante, pb, type Chamado, type Impacto, type Origem, type Setor, type Usuario } from "../../lib/pb";
import { useRealtime } from "../../lib/useRealtime";
import { LinkChamado } from "../../lib/verChamado";

const ORIGENS: { valor: Origem; rotulo: string; Icone: typeof Phone }[] = [
  { valor: "whatsapp", rotulo: "WhatsApp", Icone: MessageCircle },
  { valor: "ligacao", rotulo: "Ligação", Icone: Phone },
  { valor: "presencial", rotulo: "Presencial", Icone: UserRound },
];

const segmento = (ativo: boolean) =>
  `flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg px-2 text-sm font-semibold transition-colors ${
    ativo ? "bg-superficie text-tinta shadow ring-2 ring-acento" : "text-tinta-2 hover:bg-superficie/70 hover:text-tinta"
  }`;

/**
 * Registro rápido pelo técnico de um pedido que chegou fora do sistema (WhatsApp, ligação, corredor).
 * É o que garante que TODO atendimento entre na contagem do piloto e no histórico.
 * Mesmo desenho do Novo chamado: uma coluna numerada, anexo no rodapé da caixa de texto e o botão
 * que gruda embaixo. À direita (PC largo), o que você já registrou hoje.
 */
export function Registrar() {
  const { usuario } = useAuth();
  const categorias = useCategorias();
  const [origem, setOrigem] = useState<Origem>("whatsapp");
  const [busca, setBusca] = useState("");
  const [sugestoes, setSugestoes] = useState<Usuario[]>([]);
  const [solicitante, setSolicitante] = useState<Usuario | null>(null);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [setor, setSetor] = useState("");
  const [categoria, setCategoria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [impacto, setImpacto] = useState<Impacto>("so_eu");
  const [resolvido, setResolvido] = useState(false);
  const [diagnostico, setDiagnostico] = useState("");
  const [solucao, setSolucao] = useState("");
  const [comRegistro, setComRegistro] = useState(false);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [progresso, setProgresso] = useState<number | null>(null);
  const [preparandoAnexo, setPreparandoAnexo] = useState(false);
  const anexos = useAnexos(setArquivos, setPreparandoAnexo);
  // quem acabou de ser registrado: no corredor é comum a mesma pessoa pedir mais de uma coisa
  const [ultimo, setUltimo] = useState<{ solicitante: Usuario | null; nome: string; setor: string; origem: Origem } | null>(null);

  useEffect(() => {
    pb.collection("setores").getFullList<Setor>({ sort: "nome", filter: "ativo = true" }).then(setSetores).catch(() => {});
  }, []);

  // busca de servidores cadastrados, a partir de 2 letras
  useEffect(() => {
    if (solicitante || busca.trim().length < 2) return setSugestoes([]);
    const t = window.setTimeout(() => {
      pb.collection("users")
        .getList<Usuario>(1, 6, { filter: pb.filter("name ~ {:q} || matricula ~ {:q}", { q: busca.trim() }), sort: "name", expand: "setor" })
        .then((r) => setSugestoes(r.items))
        .catch(() => {});
    }, 250);
    return () => window.clearTimeout(t);
  }, [busca, solicitante]);

  function escolher(u: Usuario) {
    setSolicitante(u);
    setBusca(u.name);
    if (u.setor) setSetor(u.setor);
    setSugestoes([]);
  }

  function limpar() {
    setSolicitante(null); setBusca(""); setSetor(""); setCategoria(""); setDescricao("");
    setImpacto("so_eu"); setResolvido(false); setComRegistro(false); setDiagnostico(""); setSolucao(""); setArquivos([]);
  }

  async function registrar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    if (!solicitante && !busca.trim() && !setor) return setErro("Diga quem pediu ou escolha o setor (passo 1).");
    if (!categoria) return setErro("Escolha a categoria (passo 2).");
    if (!descricao.trim()) return setErro("Escreva o que foi pedido (passo 3).");
    if (resolvido && comRegistro && (!diagnostico.trim() || !solucao.trim())) return setErro("Preencha a causa e o que foi feito (passo 5), ou desmarque o registro em Soluções.");
    setSalvando(true);
    setProgresso(arquivos.length ? 0 : null);
    try {
      const d = new FormData();
      d.append("origem", origem);
      if (solicitante) d.append("solicitante", solicitante.id);
      else d.append("solicitante_nome", busca.trim());
      d.append("setor", setor);
      d.append("categoria", categoria);
      d.append("descricao", descricao);
      d.append("impacto", impacto);
      d.append("status", resolvido ? "resolvido" : "aberto");
      if (resolvido && comRegistro) { d.append("diagnostico", diagnostico.trim()); d.append("solucao", solucao.trim()); }
      arquivos.forEach((f) => d.append("anexos", f));
      const c = await criarComProgresso<Chamado>("chamados", d, setProgresso);
      avisar(`Registrado como ${c.protocolo}. ${c.status === "resolvido" ? (c.solucao ? "Já entrou no histórico com a solução." : "Já está como resolvido.") : "Já está na fila."}`, {
        link: { para: `/ti/chamado/${c.id}`, rotulo: "Abrir" },
        duracao: 6000,
      });
      setUltimo({ solicitante, nome: solicitante?.name ?? busca.trim(), setor, origem });
      limpar();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
      setProgresso(null);
    }
  }

  // nome é opcional quando o setor está escolhido ("ligaram da Obras", sem dizer quem)
  const quemOk = !!solicitante || !!busca.trim() || !!setor;
  function repetirPessoa() {
    if (!ultimo) return;
    setOrigem(ultimo.origem);
    setSolicitante(ultimo.solicitante);
    setBusca(ultimo.nome);
    setSetor(ultimo.setor);
    setSugestoes([]);
  }
  const nomeSetor = (id: string) => setores.find((x) => x.id === id)?.nome;

  return (
    <form onSubmit={registrar} className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-8">
      <div className="space-y-6">
        <CabecalhoPagina titulo="Registrar pedido" />

        <div className="space-y-8 rounded-2xl bg-superficie p-5 ring-1 ring-linha md:p-8">
          {/* 1 */}
          <Passo n={1} id="r-quem" titulo="Quem pediu, e por onde?" feito={quemOk}>
            <div className="space-y-4">
              {ultimo && !quemOk && (
                <button
                  type="button"
                  onClick={repetirPessoa}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl border-2 border-dashed border-linha px-3 py-2 text-left hover:border-acento hover:bg-mar-50"
                >
                  <RotateCcw className="size-5 shrink-0 text-acento" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">Outro pedido de {ultimo.nome}</span>
                    <span className="block truncate text-xs text-tinta-2">
                      {[ROTULO_ORIGEM[ultimo.origem], nomeSetor(ultimo.setor)].filter(Boolean).join(", ")}: preenche quem pediu, por onde e o setor
                    </span>
                  </span>
                </button>
              )}
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-fundo p-1" role="radiogroup" aria-label="Como chegou">
                {ORIGENS.map(({ valor, rotulo, Icone }) => (
                  <label key={valor} className={`${segmento(origem === valor)} flex-col gap-0.5 sm:flex-row sm:gap-2`}>
                    <input type="radio" name="origem" checked={origem === valor} onChange={() => setOrigem(valor)} className="sr-only" />
                    <Icone className="size-5 shrink-0 text-acento" aria-hidden="true" /> {rotulo}
                  </label>
                ))}
              </div>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <div className="relative">
                  <label htmlFor="quem" className="rotulo">Nome ou matrícula <span className="font-normal text-tinta-2">(opcional com o setor)</span></label>
                  <div className="relative">
                    <input
                      id="quem"
                      className="campo pr-12"
                      autoComplete="off"
                      enterKeyHint="next"
                      // Enter: escolhe a primeira pessoa sugerida (ou vai para o setor), sem enviar o formulário pela metade
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        if (sugestoes[0]) escolher(sugestoes[0]);
                        document.getElementById("setor")?.focus();
                      }}
                      placeholder="Ex.: Maria ou 12345"
                      value={busca}
                      onChange={(e) => { setBusca(e.target.value); setSolicitante(null); }}
                    />
                    {busca && (
                      <button type="button" onClick={() => { setBusca(""); setSolicitante(null); }} className="absolute top-1/2 right-3 -translate-y-1/2 p-1 text-tinta-2" aria-label="Limpar nome">
                        <X className="size-5" />
                      </button>
                    )}
                  </div>
                  {sugestoes.length > 0 && (
                    <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl bg-superficie shadow-lg ring-1 ring-linha">
                      {sugestoes.map((u) => (
                        <li key={u.id}>
                          <button type="button" onClick={() => escolher(u)} className="w-full px-4 py-3 text-left hover:bg-mar-50">
                            <span className="block font-semibold">{u.name}</span>
                            <span className="block text-sm text-tinta-2">{[u.matricula && `mat. ${u.matricula}`, u.expand?.setor?.nome].filter(Boolean).join(", ")}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {/* só depois de digitar: diz se a pessoa vai acompanhar pelo sistema */}
                  {(solicitante || busca.trim().length > 2) && (
                    <p className="ajuda">
                      {solicitante
                        ? <span className="inline-flex items-center gap-1.5 text-ok"><CheckCircle2 className="size-4" aria-hidden="true" /> Tem conta: vai acompanhar pelo sistema.</span>
                        : !sugestoes.length && "Sem conta? O nome digitado fica registrado assim mesmo."}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="setor" className="rotulo">Setor</label>
                  <select id="setor" className="campo" value={setor} onChange={(e) => setSetor(e.target.value)}>
                    <option value="">Não informado</option>
                    {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </Passo>

          {/* 2 */}
          <Passo n={2} id="r-categoria" titulo="O que está com problema?" feito={!!categoria}>
            <div role="radiogroup" aria-labelledby="r-categoria" className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-4">
              {categorias.map((c) => (
                <label key={c.id} className="opcao min-h-12 gap-2.5 py-2 text-[15px]">
                  <input type="radio" name="categoria" className="sr-only" checked={categoria === c.id} onChange={() => setCategoria(c.id)} />
                  <IconeCategoria nome={c.icone} className="size-5 shrink-0 text-acento" />
                  <span className="leading-tight">{c.nome}</span>
                </label>
              ))}
              {!categorias.length && [0, 1, 2, 3, 4, 5].map((i) => <Bloco key={i} className="h-12 rounded-xl" />)}
            </div>
          </Passo>

          {/* 3 */}
          <Passo n={3} id="r-descricao" titulo="O que foi pedido?" feito={!!descricao.trim()}>
            <CaixaComAnexos
              id="descricao"
              rotulo="O que foi pedido"
              placeholder="Ex.: Maria (Tributos) ligou: a impressora não puxa o papel desde cedo."
              valor={descricao}
              aoMudar={setDescricao}
              arquivos={arquivos}
              setArquivos={setArquivos}
              anexos={anexos}
              rotuloAnexar="Anexar print ou foto"
              min={110}
            />
          </Passo>

          {/* 4 */}
          <Passo n={4} id="r-impacto" titulo="Isso está atrapalhando quem?" feito dica="Define a prioridade na fila, como quando o próprio servidor abre.">
            <div className="grid gap-1 rounded-xl bg-fundo p-1 sm:grid-cols-3" role="radiogroup" aria-labelledby="r-impacto">
              {(Object.keys(ROTULO_IMPACTO) as Impacto[]).map((k) => (
                <label key={k} className={segmento(impacto === k)}>
                  <input type="radio" name="impacto" className="sr-only" checked={impacto === k} onChange={() => setImpacto(k)} />
                  {ROTULO_IMPACTO[k]}
                </label>
              ))}
            </div>
          </Passo>

          {/* 5 */}
          <Passo n={5} id="r-resolvido" titulo="Já foi resolvido?" feito={!resolvido || !comRegistro || (!!diagnostico.trim() && !!solucao.trim())}>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-fundo p-1" role="radiogroup" aria-labelledby="r-resolvido">
              <label className={segmento(!resolvido)}>
                <input type="radio" name="resolvido" className="sr-only" checked={!resolvido} onChange={() => setResolvido(false)} />
                <ListOrdered className="size-4" aria-hidden="true" /> Não, vai para a fila
              </label>
              <label className={segmento(resolvido)}>
                <input type="radio" name="resolvido" className="sr-only" checked={resolvido} onChange={() => setResolvido(true)} />
                <CheckCircle2 className="size-4 text-ok" aria-hidden="true" /> Sim, resolvi na hora
              </label>
            </div>
            {resolvido && (
              <div className="mt-4">
                <RegistroSolucao ligado={comRegistro} aoLigar={setComRegistro} diagnostico={diagnostico} aoDiagnostico={setDiagnostico} solucao={solucao} aoSolucao={setSolucao} prefixo="registrar" />
              </div>
            )}
          </Passo>

          <RodapeEnviar
            soNoFimNoCelular
            frase="Entra na fila (ou no histórico) e na contagem do piloto."
            topo={<><ProgressoEnvio pct={progresso} />{erro && <p role="alert" className="font-semibold text-alerta">{erro}</p>}</>}
          >
            <button className="btn-primario w-full px-8 text-lg sm:w-auto" disabled={salvando || preparandoAnexo}>
              {resolvido ? <CheckCircle2 className="size-5" aria-hidden="true" /> : <Send className="size-5" aria-hidden="true" />}
              {salvando ? "Registrando..." : preparandoAnexo ? "Preparando anexo..." : resolvido ? "Registrar resolvido" : "Registrar na fila"}
            </button>
          </RodapeEnviar>
        </div>
      </div>

      <aside className="hidden space-y-4 xl:sticky xl:top-8 xl:mt-[4.75rem] xl:block" aria-label="Registrados por você hoje">
        <RegistradosHoje eu={usuario?.id ?? ""} />
      </aside>
    </form>
  );
}

/** O que este técnico registrou hoje: confere de relance se aquele WhatsApp já entrou. */
function RegistradosHoje({ eu }: { eu: string }) {
  const [lista, setLista] = useState<Chamado[] | null>(null);
  const carregar = useCallback(async () => {
    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    const r = await pb.collection("chamados").getList<Chamado>(1, 8, {
      filter: pb.filter("registrado_por = {:eu} && created >= {:d}", { eu, d: inicio.toISOString().replace("T", " ") }),
      sort: "-created",
      expand: EXPAND_CHAMADO,
      requestKey: "registrados-hoje",
    });
    setLista(r.items);
  }, [eu]);
  useEffect(() => { if (eu) carregar().catch(() => setLista([])); }, [carregar, eu]);
  useRealtime("chamados", () => carregar().catch(() => {}));

  return (
    <section className="rounded-2xl bg-superficie p-5 ring-1 ring-linha">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <ClipboardList className="size-5 text-acento" aria-hidden="true" /> Registrados por você hoje
        {lista && <span className="ml-auto font-display text-base text-tinta-2">{lista.length}</span>}
      </h2>
      {lista === null ? (
        <div className="mt-3 space-y-3">{[0, 1, 2].map((i) => <Bloco key={i} className="h-10" />)}</div>
      ) : lista.length === 0 ? (
        <p className="mt-2 text-sm text-tinta-2">Nada registrado hoje.</p>
      ) : (
        <ul className="mt-2 divide-y divide-linha">
          {lista.map((c) => (
            <li key={c.id}>
              <LinkChamado id={c.id} para={`/ti/chamado/${c.id}`} className="-mx-2 block rounded-lg px-2 py-2.5 hover:bg-fundo">
                <span className="flex items-center gap-2 text-sm">
                  <span className="font-display font-bold">{c.protocolo}</span>
                  <SeloStatus status={c.status} />
                  <span className="ml-auto text-xs text-tinta-2">{ROTULO_ORIGEM[c.origem]}</span>
                </span>
                <span className="mt-0.5 block truncate text-sm text-tinta-2">{nomeSolicitante(c)}: {resumo(c.descricao, 60)}</span>
              </LinkChamado>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
