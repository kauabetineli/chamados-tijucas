import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { avisar } from "../lib/avisos";
import { mensagemErro, pb } from "../lib/pb";
import { useRespostasProntas, type RespostaPronta } from "../lib/respostasProntas";
import { Bloco } from "./Esqueleto";

const MAX = 300;

/**
 * Frases que o TI mais manda ("Estou indo até aí."). Um clique coloca a frase na mensagem.
 * "Editar" troca os botões por uma lista editável: qualquer técnico cria, corrige, reordena e apaga.
 * A lista é a mesma para a equipe toda.
 */
export function RespostasProntas({ selecionada, aoEscolher }: { selecionada?: string; aoEscolher: (texto: string) => void }) {
  const { lista, recarregar } = useRespostasProntas();
  const [editando, setEditando] = useState(false);

  if (lista === null) {
    return <div className="flex flex-wrap gap-2" aria-hidden="true">{[28, 40, 34].map((w) => <Bloco key={w} className="h-8 rounded-full" />)}</div>;
  }
  if (editando) return <EditorRespostas lista={lista} aoMudar={recarregar} aoFechar={() => setEditando(false)} />;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {lista.map(({ id, texto }) => (
        <button
          key={id}
          type="button"
          onClick={() => aoEscolher(texto)}
          className={`rounded-full px-3 py-1.5 text-left text-sm font-semibold ring-1 ${
            selecionada === texto ? "bg-mar-700 text-white ring-acento" : "bg-mar-50 text-acento ring-transparent hover:ring-acento"
          }`}
        >
          {texto}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setEditando(true)}
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm font-semibold text-tinta-2 hover:bg-fundo hover:text-tinta"
        title="Criar, corrigir ou apagar respostas prontas"
      >
        <Pencil className="size-3.5" aria-hidden="true" /> {lista.length ? "Editar" : "Criar respostas prontas"}
      </button>
    </div>
  );
}

function EditorRespostas({ lista, aoMudar, aoFechar }: { lista: RespostaPronta[]; aoMudar: () => Promise<void>; aoFechar: () => void }) {
  const [nova, setNova] = useState("");
  const [editandoId, setEditandoId] = useState("");
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function rodar(acao: () => Promise<unknown>, ok?: string) {
    setOcupado(true);
    try {
      await acao();
      await aoMudar();
      if (ok) avisar(ok);
      return true;
    } catch (err) {
      avisar(mensagemErro(err), { tipo: "erro" });
      return false;
    } finally {
      setOcupado(false);
    }
  }

  const col = pb.collection("respostas_prontas");
  const proximaOrdem = (lista.at(-1)?.ordem ?? 0) + 10;

  async function adicionar() {
    const t = nova.trim();
    if (!t) return;
    if (await rodar(() => col.create({ texto: t, ordem: proximaOrdem }), "Resposta pronta criada.")) setNova("");
  }
  async function salvarEdicao(r: RespostaPronta) {
    const t = texto.trim();
    if (!t || t === r.texto) return setEditandoId("");
    if (await rodar(() => col.update(r.id, { texto: t }), "Resposta pronta atualizada.")) setEditandoId("");
  }
  // trocar de lugar com o vizinho: renumera a lista toda (10, 20, 30...) para não haver empate
  function mover(i: number, d: -1 | 1) {
    const nova = [...lista];
    [nova[i], nova[i + d]] = [nova[i + d], nova[i]];
    rodar(() => Promise.all(nova.map((r, n) => (r.ordem === (n + 1) * 10 ? null : col.update(r.id, { ordem: (n + 1) * 10 })))));
  }

  const botaoIcone = "grid size-9 shrink-0 place-items-center rounded-lg text-tinta-2 hover:bg-fundo hover:text-tinta disabled:opacity-30";

  return (
    <div className="space-y-2 rounded-xl p-3 ring-1 ring-linha" aria-busy={ocupado}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Respostas prontas da equipe</p>
        <button type="button" className="btn min-h-9 px-3 text-sm text-acento hover:bg-fundo" onClick={aoFechar}>
          <Check className="size-4" aria-hidden="true" /> Pronto
        </button>
      </div>
      <ul className="divide-y divide-linha">
        {lista.map((r, i) => (
          <li key={r.id} className="flex items-center gap-1 py-1.5">
            {editandoId === r.id ? (
              <>
                <label htmlFor={`resp-${r.id}`} className="sr-only">Texto da resposta</label>
                <input
                  id={`resp-${r.id}`}
                  enterKeyHint="done"
                  className="campo min-h-10 flex-1 py-1.5"
                  value={texto}
                  maxLength={MAX}
                  autoFocus
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); salvarEdicao(r); }
                    if (e.key === "Escape") { e.stopPropagation(); setEditandoId(""); }
                  }}
                />
                <button type="button" className={botaoIcone} disabled={ocupado} onClick={() => salvarEdicao(r)} aria-label="Salvar"><Check className="size-4" /></button>
                <button type="button" className={botaoIcone} onClick={() => setEditandoId("")} aria-label="Cancelar"><X className="size-4" /></button>
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1 text-sm">{r.texto}</span>
                <button type="button" className={botaoIcone} disabled={ocupado || i === 0} onClick={() => mover(i, -1)} aria-label={`Subir "${r.texto}"`}><ArrowUp className="size-4" /></button>
                <button type="button" className={botaoIcone} disabled={ocupado || i === lista.length - 1} onClick={() => mover(i, 1)} aria-label={`Descer "${r.texto}"`}><ArrowDown className="size-4" /></button>
                <button type="button" className={botaoIcone} disabled={ocupado} onClick={() => { setEditandoId(r.id); setTexto(r.texto); }} aria-label={`Editar "${r.texto}"`}><Pencil className="size-4" /></button>
                <button
                  type="button"
                  className={`${botaoIcone} hover:text-alerta`}
                  disabled={ocupado}
                  onClick={() => rodar(() => col.delete(r.id), "Resposta pronta apagada.")}
                  aria-label={`Apagar "${r.texto}"`}
                >
                  <Trash2 className="size-4" />
                </button>
              </>
            )}
          </li>
        ))}
        {!lista.length && <li className="py-2 text-sm text-tinta-2">Nenhuma ainda. Escreva a primeira abaixo.</li>}
      </ul>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); adicionar(); }}>
        <label htmlFor="resp-nova" className="sr-only">Nova resposta pronta</label>
        <input
          id="resp-nova"
          enterKeyHint="done"
          className="campo min-h-10 flex-1 py-1.5"
          placeholder="Nova resposta, ex.: Já resolvi, pode testar?"
          value={nova}
          maxLength={MAX}
          onChange={(e) => setNova(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape" && nova) { e.stopPropagation(); setNova(""); } }}
        />
        <button className="btn-secundario min-h-10 px-3 text-sm" disabled={ocupado || !nova.trim()}>
          <Plus className="size-4" aria-hidden="true" /> Adicionar
        </button>
      </form>
    </div>
  );
}
