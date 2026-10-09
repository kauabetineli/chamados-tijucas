import type { ReactNode } from "react";

/** Moldura das telas de entrar e criar conta. */
export function TelaAcesso({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-white md:grid md:grid-cols-[1fr_minmax(0,32rem)]">
      <div className="relative overflow-hidden bg-mar-700 px-6 pt-10 pb-14 text-tinta md:flex md:flex-col md:justify-end md:p-14">
        <Rede />
        <div className="relative">
          <img src="/icone-fundo-azul.svg" alt="" className="mb-6 size-24 md:size-32" />
          <p className="font-display text-4xl leading-none font-extrabold text-white md:text-6xl">Dino Desk</p>
          <p className="mt-3 max-w-md text-lg font-semibold text-white">
            Peça ajuda ao Departamento de TI da Prefeitura e acompanhe a sua vez na fila, sem precisar mandar mensagem.
          </p>
          <p className="mt-6 text-sm font-semibold text-white">Prefeitura Municipal de Tijucas</p>
        </div>
      </div>
      <div className="relative -mt-6 rounded-t-3xl bg-white px-6 pt-8 pb-10 md:mt-0 md:flex md:flex-col md:justify-center md:rounded-none md:px-12">
        <h1 className="mb-6 text-3xl font-bold">{titulo}</h1>
        {children}
      </div>
    </div>
  );
}

// grafismo sutil da rede de pesca do brasão
function Rede() {
  return (
    <svg className="absolute inset-0 size-full opacity-60" aria-hidden="true">
      <defs>
        <pattern id="rede" width="36" height="36" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 18h36M18 0v36" stroke="#0093C9" strokeWidth="1.5" fill="none" />
          <circle cx="18" cy="18" r="2.5" fill="#0093C9" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#rede)" />
    </svg>
  );
}
