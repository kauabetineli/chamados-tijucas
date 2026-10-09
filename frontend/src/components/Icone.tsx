import {
  AppWindow, CircleHelp, Cpu, FileText, HardDrive, KeyRound, Laptop, Mail, Monitor, Phone,
  Printer, Projector, Router, Server, ShieldAlert, Smartphone, Wifi, type LucideIcon,
} from "lucide-react";

// Ícones disponíveis para as categorias (campo "icone" no painel do PocketBase).
// Para usar outro ícone do https://lucide.dev, importe e adicione aqui.
const ICONES: Record<string, LucideIcon> = {
  "app-window": AppWindow,
  "circle-help": CircleHelp,
  cpu: Cpu,
  "file-text": FileText,
  "hard-drive": HardDrive,
  "key-round": KeyRound,
  laptop: Laptop,
  mail: Mail,
  monitor: Monitor,
  phone: Phone,
  printer: Printer,
  projector: Projector,
  router: Router,
  server: Server,
  "shield-alert": ShieldAlert,
  smartphone: Smartphone,
  wifi: Wifi,
};

export function IconeCategoria({ nome, className }: { nome?: string; className?: string }) {
  const I = (nome && ICONES[nome]) || CircleHelp;
  return <I className={className} aria-hidden="true" strokeWidth={1.8} />;
}
