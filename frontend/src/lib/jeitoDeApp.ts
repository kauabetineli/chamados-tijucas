/**
 * No celular, segurar o dedo num link/botão/foto abre o menu do navegador
 * ("Abrir em nova guia", "Abrir em guia anônima", "Baixar imagem"), o que denuncia "site".
 * No Android esse menu só some cancelando o evento `contextmenu` (o CSS em index.css cuida do iPhone).
 * Só vale para toque: no computador o botão direito continua normal (abrir chamado em outra aba é útil).
 * Campos de texto e conteúdo marcado com .selecionavel continuam com o menu de copiar/colar.
 */
export function ativarJeitoDeApp() {
  const toque = window.matchMedia?.("(pointer: coarse)");
  // iPhone ignora o "user-scalable=no" do index.html: o zoom de pinça da página é cancelado aqui.
  // O zoom das fotos (Visualizador) usa eventos de ponteiro e continua funcionando.
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  document.addEventListener("contextmenu", (e) => {
    if (!toque?.matches) return;
    const alvo = e.target as Element | null;
    if (!alvo?.closest) return;
    if (alvo.closest("input, textarea, [contenteditable], .selecionavel")) return;
    if (alvo.closest("a, button, label, nav, img, video, [role=tab], [role=dialog]")) e.preventDefault();
  });
}

/**
 * Campo com Enter "Próximo" (enterKeyHint="next"): o Enter vai para o próximo campo do formulário,
 * como num app, em vez de enviar o formulário pela metade.
 * Uso: <input enterKeyHint="next" onKeyDown={irParaProximo} />
 */
export function irParaProximo(e: { key: string; currentTarget: HTMLElement; preventDefault: () => void }) {
  if (e.key !== "Enter") return;
  const form = e.currentTarget.closest("form");
  if (!form) return;
  e.preventDefault();
  const campos = Array.from(form.querySelectorAll<HTMLElement>("input:not([type=hidden]):not([type=radio]):not([type=checkbox]):not([type=file]), select, textarea"))
    .filter((c) => !(c as HTMLInputElement).disabled && c.offsetParent !== null);
  campos[campos.indexOf(e.currentTarget) + 1]?.focus();
}
