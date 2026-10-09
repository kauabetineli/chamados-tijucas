import { Camera, ImagePlus, Video, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { pb, type Chamado } from "../lib/pb";
import { prepararArquivo, TAMANHO_MAX } from "../lib/imagem";

const MAX_ARQUIVOS = 5;

/** Seleção de fotos e vídeos. No celular, "Tirar foto" e "Gravar vídeo" abrem a câmera. */
export function SeletorAnexos({ arquivos, onChange }: { arquivos: File[]; onChange: (f: File[]) => void }) {
  const [aviso, setAviso] = useState("");
  const previas = useMemo(() => arquivos.map((f) => ({ f, url: URL.createObjectURL(f) })), [arquivos]);
  useEffect(() => () => previas.forEach((p) => URL.revokeObjectURL(p.url)), [previas]);

  async function adicionar(lista: FileList | null) {
    if (!lista) return;
    setAviso("");
    const novos: File[] = [];
    for (const original of Array.from(lista)) {
      const f = await prepararArquivo(original);
      if (f.size > TAMANHO_MAX) {
        setAviso(`"${original.name}" passa de 30 MB. Grave um vídeo mais curto.`);
        continue;
      }
      novos.push(f);
    }
    const todos = [...arquivos, ...novos];
    if (todos.length > MAX_ARQUIVOS) setAviso(`Envie até ${MAX_ARQUIVOS} arquivos.`);
    onChange(todos.slice(0, MAX_ARQUIVOS));
  }

  const botao = "btn-secundario flex-1 cursor-pointer min-w-[9.5rem]";
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <label className={botao}>
          <Camera className="size-5" aria-hidden="true" /> Tirar foto
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { adicionar(e.target.files); e.target.value = ""; }} />
        </label>
        <label className={botao}>
          <Video className="size-5" aria-hidden="true" /> Gravar vídeo
          <input type="file" accept="video/*" capture="environment" className="sr-only" onChange={(e) => { adicionar(e.target.files); e.target.value = ""; }} />
        </label>
        <label className={botao}>
          <ImagePlus className="size-5" aria-hidden="true" /> Da galeria
          <input type="file" accept="image/*,video/*" multiple className="sr-only" onChange={(e) => { adicionar(e.target.files); e.target.value = ""; }} />
        </label>
      </div>
      {aviso && <p className="mt-2 text-sm font-semibold text-brasa-700">{aviso}</p>}
      {previas.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {previas.map(({ f, url }, i) => (
            <li key={url} className="relative size-24 overflow-hidden rounded-lg border border-linha bg-white">
              {f.type.startsWith("video/") ? (
                <video src={url} className="size-full object-cover" muted />
              ) : (
                <img src={url} alt={`Anexo ${i + 1}`} className="size-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => onChange(arquivos.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 rounded-full bg-tinta/80 p-1 text-white"
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

export function GaleriaAnexos({ chamado }: { chamado: Chamado }) {
  if (!chamado.anexos?.length) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {chamado.anexos.map((nome) => {
        const url = pb.files.getURL(chamado, nome);
        return (
          <li key={nome}>
            {EXT_VIDEO.test(nome) ? (
              <video src={url} controls preload="metadata" className="h-40 max-w-full rounded-lg bg-tinta" />
            ) : (
              <a href={url} target="_blank" rel="noreferrer">
                <img
                  src={pb.files.getURL(chamado, nome, { thumb: "200x200" })}
                  alt="Foto anexada ao chamado"
                  className="size-28 rounded-lg border border-linha object-cover"
                />
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
