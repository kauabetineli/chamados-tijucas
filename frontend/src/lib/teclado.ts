import { useSyncExternalStore } from "react";

/**
 * Teclado virtual aberto no celular?
 *
 * O index.html usa `interactive-widget=resizes-content`: quando o teclado sobe, a página encolhe (innerHeight diminui).
 * Consideramos o teclado aberto quando há um campo de texto em foco E a tela encolheu bastante em relação à altura
 * normal. Só o foco não basta: no Android a pessoa fecha o teclado com o "voltar" e o campo continua focado.
 *
 * Enquanto está aberto:
 * - a barra de baixo some (Layout), como no app nativo, para não cobrir o campo;
 * - `<html data-teclado>` fica marcado e ganha `scroll-padding-bottom`, para o campo focado não ficar escondido
 *   atrás do rodapé fixo com o botão de enviar (RodapeEnviar).
 */

const CELULAR = "(max-width: 767px)";
const FOLGA = 120; // px a menos que a altura normal para contar como teclado (barra de endereço do Chrome varia ~60 px)

let aberto = false;
let alturaNormal = 0;
let largura = 0;
const ouvintes = new Set<() => void>();

function editavel(el: Element | null) {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly;
  if (el instanceof HTMLInputElement) {
    return !el.readOnly && !["checkbox", "radio", "file", "button", "submit", "reset", "range", "color", "hidden"].includes(el.type);
  }
  return (el as HTMLElement).isContentEditable === true;
}

function rolarCampo() {
  const el = document.activeElement as HTMLElement | null;
  if (!el || !editavel(el)) return;
  // quando dá, leva também o FIM do formulário à vista (ex.: o botão Enviar da conversa), sem tirar o campo da tela;
  // formulário longo (Registrar) fica só com o campo, acima do rodapé fixo (scroll-padding no index.css)
  const form = el.closest("form");
  if (form) {
    const fim = form.getBoundingClientRect().bottom + 12 - window.innerHeight;
    if (fim > 0 && el.getBoundingClientRect().top - fim >= 8) { window.scrollBy({ top: fim }); return; }
  }
  el.scrollIntoView({ block: "nearest" });
}

function medir() {
  const h = window.innerHeight;
  // girou o celular: recomeça a altura normal
  if (window.innerWidth !== largura) { largura = window.innerWidth; alturaNormal = h; }
  const focado = editavel(document.activeElement);
  // sem campo em foco não há teclado: a altura atual é a normal (acompanha a barra de endereço do Chrome)
  if (!focado || h > alturaNormal) alturaNormal = h;
  const agora = window.matchMedia(CELULAR).matches && focado && h < alturaNormal - FOLGA;
  if (agora === aberto) return;
  aberto = agora;
  const raiz = document.documentElement;
  if (aberto) raiz.dataset.teclado = ""; else delete raiz.dataset.teclado;
  ouvintes.forEach((f) => f());
  // depois que a barra de baixo sumir e o layout assentar, garante o campo à vista acima do rodapé fixo
  if (aberto) requestAnimationFrame(() => requestAnimationFrame(rolarCampo));
}

let ligado = false;
function ligar() {
  if (ligado || typeof window === "undefined") return;
  ligado = true;
  largura = window.innerWidth;
  alturaNormal = window.innerHeight;
  window.addEventListener("resize", medir);
  window.visualViewport?.addEventListener("resize", medir);
  // o foco muda antes do teclado subir; o resize que vem depois decide. Ao sair do campo, fecha na hora.
  document.addEventListener("focusin", () => setTimeout(medir, 50));
  document.addEventListener("focusout", () => setTimeout(medir, 50));
}

function assinar(f: () => void) {
  ligar();
  ouvintes.add(f);
  return () => { ouvintes.delete(f); };
}

export function useTecladoAberto() {
  return useSyncExternalStore(assinar, () => aberto, () => false);
}
