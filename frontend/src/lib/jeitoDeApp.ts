/**
 * No celular, segurar o dedo num link/botão/foto abre o menu do navegador
 * ("Abrir em nova guia", "Abrir em guia anônima", "Baixar imagem"), o que denuncia "site".
 * No Android esse menu só some cancelando o evento `contextmenu` (o CSS em index.css cuida do iPhone).
 * Só vale para toque: no computador o botão direito continua normal (abrir chamado em outra aba é útil).
 * Campos de texto e conteúdo marcado com .selecionavel continuam com o menu de copiar/colar.
 */
export function ativarJeitoDeApp() {
  const toque = window.matchMedia?.("(pointer: coarse)");
  document.addEventListener("contextmenu", (e) => {
    if (!toque?.matches) return;
    const alvo = e.target as Element | null;
    if (!alvo?.closest) return;
    if (alvo.closest("input, textarea, [contenteditable], .selecionavel")) return;
    if (alvo.closest("a, button, label, nav, img, video, [role=tab], [role=dialog]")) e.preventDefault();
  });
}
