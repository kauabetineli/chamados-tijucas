import { BellRing, ClipboardPen, Ticket } from "lucide-react";
import type { ReactNode } from "react";
import { BotaoTema } from "./BotaoTema";

// "Como funciona": aparece no PC, ao lado do formulário (no celular o formulário vem primeiro)
const PASSOS = [
  { Icone: ClipboardPen, titulo: "Abra o chamado", texto: "Diga o que aconteceu e, se puder, mande uma foto." },
  { Icone: Ticket, titulo: "Acompanhe a sua senha", texto: "Veja a sua posição na fila, sem precisar perguntar." },
  { Icone: BellRing, titulo: "Confirme a solução", texto: "O TI avisa quando resolver. Se continuar, é só reabrir." },
];

/** Moldura das telas de entrar e criar conta. */
export function TelaAcesso({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    // celular: faixa azul em cima e o formulário numa folha que sobe por baixo.
    // PC: a página toda azul (rede do brasão) e, no centro, a marca à esquerda e um CARTÃO com o formulário à direita.
    // celular: ocupa exatamente a altura da tela, sem rolar a página (só a folha do formulário rola, se o teclado apertar)
    <div className="relative flex h-dvh flex-col overflow-hidden overscroll-none bg-superficie md:h-auto md:min-h-dvh md:flex-row md:items-center md:justify-center md:bg-mar-700 md:p-10">
      <div className="hidden md:block"><Rede id="rede-pc" /></div>
      <div className="relative flex min-h-0 flex-1 flex-col md:grid md:flex-none md:w-full md:max-w-5xl md:grid-cols-[minmax(0,1fr)_26rem] md:items-center md:gap-14">
        <div className="relative shrink-0 overflow-hidden bg-mar-700 px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-10 md:overflow-visible md:bg-transparent md:p-0">
          <div className="md:hidden"><Rede id="rede-celular" /></div>
          <div className="relative">
            {/* celular: ícone e nome lado a lado, para caber tudo sem rolar */}
            <div className="flex items-center gap-3 md:block">
              <img src="/icone-fundo-azul.svg" alt="" className="size-14 md:mb-6 md:size-28" />
              <p className="font-display text-4xl leading-none font-extrabold text-white md:text-6xl">Dino Desk</p>
            </div>
            {/* celular de tela baixa: some a frase, para o formulário caber sem rolar */}
            <p className="mt-3 max-w-lg font-semibold text-white max-md:[@media(max-height:700px)]:hidden md:text-lg">
              Peça ajuda ao Departamento de TI da Prefeitura e acompanhe a sua vez na fila, sem precisar mandar mensagem.
            </p>

            <ol className="mt-10 hidden space-y-5 md:block" aria-label="Como funciona">
              {PASSOS.map(({ Icone, titulo, texto }, i) => (
                <li key={titulo} className="flex items-start gap-4">
                  <span className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-noite/25 text-white ring-1 ring-white/25">
                    <Icone className="size-6" aria-hidden="true" />
                    <span className="absolute -top-2 -left-2 grid size-6 place-items-center rounded-full bg-sol font-display text-sm font-extrabold text-noite">
                      {i + 1}
                    </span>
                  </span>
                  <span className="text-white">
                    <span className="block font-display text-lg font-bold">{titulo}</span>
                    <span className="block text-white/85">{texto}</span>
                  </span>
                </li>
              ))}
            </ol>

            <div className="mt-4 flex items-center gap-3 md:mt-12">
              <img src="/brasao-tijucas.png" alt="Brasão de Tijucas" className="h-12 w-auto drop-shadow md:h-20" />
              <p className="text-sm leading-tight font-semibold text-white">
                Prefeitura Municipal
                <span className="block font-display text-xl font-extrabold">de Tijucas</span>
              </p>
            </div>
          </div>
        </div>

        <div className="relative -mt-6 min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-t-3xl bg-superficie px-6 pt-7 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:mt-0 md:flex-none md:overflow-visible md:rounded-3xl md:p-10 md:shadow-2xl md:ring-1 md:ring-linha">
          <BotaoTema className="absolute top-3 right-3" />
          <h1 className="mb-6 text-3xl font-bold">{titulo}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}

// grafismo sutil da rede de pesca do brasão
// `id` único: com dois desenhos na página, um padrão escondido (display:none) não pinta o outro
function Rede({ id }: { id: string }) {
  return (
    <svg className="absolute inset-0 size-full opacity-60" aria-hidden="true">
      <defs>
        <pattern id={id} width="36" height="36" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          {/* tema-fixo: grafismo da marca sobre o painel azul */}
          <path d="M0 18h36M18 0v36" stroke="#0093C9" strokeWidth="1.5" fill="none" />
          <circle cx="18" cy="18" r="2.5" fill="#0093C9" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
