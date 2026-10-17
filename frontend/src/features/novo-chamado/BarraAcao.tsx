import type { ReactNode } from "react";

/**
 * Botão de ação do passo a passo, preso no rodapé da tela do celular
 * (no lugar da barra de navegação, que some durante o passo a passo).
 */
export function BarraAcao({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-linha bg-superficie/95 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur print:hidden">
      <div className="mx-auto max-w-xl space-y-2">{children}</div>
    </div>
  );
}
