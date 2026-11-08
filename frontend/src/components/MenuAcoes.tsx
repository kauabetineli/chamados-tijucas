import { CheckCircle2, ExternalLink, Hourglass, ListOrdered, MessageSquare, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ROTULO_AGUARDANDO, ROTULO_PRIORIDADE, resumo } from "../lib/formato";
import { mensagemErro, nomeSolicitante, pb, type Chamado, type MotivoAguardando, type Prioridade, type Status, type Usuario } from "../lib/pb";
import { EscolhaEspera } from "./EscolhaEspera";
import { EscolhaResponsavel, PainelRapido, RodapeRascunho, RotuloSecao } from "./PainelRapido";
import { RespostasProntas } from "./RespostasProntas";
import { COR_PRIORIDADE, PilulaPrioridade } from "./Selos";


const PRIORIDADES: Prioridade[] = ["baixa", "normal", "alta", "urgente"];

type Rascunho = { status: Status; motivo: MotivoAguardando | ""; prioridade: Prioridade; responsavel: string; mensagem: string };

/**
 * Ações rápidas de um chamado, sem precisar abrir: situação, prioridade, quem fica e mensagem.
 * NADA é salvo na hora: as mudanças viram um rascunho e só valem no "Salvar alterações"
 * (ou são descartadas). Assim o cartão não "foge" da tela no meio da edição.
 * Resolver abre o chamado (causa e solução precisam de atenção: são o histórico do TI).
 * Abre pelo "⋮" do cartão ou segurando o dedo no cartão (celular).
 */
export function MenuAcoes({ chamado: c, eu, tecnicos, carga, aoFechar, aoSalvo }: {
  chamado: Chamado;
  eu: string;
  tecnicos: Usuario[];
  carga: Record<string, number>;
  aoFechar: () => void;
  /** depois de salvar: mensagem para o aviso da tela e o id para destacar o cartão */
  aoSalvo: (msg: string, id: string) => void;
}) {
  const inicial: Rascunho = { status: c.status, motivo: c.aguardando_motivo ?? "", prioridade: c.prioridade, responsavel: c.responsavel ?? "", mensagem: "" };
  const [r, setR] = useState<Rascunho>(inicial);
  // no PC a mensagem tem a coluna da direita: já abre pronta para escrever
  const telaLarga = typeof window !== "undefined" && !!window.matchMedia?.("(min-width: 768px)").matches;
  const [escrevendo, setEscrevendo] = useState(telaLarga);
  const [focarMensagem, setFocarMensagem] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const mudou = {
    status: r.status !== inicial.status || (r.status === "aguardando" && r.motivo !== inicial.motivo),
    prioridade: r.prioridade !== inicial.prioridade,
    responsavel: r.responsavel !== inicial.responsavel,
    mensagem: r.mensagem.trim() !== "",
  };
  const mudancas = Object.values(mudou).filter(Boolean).length;
  const primeiro = (id: string) => id === eu ? "você" : (tecnicos.find((t) => t.id === id)?.name ?? "colega").split(" ")[0];
  const solicitante = nomeSolicitante(c).split(" ")[0];

  // regras que mantêm o rascunho coerente com o servidor
  function mudarStatus(status: Status) {
    setSaindo(false);
    setR((x) => ({
      ...x,
      status,
      motivo: status === "aguardando" ? x.motivo : "",
      responsavel: status !== "aberto" && !x.responsavel ? eu : x.responsavel,
    }));
  }
  function mudarResponsavel(responsavel: string) {
    setSaindo(false);
    setR((x) => ({ ...x, responsavel, status: !responsavel ? "aberto" : x.status }));
  }

  function tentarFechar() {
    if (salvando) return;
    if (!mudancas) return aoFechar();
    setSaindo((s) => !s ? true : false); // segunda vez (Esc de novo) = continuar editando
  }

  async function salvar() {
    if (!mudancas || salvando) return;
    if (r.status === "aguardando" && !r.motivo) return setErro("Escolha o que o chamado está aguardando.");
    setErro("");
    setSalvando(true);
    try {
      const dados: Partial<Chamado> = {};
      if (mudou.status) {
        dados.status = r.status;
        if (r.status === "aguardando") dados.aguardando_motivo = r.motivo as MotivoAguardando;
      }
      if (mudou.prioridade) dados.prioridade = r.prioridade;
      if (mudou.responsavel) dados.responsavel = r.responsavel;
      if (Object.keys(dados).length) await pb.collection("chamados").update(c.id, dados);
      if (mudou.mensagem) await pb.collection("interacoes").create({ chamado: c.id, texto: r.mensagem.trim(), interno: false });

      const partes: string[] = [];
      if (mudou.status) {
        partes.push(r.status === "em_andamento" ? "em atendimento"
          : r.status === "aguardando" ? `em espera (${ROTULO_AGUARDANDO[r.motivo as MotivoAguardando]})` : "de volta à fila");
      }
      if (mudou.prioridade) partes.push(`prioridade ${ROTULO_PRIORIDADE[r.prioridade].toLowerCase()}`);
      if (mudou.responsavel) partes.push(r.responsavel ? `com ${primeiro(r.responsavel)}` : "livre");
      if (mudou.mensagem) partes.push(`mensagem enviada a ${solicitante}`);
      aoSalvo(`${c.protocolo}: ${partes.join(", ")}.`, c.id);
      aoFechar();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  }

  // Ctrl+Enter (ou Cmd+Enter) salva de qualquer lugar da janela
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); salvar(); }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  const segmento = (ativo: boolean) =>
    `flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg px-2 text-sm font-semibold transition-colors ${
      ativo ? "bg-superficie text-tinta shadow ring-2 ring-acento" : "text-tinta-2 hover:bg-superficie/70 hover:text-tinta"
    }`;

  const reservado = r.status === "aberto" && r.responsavel;

  return (
    <PainelRapido
      idTitulo="titulo-acoes"
      largura={c.solicitante ? "max-w-lg md:max-w-4xl" : "max-w-lg"}
      aoTentarFechar={tentarFechar}
      titulo={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {c.protocolo}
          <PilulaPrioridade prioridade={c.prioridade} />
        </span>
      }
      subtitulo={
        <>
          <p className="mt-1 line-clamp-2 text-sm">{resumo(c.descricao, 160)}</p>
          <p className="mt-0.5 truncate text-sm text-tinta-2">
            {[nomeSolicitante(c), c.expand?.setor?.nome, c.expand?.categoria?.nome].filter(Boolean).join(", ")}
          </p>
        </>
      }
      rodape={
        <>
          {erro && <p role="alert" className="mb-2 font-semibold text-alerta">{erro}</p>}
          <RodapeRascunho
            mudancas={mudancas}
            saindo={saindo}
            salvando={salvando}
            rotuloSalvar="Salvar alterações"
            aoSalvar={salvar}
            aoDescartar={() => { setR(inicial); setEscrevendo(telaLarga); setErro(""); }}
            aoContinuar={() => setSaindo(false)}
            aoSairSemSalvar={aoFechar}
            semMudancas={
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                <Link to={`/ti/chamado/${c.id}`} className="btn px-3 text-tinta-2 hover:bg-fundo hover:text-tinta sm:mr-auto" onClick={aoFechar}>
                  <ExternalLink className="size-5" aria-hidden="true" /> Abrir o chamado completo
                </Link>
                {(c.status === "em_andamento" || c.status === "aguardando") && (
                  <Link to={`/ti/chamado/${c.id}?resolver=1`} className="btn-sucesso" onClick={aoFechar}>
                    <CheckCircle2 className="size-5" aria-hidden="true" /> Resolver...
                  </Link>
                )}
              </div>
            }
          />
        </>
      }
    >
      {/* PC: à esquerda o que muda no chamado; à direita a mensagem. Celular: tudo em uma coluna. */}
      <div className={c.solicitante ? "grid gap-5 md:grid-cols-2 md:gap-8" : ""}>
      <div className="space-y-5">
        {/* situação */}
        <section aria-labelledby="sec-situacao">
          <RotuloSecao id="sec-situacao" alterado={mudou.status}>Situação</RotuloSecao>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-fundo p-1" role="radiogroup" aria-labelledby="sec-situacao">
            {([
              ["aberto", ListOrdered, "Na fila"],
              ["em_andamento", Wrench, "Atendendo"],
              ["aguardando", Hourglass, "Em espera"],
            ] as const).map(([st, Icone, rotulo]) => (
              <label key={st} className={`${segmento(r.status === st)} flex-col gap-1 sm:flex-row sm:gap-2`}>
                <input type="radio" name="situacao" className="sr-only" checked={r.status === st} onChange={() => mudarStatus(st)} />
                <Icone className="size-4" aria-hidden="true" /> {rotulo}
              </label>
            ))}
          </div>
          {r.status === "aguardando" && (
            <div className="mt-2 space-y-1.5">
              <p className="text-sm font-semibold">Aguardando o quê?</p>
              <EscolhaEspera nome="motivo-acoes" valor={r.motivo} aoEscolher={(m) => { setSaindo(false); setErro(""); setR((x) => ({ ...x, motivo: m })); }} />
            </div>
          )}
          {mudou.status && (
            <p className="mt-1.5 text-sm text-tinta-2">
              {r.status === "em_andamento"
                ? `Vai ficar em atendimento com ${primeiro(r.responsavel)}.`
                : r.status === "aguardando"
                  ? r.motivo === "solicitante"
                    ? `Fica com ${primeiro(r.responsavel)}, fora da fila. Volta sozinho quando ${solicitante} responder.`
                    : `Fica com ${primeiro(r.responsavel)}, fora da fila e da carga até você retomar.`
                  : reservado ? `Volta para a fila, reservado para ${primeiro(r.responsavel)}.` : "Volta para a fila, livre para qualquer um."}
            </p>
          )}
        </section>

        {/* prioridade */}
        <section aria-labelledby="sec-prioridade">
          <RotuloSecao id="sec-prioridade" alterado={mudou.prioridade}>Prioridade</RotuloSecao>
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-fundo p-1" role="radiogroup" aria-labelledby="sec-prioridade">
            {PRIORIDADES.map((p) => (
              <label key={p} className={`${segmento(r.prioridade === p)} flex-col gap-1 sm:flex-row sm:gap-2`}>
                <input type="radio" name="prioridade" className="sr-only" checked={r.prioridade === p} onChange={() => { setSaindo(false); setR((x) => ({ ...x, prioridade: p })); }} />
                <span className={`size-2.5 rounded-full ${COR_PRIORIDADE[p]}`} aria-hidden="true" />
                {ROTULO_PRIORIDADE[p]}
              </label>
            ))}
          </div>
          {mudou.prioridade && <p className="mt-1.5 text-sm text-tinta-2">O chamado muda de lugar na fila quando você salvar.</p>}
        </section>

        {/* quem fica */}
        <section aria-labelledby="sec-responsavel">
          <RotuloSecao id="sec-responsavel" alterado={mudou.responsavel}>Quem fica com o chamado</RotuloSecao>
          <EscolhaResponsavel
            nomeGrupo="responsavel-acoes"
            tecnicos={tecnicos}
            eu={eu}
            carga={carga}
            valor={r.responsavel}
            original={inicial.responsavel}
            aoEscolher={mudarResponsavel}
            colunas={c.solicitante ? "sm:grid-cols-2 md:grid-cols-1" : "sm:grid-cols-2"}
          />
        </section>
      </div>

        {/* mensagem para o solicitante */}
        {c.solicitante && (
          <section aria-labelledby="sec-mensagem">
            <RotuloSecao id="sec-mensagem" alterado={mudou.mensagem}>Mensagem para {solicitante}</RotuloSecao>
            {!escrevendo ? (
              <button
                type="button"
                onClick={() => { setEscrevendo(true); setFocarMensagem(true); }}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left font-semibold ring-1 ring-linha hover:bg-fundo hover:ring-acento"
              >
                <MessageSquare className="size-5 text-acento" aria-hidden="true" />
                <span className="flex-1">Escrever mensagem</span>
                <span className="text-sm font-normal text-tinta-2">vai junto ao salvar</span>
              </button>
            ) : (
              <div className="space-y-2">
                <RespostasProntas selecionada={r.mensagem} aoEscolher={(t) => { setSaindo(false); setR((x) => ({ ...x, mensagem: t })); }} />
                <label htmlFor="resposta-rapida" className="sr-only">Mensagem para {solicitante}</label>
                <textarea
                  id="resposta-rapida"
                  className="campo min-h-24 resize-y"
                  placeholder="Escolha uma pronta ou escreva aqui..."
                  value={r.mensagem}
                  onChange={(e) => { setSaindo(false); setR((x) => ({ ...x, mensagem: e.target.value })); }}
                  autoFocus={focarMensagem}
                />
                <p className="text-sm text-tinta-2">{solicitante} vê a mensagem no chamado. Ela só é enviada quando você salvar.</p>
              </div>
            )}
          </section>
        )}
      </div>
    </PainelRapido>
  );
}
