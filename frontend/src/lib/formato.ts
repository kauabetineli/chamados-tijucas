import type { Impacto, MotivoAguardando, Origem, Prioridade, Status } from "./pb";

export const ROTULO_STATUS: Record<Status, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  aguardando: "Em espera",
  resolvido: "Resolvido",
};

/** "Aguardando ..." — o que o chamado espera para continuar. */
export const ROTULO_AGUARDANDO: Record<MotivoAguardando, string> = {
  peca: "peça ou equipamento",
  solicitante: "resposta de quem pediu",
  terceiro: "terceiro ou fornecedor",
};

export const ROTULO_PRIORIDADE: Record<Prioridade, string> = {
  baixa: "Baixa",
  normal: "Normal",
  alta: "Alta",
  urgente: "Urgente",
};

export const ROTULO_IMPACTO: Record<Impacto, string> = {
  so_eu: "Só eu",
  setor: "Meu setor inteiro",
  publico: "O atendimento ao público parou",
};

/** O mesmo, lido pelo TI (quem registra ou atende fala da OUTRA pessoa: "Só eu" vira "Só a pessoa"). */
export const ROTULO_IMPACTO_TI: Record<Impacto, string> = {
  so_eu: "Só a pessoa",
  setor: "O setor todo",
  publico: "Atendimento ao público parado",
};

export const ROTULO_ORIGEM: Record<Origem, string> = {
  sistema: "Pelo sistema",
  whatsapp: "WhatsApp",
  ligacao: "Ligação",
  presencial: "Presencial",
};

/** Datas do PocketBase vêm em UTC no formato "2026-10-09 21:40:15.706Z". */
export function paraData(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s.replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
}

const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

export function tempoRelativo(s: string): string {
  const d = paraData(s);
  if (!d) return "";
  const seg = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(seg);
  if (abs < 60) return "agora há pouco";
  if (abs < 3600) return rtf.format(Math.round(seg / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seg / 3600), "hour");
  if (abs < 86400 * 7) return rtf.format(Math.round(seg / 86400), "day");
  return dataCurta(s);
}

export function dataCurta(s: string): string {
  const d = paraData(s);
  return d ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "";
}

export function dataHora(s: string): string {
  const d = paraData(s);
  return d
    ? d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";
}

export function duracaoHoras(horas: number): string {
  if (horas < 1 / 60) return "menos de 1 min";
  if (horas < 1) return `${Math.round(horas * 60)} min`;
  if (horas < 24) return `${horas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
  return `${(horas / 24).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`;
}

export function resumo(texto: string, max = 110) {
  const t = texto.replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}
