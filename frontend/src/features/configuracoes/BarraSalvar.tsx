import type { ReactNode } from "react";

/**
 * Barra "alterações não salvas" das Configurações do TI. Gruda EMBAIXO (os avisos rápidos ficam em cima,
 * e assim o "Desfazer" de um aviso nunca cobre o Salvar). No celular fica acima da barra de navegação.
 */
export function BarraSalvar({ texto, salvando, rotulo = "Salvar", desabilitado, aoSalvar, aoDescartar }: {
  texto: ReactNode; salvando: boolean; rotulo?: string; desabilitado?: boolean; aoSalvar: () => void; aoDescartar: () => void;
}) {
  return (
    <div role="status" className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-noite px-4 py-2.5 text-white shadow-2xl md:bottom-4">
      <span className="min-w-0 flex-[1_1_16rem] font-semibold">{texto}</span>
      <button type="button" onClick={aoDescartar} disabled={salvando}
        className="btn min-h-11 border-2 border-white/80 px-4 text-white hover:opacity-80">Descartar</button>
      <button type="button" onClick={aoSalvar} disabled={salvando || desabilitado}
        className="btn min-h-11 bg-sol px-5 font-extrabold text-noite hover:opacity-90">{salvando ? "Salvando..." : rotulo}</button>
    </div>
  );
}
