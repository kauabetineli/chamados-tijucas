import { useId, type ReactNode } from "react";
import { CircleHelp, type LucideIcon } from "lucide-react";

/**
 * Ícone de categoria no estilo "ícone de app": quadrado arredondado com degradê e desenho branco.
 * As 8 categorias iniciais têm desenho próprio (DESENHOS); qualquer outro ícone que o admin escolher
 * usa o desenho do lucide dentro do mesmo quadrado, na cor da família (FAMILIA). Cores em src/index.css (--app-*).
 * O tamanho vem do className (size-5, size-10...): o quadrado já é o fundo, não embrulhe em outro quadrado.
 */
export type Familia = "azul" | "teal" | "marinho" | "verde" | "amarelo" | "laranja" | "vermelho" | "cinza";

const FAMILIA: Record<string, Familia> = {
  monitor: "azul", laptop: "azul", tablet: "azul", smartphone: "azul", mouse: "azul", keyboard: "azul", cpu: "azul", "hard-drive": "azul", usb: "azul",
  printer: "teal", "scan-line": "teal", "scan-barcode": "teal", projector: "teal", tv: "teal",
  wifi: "marinho", router: "marinho", network: "marinho", globe: "marinho", signal: "marinho", cable: "marinho", server: "marinho", cloud: "marinho", database: "marinho",
  "app-window": "verde", "file-text": "verde", "file-spreadsheet": "verde", folder: "verde", calendar: "verde",
  "key-round": "amarelo", lock: "amarelo",
  mail: "laranja", "message-square": "laranja", video: "laranja", webcam: "laranja", camera: "laranja", mic: "laranja", speaker: "laranja", headphones: "laranja",
  phone: "vermelho", "shield-alert": "vermelho", bug: "vermelho", zap: "vermelho", "battery-low": "vermelho", plug: "vermelho",
};

/** Desenhos próprios (grade 48x48). "c" = cor de detalhe da família. */
const DESENHOS: Record<string, (c: string) => ReactNode> = {
  monitor: (c) => (<>
    <rect x="11" y="13" width="26" height="17" rx="3.5" fill="white" />
    <rect x="14" y="16" width="20" height="11" rx="1.5" fill={c} opacity=".35" />
    <rect x="21" y="30" width="6" height="4" fill="white" />
    <rect x="16" y="33.5" width="16" height="3" rx="1.5" fill="white" />
  </>),
  printer: (c) => (<>
    <rect x="16" y="10" width="16" height="9" rx="2" fill="white" opacity=".9" />
    <rect x="10" y="18" width="28" height="13" rx="4" fill="white" />
    <circle cx="32.5" cy="22.5" r="1.6" fill={c} />
    <rect x="16" y="27" width="16" height="11" rx="2" fill="white" stroke={c} strokeWidth="2" />
    <rect x="19" y="31" width="10" height="1.8" rx=".9" fill={c} opacity=".5" />
  </>),
  wifi: () => (<>
    <path d="M10 21a20 20 0 0 1 28 0" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" />
    <path d="M15 26.5a12.5 12.5 0 0 1 18 0" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" />
    <circle cx="24" cy="33" r="3.6" fill="white" />
  </>),
  "app-window": (c) => (<>
    <rect x="10" y="12" width="28" height="24" rx="4" fill="white" />
    <rect x="10" y="17" width="28" height="2" fill={c} opacity=".25" />
    <circle cx="14.5" cy="15" r="1.3" fill={c} />
    <circle cx="18.5" cy="15" r="1.3" fill={c} opacity=".6" />
    <rect x="14" y="23" width="12" height="2.6" rx="1.3" fill={c} opacity=".5" />
    <rect x="14" y="28.5" width="20" height="2.6" rx="1.3" fill={c} opacity=".3" />
  </>),
  "key-round": (c) => (<>
    <circle cx="18" cy="20" r="7.5" fill="white" />
    <circle cx="18" cy="20" r="2.8" fill={c} />
    <path d="M23 24.5l11 11" stroke="white" strokeWidth="4.5" strokeLinecap="round" />
    <path d="M30.5 32l3.5-3.5M27 28.5l3-3" stroke="white" strokeWidth="4" strokeLinecap="round" />
  </>),
  mail: (c) => (<>
    <rect x="10" y="14" width="28" height="20" rx="4" fill="white" />
    <path d="M12 17l12 9 12-9" stroke={c} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity=".6" />
  </>),
  phone: () => (
    <path fill="white" d="M17.5 11.5c1.2-.7 2.6-.3 3.2.9l2 4c.5 1 .2 2.2-.7 2.9l-1.7 1.3a14 14 0 0 0 7.1 7.1l1.3-1.7c.7-.9 1.9-1.2 2.9-.7l4 2c1.2.6 1.6 2 .9 3.2l-1.4 2.3c-.9 1.5-2.7 2.2-4.4 1.7A22 22 0 0 1 13.5 18.1c-.5-1.7.2-3.5 1.7-4.4z" />
  ),
  "circle-help": (c) => (<>
    <circle cx="24" cy="24" r="13" fill="white" />
    <path d="M20.3 20.6a3.9 3.9 0 1 1 5.6 3.5c-1.2.6-1.9 1.4-1.9 2.6v.6" stroke={c} strokeWidth="3" fill="none" strokeLinecap="round" />
    <circle cx="24" cy="31.2" r="1.9" fill={c} />
  </>),
};

export function IconeApp({ nome, I, className, titulo }: { nome?: string; I?: LucideIcon; className?: string; titulo?: string }) {
  const id = useId();
  const chave = nome || "circle-help";
  const fam = FAMILIA[chave] ?? "cinza";
  const desenho = DESENHOS[chave];
  const Lucide = I ?? CircleHelp;
  return (
    <svg viewBox="0 0 48 48" className={`shrink-0 ${className ?? ""}`} aria-hidden={titulo ? undefined : true} role={titulo ? "img" : undefined}>
      {titulo && <title>{titulo}</title>}
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`var(--app-${fam}-a)`} />
          <stop offset="1" stopColor={`var(--app-${fam}-b)`} />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="white" stopOpacity=".35" />
          <stop offset=".5" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill={`url(#${id}g)`} />
      <rect width="48" height="48" rx="13" fill={`url(#${id}b)`} />
      <rect x=".5" y=".5" width="47" height="47" rx="12.5" fill="none" stroke="white" strokeOpacity=".18" />
      {desenho ? desenho(`var(--app-${fam}-c)`) : <Lucide x={11} y={11} width={26} height={26} color="white" strokeWidth={2.4} />}
    </svg>
  );
}
