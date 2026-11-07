import type { CSSProperties } from "react";
import { ChevronUp, ClipboardList, History, ListOrdered, Plus, SquarePen, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../lib/auth";
import { Avisos } from "./Avisos";
import { Avatar } from "./Avatar";
import { BarraLateral } from "./BarraLateral";
import { BarraTopo } from "./BarraTopo";
import { Opiniao } from "./Opiniao";
import { PainelChamado } from "./PainelChamado";
import { ehTecnico } from "../lib/pb";
import { useNumeros, VISOES, type Numeros } from "../lib/numeros";
import { useTecladoAberto } from "../lib/teclado";

// avatar: o item "Você" mostra a foto/iniciais da pessoa no lugar do ícone
type Item = { para: string; rotulo: string; Icone: typeof Plus; fim?: boolean; destaque?: boolean; avatar?: boolean };

const SOLICITANTE: Item[] = [
  { para: "/", rotulo: "Início", Icone: ClipboardList, fim: true },
  { para: "/novo", rotulo: "Novo chamado", Icone: Plus, destaque: true },
  { para: "/perfil", rotulo: "Você", Icone: UserRound, avatar: true },
];
const TECNICO: Item[] = [
  { para: "/ti", rotulo: "Fila", Icone: ListOrdered, fim: true },
  { para: "/ti/registrar", rotulo: "Registrar", Icone: SquarePen },
  { para: "/ti/historico", rotulo: "Soluções", Icone: History },
  // Painel e Pessoas são eventuais no celular: ficam dentro de "Você" (no PC continuam na barra lateral)
  { para: "/perfil", rotulo: "Você", Icone: UserRound, avatar: true },
];
// telas que moram dentro de "Você" no celular (o item fica marcado nelas)
const DENTRO_DE_VOCE = ["/configuracoes", "/ti/painel", "/ti/usuarios", "/ti/configuracoes", "/projeto/feedback"];

export function Layout() {
  const { usuario } = useAuth();
  const itens = ehTecnico(usuario) ? TECNICO : SOLICITANTE;
  // no passo a passo de novo chamado a barra de baixo some: o único botão no rodapé é o da etapa
  const caminho = useLocation().pathname;
  const focado = caminho === "/novo";
  // celular com o teclado aberto: a barra de baixo some para não cobrir o campo (volta quando o teclado fecha)
  const teclado = useTecladoAberto();
  const semBarra = focado || teclado;
  // "Todos os chamados" é a outra visão da Fila: o item Fila continua marcado, e a página fica mais larga (tabela)
  const ativo = (i: Item, isActive: boolean) =>
    isActive || (i.para === "/ti" && caminho === "/ti/chamados") || (i.para === "/perfil" && DENTRO_DE_VOCE.includes(caminho));
  const numeros = useNumeros();
  const tecnico = ehTecnico(usuario);
  const [params] = useSearchParams();
  const navegar = useNavigate();
  // celular, técnico: tocar de novo em "Fila" (já estando nela) abre o menu das visões
  const [menuFila, setMenuFila] = useState(false);
  useEffect(() => setMenuFila(false), [caminho, params]);
  const largura = !tecnico ? "72rem" : caminho === "/ti/configuracoes" ? "96rem" : caminho === "/ti" || caminho === "/ti/chamados" || caminho === "/ti/registrar" || focado ? "80rem" : "64rem";

  return (
    // PC: barra lateral à esquerda + conteúdo. Celular: topo + barra de baixo (a lateral não aparece).
    <div className="md:flex">
    {/* PC: o TI tem a barra lateral; o servidor, uma barra no topo (poucas telas) */}
    {tecnico && <BarraLateral numeros={numeros} />}
    <div className={`flex min-h-dvh min-w-0 flex-1 flex-col md:pb-0 ${semBarra ? "" : "pb-[calc(76px+env(safe-area-inset-bottom))]"}`}>
      {!tecnico && <BarraTopo numeros={numeros} />}

      {/* com o chamado aberto na gaveta da direita (PC), a lista encolhe ao lado dela (--largura-painel) */}
      {/* celular: SEM barra no topo (a tela toda é do conteúdo, como no app). A pessoa fica na barra de baixo
          ("Você"); o nome "Dino Desk" fica na tela de entrar, na aba do navegador e na barra lateral do PC. */}
      <main className="conteudo w-full flex-1 px-4 pt-5 pb-8 md:px-8 md:pt-8" style={{ "--max": largura } as CSSProperties}>
        <Outlet />
        <Avisos />
        <PainelChamado />
        <Opiniao />
      </main>

      {/* barra inferior no celular */}
      {!semBarra && <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-20 print:hidden border-t border-linha bg-superficie pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="flex">
          {itens.map((i) => (
            <li key={i.para} className="relative flex-1">
              <NavLink
                to={i.para}
                end={i.fim}
                onClick={(e) => {
                  if (tecnico && i.para === "/ti" && caminho === "/ti") { e.preventDefault(); setMenuFila((m) => !m); }
                }}
                aria-haspopup={tecnico && i.para === "/ti" ? "menu" : undefined}
                aria-expanded={tecnico && i.para === "/ti" ? menuFila : undefined}
                className={({ isActive: marcado }) => { const isActive = ativo(i, marcado); return (
                  i.destaque
                    // ação principal: botão redondo no meio, saltando um pouco para fora da barra, com o rótulo inteiro embaixo
                    ? "flex h-[76px] flex-col items-center justify-end gap-1 pb-2.5 text-sm font-bold text-tinta"
                    : `flex h-[76px] flex-col items-center justify-center gap-1 text-sm font-semibold ${
                        isActive ? "text-acento" : "text-tinta-2"
                      }`
                ); }}
              >
                {({ isActive: marcado }) => {
                  const isActive = ativo(i, marcado);
                  if (i.destaque) return (
                    <>
                      <span className="-mt-8 grid size-14 place-items-center rounded-full bg-mar-700 text-white shadow-lg ring-4 ring-fundo">
                        <i.Icone className="size-7" strokeWidth={2.6} aria-hidden="true" />
                      </span>
                      {i.rotulo}
                    </>
                  );
                  return (
                    <>
                      {/* aba marcada: "pílula" atrás do ícone, como a barra nativa do Android. No "Você" a foto já é o
                          ícone: sem pílula, do tamanho dos outros ícones, e marcada só com um anel em volta */}
                      <span className={`relative flex h-8 items-center justify-center rounded-full px-5 transition-colors ${isActive && !i.avatar ? "bg-mar-50" : ""}`}>
                        {i.avatar && usuario
                          ? <span className={`rounded-full ${isActive ? "ring-2 ring-acento ring-offset-2 ring-offset-superficie" : ""}`}><Avatar id={usuario.id} nome={usuario.name} tamanho="xs" /></span>
                          : <i.Icone className="size-6" aria-hidden="true" />}
                        <SeloMenu i={i} numeros={numeros} tecnico={tecnico} />
                      </span>
                      <span className="flex items-center gap-0.5">
                        {i.rotulo}
                        {/* na Fila: setinha avisa que tocar de novo abre as visões */}
                        {tecnico && i.para === "/ti" && caminho === "/ti" && <ChevronUp className={`size-3.5 transition-transform ${menuFila ? "rotate-180" : ""}`} aria-hidden="true" />}
                      </span>
                    </>
                  );
                }}
              </NavLink>
              {tecnico && i.para === "/ti" && menuFila && (
                <MenuVisoes numeros={numeros} atual={params.get("visao")} aoEscolher={(v) => { setMenuFila(false); navegar(v ? `/ti?visao=${v}` : "/ti"); }} aoFechar={() => setMenuFila(false)} />
              )}
            </li>
          ))}
        </ul>
      </nav>}
    </div>
    </div>
  );
}

/** Número no ícone da barra de baixo: servidor = quantos precisam dele (responder ou confirmar); TI = fila. */
function SeloMenu({ i, numeros, tecnico }: { i: Item; numeros: Numeros | null; tecnico: boolean }) {
  const n = !numeros ? 0 : tecnico ? (i.para === "/ti" ? numeros.fila : 0) : i.para === "/" ? numeros.precisaDeVoce : 0;
  if (!n) return null;
  const alerta = tecnico && !!numeros?.atrasados;
  return (
    <span
      className={`absolute -top-1 right-1 grid min-w-5 place-items-center rounded-full px-1 text-[11px] leading-5 font-bold text-white ${alerta ? "bg-brasa" : "bg-mar-700"}`}
      aria-label={tecnico ? `${n} na fila` : `${n} precisa(m) de você`}
    >
      {n}
    </span>
  );
}

/** Menu que sobe do ícone "Fila" (celular): as visões rápidas, com os números. */
function MenuVisoes({ numeros, atual, aoEscolher, aoFechar }: {
  numeros: Numeros | null;
  atual: string | null;
  aoEscolher: (v: string) => void;
  aoFechar: () => void;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fora = (e: PointerEvent) => { if (!caixa.current?.parentElement?.contains(e.target as Node)) aoFechar(); };
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    document.addEventListener("pointerdown", fora);
    window.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("pointerdown", fora); window.removeEventListener("keydown", tecla); };
  }, [aoFechar]);
  const opcoes = [{ id: "", rotulo: "Fila completa", Icone: ListOrdered, total: numeros?.fila }, ...VISOES.map((v) => ({ id: v.id as string, rotulo: v.rotulo as string, Icone: v.Icone, total: numeros?.[v.id] }))];
  return (
    <div
      ref={caixa}
      role="menu"
      aria-label="Visões da fila"
      className="absolute bottom-full left-2 mb-2 w-60 overflow-hidden rounded-2xl bg-superficie p-1.5 shadow-2xl ring-1 ring-linha"
    >
      {opcoes.map((o) => {
        const ativo = (atual ?? "") === o.id;
        return (
          <Link
            key={o.id || "tudo"}
            to={o.id ? `/ti?visao=${o.id}` : "/ti"}
            role="menuitem"
            aria-current={ativo ? "true" : undefined}
            onClick={(e) => { e.preventDefault(); aoEscolher(o.id); }}
            className={`flex min-h-12 items-center gap-3 rounded-xl px-3 font-semibold ${ativo ? "bg-mar-50 text-acento" : "text-tinta hover:bg-fundo"}`}
          >
            <o.Icone className="size-5 shrink-0" aria-hidden="true" />
            <span className="flex-1">{o.rotulo}</span>
            {o.total !== undefined && <span className="font-display text-tinta-2">{o.total}</span>}
          </Link>
        );
      })}
    </div>
  );
}
