import { Pencil } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { arrastandoArquivo, GaleriaArquivos, SeletorAnexos, useAnexos } from "../../components/Anexos";
import { EscolhaCategoria, EscolhaImpacto } from "../../components/CamposChamado";
import { ROTULO_IMPACTO } from "../../lib/formato";
import type { Prioridade } from "../../lib/pb";
import { AvisoSemelhantes } from "./AvisoSemelhantes";
import { EscolhaPrioridade } from "./EscolhaPrioridade";
import type { FormularioChamado } from "./useNovoChamado";
import { BarraAcao } from "./BarraAcao";

/**
 * As etapas do formulário de abertura de chamado.
 *
 * Para tirar, adicionar ou reordenar uma etapa, mexa só na lista ETAPAS no fim do arquivo.
 * - modo "passo": celular, uma etapa por tela.
 * - modo "painel": computador, todas na mesma tela, em duas colunas.
 */
export interface PropsEtapa {
  f: FormularioChamado;
  modo: "passo" | "painel";
  /** avança para a próxima etapa (só no modo passo) */
  avancar: () => void;
  /** volta para uma etapa pelo id (usado no resumo) */
  irPara: (id: string) => void;
}

export interface Etapa {
  id: string;
  /** nome curto, usado no resumo e no indicador de progresso */
  rotulo: string;
  Componente: (p: PropsEtapa) => ReactNode;
  /** a etapa está preenchida? (o passo a passo só deixa avançar se estiver) */
  pronta: (f: FormularioChamado) => boolean;
  /** mensagem quando falta preencher */
  falta: string;
  /** coluna na tela dividida do computador; sem coluna = só aparece no passo a passo */
  coluna?: "esquerda" | "direita";
}

function EtapaCategoria({ f, modo, avancar }: PropsEtapa) {
  return (
    <div className="space-y-4">
      <EscolhaCategoria
        valor={f.categoria}
        onChange={f.setCategoria}
        aoTocar={modo === "passo" ? () => setTimeout(avancar, 120) : undefined}
        grande={modo === "passo"}
        classeGrade={modo === "painel" ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}
        horizontal={modo === "painel"}
      />
      {modo === "painel" && <AvisoSemelhantes categoria={f.categoria} />}
    </div>
  );
}

function EtapaDescricao({ f, modo, avancar }: PropsEtapa) {
  const sugestoes = f.categoriaEscolhida?.sugestoes ?? [];
  const usarSugestao = (s: string) =>
    f.setDescricao((atual) => (atual.trim() ? `${atual.trim()} ${s}.` : `${s}. `));
  const anexos = useAnexos(f.setArquivos, f.setPreparandoAnexo);
  const painel = modo === "painel";
  const [sobre, setSobre] = useState(false);
  // "Continuar" sem descrição: em vez de um botão apagado sem explicação, diz o que falta e leva até a caixa
  const [falta, setFalta] = useState(false);
  // computador: a caixa começa baixa e cresce com o texto (até ~320 px; depois rola por dentro)
  const caixa = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el || !painel) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(320, Math.max(150, el.scrollHeight + 4))}px`;
  }, [f.descricao, painel]);

  return (
    <div className={modo === "painel" ? "space-y-6" : "space-y-5"}>
      {modo === "passo" && <AvisoSemelhantes categoria={f.categoria} />}
      <div>
        <label htmlFor="descricao" className={modo === "passo" ? "mb-4 block font-display text-2xl font-bold" : "rotulo text-lg"}>
          Conte o que está acontecendo
        </label>
        {sugestoes.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2" aria-label="Sugestões">
            {sugestoes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => usarSugestao(s)}
                className="rounded-full bg-superficie px-3 py-2 text-sm font-semibold ring-1 ring-linha hover:ring-acento"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="relative">
          <textarea
            ref={caixa}
            id="descricao"
            required
            rows={5}
            className={`campo ${painel ? "resize-none leading-relaxed" : "resize-y min-h-36"}`}
            placeholder={
              painel
                ? "Ex.: a impressora da recepção mostra uma luz laranja e não imprime desde hoje cedo.\n\nO que você já tentou? Aparece alguma mensagem de erro?"
                : "Ex.: a impressora da recepção mostra uma luz laranja e não imprime desde hoje cedo."
            }
            value={f.descricao}
            onChange={(e) => { f.setDescricao(e.target.value); if (e.target.value.trim()) setFalta(false); }}
            aria-invalid={falta || undefined}
            aria-describedby={falta ? "descricao-falta" : undefined}
            // print colado (Ctrl+V) ou arrastado para a caixa de texto vira anexo
            onPaste={(e) => {
              const imgs = Array.from(e.clipboardData.files);
              if (imgs.length) { e.preventDefault(); anexos.adicionar(imgs); }
            }}
            onDragEnter={(e) => { if (arrastandoArquivo(e)) { e.preventDefault(); setSobre(true); } }}
            onDragOver={(e) => { if (arrastandoArquivo(e)) e.preventDefault(); }}
            onDragLeave={() => setSobre(false)}
            onDrop={(e) => {
              if (!e.dataTransfer.files.length) return;
              e.preventDefault(); setSobre(false); anexos.adicionar(e.dataTransfer.files);
            }}
          />
          {falta && (
            <p id="descricao-falta" role="alert" className="mt-2 font-semibold text-alerta">
              Escreva o que está acontecendo para continuar. Pode ser curto, ou toque numa sugestão acima.
            </p>
          )}
          {sobre && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl border-2 border-dashed border-acento bg-mar-50/90 font-semibold text-acento">
              Solte para anexar ao chamado
            </div>
          )}
        </div>
      </div>
      <div>
        <p className="rotulo">Foto ou vídeo <span className="font-normal text-tinta-2">(opcional, ajuda o TI a resolver mais rápido)</span></p>
        <SeletorAnexos
          arquivos={f.arquivos}
          onChange={f.setArquivos}
          modo={modo === "passo" ? "celular" : "computador"}
          controle={anexos}
          compacto={painel}
        />
      </div>
      {modo === "passo" && (
        <BarraAcao>
          <button
            type="button"
            className="btn-primario w-full text-lg"
            disabled={f.preparandoAnexo}
            onClick={() => {
              if (f.descricao.trim()) return avancar();
              setFalta(true);
              caixa.current?.focus();
            }}
          >
            {f.preparandoAnexo ? "Preparando anexo..." : "Continuar"}
          </button>
        </BarraAcao>
      )}
    </div>
  );
}

function EtapaImpacto({ f, modo, avancar }: PropsEtapa) {
  // com a escolha de prioridade liberada, o toque não avança sozinho: a pessoa confere a prioridade e toca em Continuar
  const [faltaMotivo, setFaltaMotivo] = useState(false);
  const passo = modo === "passo";
  return (
    <div className="space-y-4">
      <EscolhaImpacto
        valor={f.impacto}
        onChange={f.setImpacto}
        aoTocar={passo && !f.escolhePrioridade ? () => setTimeout(avancar, 120) : undefined}
        titulo="Isso está atrapalhando quem?"
        grande={passo}
        lado={modo === "painel"}
      />
      <EscolhaPrioridade f={f} faltaMotivo={faltaMotivo && !f.motivoUrgencia.trim()} />
      {passo && f.escolhePrioridade && f.impacto && (
        <BarraAcao>
          <button type="button" className="btn-primario w-full text-lg"
            onClick={() => { if (f.precisaMotivo && !f.motivoUrgencia.trim()) return setFaltaMotivo(true); avancar(); }}>
            Continuar
          </button>
        </BarraAcao>
      )}
    </div>
  );
}

const ROTULO_PRIORIDADE: Record<Prioridade, string> = { baixa: "Baixa", normal: "Normal", alta: "Alta", urgente: "Urgente" };

function EtapaRevisao({ f, irPara }: PropsEtapa) {
  const linhas: { id: string; rotulo: string; valor: ReactNode }[] = [
    { id: "categoria", rotulo: "Problema", valor: f.categoriaEscolhida?.nome },
    { id: "descricao", rotulo: "Descrição", valor: <span className="whitespace-pre-wrap">{f.descricao}</span> },
    { id: "impacto", rotulo: "Quem é afetado", valor: f.impacto ? ROTULO_IMPACTO[f.impacto] : "" },
    ...(f.escolhePrioridade ? [{
      id: "impacto", rotulo: "Prioridade",
      valor: <>{ROTULO_PRIORIDADE[f.prioridade]}{f.motivoUrgencia.trim() && f.prioridade !== f.sugerida ? <span className="block font-normal text-tinta-2">“{f.motivoUrgencia.trim()}”</span> : null}</>,
    }] : []),
  ];
  return (
    <div className="space-y-5">
      <h2 className="font-display text-2xl font-bold">Confira e envie</h2>
      <dl className="divide-y divide-linha rounded-2xl bg-superficie ring-1 ring-linha">
        <div className="p-4">
          <dt className="text-sm text-tinta-2">Para</dt>
          <dd className="font-semibold">{f.setor || "Seu setor"}</dd>
        </div>
        {linhas.map((l) => (
          <div key={l.rotulo} className="flex items-start gap-3 p-4">
            <div className="min-w-0 flex-1">
              <dt className="text-sm text-tinta-2">{l.rotulo}</dt>
              <dd className="font-semibold">{l.valor || "—"}</dd>
            </div>
            <button type="button" onClick={() => irPara(l.id)} className="flex items-center gap-1 text-sm font-semibold text-acento">
              <Pencil className="size-4" aria-hidden="true" /> Alterar
            </button>
          </div>
        ))}
        {f.arquivos.length > 0 && (
          <div className="flex items-start gap-3 p-4">
            <div className="min-w-0 flex-1">
              <dt className="mb-2 text-sm text-tinta-2">Anexos</dt>
              <dd><GaleriaArquivos arquivos={f.arquivos} /></dd>
            </div>
            <button type="button" onClick={() => irPara("descricao")} className="flex items-center gap-1 text-sm font-semibold text-acento">
              <Pencil className="size-4" aria-hidden="true" /> Alterar
            </button>
          </div>
        )}
      </dl>
    </div>
  );
}

export const ETAPAS: Etapa[] = [
  {
    id: "categoria", rotulo: "Problema", Componente: EtapaCategoria, coluna: "esquerda",
    pronta: (f) => !!f.categoria, falta: "Escolha o que está com problema.",
  },
  {
    id: "descricao", rotulo: "Descrição", Componente: EtapaDescricao, coluna: "direita",
    pronta: (f) => !!f.descricao.trim() && !f.preparandoAnexo, falta: "Conte o que está acontecendo.",
  },
  {
    id: "impacto", rotulo: "Impacto", Componente: EtapaImpacto, coluna: "direita",
    pronta: (f) => !!f.impacto && (!f.precisaMotivo || !!f.motivoUrgencia.trim()), falta: "Diga quem está sendo afetado (e, se escolheu Urgente, o motivo).",
  },
  {
    id: "revisao", rotulo: "Enviar", Componente: EtapaRevisao,
    pronta: () => true, falta: "",
  },
];
