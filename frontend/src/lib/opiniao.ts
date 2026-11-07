import { avisar } from "./avisos";

/**
 * "Sua opinião": feedback sobre o PRÓPRIO sistema, para a equipe do projeto (não é chamado).
 * Qualquer tela abre a janela com abrirOpiniao(); quem desenha a janela é components/Opiniao.tsx (no Layout).
 */

const EVENTO = "dinodesk:opiniao";

export function abrirOpiniao(opcoes: { nota?: boolean } = {}) {
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: opcoes }));
}

export function aoAbrirOpiniao(f: (opcoes: { nota?: boolean }) => void) {
  const ouvinte = (e: Event) => f((e as CustomEvent).detail ?? {});
  window.addEventListener(EVENTO, ouvinte);
  return () => window.removeEventListener(EVENTO, ouvinte);
}

/** Nome da tela, para a equipe saber onde a pessoa estava. */
export function nomeDaTela(caminho: string): string {
  const fixos: Record<string, string> = {
    "/": "Meus chamados",
    "/novo": "Novo chamado",
    "/perfil": "Você",
    "/configuracoes": "Configurações",
    "/ti": "Fila",
    "/ti/chamados": "Todos os chamados",
    "/ti/registrar": "Registrar pedido",
    "/ti/historico": "Soluções",
    "/ti/painel": "Painel",
    "/ti/usuarios": "Pessoas e setores",
    "/ti/configuracoes": "Configurações do TI",
    "/ti/qrcodes": "QR codes",
    "/projeto/feedback": "Feedback do sistema",
  };
  if (fixos[caminho]) return fixos[caminho];
  if (caminho.startsWith("/ti/chamado/")) return "Chamado (TI)";
  if (caminho.startsWith("/chamado/")) return "Chamado";
  return caminho.slice(0, 120);
}

const CHAVE_CONVITE = "dinodesk:convite-opiniao";
const INTERVALO = 30 * 24 * 3600 * 1000;

/** Depois de confirmar um chamado: no máximo uma vez a cada 30 dias, um aviso convida a dar nota ao sistema. */
export function convidarOpiniao() {
  let ultimo = 0;
  try { ultimo = Number(localStorage.getItem(CHAVE_CONVITE) || 0); } catch { /* sem armazenamento: convida */ }
  if (Date.now() - ultimo < INTERVALO) return;
  try { localStorage.setItem(CHAVE_CONVITE, String(Date.now())); } catch { /* segue */ }
  window.setTimeout(() => avisar("Como foi usar o Dino Desk desta vez?", {
    tipo: "info", duracao: 9000, acao: { rotulo: "Dar nota", fazer: () => abrirOpiniao({ nota: true }) },
  }), 1200);
}
