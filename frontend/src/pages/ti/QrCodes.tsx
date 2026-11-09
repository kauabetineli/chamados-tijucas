import { CabecalhoPagina } from "../../components/CabecalhoPagina";
import { Dica, idDaDica, RotuloComDica } from "../../components/Dica";
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
 * Gera etiquetas com QR code para colar perto dos computadores e impressoras.
 * O QR abre o formulário de novo chamado; o lugar é o setor de quem está logado
 * (não há mais "local" por sala), então todas as etiquetas são iguais.
 * Use como endereço a página de redirecionamento do site da Prefeitura:
 * assim, se o IP do servidor mudar, as etiquetas continuam valendo.
 */
export function QrCodes() {
  const [base, setBase] = useState(lerBase);
  const [quantidade, setQuantidade] = useState(6);
  const [svg, setSvg] = useState("");

  useEffect(() => {
    try { localStorage.setItem(CHAVE, base); } catch { /* sem armazenamento: tudo bem */ }
    // tema-fixo: QR sempre escuro sobre branco (é impresso e lido pela câmera)
    QRCode.toString(base, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#16212b", light: "#ffffff" } })
      .then(setSvg)
      .catch(() => setSvg(""));
  }, [base]);

  return (
    <div className="space-y-6">
      <div className="space-y-5 print:hidden">
        <CabecalhoPagina voltar={{ para: "/ti/painel", rotulo: "Voltar para o Painel", sempre: true }} titulo={<span className="inline-flex items-center gap-3">QR code para abrir chamado <Dica rotulo="Para que serve">Imprima e cole perto dos computadores e impressoras. Quem escanear cai direto no formulário de novo chamado.</Dica></span>} />
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_12rem]">
          <div>
            <RotuloComDica htmlFor="base" dica={<>Use o endereço da página de redirecionamento no site da Prefeitura, se ela já existir, com <code>?novo=1</code> no fim (abre direto o formulário).</>}>Endereço que o QR abre</RotuloComDica>
            <input id="base" aria-describedby={idDaDica("base")} className="campo" value={base} onChange={(e) => setBase(e.target.value.trim())} />
          </div>
          <div>
            <label htmlFor="qtd" className="rotulo">Etiquetas</label>
            <input
              id="qtd" type="number" min={1} max={24} className="campo" value={quantidade}
              onChange={(e) => setQuantidade(Math.max(1, Math.min(24, Number(e.target.value) || 1)))}
            />
          </div>
        </div>
        <button className="btn-primario" onClick={() => window.print()}>
          <Printer className="size-5" aria-hidden="true" /> Imprimir etiquetas
        </button>
      </div>

      {svg && (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2 print:gap-6">
          {/* tema-fixo: a etiqueta é papel; a prévia fica clara também no modo escuro */}
          {Array.from({ length: quantidade }, (_, i) => (
            <li key={i} className="break-inside-avoid overflow-hidden rounded-2xl bg-white text-noite ring-2 ring-noite print:rounded-none">
              <div className="flex items-center gap-3 bg-mar-700 px-5 py-3 text-white">
                <img src="/icone-fundo-azul.svg" alt="" className="size-14 shrink-0" />
                <div>
                  <p className="font-display text-xl font-bold">Problema com o computador?</p>
                  <p className="font-semibold">Abra um chamado no Dino Desk</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-5">
                <div className="w-32 shrink-0" dangerouslySetInnerHTML={{ __html: svg }} />
                <p className="text-sm">Aponte a câmera do celular. Funciona no Wi-Fi da Prefeitura.</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
