import type { ReactNode } from "react";
import { BotaoTema } from "./BotaoTema";

/**
 * Moldura das telas de entrar e de criar a senha: uma coluna só, calma, no centro.
 * A página inteira rola junto (sem caixa com rolagem própria), então no celular o teclado só empurra a tela,
 * sem barra de rolagem no meio do formulário.
 */
export function TelaAcesso({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-superficie md:bg-fundo">
      <div className="h-1.5 shrink-0 bg-mar" aria-hidden="true" />
      <BotaoTema className="absolute top-4 right-3" />

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 pt-10 pb-8 md:max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src="/icone-fundo-azul.svg" alt="" className="size-16 rounded-2xl" />
          <p className="mt-3 font-display text-3xl leading-none font-extrabold tracking-tight">Dino Desk</p>
          <p className="mt-2 text-tinta-2">Chamados do Departamento de TI</p>
        </div>
        <div className="md:rounded-3xl md:bg-superficie md:p-8 md:shadow-sm md:ring-1 md:ring-linha">
          <h1 className="mb-6 text-2xl font-bold">{titulo}</h1>
          {children}
        </div>
      </main>

      <footer className="flex shrink-0 items-center justify-center gap-2.5 px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-sm text-tinta-2">
        <img src="/brasao-tijucas.png" alt="" className="h-8 w-auto" />
        Prefeitura Municipal de Tijucas
      </footer>
    </div>
  );
}
