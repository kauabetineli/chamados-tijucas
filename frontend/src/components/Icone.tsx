import {
  AppWindow, BatteryLow, Bug, Building2, Cable, Calendar, Camera, CircleHelp, Cloud, Cpu, Database, FileSpreadsheet, FileText,
  Folder, Globe, HardDrive, Headphones, KeyRound, Keyboard, Laptop, Lock, Mail, MessageSquare, Mic, Monitor, Mouse, Network,
  Phone, Plug, Printer, Projector, Router, ScanBarcode, ScanLine, Server, Settings, ShieldAlert, Signal, Smartphone, Speaker,
  Tablet, Tv, Usb, UserRound, Users, Video, Webcam, Wifi, Wrench, Zap, type LucideIcon,
} from "lucide-react";

/**
 * Ícones que o administrador do TI pode escolher para as categorias (Configurações do TI > Categorias).
 * Chave = nome do ícone no https://lucide.dev (é o que fica gravado em categorias.icone); rótulo = busca em português.
 * Para oferecer outro ícone: importe e acrescente aqui.
 */
export const ICONES: Record<string, { I: LucideIcon; rot: string }> = {
  monitor: { I: Monitor, rot: "Monitor, computador" },
  laptop: { I: Laptop, rot: "Notebook" },
  printer: { I: Printer, rot: "Impressora" },
  "scan-line": { I: ScanLine, rot: "Scanner" },
  wifi: { I: Wifi, rot: "Wi-Fi" },
  router: { I: Router, rot: "Roteador" },
  network: { I: Network, rot: "Rede" },
  globe: { I: Globe, rot: "Internet, site" },
  signal: { I: Signal, rot: "Sinal" },
  cable: { I: Cable, rot: "Cabo" },
  "app-window": { I: AppWindow, rot: "Sistema ou programa" },
  bug: { I: Bug, rot: "Erro no sistema" },
  database: { I: Database, rot: "Banco de dados" },
  server: { I: Server, rot: "Servidor" },
  cloud: { I: Cloud, rot: "Nuvem" },
  "key-round": { I: KeyRound, rot: "Senha" },
  lock: { I: Lock, rot: "Acesso, bloqueio" },
  "shield-alert": { I: ShieldAlert, rot: "Segurança, vírus" },
  mail: { I: Mail, rot: "E-mail" },
  "message-square": { I: MessageSquare, rot: "Mensagem" },
  phone: { I: Phone, rot: "Telefone, ramal" },
  smartphone: { I: Smartphone, rot: "Celular" },
  tablet: { I: Tablet, rot: "Tablet" },
  projector: { I: Projector, rot: "Projetor" },
  tv: { I: Tv, rot: "TV" },
  video: { I: Video, rot: "Vídeo, videoconferência" },
  webcam: { I: Webcam, rot: "Webcam" },
  camera: { I: Camera, rot: "Câmera" },
  mic: { I: Mic, rot: "Microfone" },
  speaker: { I: Speaker, rot: "Caixa de som" },
  headphones: { I: Headphones, rot: "Fone de ouvido" },
  mouse: { I: Mouse, rot: "Mouse" },
  keyboard: { I: Keyboard, rot: "Teclado" },
  usb: { I: Usb, rot: "USB, pen drive" },
  "hard-drive": { I: HardDrive, rot: "Disco, HD" },
  cpu: { I: Cpu, rot: "Peça, processador" },
  plug: { I: Plug, rot: "Tomada" },
  zap: { I: Zap, rot: "Energia" },
  "battery-low": { I: BatteryLow, rot: "Bateria, nobreak" },
  "scan-barcode": { I: ScanBarcode, rot: "Leitor de código" },
  "file-text": { I: FileText, rot: "Documento" },
  "file-spreadsheet": { I: FileSpreadsheet, rot: "Planilha" },
  folder: { I: Folder, rot: "Pasta" },
  calendar: { I: Calendar, rot: "Agenda" },
  "user-round": { I: UserRound, rot: "Pessoa, conta" },
  users: { I: Users, rot: "Equipe" },
  "building-2": { I: Building2, rot: "Prédio" },
  wrench: { I: Wrench, rot: "Manutenção" },
  settings: { I: Settings, rot: "Configuração" },
  "circle-help": { I: CircleHelp, rot: "Outro" },
};

export function IconeCategoria({ nome, className }: { nome?: string; className?: string }) {
  const I = (nome && ICONES[nome]?.I) || CircleHelp;
  return <I className={className} aria-hidden="true" strokeWidth={1.8} />;
}
