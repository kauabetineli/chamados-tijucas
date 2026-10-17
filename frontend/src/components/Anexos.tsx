import { Camera, ImagePlus, Play, Upload, Video, X } from "lucide-react";
import { useSearchParams } from "react-router";
import { useEffect, useMemo, useState, type DragEvent, type Dispatch, type SetStateAction } from "react";
import { pb, type Chamado } from "../lib/pb";
import { prepararArquivo, TAMANHO_MAX } from "../lib/imagem";
import { Visualizador, type ItemVisualizador } from "./Visualizador";

const MAX_ARQUIVOS = 5;

/** só imagem e vídeo entram (arrastar ou colar pode trazer PDF, texto etc.); sem tipo passa, o servidor confere */
export function apenasMidia(lista: FileList | File[] | null | undefined): File[] {
  return Array.from(lista ?? []).filter((f) => !f.type || f.type.startsWith("image/") || f.type.startsWith("video/"));
}

/** o que está sendo arrastado tem arquivo? (texto selecionado não conta) */
export function arrastandoArquivo(e: DragEvent) {
  return Array.from(e.dataTransfer?.types ?? []).includes("Files");
}

/**
 * Lógica de adicionar anexos, separada do visual para que outros lugares
 * (ex.: colar um print na caixa de texto) usem a mesma fila e os mesmos limites.
 *
 * `onChange` recebe o setState do pai: as atualizações usam a lista ATUAL, não a da
 * hora do clique. Isso evita a corrida em que a foto, ainda sendo reduzida enquanto a
 * câmera de vídeo estava aberta (o celular pausa a página), sobrescrevia o vídeo.
 */
export function useAnexos(onChange: Dispatch<SetStateAction<File[]>>, aoPreparar?: (ocupado: boolean) => void) {
  const [aviso, setAviso] = useState("");
  const [preparando, setPreparando] = useState(0);
  useEffect(() => aoPreparar?.(preparando > 0), [preparando, aoPreparar]);

  async function adicionar(lista: FileList | File[] | null) {
    if (!lista || !lista.length) return;
    const originais = Array.from(lista); // copia antes de o campo ser limpo
    const midias = apenasMidia(originais);
    setAviso(midias.length < originais.length ? "Só dá para anexar fotos e vídeos." : "");
    if (!midias.length) return;
    setPreparando((n) => n + 1);
    try {
      const novos: File[] = [];
      for (const original of midias) {
        const f = await prepararArquivo(original);
        if (f.size > TAMANHO_MAX) {
          setAviso(`"${original.name}" passa de 250 MB. Grave um vídeo mais curto (até 1 minuto).`);
          continue;
        }
        novos.push(f);
      }
      onChange((atual) => {
        const todos = [...atual, ...novos];
        if (todos.length > MAX_ARQUIVOS) setAviso(`Envie até ${MAX_ARQUIVOS} arquivos.`);
        return todos.slice(0, MAX_ARQUIVOS);
      });
    } finally {
      setPreparando((n) => n - 1);
    }
  }

  return { adicionar, aviso, preparando: preparando > 0 };
}
export type ControleAnexos = ReturnType<typeof useAnexos>;

/**
 * Seleção de fotos e vídeos.
 * - celular: "Tirar foto" e "Gravar vídeo" abrem a câmera, mais a galeria;
 * - computador: área tracejada para arrastar o arquivo, com botão para escolher.
 */
export function SeletorAnexos({
  arquivos,
  onChange,
  aoPreparar,
  modo,
  controle,
}: {
  arquivos: File[];
  onChange: Dispatch<SetStateAction<File[]>>;
  aoPreparar?: (ocupado: boolean) => void;
  /** "celular": câmera, vídeo e galeria; "computador": área de arrastar. Padrão: detecta pela tela de toque. */
  modo?: "celular" | "computador";
  /** passe quando outro componente também adiciona anexos (ex.: colar na caixa de texto) */
  controle?: ControleAnexos;
}) {
  const proprio = useAnexos(onChange, controle ? undefined : aoPreparar);
  const { adicionar, aviso, preparando } = controle ?? proprio;
  const [usouVideo, setUsouVideo] = useState(false);
  const [sobre, setSobre] = useState(false);
  const celular = (modo ?? (window.matchMedia?.("(pointer: coarse)").matches ? "celular" : "computador")) === "celular";
  const previas = useMemo(() => arquivos.map((f) => ({ f, url: URL.createObjectURL(f) })), [arquivos]);
  useEffect(() => () => previas.forEach((p) => URL.revokeObjectURL(p.url)), [previas]);

  const botao = "btn-secundario flex-1 cursor-pointer min-w-[9.5rem]";
  return (
    <div>
      {celular ? (
        <div className="flex flex-wrap gap-2">
          <label className={botao}>
            <Camera className="size-5" aria-hidden="true" /> Tirar foto
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { adicionar(e.target.files); e.target.value = ""; }} />
          </label>
          <label className={botao} onClick={() => setUsouVideo(true)}>
            <Video className="size-5" aria-hidden="true" /> Gravar vídeo
            <input type="file" accept="video/*" capture="environment" className="sr-only" onChange={(e) => { adicionar(e.target.files); e.target.value = ""; }} />
          </label>
          <label className={botao}>
            <ImagePlus className="size-5" aria-hidden="true" /> Da galeria
            <input type="file" accept="image/*,video/*" multiple className="sr-only" onChange={(e) => { adicionar(e.target.files); e.target.value = ""; }} />
          </label>
        </div>
      ) : (
        <label
          onDragEnter={(e) => { if (arrastandoArquivo(e)) { e.preventDefault(); setSobre(true); } }}
          onDragOver={(e) => { if (arrastandoArquivo(e)) e.preventDefault(); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSobre(false); }}
          onDrop={(e) => { e.preventDefault(); setSobre(false); adicionar(e.dataTransfer.files); }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center ${
            sobre ? "border-acento bg-mar-50" : "border-linha bg-superficie hover:border-acento hover:bg-mar-50/50"
          }`}
        >
          <Upload className={`size-8 ${sobre ? "text-acento" : "text-tinta-2"}`} aria-hidden="true" />
          <span className="font-semibold">{sobre ? "Solte para anexar" : "Arraste aqui sua foto ou vídeo"}</span>
          <span className="text-sm text-tinta-2">
            ou <span className="font-semibold text-acento underline underline-offset-4">escolha um arquivo</span> do computador
          </span>
          <input type="file" accept="image/*,video/*" multiple className="sr-only" onChange={(e) => { adicionar(e.target.files); e.target.value = ""; }} />
        </label>
      )}
      {usouVideo && (
        <p className="ajuda">
          Vídeo: até 1 minuto. Se o celular voltar para esta página em branco depois de gravar,
          grave pela câmera do celular e anexe em "Da galeria".
        </p>
      )}
      {preparando && <p className="mt-2 text-sm font-semibold text-tinta-2" role="status">Preparando anexo...</p>}
      {aviso && <p className="mt-2 text-sm font-semibold text-alerta">{aviso}</p>}
      {previas.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {previas.map(({ f, url }, i) => (
            <li key={url} className="relative size-24 overflow-hidden rounded-lg border border-linha bg-superficie">
              {f.type.startsWith("video/") ? (
                <>
                  <video src={url} className="size-full bg-noite object-cover" muted playsInline preload="metadata" />
                  <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-noite/80 px-1.5 py-0.5 text-xs font-semibold text-white">
                    <Video className="size-3.5" aria-hidden="true" /> Vídeo
                  </span>
                </>
              ) : (
                <img src={url} alt={`Anexo ${i + 1}`} className="size-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => onChange((atual) => atual.filter((x) => x !== f))}
                className="absolute top-1 right-1 rounded-full bg-noite/80 p-1 text-white"
                aria-label={`Remover anexo ${i + 1}`}
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const EXT_VIDEO = /\.(mp4|mov|webm|3gp)$/i;

/**
 * Anexos de um chamado salvo: miniaturas grandes; o toque abre em tela cheia
 * (foto com zoom de pinça, vídeo grande). O anexo aberto fica no endereço (?anexo=2),
 * então o botão "voltar" do celular fecha a tela cheia em vez de sair do chamado.
 */
export function GaleriaAnexos({ chamado }: { chamado: Chamado }) {
  const [params, setParams] = useSearchParams();
  if (!chamado.anexos?.length) return null;
  const temVideo = chamado.anexos.some((n) => EXT_VIDEO.test(n));
  const itens: ItemVisualizador[] = chamado.anexos.map((nome) => ({
    url: pb.files.getURL(chamado, nome),
    tipo: EXT_VIDEO.test(nome) ? "video" : "imagem",
    nome,
  }));
  const aberto = parseInt(params.get("anexo") ?? "", 10) - 1;

  function abrir(i: number, substituir = false) {
    const p = new URLSearchParams(params);
    p.set("anexo", String(i + 1));
    setParams(p, { replace: substituir });
  }
  function fechar() {
    // aberto por esta tela: volta no histórico (como o botão do celular); se veio por link, só tira o parâmetro
    if ((window.history.state?.idx ?? 0) > 0) window.history.back();
    else {
      const p = new URLSearchParams(params);
      p.delete("anexo");
      setParams(p, { replace: true });
    }
  }

  return (
    <div className="space-y-2">
      {chamado.midia_pendente && temVideo && (
        <p className="text-sm text-tinta-2">O vídeo está sendo otimizado pelo servidor e fica mais leve em alguns minutos.</p>
      )}
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {chamado.anexos.map((nome, i) => {
          const video = EXT_VIDEO.test(nome);
          return (
            <li key={nome}>
              <button
                type="button"
                onClick={() => abrir(i)}
                className="relative block aspect-square w-full overflow-hidden rounded-xl bg-noite ring-1 ring-linha hover:ring-2 hover:ring-acento"
                aria-label={video ? `Assistir vídeo ${i + 1}` : `Ver foto ${i + 1} em tela cheia`}
              >
                {video ? (
                  <>
                    <video src={`${itens[i].url}#t=0.5`} muted playsInline preload="metadata" className="size-full object-cover opacity-80" />
                    <span className="absolute inset-0 grid place-items-center">
                      {/* tema-fixo: botão claro sobre o vídeo, igual nos dois temas */}
                      <span className="grid size-12 place-items-center rounded-full bg-white/90 text-noite shadow">
                        <Play className="size-6 translate-x-0.5" aria-hidden="true" />
                      </span>
                    </span>
                  </>
                ) : (
                  <img src={pb.files.getURL(chamado, nome, { thumb: "400x400" })} alt="" className="size-full object-cover" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {aberto >= 0 && aberto < itens.length && (
        <Visualizador itens={itens} indice={aberto} aoMudar={(i) => abrir(i, true)} aoFechar={fechar} />
      )}
    </div>
  );
}

/** Miniaturas só para conferência (resumo do passo a passo), de arquivos ainda não enviados. */
export function GaleriaArquivos({ arquivos }: { arquivos: File[] }) {
  const previas = useMemo(() => arquivos.map((f) => ({ f, url: URL.createObjectURL(f) })), [arquivos]);
  useEffect(() => () => previas.forEach((p) => URL.revokeObjectURL(p.url)), [previas]);
  return (
    <ul className="flex flex-wrap gap-2">
      {previas.map(({ f, url }, i) => (
        <li key={url} className="relative size-16 overflow-hidden rounded-lg border border-linha bg-noite">
          {f.type.startsWith("video/") ? (
            <span className="flex size-full items-center justify-center text-white">
              <Video className="size-6" aria-label="Vídeo" />
            </span>
          ) : (
            <img src={url} alt={`Anexo ${i + 1}`} className="size-full object-cover" />
          )}
        </li>
      ))}
    </ul>
  );
}
