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

  // o Eruda só passa a mostrar o console depois de carregar: o que for registrado antes fica guardado aqui
  // e é repetido quando ele abre (senão o "[página] carregou (reload)" do começo some)
  const antes: { tipo: "info" | "warn" | "error"; args: unknown[] }[] = [];
  const originais = { info: console.info, warn: console.warn, error: console.error };
  (["info", "warn", "error"] as const).forEach((tipo) => {
    console[tipo] = (...args: unknown[]) => { antes.push({ tipo, args }); originais[tipo](...args); };
  });
  // devolve o console original (o Eruda se pendura nele ao iniciar) e repete o que veio antes
  const repetir = () => antes.splice(0).forEach(({ tipo, args }) => console[tipo](...args));

  // a página foi recarregada? (no Android, depois de abrir a câmera, é o sinal de aba descartada)
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  console.info(`[página] carregou (${nav?.type ?? "?"}) às ${new Date().toLocaleTimeString()}, memória do aparelho: ${(navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? "?"} GB`);
  document.addEventListener("visibilitychange", () => console.info(`[página] ${document.visibilityState === "hidden" ? "foi para segundo plano" : "voltou"} às ${new Date().toLocaleTimeString()}`));
  window.addEventListener("pagehide", (e) => console.info(`[página] saindo (guardada na memória: ${e.persisted})`));
  window.addEventListener("error", (e) => console.error("[erro]", e.message));
  window.addEventListener("unhandledrejection", (e) => console.error("[erro]", e.reason));

  const s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/npm/eruda@3.4.1/eruda.min.js";
  s.onload = () => { Object.assign(console, originais); (window as unknown as { eruda?: { init: () => void } }).eruda?.init(); repetir(); };
  s.onerror = () => { Object.assign(console, originais); antes.length = 0; console.warn("[diagnóstico] sem internet para carregar o console"); };
  document.head.appendChild(s);
}
