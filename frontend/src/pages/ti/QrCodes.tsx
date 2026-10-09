import { Printer } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

const CHAVE = "dinodesk:qr-base";

function lerBase() {
  try {
    return localStorage.getItem(CHAVE) || `${window.location.origin}/novo`;
  } catch {
    return `${window.location.origin}/novo`;
  }
}

/**
 * Gera etiquetas com QR code para colar nas salas e equipamentos.
 * O QR abre o formulário com o local já preenchido (?local=...).
 * Use como endereço a página de redirecionamento do site da Prefeitura:
 * assim, se o IP do servidor mudar, as etiquetas continuam valendo.
 */
export function QrCodes() {
  const [base, setBase] = useState(lerBase);
  const [locais, setLocais] = useState("Recepção\nProtocolo\nRecursos Humanos");
  const [etiquetas, setEtiquetas] = useState<{ local: string; svg: string }[]>([]);

  useEffect(() => {
    try { localStorage.setItem(CHAVE, base); } catch { /* sem armazenamento: tudo bem */ }
    const lista = locais.split("\n").map((l) => l.trim()).filter(Boolean);
    Promise.all(
      lista.map(async (local) => {
        const url = `${base}${base.includes("?") ? "&" : "?"}local=${encodeURIComponent(local)}`;
        const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#113227", light: "#ffffff" } });
        return { local, svg };
      }),
    ).then(setEtiquetas).catch(() => setEtiquetas([]));
  }, [base, locais]);

  return (
    <div className="space-y-6">
      <div className="space-y-5 print:hidden">
        <div>
          <h1 className="text-3xl font-bold">QR codes das salas</h1>
          <p className="mt-1 max-w-2xl text-tinta-2">
            Imprima e cole perto dos computadores e impressoras. Quem escanear cai direto no formulário, com o local preenchido.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="base" className="rotulo">Endereço que o QR abre</label>
            <input id="base" className="campo" value={base} onChange={(e) => setBase(e.target.value.trim())} />
            <p className="ajuda">Use o endereço da página de redirecionamento no site da Prefeitura, se ela já existir.</p>
          </div>
          <div>
            <label htmlFor="locais" className="rotulo">Locais (um por linha)</label>
            <textarea id="locais" className="campo min-h-32" value={locais} onChange={(e) => setLocais(e.target.value)} />
          </div>
        </div>
        <button className="btn-primario" onClick={() => window.print()}>
          <Printer className="size-5" aria-hidden="true" /> Imprimir etiquetas
        </button>
      </div>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2 print:gap-6">
        {etiquetas.map(({ local, svg }) => (
          <li key={local} className="break-inside-avoid overflow-hidden rounded-2xl bg-white ring-2 ring-tinta print:rounded-none">
            <div className="flex items-center gap-3 bg-mar-700 px-5 py-3 text-white">
              <img src="/icone-fundo-azul.svg" alt="" className="size-14 shrink-0" />
              <div>
                <p className="font-display text-xl font-bold">Problema com o computador?</p>
                <p className="font-semibold">Abra um chamado no Dino Desk</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-5">
              <div className="w-32 shrink-0" dangerouslySetInnerHTML={{ __html: svg }} />
              <div>
                <p className="text-sm text-tinta-2">Local</p>
                <p className="font-display text-lg leading-tight font-bold">{local}</p>
                <p className="mt-2 text-sm">Aponte a câmera do celular. Funciona no Wi-Fi da Prefeitura.</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
