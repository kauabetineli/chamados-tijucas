import { Download, MessageSquare } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AbasPagina, CabecalhoPagina } from "../../components/CabecalhoPagina";
import { EsqueletoLinhas } from "../../components/Esqueleto";
import { MarcaTeste } from "../../components/Selos";
import { avisar } from "../../lib/avisos";
import { dataHora } from "../../lib/formato";
import { mensagemErro, pb, type Feedback as TFeedback } from "../../lib/pb";
import { baixarCsv } from "../../lib/planilha";

/**
 * Feedback do sistema ("Sua opinião"): só para a EQUIPE DO PROJETO (contas com equipe_projeto).
 * Serve para corrigir problemas durante o piloto e como evidência nos relatórios da extensão.
 */

const TIPO: Record<TFeedback["tipo"], { rot: string; classe: string }> = {
  problema: { rot: "Problema", classe: "bg-brasa-50 text-alerta" },
  ideia: { rot: "Ideia", classe: "bg-mar-50 text-acento" },
  elogio: { rot: "Elogio", classe: "bg-campo-50 text-ok" },
  nota: { rot: "Só nota", classe: "bg-fundo text-tinta-2 ring-1 ring-linha" },
};
const SITUACAO: Record<TFeedback["situacao"], string> = { novo: "Novo", visto: "Visto", resolvido: "Resolvido", melhoria: "Virou melhoria" };
const PAPEL: Record<string, string> = { tecnico: "TI", solicitante: "Servidor" };

type Filtro = "tudo" | TFeedback["tipo"] | "novos";

export function Feedback() {
  const [lista, setLista] = useState<TFeedback[] | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("tudo");
  const [quem, setQuem] = useState<"" | "tecnico" | "solicitante">("");

  useEffect(() => {
    document.title = "Feedback do sistema | Dino Desk";
    let vivo = true;
    const carregar = () => pb.collection("feedbacks").getFullList<TFeedback>({ sort: "-created", expand: "setor", requestKey: null })
      .then((l) => vivo && setLista(l)).catch((e) => vivo && avisar(mensagemErro(e), { tipo: "erro" }));
    carregar();
    pb.collection("feedbacks").subscribe("*", carregar).catch(() => {});
    return () => { vivo = false; pb.collection("feedbacks").unsubscribe("*").catch(() => {}); document.title = "Dino Desk"; };
  }, []);

  const visiveis = useMemo(() => (lista ?? []).filter((f) =>
    (filtro === "tudo" || (filtro === "novos" ? f.situacao === "novo" : f.tipo === filtro)) && (!quem || f.papel === quem)), [lista, filtro, quem]);

  const conta = (t: TFeedback["tipo"]) => (lista ?? []).filter((f) => f.tipo === t).length;
  const notas = (lista ?? []).filter((f) => f.nota > 0).map((f) => f.nota);
  const media = notas.length ? (notas.reduce((a, b) => a + b, 0) / notas.length).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—";
  const novos = (lista ?? []).filter((f) => f.situacao === "novo").length;

  async function mudarSituacao(f: TFeedback, situacao: TFeedback["situacao"]) {
    setLista((l) => l?.map((x) => (x.id === f.id ? { ...x, situacao } : x)) ?? null);
    try { await pb.collection("feedbacks").update(f.id, { situacao }); }
    catch (e) { avisar(mensagemErro(e), { tipo: "erro" }); setLista((l) => l?.map((x) => (x.id === f.id ? f : x)) ?? null); }
  }

  function baixar() {
    baixarCsv(
      ["data", "tipo", "texto", "nota", "papel", "setor", "tela", "situacao", "teste"],
      (lista ?? []).map((f) => [dataHora(f.created), TIPO[f.tipo].rot, f.texto, f.nota || "", PAPEL[f.papel] ?? f.papel, f.expand?.setor?.nome ?? "", f.tela, SITUACAO[f.situacao], f.ficticio ? "sim" : ""]),
      `feedback-dino-desk-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  }

  const cartao = (rot: string, valor: string | number, cor = "") => (
    <div className="rounded-2xl bg-superficie p-4 ring-1 ring-linha">
      <p className="text-sm text-tinta-2">{rot}</p>
      <p className={`mt-0.5 font-display text-3xl font-extrabold ${cor}`}>{lista ? valor : "…"}</p>
    </div>
  );

  return (
    <div>
      <CabecalhoPagina
        className="mb-6"
        titulo="Feedback do sistema"
        subtitulo="Problemas, ideias e elogios enviados pelo botão “Sua opinião”."
        acoes={<button type="button" className="btn-secundario" onClick={baixar} disabled={!lista?.length}><Download className="size-5" aria-hidden="true" /> Baixar planilha</button>}
        abas={
          <AbasPagina rotulo="Filtrar por tipo" itens={[
            { rotulo: "Tudo", ativo: filtro === "tudo", aoClicar: () => setFiltro("tudo"), numero: lista?.length },
            { rotulo: "Novos", ativo: filtro === "novos", aoClicar: () => setFiltro("novos"), numero: novos },
            { rotulo: "Problemas", ativo: filtro === "problema", aoClicar: () => setFiltro("problema"), numero: conta("problema") },
            { rotulo: "Ideias", ativo: filtro === "ideia", aoClicar: () => setFiltro("ideia"), numero: conta("ideia") },
            { rotulo: "Elogios", ativo: filtro === "elogio", aoClicar: () => setFiltro("elogio"), numero: conta("elogio") },
          ]} />
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {cartao("Recebidos", lista?.length ?? 0)}
        {cartao("Problemas", conta("problema"), "text-alerta")}
        {cartao("Elogios", conta("elogio"), "text-ok")}
        {cartao(`Nota média (${notas.length} nota${notas.length === 1 ? "" : "s"})`, media)}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Quem enviou">
        {([["", "Todos"], ["tecnico", "Do TI"], ["solicitante", "Dos servidores"]] as const).map(([v, rot]) => (
          <button key={v} type="button" aria-pressed={quem === v} onClick={() => setQuem(v)}
            className={`min-h-10 rounded-full px-4 font-semibold ring-1 ${quem === v ? "bg-mar-700 text-white ring-acento" : "bg-superficie ring-linha hover:ring-acento"}`}>
            {rot}
          </button>
        ))}
      </div>

      {!lista ? <EsqueletoLinhas /> : visiveis.length === 0 ? (
        <div className="rounded-2xl bg-superficie p-8 text-center ring-1 ring-linha">
          <MessageSquare className="mx-auto size-8 text-tinta-2" aria-hidden="true" />
          <p className="mt-2 font-semibold">Nada por aqui ainda.</p>
          <p className="text-tinta-2">Quando alguém usar o botão “Sua opinião”, aparece nesta lista.</p>
        </div>
      ) : (
        <ul className="divide-y divide-linha overflow-hidden rounded-2xl bg-superficie ring-1 ring-linha">
          {visiveis.map((f) => (
            <li key={f.id} className="grid gap-3 p-4 md:grid-cols-[7rem_minmax(0,1fr)_12rem_10rem] md:items-start">
              <span><span className={`inline-block rounded-full px-2.5 py-0.5 text-sm font-bold ${TIPO[f.tipo].classe}`}>{TIPO[f.tipo].rot}</span></span>
              <div className="min-w-0">
                <p className="texto-livre whitespace-pre-line">{f.texto || <span className="text-tinta-2">(sem texto)</span>}</p>
                <p className="mt-1 text-sm text-tinta-2">
                  {dataHora(f.created)}{f.tela && <> · tela: {f.tela}</>}{f.nota > 0 && <> · nota <b className="text-tinta">{f.nota}</b></>} <MarcaTeste ficticio={f.ficticio} />
                </p>
              </div>
              <p className="text-sm">
                <b>{f.autor_nome ?? "—"}</b><br />
                <span className="text-tinta-2">{PAPEL[f.papel] ?? f.papel}{f.expand?.setor?.nome ? ` · ${f.expand.setor.nome}` : ""}</span>
              </p>
              <label className="block">
                <span className="sr-only">Situação</span>
                <select className="campo w-full font-semibold" value={f.situacao} onChange={(e) => mudarSituacao(f, e.target.value as TFeedback["situacao"])}>
                  {Object.entries(SITUACAO).map(([v, rot]) => <option key={v} value={v}>{rot}</option>)}
                </select>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
