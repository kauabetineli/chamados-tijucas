import { useEffect, useState } from "react";
import { emCache, limparCache } from "./cache";
import { pb, type Prioridade } from "./pb";

/**
 * Configuração da fila e do atendimento (coleção config_ti, registro "geral").
 * Editada em Configurações do TI > Fila e atendimento; o servidor valida e limpa (pb_hooks/automacao.pb.js).
 */
export interface ConfigTI {
  ordem_fila: "prazo" | "prioridade" | "chegada";
  /** prazo para começar o atendimento, em minutos, por prioridade */
  prazos: Record<Prioridade, number>;
  servidor_prioridade: boolean;
  teto_prioridade: "alta" | "urgente";
  pedir_motivo_urgente: boolean;
  marcar_escolhida: boolean;
  horario: { ativo: boolean; dias: number[]; inicio: string; fim: string };
  destino_ausencia: "fica" | "fila";
  /** resolvido sem resposta do servidor: considerado resolvido depois de N dias úteis (0 = nunca) */
  dias_confirmar: number;
  /** até onde os fluxos de tempo sobem a prioridade sozinhos */
  teto_tempo: "alta" | "urgente";
}

export const CONFIG_PADRAO: ConfigTI = {
  ordem_fila: "prazo",
  prazos: { urgente: 60, alta: 240, normal: 1440, baixa: 4320 },
  servidor_prioridade: false,
  teto_prioridade: "urgente",
  pedir_motivo_urgente: true,
  marcar_escolhida: true,
  horario: { ativo: false, dias: [1, 2, 3, 4, 5], inicio: "08:00", fim: "17:00" },
  destino_ausencia: "fica",
  dias_confirmar: 3,
  teto_tempo: "alta",
};

/** Dias úteis que faltam para um chamado resolvido ser considerado resolvido sozinho (null = desligado). */
export function diasParaConfirmar(resolvidoEm: string | undefined, dias: number): number | null {
  if (!dias || !resolvidoEm) return null;
  const d = new Date(resolvidoEm.replace(" ", "T"));
  let passados = 0;
  const hoje = new Date();
  while (d < hoje) {
    d.setDate(d.getDate() + 1);
    if (d <= hoje && d.getDay() !== 0 && d.getDay() !== 6) passados++;
  }
  return Math.max(0, dias - passados);
}

interface RegistroConfig { id: string; dados: Partial<ConfigTI> | null }

export function juntarConfig(d: Partial<ConfigTI> | null | undefined): ConfigTI {
  return {
    ...CONFIG_PADRAO,
    ...(d ?? {}),
    prazos: { ...CONFIG_PADRAO.prazos, ...(d?.prazos ?? {}) },
    horario: { ...CONFIG_PADRAO.horario, ...(d?.horario ?? {}) },
  };
}

export function lerConfigTI(): Promise<{ id: string; config: ConfigTI }> {
  return emCache("config_ti", async () => {
    const r = await pb.collection("config_ti").getFirstListItem<RegistroConfig>('chave = "geral"');
    return { id: r.id, config: juntarConfig(r.dados) };
  });
}

/** Configuração em vigor (cai no padrão enquanto carrega ou sem conexão). */
export function useConfigTI() {
  const [estado, setEstado] = useState<{ id: string; config: ConfigTI; carregada: boolean }>({ id: "", config: CONFIG_PADRAO, carregada: false });
  useEffect(() => {
    let vivo = true;
    lerConfigTI().then((r) => vivo && setEstado({ ...r, carregada: true })).catch(() => vivo && setEstado((e) => ({ ...e, carregada: true })));
    return () => { vivo = false; };
  }, []);
  return estado;
}

export async function salvarConfigTI(id: string, config: ConfigTI) {
  const r = await pb.collection("config_ti").update<RegistroConfig>(id, { dados: config });
  limparCache("config_ti");
  return juntarConfig(r.dados);
}

/* ---------- prazos e horário ---------- */

export const ROTULO_ORDEM: Record<ConfigTI["ordem_fila"], string> = {
  prazo: "Pelo prazo",
  prioridade: "Prioridade, depois chegada",
  chegada: "Ordem de chegada",
};

/** 60 -> "1 hora", 1440 -> "1 dia" (24 h), 4320 -> "3 dias" */
export function textoMinutos(min: number): string {
  if (min < 60) return `${min} min`;
  if (min % 1440 === 0) { const d = min / 1440; return d === 1 ? "1 dia" : `${d} dias`; }
  const h = Math.round(min / 60);
  return h === 1 ? "1 hora" : `${h} horas`;
}

export const OPCOES_PRAZO = [30, 60, 120, 240, 480, 1440, 2880, 4320];

const hm = (s: string) => { const [h, m] = s.split(":").map((x) => parseInt(x, 10) || 0); return h * 60 + m; };

/** O TI está atendendo agora? (horário desligado = sempre) */
export function dentroDoHorario(cfg: ConfigTI, d = new Date()): boolean {
  const h = cfg.horario;
  if (!h.ativo) return true;
  if (!h.dias.includes(d.getDay())) return false;
  const m = d.getHours() * 60 + d.getMinutes();
  return m >= hm(h.inicio) && m < hm(h.fim);
}

const NOMES_DIA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
export const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** "segunda a sexta, das 8h às 17h" */
export function textoHorario(cfg: ConfigTI): string {
  const h = cfg.horario;
  const dias = [...h.dias].sort();
  const seguidos = dias.length > 1 && dias.every((d, i) => i === 0 || d === dias[i - 1] + 1);
  const quando = !dias.length ? "em dias a definir" : seguidos ? `${NOMES_DIA[dias[0]]} a ${NOMES_DIA[dias[dias.length - 1]]}` : dias.map((d) => NOMES_DIA[d]).join(", ");
  const hora = (s: string) => s.replace(/^0/, "").replace(":00", "h").replace(":", "h");
  return `${quando}, das ${hora(h.inicio)} às ${hora(h.fim)}`;
}

/** Frase para quem abriu o chamado fora do horário (tela do chamado, logo depois de enviar). */
export function mensagemForaDoHorario(cfg: ConfigTI): string {
  return `O TI atende ${textoHorario(cfg)}: o seu chamado já está na fila e é visto quando a equipe voltar.`;
}

/* ---------- prioridade escolhida por quem abre ---------- */

const NIVEL: Record<Prioridade, number> = { baixa: 1, normal: 2, alta: 3, urgente: 4 };
export const PRIORIDADE_DO_IMPACTO: Record<string, Prioridade> = { so_eu: "normal", setor: "alta", publico: "urgente" };

/** Prioridades que quem abre pode escolher (o servidor confere de novo): de Normal até o teto (ou a sugerida, se for maior). */
export function prioridadesDoServidor(cfg: ConfigTI, sugerida: Prioridade): Prioridade[] {
  const max = Math.max(NIVEL[cfg.teto_prioridade], NIVEL[sugerida]);
  return (["normal", "alta", "urgente"] as Prioridade[]).filter((p) => NIVEL[p] <= max);
}

/** Precisa contar o motivo? (subiu para Urgente acima do que o impacto sugeria) */
export function pedeMotivo(cfg: ConfigTI, sugerida: Prioridade, escolhida: Prioridade): boolean {
  return cfg.servidor_prioridade && cfg.pedir_motivo_urgente && escolhida === "urgente" && sugerida !== "urgente";
}
