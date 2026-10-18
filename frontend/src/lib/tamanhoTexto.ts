import { useState } from "react";

/**
 * "Tamanho do texto" (Meu perfil). Como no celular, deixa a tela inteira maior para quem enxerga pouco,
 * no lugar do zoom de pinça (bloqueado para a tela não "escapar"). Salvo no aparelho.
 * O index.html aplica antes da primeira pintura; o CSS está em index.css (html[data-texto]).
 */
export type TamanhoTexto = "normal" | "grande" | "maior";
const CHAVE = "dinodesk:texto";

export function lerTamanhoTexto(): TamanhoTexto {
  try {
    const t = localStorage.getItem(CHAVE);
    return t === "grande" || t === "maior" ? t : "normal";
  } catch {
    return "normal";
  }
}

export function useTamanhoTexto() {
  const [tamanho, setTamanho] = useState<TamanhoTexto>(lerTamanhoTexto);
  function mudar(t: TamanhoTexto) {
    setTamanho(t);
    if (t === "normal") delete document.documentElement.dataset.texto;
    else document.documentElement.dataset.texto = t;
    try {
      if (t === "normal") localStorage.removeItem(CHAVE);
      else localStorage.setItem(CHAVE, t);
    } catch { /* sem armazenamento: vale só nesta visita */ }
  }
  return { tamanho, mudar };
}
