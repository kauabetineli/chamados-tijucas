import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as PE, type WheelEvent as WE } from "react";
import { createPortal } from "react-dom";

export interface ItemVisualizador {
  url: string;
  tipo: "imagem" | "video";
  nome: string;
}

const ESCALA_MAX = 5;
const ESCALA_TOQUE_DUPLO = 2.5;

type Ponto = { x: number; y: number };
type Estado = { s: number; x: number; y: number };

/**
 * Foto com zoom de pinça (dois dedos), toque duplo para ampliar/voltar, arrastar quando ampliada
 * e roda do mouse no computador. Sem zoom, arrastar para o lado troca de anexo.
 */
function FotoComZoom({ url, nome, aoDeslizar }: { url: string; nome: string; aoDeslizar: (dir: 1 | -1) => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [t, setT] = useState<Estado>({ s: 1, x: 0, y: 0 });
  const [animar, setAnimar] = useState(false);
  const dedos = useRef(new Map<number, Ponto>());
  const inicio = useRef<{ t: Estado; meio: Ponto; dist: number; arrasteX: number } | null>(null);
  const ultimoToque = useRef(0);

  useEffect(() => setT({ s: 1, x: 0, y: 0 }), [url]);

  // posição relativa ao centro da área da foto
  function relativo(p: Ponto): Ponto {
    const r = caixa.current!.getBoundingClientRect();
    return { x: p.x - (r.left + r.width / 2), y: p.y - (r.top + r.height / 2) };
  }

  // não deixa a foto ampliada "fugir" da tela
  function limitar(e: Estado): Estado {
    const r = caixa.current?.getBoundingClientRect();
    if (!r || e.s <= 1) return { s: Math.max(1, e.s), x: 0, y: 0 };
    const mx = ((e.s - 1) * r.width) / 2, my = ((e.s - 1) * r.height) / 2;
    return { s: Math.min(ESCALA_MAX, e.s), x: Math.max(-mx, Math.min(mx, e.x)), y: Math.max(-my, Math.min(my, e.y)) };
  }

  // amplia mantendo o ponto `p` (relativo ao centro) parado sob o dedo/cursor
  function zoomEm(base: Estado, s: number, p: Ponto, destino: Ponto = p): Estado {
    const cx = (p.x - base.x) / base.s, cy = (p.y - base.y) / base.s;
    return limitar({ s, x: destino.x - s * cx, y: destino.y - s * cy });
  }

  function comecarGesto() {
    const pts = [...dedos.current.values()];
    const meio = pts.length === 2 ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } : pts[0];
    const dist = pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    inicio.current = { t, meio: relativo(meio), dist, arrasteX: 0 };
  }

  function aoPressionar(e: PE<HTMLDivElement>) {
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ponteiro já liberado */ }
    dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setAnimar(false);
    comecarGesto();
  }

  function aoMover(e: PE<HTMLDivElement>) {
    if (!dedos.current.has(e.pointerId) || !inicio.current) return;
    dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...dedos.current.values()];
    const ini = inicio.current;
    if (pts.length === 2 && ini.dist > 0) {
      const meio = relativo({ x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 });
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const s = Math.max(1, Math.min(ESCALA_MAX, ini.t.s * (dist / ini.dist)));
      setT(zoomEm(ini.t, s, ini.meio, meio));
    } else if (pts.length === 1) {
      const p = relativo(pts[0]);
      const dx = p.x - ini.meio.x, dy = p.y - ini.meio.y;
      if (ini.t.s > 1) setT(limitar({ s: ini.t.s, x: ini.t.x + dx, y: ini.t.y + dy }));
      else ini.arrasteX = dx;
    }
  }

  function aoSoltar(e: PE<HTMLDivElement>) {
    const eraUmDedo = dedos.current.size === 1;
    dedos.current.delete(e.pointerId);
    const ini = inicio.current;
    if (dedos.current.size > 0) return comecarGesto(); // tirou um dos dois dedos: segue arrastando com o outro
    inicio.current = null;
    if (!eraUmDedo || !ini) return;

    if (ini.t.s === 1 && Math.abs(ini.arrasteX) > 60) return aoDeslizar(ini.arrasteX < 0 ? 1 : -1);

    // toque duplo: amplia no ponto tocado ou volta ao normal
    const agora = Date.now();
    const moveuPouco = Math.abs(ini.arrasteX) < 10;
    if (moveuPouco && agora - ultimoToque.current < 300) {
      ultimoToque.current = 0;
      setAnimar(true);
      setT((atual) => (atual.s > 1 ? { s: 1, x: 0, y: 0 } : zoomEm(atual, ESCALA_TOQUE_DUPLO, relativo({ x: e.clientX, y: e.clientY }))));
    } else if (moveuPouco) {
      ultimoToque.current = agora;
    }
  }

  function aoRolar(e: WE<HTMLDivElement>) {
    setAnimar(false);
    const fator = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setT((atual) => zoomEm(atual, Math.max(1, Math.min(ESCALA_MAX, atual.s * fator)), relativo({ x: e.clientX, y: e.clientY })));
  }

  return (
    <div
      ref={caixa}
      className="flex size-full touch-none items-center justify-center overflow-hidden select-none"
      onPointerDown={aoPressionar}
      onPointerMove={aoMover}
      onPointerUp={aoSoltar}
      onPointerCancel={aoSoltar}
      onWheel={aoRolar}
      style={{ cursor: t.s > 1 ? "grab" : "zoom-in" }}
    >
      <img
        src={url}
        alt={nome}
        draggable={false}
        className="max-h-full max-w-full object-contain"
        style={{
          transform: `translate(${t.x}px, ${t.y}px) scale(${t.s})`,
          transition: animar ? "transform 200ms ease-out" : "none",
        }}
      />
    </div>
  );
}

/**
 * Anexos em tela cheia: foto com zoom, vídeo grande com controles, setas/arrastar para trocar.
 * Fecha no X, no Esc ou no botão "voltar" do celular (quem abre controla isso pelo endereço).
 */
export function Visualizador({ itens, indice, aoMudar, aoFechar }: {
  itens: ItemVisualizador[];
  indice: number;
  aoMudar: (i: number) => void;
  aoFechar: () => void;
}) {
  const item = itens[indice];
  const ir = (dir: 1 | -1) => {
    const novo = indice + dir;
    if (novo >= 0 && novo < itens.length) aoMudar(novo);
  };

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoFechar();
      if (e.key === "ArrowRight") ir(1);
      if (e.key === "ArrowLeft") ir(-1);
    };
    window.addEventListener("keydown", tecla);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", tecla); document.body.style.overflow = overflow; };
  });

  if (!item) return null;
  const toque = window.matchMedia?.("(pointer: coarse)").matches;
  // tema-fixo: o visualizador é sempre escuro (fundo preto), nos dois temas
  const botao = "grid size-12 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20";

  // portal no <body> + z-index alto em estilo: cobre a barra de navegação do celular
  // tema-fixo: fundo preto nos dois temas (foto e vídeo)
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Anexo em tela cheia" className="fixed inset-0 flex flex-col bg-black" style={{ zIndex: 100 }}>
      <div className="flex items-center gap-2 p-2 pt-[max(8px,env(safe-area-inset-top))] text-white">
        <button type="button" onClick={aoFechar} className={botao} aria-label="Fechar">
          <X className="size-6" />
        </button>
        <p className="flex-1 text-center text-sm font-semibold">
          {itens.length > 1 ? `${indice + 1} de ${itens.length}` : item.tipo === "video" ? "Vídeo" : "Foto"}
        </p>
        <a href={item.url} download={item.nome} className={botao} aria-label="Baixar">
          <Download className="size-5" />
        </a>
      </div>

      <div className="relative min-h-0 flex-1">
        {item.tipo === "imagem" ? (
          <FotoComZoom url={item.url} nome={item.nome} aoDeslizar={ir} />
        ) : (
          <div className="flex size-full items-center justify-center">
            {/* tema-fixo */}
            <video key={item.url} src={item.url} controls autoPlay playsInline className="max-h-full w-full max-w-5xl bg-black" />
          </div>
        )}
      </div>

      {/* rodapé: setas fora da foto/vídeo para não cobrir os controles */}
      <div className="flex items-center gap-2 p-2 pb-[max(8px,env(safe-area-inset-bottom))] text-white">
        <button type="button" onClick={() => ir(-1)} disabled={indice === 0} className={`${botao} disabled:invisible`} aria-label="Anexo anterior">
          <ChevronLeft className="size-7" />
        </button>
        <p className="flex-1 text-center text-sm text-white/70">
          {item.tipo === "video"
            ? "Toque no vídeo para pausar ou ver em tela cheia."
            : toque
              ? "Use dois dedos para ampliar. Toque duas vezes para ampliar ou voltar."
              : "Use a roda do mouse para ampliar. Clique duas vezes para ampliar ou voltar."}
        </p>
        <button type="button" onClick={() => ir(1)} disabled={indice === itens.length - 1} className={`${botao} disabled:invisible`} aria-label="Próximo anexo">
          <ChevronRight className="size-7" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
