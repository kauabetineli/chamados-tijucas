import { Clock, Info, Lightbulb, Send, Ticket } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useAnexos } from "../../components/Anexos";
import { CaixaComAnexos, Passo, RodapeEnviar } from "../../components/FormularioPassos";
import { IconeCategoria } from "../../components/Icone";
import { ProgressoEnvio } from "../../components/ProgressoEnvio";
import { useCategorias } from "../../components/CamposChamado";
import { ROTULO_IMPACTO } from "../../lib/formato";
import { mensagemErro, type Impacto } from "../../lib/pb";
import { AvisoSemelhantes } from "./AvisoSemelhantes";
import { EscolhaPrioridade } from "./EscolhaPrioridade";
import type { FormularioChamado } from "./useNovoChamado";

// perguntas para quando a categoria não tem as suas (Configurações do TI > Categorias)
const DICAS_GERAIS = ["O que aparece na tela?", "Desde quando acontece?", "Já tentou alguma coisa?"];

const DETALHE_IMPACTO: Record<Impacto, string> = {
  so_eu: "Consigo continuar trabalhando de outro jeito, ou só eu fui afetado.",
  setor: "Várias pessoas do setor estão sem conseguir trabalhar.",
  publico: "A população está esperando: atendimento, protocolo ou serviço parado.",
};

/**
 * Computador: o formulário é UMA coluna, de cima para baixo (1 problema · 2 o que acontece · 3 quem é afetado · enviar),
 * e a coluna da direita ajuda a preencher (perguntas que o TI vai fazer, chamado parecido, o que acontece depois).
 * No celular continua o passo a passo (Assistente.tsx).
 */
export function Painel({ f }: { f: FormularioChamado }) {
  const navegar = useNavigate();
  const categorias = useCategorias();
  const [erro, setErro] = useState("");
  const [faltaMotivo, setFaltaMotivo] = useState(false);
  const anexos = useAnexos(f.setArquivos, f.setPreparandoAnexo);
  const caixa = useRef<HTMLTextAreaElement>(null);
  const nomeCategoria = f.categoriaEscolhida?.nome ?? "";
  const sugestoes = f.categoriaEscolhida?.sugestoes ?? [];
  const dicasCategoria = f.categoriaEscolhida?.dicas ?? [];
  const dicas = dicasCategoria.length ? dicasCategoria : DICAS_GERAIS;
  const juntar = (trecho: string) => {
    f.setDescricao((atual) => (atual.trim() ? `${atual.trim()}\n${trecho} ` : `${trecho} `));
    caixa.current?.focus();
  };

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro("");
    if (!f.categoria) return setErro("Escolha o que está com problema (passo 1).");
    if (!f.descricao.trim()) return setErro("Conte o que está acontecendo (passo 2).");
    if (!f.impacto) return setErro("Diga quem está sendo afetado (passo 3).");
    if (f.precisaMotivo && !f.motivoUrgencia.trim()) { setFaltaMotivo(true); return setErro("Conte por que é urgente (passo 3)."); }
    try {
      const c = await f.enviar();
      navegar(`/chamado/${c.id}`, { state: { novo: true } });
    } catch (err) {
      setErro(mensagemErro(err));
    }
  }

  return (
    <form onSubmit={enviar} className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-8">
      <div className="space-y-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-3xl font-bold">Novo chamado</h1>
          {f.setor && <p className="text-tinta-2">Para o TI, a partir de <span className="font-semibold text-tinta">{f.setor}</span></p>}
        </div>

        <div className="space-y-8 rounded-2xl bg-superficie p-5 ring-1 ring-linha md:p-8">
          {/* 1 */}
          <Passo n={1} id="p-categoria" titulo="O que está com problema?" feito={!!f.categoria}>
            <div role="radiogroup" aria-labelledby="p-categoria" className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-4">
              {categorias.map((c) => (
                <label key={c.id} className="opcao min-h-12 gap-2.5 py-2 text-[15px]">
                  <input type="radio" name="categoria" className="sr-only" checked={f.categoria === c.id} onChange={() => f.setCategoria(c.id)} />
                  <IconeCategoria nome={c.icone} className="size-5 shrink-0 text-acento" />
                  <span className="leading-tight">{c.nome}</span>
                </label>
              ))}
            </div>
          </Passo>

          {/* 2 */}
          <Passo n={2} id="p-descricao" titulo="Conte o que está acontecendo" feito={!!f.descricao.trim()}>
            {sugestoes.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2" aria-label="Começar com">
                {sugestoes.map((s) => (
                  <button key={s} type="button" onClick={() => juntar(`${s}.`)} className="rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-linha hover:bg-mar-50 hover:ring-acento">
                    {s}
                  </button>
                ))}
              </div>
            )}
            <CaixaComAnexos
              ref={caixa}
              id="descricao"
              rotulo="Descrição do problema"
              placeholder="Ex.: a impressora da recepção mostra uma luz laranja e não imprime desde hoje cedo."
              valor={f.descricao}
              aoMudar={f.setDescricao}
              arquivos={f.arquivos}
              setArquivos={f.setArquivos}
              anexos={anexos}
            />
          </Passo>

          {/* 3 */}
          <Passo n={3} id="p-impacto" titulo="Isso está atrapalhando quem?" feito={!!f.impacto}>
            <div role="radiogroup" aria-labelledby="p-impacto" className="grid gap-2 2xl:grid-cols-3">
              {(Object.keys(ROTULO_IMPACTO) as Impacto[]).map((k) => (
                <label key={k} className="opcao items-start py-3">
                  <input type="radio" name="impacto" className="mt-0.5 size-5 shrink-0 accent-acento" checked={f.impacto === k} onChange={() => f.setImpacto(k)} />
                  <span>
                    <span className="block">{ROTULO_IMPACTO[k]}</span>
                    <span className="mt-0.5 block text-sm font-normal text-tinta-2">{DETALHE_IMPACTO[k]}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-3"><EscolhaPrioridade f={f} faltaMotivo={faltaMotivo && !f.motivoUrgencia.trim()} /></div>
          </Passo>

          {/* enviar: no fim do formulário; gruda embaixo enquanto o fim não aparece (notebook) */}
          <RodapeEnviar frase="Depois de enviar, você acompanha a sua vez na fila em Meus chamados." topo={<><ProgressoEnvio pct={f.progresso} />{erro && <p role="alert" className="font-semibold text-alerta">{erro}</p>}</>}>
            <button className="btn-primario px-8 text-lg" disabled={f.enviando || f.preparandoAnexo}>
              <Send className="size-5" aria-hidden="true" />
              {f.enviando ? "Enviando..." : f.preparandoAnexo ? "Preparando anexo..." : "Enviar chamado"}
            </button>
          </RodapeEnviar>
        </div>
      </div>

      {/* coluna de apoio: aproveita a largura com o que ajuda a preencher */}
      <aside className="space-y-4 xl:sticky xl:top-8 xl:mt-[3.25rem]" aria-label="Ajuda para abrir o chamado">
        <AvisoSemelhantes categoria={f.categoria} />

        <section className="rounded-2xl bg-superficie p-5 ring-1 ring-linha">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <Lightbulb className="size-5 text-acento" aria-hidden="true" /> O que ajuda o TI
          </h2>
          <p className="mt-1 text-sm text-tinta-2">
            {nomeCategoria ? `Sobre ${nomeCategoria.toLowerCase()}, o TI costuma perguntar:` : "Responder isto no texto evita idas e vindas:"}
          </p>
          <ul className="mt-3 space-y-1.5">
            {dicas.map((d) => (
              <li key={d}>
                <button type="button" onClick={() => juntar(d)} className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-mar-50" title="Colocar a pergunta no texto">
                  <span className="mt-0.5 text-acento">+</span> {d}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl bg-superficie p-5 ring-1 ring-linha">
          <h2 className="font-display text-lg font-bold">Depois de enviar</h2>
          <ol className="mt-3 space-y-3 text-sm">
            <li className="flex gap-3"><Ticket className="size-5 shrink-0 text-acento" aria-hidden="true" /><span>Você recebe uma <b>senha da fila</b> e vê quantos chamados estão antes do seu.</span></li>
            <li className="flex gap-3"><Clock className="size-5 shrink-0 text-acento" aria-hidden="true" /><span>{f.config.ordem_fila === "chegada" ? <>A fila segue a <b>ordem de chegada</b>.</> : f.config.ordem_fila === "prazo" ? <>A ordem segue o <b>prazo</b> de cada chamado: os mais urgentes têm prazo menor.</> : <>A ordem segue a <b>urgência</b> e, depois, quem pediu primeiro.</>}</span></li>
            <li className="flex gap-3"><Info className="size-5 shrink-0 text-acento" aria-hidden="true" /><span>O TI responde <b>por aqui</b>: não precisa mandar WhatsApp.</span></li>
          </ol>
        </section>
      </aside>
    </form>
  );
}
