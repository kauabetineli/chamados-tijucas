/**
 * Modo de diagnóstico para o celular (sem cabo USB): abra qualquer página com ?diagnostico=1.
 * Aparece um console flutuante (Eruda) na própria tela, com erros, avisos e as linhas "[anexos]"/"[envio]".
 * Fica ligado neste navegador até abrir com ?diagnostico=0. Precisa de internet para carregar o Eruda.
 */
const CHAVE = "dinodesk:diagnostico";

export function ativarDiagnostico() {
  let ligado = false;
  try {
    const p = new URLSearchParams(location.search).get("diagnostico");
    if (p === "1") localStorage.setItem(CHAVE, "1");
    if (p === "0") localStorage.removeItem(CHAVE);
    ligado = localStorage.getItem(CHAVE) === "1";
  } catch { /* sem armazenamento */ }
  if (!ligado) return;

  // a página foi recarregada? (no Android, depois de abrir a câmera, é o sinal de aba descartada)
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  console.info(`[página] carregou (${nav?.type ?? "?"}) às ${new Date().toLocaleTimeString()} · memória do aparelho: ${(navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? "?"} GB`);
  document.addEventListener("visibilitychange", () => console.info(`[página] ${document.visibilityState === "hidden" ? "foi para segundo plano" : "voltou"} às ${new Date().toLocaleTimeString()}`));
  window.addEventListener("pagehide", (e) => console.info(`[página] saindo (guardada na memória: ${e.persisted})`));
  window.addEventListener("error", (e) => console.error("[erro]", e.message));
  window.addEventListener("unhandledrejection", (e) => console.error("[erro]", e.reason));

  const s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/npm/eruda@3.4.1/eruda.min.js";
  s.onload = () => (window as unknown as { eruda?: { init: () => void } }).eruda?.init();
  s.onerror = () => console.warn("[diagnóstico] sem internet para carregar o console");
  document.head.appendChild(s);
}
