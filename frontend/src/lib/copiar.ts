/**
 * Copia texto. Sem HTTPS (o servidor é acessado por IP) a área de transferência moderna não existe,
 * então usa o jeito antigo (textarea + execCommand), que funciona em HTTP. Devolve se deu certo.
 */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (window.isSecureContext && navigator.clipboard) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch { /* cai no jeito antigo */ }
  const area = document.createElement("textarea");
  area.value = texto;
  area.setAttribute("readonly", "");
  area.style.cssText = "position:fixed;top:0;left:0;opacity:0";
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch { ok = false; }
  area.remove();
  return ok;
}
