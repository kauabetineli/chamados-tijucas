import { ArrowLeft, ArrowRight, Copy, Trash2, TriangleAlert, X } from "lucide-react";
import { Dica } from "../../../components/Dica";
import { useState, type ReactNode } from "react";
import { textoMinutos } from "../../../lib/configTI";
import {
  ACOES_POR_GATILHO, AJUDA_GATILHO, CAMPOS, GATILHOS, MINUTOS, PRAZOS, PRIORIDADES, ROTULO_ACAO, ROTULO_CAMPO, ROTULO_GATILHO, ROTULO_PRIO,
  novaAcao, novaCondicao, opcoesAvisar, opcoesDoCampo, temMinutos,
  type Acao, type Campo, type Condicao, type Fluxo, type Gatilho, type Listas, type No, type Problemas, type TipoAcao,
} from "../../../lib/automacao";

const SEL = "campo min-h-11 w-full font-semibold";

function Campo_({ rot, ajuda, children }: { rot: string; ajuda?: ReactNode; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-bold">{rot}</span>
      {children}
      {ajuda && <span className="block text-sm text-tinta-2">{ajuda}</span>}
    </label>
  );
}

function ListaProblemas({ itens }: { itens?: string[] }) {
  if (!itens?.length) return null;
  return (
    <ul className="space-y-1 rounded-xl bg-brasa-50 p-3 text-sm font-semibold text-alerta">
      {itens.map((t) => (
        <li key={t} className="flex items-start gap-1.5"><TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{t}</li>
      ))}
    </ul>
  );
}

const AJUDA_ACAO: Record<TipoAcao, string> = {
  prioridade: "Se vários fluxos mudarem a prioridade, vale a maior.",
  prazo: "Prazo para começar o atendimento. Se vários fluxos mudarem, vale o menor.",
  subir: "Baixa → Normal → Alta → Urgente. Se vários fluxos mudarem, vale a maior.",
  atribuir: "Se outro fluxo (mais acima na lista) já escolheu alguém, este bloco é ignorado. Pessoa ausente também é pulada.",
  rodizio: "Quem estiver ausente ou sem chamados automáticos é pulado. Se outro fluxo já escolheu alguém, é ignorado.",
  devolver: "Tira o responsável e o chamado volta a ficar livre na fila.",
  avisar: "O aviso chega no celular pelo aplicativo de alertas do TI.",
  resposta: "Aparece na conversa do chamado para quem pediu, como mensagem do TI.",
  nota: "Só o TI vê. Fica na linha do tempo do chamado.",
};

/* ------------------------------------------------------------------ */

export function Inspetor({ fluxo, no, listas, respostas, problemas, posicao, mudar, aoApagarNo, aoApagarFluxo, aoDuplicarFluxo, aoMoverFluxo, aoFechar }: {
  fluxo: Fluxo; no?: No; listas: Listas; respostas: string[]; problemas: Problemas;
  posicao: { i: number; total: number };
  mudar: (f: (fl: Fluxo) => void, aviso?: string) => void;
  aoApagarNo: (id: string) => void; aoApagarFluxo: () => void; aoDuplicarFluxo: () => void; aoMoverFluxo: (d: -1 | 1) => void;
  aoFechar: () => void;
}) {
  const mudarNo = (f: (n: No) => void) => mudar((fl) => { const n = fl.nos.find((x) => x.id === no?.id); if (n) f(n); });

  if (no && no.tipo === "cond" && no.cond) {
    return (
      <Moldura titulo="Pergunta (Se…)" cor="text-acento" aoFechar={aoFechar}
        rodape={<BotaoApagar rot="Apagar este bloco" aoClicar={() => aoApagarNo(no.id)} />}>
        <ListaProblemas itens={problemas.porNo[no.id]} />
        <EditorCondicao c={no.cond} listas={listas} aoMudar={(c) => mudarNo((n) => { n.cond = c; })} />
        <p className="text-sm text-tinta-2">Ligue a bolinha <b className="text-ok">Sim</b> ao que acontece quando a resposta é sim, e a <b className="text-alerta">Não</b> ao contrário. Pode deixar uma delas solta.</p>
      </Moldura>
    );
  }

  if (no && no.tipo === "acao" && no.acao) {
    const permitidas = ACOES_POR_GATILHO[fluxo.gatilho];
    return (
      <Moldura titulo="Ação (Então…)" cor="text-ok" aoFechar={aoFechar}
        rodape={<BotaoApagar rot="Apagar este bloco" aoClicar={() => aoApagarNo(no.id)} />}>
        <ListaProblemas itens={problemas.porNo[no.id]} />
        <Campo_ rot="O que fazer">
          <select className={SEL} value={no.acao.tipo} onChange={(e) => mudarNo((n) => { n.acao = novaAcao(e.target.value as TipoAcao); })}>
            {!permitidas.includes(no.acao.tipo) && <option value={no.acao.tipo}>{ROTULO_ACAO[no.acao.tipo]} (não vale neste gatilho)</option>}
            {permitidas.map((k) => <option key={k} value={k}>{ROTULO_ACAO[k]}</option>)}
          </select>
        </Campo_>
        <EditorAcao a={no.acao} listas={listas} respostas={respostas} aoMudar={(a) => mudarNo((n) => { n.acao = a; })} />
        <p className="text-sm text-tinta-2">{AJUDA_ACAO[no.acao.tipo]}</p>
      </Moldura>
    );
  }

  // gatilho selecionado ou nada selecionado: configurações do fluxo
  return (
    <Moldura titulo="Fluxo" cor="text-acento"
      rodape={
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secundario min-h-11 px-3" onClick={aoDuplicarFluxo}><Copy className="size-4" aria-hidden="true" /> Duplicar</button>
          <BotaoApagar rot="Apagar o fluxo" aoClicar={aoApagarFluxo} />
        </div>
      }>
      <ListaProblemas itens={[...problemas.erros, ...problemas.avisos]} />
      <Campo_ rot="Nome">
        <input className="campo min-h-11 w-full" value={fluxo.nome} maxLength={120} placeholder="Ex.: Impressoras da Saúde"
          onChange={(e) => mudar((f) => { f.nome = e.target.value; })} />
      </Campo_>
      <label className="flex min-h-11 cursor-pointer items-center gap-2.5 font-semibold">
        <input type="checkbox" role="switch" checked={fluxo.ativo} onChange={() => mudar((f) => { f.ativo = !f.ativo; })} className="size-5 accent-acento" />
        {fluxo.ativo ? "Ligado: o fluxo está valendo" : "Desligado: o fluxo não roda"}
      </label>
      <Campo_ rot="Gatilho (quando o fluxo roda)" ajuda={AJUDA_GATILHO[fluxo.gatilho]}>
        <select className={SEL} value={fluxo.gatilho} onChange={(e) => {
          const g = e.target.value as Gatilho;
          mudar((f) => { f.gatilho = g; f.minutos = g === "espera" ? 1440 : temMinutos(g) ? 30 : 0; });
        }}>
          {GATILHOS.map((g) => <option key={g} value={g}>{ROTULO_GATILHO[g]}</option>)}
        </select>
      </Campo_>
      {(fluxo.gatilho === "sem_inicio" || fluxo.gatilho === "espera") && (
        <Campo_ rot={fluxo.gatilho === "sem_inicio" ? "Depois de quanto tempo sem ninguém começar" : "Depois de quanto tempo sem resposta"}>
          <select className={SEL} value={String(fluxo.minutos)} onChange={(e) => mudar((f) => { f.minutos = parseInt(e.target.value, 10); })}>
            {(MINUTOS[fluxo.gatilho].includes(fluxo.minutos) ? MINUTOS[fluxo.gatilho] : [fluxo.minutos, ...MINUTOS[fluxo.gatilho]]).map((m) => (
              <option key={m} value={m}>{textoMinutos(m)}</option>
            ))}
          </select>
        </Campo_>
      )}
      <div className="space-y-1">
        <p className="flex items-center gap-2 text-sm font-bold">
          Ordem na lista: {posicao.i + 1} de {posicao.total}
          <Dica rotulo="Para que serve a ordem">Fluxos com o mesmo gatilho rodam nessa ordem. Se dois escolherem pessoas diferentes, vale o que vem antes.</Dica>
        </p>
        <div className="flex gap-2">
          <button type="button" className="btn-secundario min-h-11 px-3" disabled={posicao.i === 0} onClick={() => aoMoverFluxo(-1)}>
            <ArrowLeft className="size-4" aria-hidden="true" /> Antes
          </button>
          <button type="button" className="btn-secundario min-h-11 px-3" disabled={posicao.i === posicao.total - 1} onClick={() => aoMoverFluxo(1)}>
            Depois <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <details className="rounded-xl bg-fundo p-3 text-sm">
        <summary className="cursor-pointer font-bold">Como montar</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-tinta-2">
          <li>Arraste uma pergunta ou ação da coluna da esquerda para o desenho, ou clique nela para ligar abaixo do bloco selecionado.</li>
          <li>Para ligar dois blocos, puxe a bolinha de baixo de um até o outro. Perguntas têm duas saídas: <b className="text-ok">Sim</b> e <b className="text-alerta">Não</b>.</li>
          <li>Um bloco pode abrir vários caminhos. Um bloco com várias setas chegando roda uma vez, depois de todos os anteriores.</li>
          <li>Clique numa ligação e aperte Delete para apagar. Caminhos que voltam para trás não são aceitos.</li>
        </ul>
      </details>
    </Moldura>
  );
}

function Moldura({ titulo, cor, aoFechar, rodape, children }: { titulo: string; cor: string; aoFechar?: () => void; rodape?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl bg-superficie p-4 ring-1 ring-linha" aria-label={titulo}>
      <div className="flex items-center justify-between gap-2">
        <h2 className={`text-sm font-extrabold tracking-wider uppercase ${cor}`}>{titulo}</h2>
        {aoFechar && (
          <button type="button" onClick={aoFechar} aria-label="Fechar e ver o fluxo" className="grid size-10 place-items-center rounded-lg text-tinta-2 hover:bg-fundo hover:text-tinta">
            <X className="size-5" aria-hidden="true" />
          </button>
        )}
      </div>
      {children}
      {rodape && <div className="border-t border-linha pt-3">{rodape}</div>}
    </section>
  );
}

function BotaoApagar({ rot, aoClicar }: { rot: string; aoClicar: () => void }) {
  return (
    <button type="button" onClick={aoClicar} className="btn min-h-11 px-3 font-bold text-alerta ring-1 ring-linha hover:bg-brasa-50">
      <Trash2 className="size-4" aria-hidden="true" /> {rot}
    </button>
  );
}

/* ------------------------------------------------------------------ */

function EditorCondicao({ c, listas, aoMudar }: { c: Condicao; listas: Listas; aoMudar: (c: Condicao) => void }) {
  const [palavra, setPalavra] = useState("");
  const opcoes = opcoesDoCampo(c.campo, listas);
  const addPalavra = () => {
    const w = palavra.trim();
    if (w && !c.valores.includes(w)) aoMudar({ ...c, valores: [...c.valores, w] });
    setPalavra("");
  };
  return (
    <>
      <Campo_ rot="Perguntar sobre">
        <select className={SEL} value={c.campo} onChange={(e) => aoMudar(novaCondicao(e.target.value as Campo))}>
          {CAMPOS.map((k) => <option key={k} value={k}>{ROTULO_CAMPO[k]}</option>)}
        </select>
      </Campo_>
      <Campo_ rot="Comparação">
        <select className={SEL} value={c.op} onChange={(e) => aoMudar({ ...c, op: e.target.value as Condicao["op"] })}>
          {c.campo === "texto"
            ? <><option value="contem">contém alguma destas palavras</option><option value="nao_contem">não contém nenhuma</option></>
            : <><option value="e">é um destes</option><option value="nao_e">não é nenhum destes</option></>}
        </select>
      </Campo_>
      {c.campo === "texto" ? (
        <div className="space-y-2">
          <p className="text-sm font-bold">Palavras</p>
          <div className="flex flex-wrap gap-1.5">
            {c.valores.map((v) => (
              <span key={v} className="inline-flex min-h-8 items-center rounded-full bg-mar-700 pl-3 text-sm font-semibold text-white">
                {v}
                <button type="button" aria-label={`Tirar ${v}`} className="grid size-8 place-items-center" onClick={() => aoMudar({ ...c, valores: c.valores.filter((x) => x !== v) })}>
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <label className="min-w-0 flex-1"><span className="sr-only">Nova palavra</span>
              <input className="campo min-h-11 w-full" value={palavra} placeholder="ex.: toner" onChange={(e) => setPalavra(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPalavra(); } }} />
            </label>
            <button type="button" className="btn-secundario min-h-11 px-3" onClick={addPalavra}>Pôr</button>
          </div>
        </div>
      ) : (
        <fieldset className="space-y-1">
          <legend className="mb-1 text-sm font-bold">Valores</legend>
          <div className="max-h-60 space-y-0.5 overflow-y-auto rounded-xl p-1 ring-1 ring-linha">
            {opcoes.map((o) => {
              const on = c.valores.includes(o.v);
              return (
                <label key={o.v} className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2 hover:bg-fundo">
                  <input type="checkbox" checked={on} className="size-5 accent-acento"
                    onChange={() => aoMudar({ ...c, valores: on ? c.valores.filter((x) => x !== o.v) : [...c.valores, o.v] })} />
                  <span className="font-semibold">{o.rot}</span>
                </label>
              );
            })}
            {!opcoes.length && <p className="p-2 text-sm text-tinta-2">Nada cadastrado.</p>}
          </div>
        </fieldset>
      )}
    </>
  );
}

function EditorAcao({ a, listas, respostas, aoMudar }: { a: Acao; listas: Listas; respostas: string[]; aoMudar: (a: Acao) => void }) {
  switch (a.tipo) {
    case "prioridade":
      return (
        <Campo_ rot="Prioridade">
          <select className={SEL} value={a.valor} onChange={(e) => aoMudar({ ...a, valor: e.target.value })}>
            {PRIORIDADES.map((p) => <option key={p} value={p}>{ROTULO_PRIO[p]}</option>)}
          </select>
        </Campo_>
      );
    case "prazo":
      return (
        <Campo_ rot="Prazo para começar">
          <select className={SEL} value={a.valor} onChange={(e) => aoMudar({ ...a, valor: e.target.value })}>
            {PRAZOS.map((m) => <option key={m} value={String(m)}>{textoMinutos(m)}</option>)}
          </select>
        </Campo_>
      );
    case "atribuir":
      return (
        <Campo_ rot="Para quem">
          <select className={SEL} value={a.valor} onChange={(e) => aoMudar({ ...a, valor: e.target.value })}>
            <option value="">Escolher…</option>
            {listas.pessoas.map((p) => <option key={p.v} value={p.v}>{p.rot}</option>)}
          </select>
        </Campo_>
      );
    case "rodizio":
      return (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-bold">Entre quem</legend>
          <div className="flex flex-wrap gap-2">
            {listas.pessoas.map((p) => {
              const on = a.pessoas.includes(p.v);
              return (
                <button key={p.v} type="button" aria-pressed={on}
                  onClick={() => aoMudar({ ...a, pessoas: on ? a.pessoas.filter((x) => x !== p.v) : [...a.pessoas, p.v] })}
                  className={`min-h-10 rounded-full px-3.5 text-sm font-bold ${on ? "bg-campo-700 text-white" : "border-2 border-dashed border-ok/50 text-ok"}`}>
                  {p.rot}
                </button>
              );
            })}
          </div>
          <Campo_ rot="Como dividir">
            <select className={SEL} value={a.modo} onChange={(e) => aoMudar({ ...a, modo: e.target.value as Acao["modo"] })}>
              <option value="carga">Para quem estiver com menos chamados</option>
              <option value="sequencia">Um de cada vez, em sequência</option>
            </select>
          </Campo_>
        </fieldset>
      );
    case "avisar":
      return (
        <Campo_ rot="Avisar quem">
          <select className={SEL} value={a.valor} onChange={(e) => aoMudar({ ...a, valor: e.target.value })}>
            {opcoesAvisar(listas).map((o) => <option key={o.v} value={o.v}>{o.rot}</option>)}
          </select>
        </Campo_>
      );
    case "resposta":
    case "nota":
      return (
        <div className="space-y-2">
          <Campo_ rot={a.tipo === "nota" ? "Texto da nota" : "Mensagem para quem pediu"}>
            <textarea className="campo min-h-24 w-full" maxLength={500} value={a.valor} onChange={(e) => aoMudar({ ...a, valor: e.target.value })}
              placeholder={a.tipo === "nota" ? "Ex.: conferir o toner no almoxarifado" : "Ex.: Recebemos o seu chamado e já vamos verificar."} />
          </Campo_>
          {a.tipo === "resposta" && respostas.length > 0 && (
            <Campo_ rot="Ou usar uma resposta pronta">
              <select className={SEL} value="" onChange={(e) => { if (e.target.value) aoMudar({ ...a, valor: e.target.value }); }}>
                <option value="">Escolher…</option>
                {respostas.map((t) => <option key={t} value={t}>{t.length > 70 ? t.slice(0, 70) + "…" : t}</option>)}
              </select>
            </Campo_>
          )}
        </div>
      );
    default:
      return null;
  }
}
