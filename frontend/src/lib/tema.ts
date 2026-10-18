import { useEffect, useState } from "react";

/**
 * Tema claro/escuro. "auto" segue o celular/computador (prefers-color-scheme).
 * A classe .dark no <html> troca os tokens de cor (index.css). O index.html aplica
 * o tema salvo antes da primeira pintura, para a tela não piscar branca.
 */
export type Tema = "auto" | "claro" | "escuro";

const CHAVE = "dinodesk:tema";
const COR_BARRA = { claro: "#00658C", escuro: "#000000" }; // <meta name="theme-color"> (barra do navegador)
const sistemaEscuro = () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;

export function lerTema(): Tema {
  try {
    const t = localStorage.getItem(CHAVE);
    return t === "claro" || t === "escuro" ? t : "auto";
  } catch {
    return "auto";
  }
}

export function aplicarTema(tema: Tema) {
  const escuro = tema === "escuro" || (tema === "auto" && sistemaEscuro());
  document.documentElement.classList.toggle("dark", escuro);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", escuro ? COR_BARRA.escuro : COR_BARRA.claro);
}

/** Tema atual e função para trocar (salva no aparelho). No "auto", acompanha a troca do sistema na hora. */
export function useTema() {
  const [tema, setTemaLocal] = useState<Tema>(lerTema);
  // várias telas podem mostrar o tema ao mesmo tempo (barra lateral e Configurações): todas acompanham
  useEffect(() => {
    const ouvir = (e: Event) => setTemaLocal((e as CustomEvent<Tema>).detail);
    window.addEventListener("dinodesk:tema", ouvir);
    return () => window.removeEventListener("dinodesk:tema", ouvir);
  }, []);
  const setTema = (t: Tema) => { setTemaLocal(t); window.dispatchEvent(new CustomEvent<Tema>("dinodesk:tema", { detail: t })); };

  useEffect(() => {
    aplicarTema(tema);
    try {
      if (tema === "auto") localStorage.removeItem(CHAVE);
      else localStorage.setItem(CHAVE, tema);
    } catch { /* sem armazenamento: vale só nesta visita */ }
    if (tema !== "auto") return;
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const mudou = () => aplicarTema("auto");
    mq?.addEventListener("change", mudou);
    return () => mq?.removeEventListener("change", mudou);
  }, [tema]);

  return [tema, setTema] as const;
}
