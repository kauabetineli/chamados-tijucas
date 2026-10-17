import { AlertTriangle, ChevronDown, Clock, GripVertical, Hourglass, MoreVertical, User, Wrench } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type DragEvent, type MouseEvent as ME, type PointerEvent as PE, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Avatar, SeloLivre } from "../../components/Avatar";
import { Bloco, EsqueletoCartoes } from "../../components/Esqueleto";
import { IconeCategoria } from "../../components/Icone";
import { MuralAvisos } from "../../components/MuralAvisos";
import { MenuAcoes } from "../../components/MenuAcoes";
import { MenuAtribuir } from "../../components/MenuAtribuir";
import { Paginacao, usePaginacao } from "../../components/Paginacao";
import { VisaoTI } from "../../components/VisaoTI";
import { COR_PRIORIDADE, PilulaPrioridade, SeloTeste } from "../../components/Selos";
import { useAuth } from "../../lib/auth";
import { atribuir, useTecnicos } from "../../lib/equipe";
import { atrasado, cargaDaEquipe, esperaCurta, horasEsperando, organizarFila } from "../../lib/fila";
import { paraData, resumo, ROTULO_AGUARDANDO, ROTULO_ORIGEM } from "../../lib/formato";
import { EXPAND_CHAMADO, mensagemErro, nomeSolicitante, pb, type Chamado, type Usuario } from "../../lib/pb";
import { useRealtime } from "../../lib/useRealtime";
import { ehVisao, VISOES, type Visao } from "../../lib/numeros";
import { LinkChamado, useVerChamado } from "../../lib/verChamado";
import { avisar } from "../../lib/avisos";

const TIPO_ARRASTE = "application/x-dinodesk-chamado";
const horasDesde = (s: string) => (Date.now() - (paraData(s)?.getTime() ?? Date.now())) / 3_600_000;
const primeiroNome = (n?: string) => (n || "").trim().split(/\s+/)[0] || "Técnico";

/**
 * Linha de detalhes do cartão (3ª linha): categoria · setor · espera, e os selos no fim.
 * Nunca quebra: se faltar espaço, categoria e setor encurtam com "…".
 */
function Detalhes({ c }: { c: Chamado }) {
  const late = atrasado(c);
  return (
    <div className="mt-1 flex min-w-0 items-center gap-2 text-sm whitespace-nowrap text-tinta-2">
      {/* no celular, só o ícone da categoria: sobra espaço para o setor */}
      <span className="inline-flex min-w-0 shrink-0 items-center gap-1 sm:shrink" title={c.expand?.categoria?.nome}>
        <IconeCategoria nome={c.expand?.categoria?.icone} className="size-4 shrink-0 text-acento" />
        <span className="sr-only truncate sm:not-sr-only">{c.expand?.categoria?.nome}</span>
      </span>
      {c.expand?.setor?.nome && (
        <>
          <span aria-hidden="true">·</span>
          <span className="min-w-0 truncate">{c.expand.setor.nome}</span>
        </>
      )}
      {c.status === "aberto" && (
        <span className={`inline-flex shrink-0 items-center gap-1 ${late ? "font-semibold text-alerta" : ""}`}>
          <span aria-hidden="true" className="font-normal text-tinta-2">·</span>
          {late ? <AlertTriangle className="size-4" aria-hidden="true" /> : <Clock className="size-4" aria-hidden="true" />}
          {late ? "atrasado " : "há "}{esperaCurta(horasEsperando(c))}
        </span>
      )}
      {c.status === "em_andamento" && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sol-50 px-2 py-0.5 text-xs font-semibold text-tinta ring-1 ring-sol">
          <Wrench className="size-3.5" aria-hidden="true" /> atendendo
        </span>
      )}
      {c.status === "aguardando" && (
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-fundo px-2 py-0.5 text-xs font-semibold text-tinta ring-1 ring-linha"
          title={c.aguardando_motivo ? `Aguardando ${ROTULO_AGUARDANDO[c.aguardando_motivo]}` : "Em espera"}
        >
          <Hourglass className="size-3.5" aria-hidden="true" />
          {c.aguardando_motivo === "peca" ? "peça" : c.aguardando_motivo === "solicitante" ? "resposta" : c.aguardando_motivo === "terceiro" ? "terceiro" : "em espera"}
          {paraData(c.aguardando_desde || "") && <span className="font-normal text-tinta-2">· {esperaCurta(horasDesde(c.aguardando_desde!))}</span>}
        </span>
      )}
      {c.ficticio && <span className="ml-auto shrink-0"><SeloTeste ficticio compacto /></span>}
    </div>
  );
}

/** Botão com o dono atual ("Livre", "você", "Felipe"); toque abre o menu de atribuir. */
function BotaoDono({ c, eu, aoAbrir, compacto }: { c: Chamado; eu: string; aoAbrir: () => void; compacto?: boolean }) {
  const dono = c.expand?.responsavel;
  const rotulo = !c.responsavel ? "Livre" : c.responsavel === eu ? "Você" : primeiroNome(dono?.name);
  return (
    <button
      type="button"
      onClick={aoAbrir}
      className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full py-1 pr-2 pl-1 hover:bg-mar-50"
      aria-label={`Atribuir ${c.protocolo}. Agora: ${rotulo}`}
    >
      {c.responsavel ? (
        <Avatar id={c.responsavel} nome={dono?.name} tamanho="sm" destaque={c.responsavel === eu} />
      ) : compacto ? (
        // celular: círculo tracejado no lugar do selo, para sobrar espaço para o texto
        <>
          <span className="size-7 rounded-full border-2 border-dashed border-tinta-2/50 sm:hidden" aria-hidden="true" />
          <span className="hidden sm:inline-flex"><SeloLivre /></span>
        </>
      ) : <SeloLivre />}
      {c.responsavel && <span className={`text-sm font-semibold ${compacto ? "hidden sm:inline" : ""}`}>{rotulo}</span>}
    </button>
  );
}

/** "⋯": ações rápidas do chamado. */
function BotaoMais({ c, aoAbrir }: { c: Chamado; aoAbrir: () => void }) {
  return (
    <button
      type="button"
      onClick={aoAbrir}
      className="grid size-11 shrink-0 place-items-center rounded-full text-tinta-2 hover:bg-mar-50 hover:text-tinta"
      aria-label={`Ações do ${c.protocolo}`}
    >
      <MoreVertical className="size-5" />
    </button>
  );
}

/**
 * Segurar o dedo ~0,5 s no cartão abre as ações (como nos apps). Rolar a tela cancela.
 * Depois de abrir pelo "segurar", o toque não navega para o chamado.
 */
function useSegurar(aoSegurar: () => void) {
  const espera = useRef<{ t: number; x: number; y: number } | null>(null);
  const disparou = useRef(false);
  const cancelar = () => {
    if (espera.current) window.clearTimeout(espera.current.t);
    espera.current = null;
  };
  return {
    onPointerDown: (e: PE) => {
      if (e.pointerType !== "touch") return;
      disparou.current = false;
      const { clientX: x, clientY: y } = e;
      espera.current = {
        x, y,
        t: window.setTimeout(() => {
          disparou.current = true;
          espera.current = null;
          navigator.vibrate?.(15);
          aoSegurar();
        }, 450),
      };
    },
    onPointerMove: (e: PE) => {
      const s = espera.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) cancelar();
    },
    onPointerUp: cancelar,
    onPointerCancel: cancelar,
    onClickCapture: (e: ME) => {
      if (disparou.current) { e.preventDefault(); e.stopPropagation(); disparou.current = false; }
    },
  };
}

/** Faixa da equipe: quantos chamados cada um tem. Toque filtra; no PC, solte um chamado aqui para atribuir. */
function FaixaEquipe({ tecnicos, eu, carga, livres, filtro, aoFiltrar, arrastando, aoSoltar }: {
  tecnicos: Usuario[];
  eu: string;
  carga: Record<string, number>;
  livres: number;
  filtro: string;
  aoFiltrar: (f: string) => void;
  arrastando: boolean;
  aoSoltar: (tecnicoId: string, chamadoId: string) => void;
}) {
  const [sobre, setSobre] = useState("");
  const alvo = (id: string) => ({
    onDragOver: (e: DragEvent) => { if (e.dataTransfer.types.includes(TIPO_ARRASTE)) { e.preventDefault(); setSobre(id); } },
    onDragLeave: () => setSobre(""),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setSobre("");
      const chamado = e.dataTransfer.getData(TIPO_ARRASTE);
      if (chamado) aoSoltar(id === "livres" ? "" : id, chamado);
    },
  });
  const chip = (id: string, ativo: boolean) =>
    `flex min-h-12 shrink-0 items-center gap-2 rounded-full py-1.5 pr-4 pl-1.5 font-semibold ring-1 ${
      sobre === id ? "bg-mar-700 text-white ring-acento scale-105" :
      ativo ? "bg-mar-50 ring-2 ring-acento" :
      arrastando ? "bg-superficie ring-2 ring-dashed ring-acento/60" : "bg-superficie ring-linha hover:ring-acento"
    }`;
  const ordem = [...tecnicos].sort((a, b) => (a.id === eu ? -1 : b.id === eu ? 1 : 0));

  return (
    <div className={`sticky top-[70px] z-10 -mx-4 px-4 md:top-0 md:-mx-8 md:px-8 py-2 backdrop-blur ${arrastando ? "bg-mar-50/95" : "bg-fundo/95"}`}>
      <p className={`mb-1.5 text-sm font-semibold ${arrastando ? "text-acento" : "text-tinta-2"}`}>
        {arrastando ? "Solte na pessoa para atribuir" : "Equipe"}
      </p>
      <div className="-mx-1.5 -my-1 flex gap-2 overflow-x-auto px-1.5 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Chamados por técnico">
        {ordem.map((t) => (
          <button
            key={t.id}
            type="button"
            className={chip(t.id, filtro === t.id)}
            aria-pressed={filtro === t.id}
            onClick={() => aoFiltrar(filtro === t.id ? "" : t.id)}
            {...alvo(t.id)}
          >
            <Avatar id={t.id} nome={t.name} tamanho="sm" destaque={t.id === eu} />
            {t.id === eu ? "Você" : primeiroNome(t.name)}
            <span className="font-display text-lg">{carga[t.id] ?? 0}</span>
          </button>
        ))}
        <button
          type="button"
          className={chip("livres", filtro === "livres")}
          aria-pressed={filtro === "livres"}
          onClick={() => aoFiltrar(filtro === "livres" ? "" : "livres")}
          {...alvo("livres")}
        >
          <span className="grid size-7 place-items-center rounded-full border-2 border-dashed border-tinta-2/50" aria-hidden="true" />
          Livres
          <span className="font-display text-lg">{livres}</span>
        </button>
      </div>
    </div>
  );
}

/** Cartão de chamado na fila. No PC dá para arrastar (alça à esquerda) até alguém da equipe. */
function Cartao({ c, eu, posicao, destaque, realcado, selecionado, aoAtribuir, aoAcoes, arrastavel, aoArrastar }: {
  c: Chamado;
  realcado?: boolean;
  /** aberto no painel de baixo */
  selecionado?: boolean;
  eu: string;
  posicao?: number;
  destaque?: boolean;
  aoAtribuir: () => void;
  aoAcoes: () => void;
  arrastavel: boolean;
  aoArrastar: (id: string) => void;
}) {
  const segurar = useSegurar(aoAcoes);
  return (
    <li
      id={`chamado-${c.id}`}
      {...segurar}
      draggable={arrastavel}
      onDragStart={(e) => { e.dataTransfer.setData(TIPO_ARRASTE, c.id); e.dataTransfer.effectAllowed = "move"; aoArrastar(c.id); }}
      onDragEnd={() => aoArrastar("")}
      className={`group flex items-stretch overflow-hidden rounded-xl ring-1 hover:ring-acento ${destaque ? "bg-sol-50 ring-sol" : "bg-superficie ring-linha"} ${selecionado ? "ring-2 ring-acento" : ""} ${realcado ? "animar-realce" : ""}`}
    >
      <span className={`w-1.5 shrink-0 ${COR_PRIORIDADE[c.prioridade]}`} aria-hidden="true" />
      {arrastavel && (
        <span className="hidden w-5 shrink-0 cursor-grab items-center justify-center text-tinta-2/40 group-hover:text-tinta-2 md:flex" aria-hidden="true">
          <GripVertical className="size-4" />
        </span>
      )}
      {posicao !== undefined && (
        <span className="grid w-11 shrink-0 place-items-center font-display text-xl font-bold text-tinta-2" aria-label={`${posicao}º da fila`}>
          {posicao}º
        </span>
      )}
      <LinkChamado id={c.id} para={`/ti/chamado/${c.id}`} draggable={false} className={`min-w-0 flex-1 py-3 ${posicao === undefined ? "pl-3" : ""}`}>
        {/* 1: identidade (nunca quebra) · 2: o problema · 3: detalhes */}
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span className="font-display text-base font-bold">{c.protocolo}</span>
          <PilulaPrioridade prioridade={c.prioridade} />
        </div>
        <p className="mt-1 truncate font-semibold">{resumo(c.descricao, 140)}</p>
        <Detalhes c={c} />
      </LinkChamado>
      <div className="flex items-center pr-1.5 pl-1">
        <BotaoDono c={c} eu={eu} aoAbrir={aoAtribuir} compacto />
        <BotaoMais c={c} aoAbrir={aoAcoes} />
      </div>
    </li>
  );
}

/** O próximo chamado livre, em destaque, com começar e atribuir. */
function Proximo({ c, eu, posicao, aoComecar, aoAtribuir, aoAcoes, ocupado, realcado }: { c: Chamado; eu: string; posicao: number; aoComecar: () => void; aoAtribuir: () => void; aoAcoes: () => void; ocupado: boolean; realcado?: boolean }) {
  const meu = c.responsavel === eu;
  return (
    <section id={`chamado-${c.id}`} aria-labelledby="titulo-proximo" className={`overflow-hidden rounded-2xl bg-superficie ring-2 ring-acento ${realcado ? "animar-realce" : ""}`}>
      <div className={`h-2 ${COR_PRIORIDADE[c.prioridade]}`} aria-hidden="true" />
      <div className="p-5 md:p-6">
        {/* título e dono à esquerda (podem quebrar linha); "⋮" sempre fixo no canto direito */}
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2 pt-2">
            <p id="titulo-proximo" className="text-sm font-bold tracking-wider text-acento uppercase">
              Seu próximo{posicao > 1 && <span className="font-semibold text-tinta-2 normal-case" title="Os de cima estão com colegas"> · {posicao}º da fila</span>}
            </p>
            {meu ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap">
                <Avatar id={eu} nome={c.expand?.responsavel?.name} tamanho="sm" destaque /> Passado para você
              </span>
            ) : <SeloLivre />}
          </div>
          <div className="-mt-1 -mr-3"><BotaoMais c={c} aoAbrir={aoAcoes} /></div>
        </div>
        {/* mesmo desenho dos cartões da fila, em tamanho maior */}
        <div className="mt-2 flex items-center gap-2 whitespace-nowrap">
          <span className="font-display text-2xl font-extrabold">{c.protocolo}</span>
          <PilulaPrioridade prioridade={c.prioridade} />
        </div>
        <p className="mt-2 text-lg leading-snug">{resumo(c.descricao, 220)}</p>
        <Detalhes c={c} />
        <p className="mt-1 flex min-w-0 items-center gap-1 text-sm whitespace-nowrap text-tinta-2">
          <User className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{nomeSolicitante(c)}{c.origem !== "sistema" ? ` · chegou por ${ROTULO_ORIGEM[c.origem]}` : ""}</span>
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button type="button" className="btn-primario flex-1 text-lg" onClick={aoComecar} disabled={ocupado}>
            <Wrench className="size-5" aria-hidden="true" />
            {ocupado ? "Pegando..." : "Começar atendimento"}
          </button>
          <button type="button" className="btn-secundario" onClick={aoAtribuir}>
            Passar para alguém <ChevronDown className="size-4" aria-hidden="true" />
          </button>
          <LinkChamado id={c.id} para={`/ti/chamado/${c.id}`} className="btn px-3 text-tinta-2 hover:text-tinta">Ver detalhes</LinkChamado>
        </div>
      </div>
    </section>
  );
}

function Secao({ titulo, total, children }: { titulo: string; total: number; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-baseline gap-2 text-lg font-bold">
        {titulo} <span className="font-display text-base text-tinta-2">{total}</span>
      </h2>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}

/**
 * Fila do técnico, organizada pela pergunta "o que eu faço agora?":
 * faixa da equipe (carga de cada um, filtro e alvo para arrastar), o que estou atendendo,
 * o MEU PRÓXIMO (primeiro da fila que é meu ou livre), o resto da fila numerado
 * (os meus destacados). O que já está com um colega NÃO aparece sem filtro: fica na fila dele (toque no nome na Equipe).
 * Cada cartão mostra o dono; tocar nele atribui (eu, colega ou de volta para a fila).
 */
export function Fila() {
  const { usuario } = useAuth();
  const eu = usuario?.id ?? "";
  const navegar = useNavigate();
  const tecnicos = useTecnicos();
  const [chamados, setChamados] = useState<Chamado[] | null>(null);
  const [pegando, setPegando] = useState("");
  const [filtro, setFiltro] = useState("");
  // visão rápida (/ti?visao=atendendo|livres|espera): barra lateral, abas do celular e menu do ícone Fila
  const [params, setParams] = useSearchParams();
  const visao: Visao | null = ehVisao(params.get("visao")) ? (params.get("visao") as Visao) : null;
  function irParaVisao(v: Visao | null) {
    const p = new URLSearchParams(params);
    if (v) p.set("visao", v); else p.delete("visao");
    setParams(p);
    setFiltro("");
    pag.voltarAoInicio();
  }
  // filtro por colega (faixa Equipe) e visão não se misturam: escolher um desliga o outro
  useEffect(() => { if (visao) setFiltro(""); }, [visao]);
  const [menu, setMenu] = useState<Chamado | null>(null);
  const [acoes, setAcoes] = useState<Chamado | null>(null);
  const [arrastando, setArrastando] = useState("");
  // cartão que acabou de mudar: a tela rola até ele e ele pisca (prioridade nova = lugar novo na fila)
  const [realce, setRealce] = useState("");
  const { aberto: verId } = useVerChamado();
  // a fila precisa de todos os chamados em aberto (posição, contagem da equipe);
  // a lista "Depois na fila" é mostrada em páginas para a tela não ficar enorme
  const pag = usePaginacao("fila", 10);
  const [, setTique] = useState(0);
  const podeArrastar = typeof window !== "undefined" && !!window.matchMedia?.("(pointer: fine)").matches;

  const carregar = useCallback(async () => {
    const lista = await pb.collection("chamados").getFullList<Chamado>({
      filter: 'status != "resolvido"',
      sort: "-peso,created", // a mesma ordem da senha que o servidor vê
      expand: EXPAND_CHAMADO,
    });
    setChamados(lista);
  }, []);

  useEffect(() => { carregar().catch(() => setChamados([])); }, [carregar]);
  useRealtime("chamados", () => carregar().catch(() => {}));
  useEffect(() => {
    const t = window.setInterval(() => setTique((n) => n + 1), 60_000); // atualiza "esperando há"
    return () => window.clearInterval(t);
  }, []);

  const lista = chamados ?? [];
  const { atendendo, comOutros, esperando, fila, proximo, depois: depoisTodos } = organizarFila(lista, eu);
  // sem filtro, a fila mostra só o que é meu ou está livre: o que já está com um colega fica na fila DELE
  // (para ver, toque no nome dele na faixa da Equipe). A posição (1º, 2º...) continua a da fila geral.
  const depois = depoisTodos.filter((c) => !c.responsavel || c.responsavel === eu);
  const comColegas = depoisTodos.length - depois.length + comOutros.length
    + lista.filter((c) => c.status === "aguardando" && c.responsavel && c.responsavel !== eu).length;
  const { carga, livres } = cargaDaEquipe(lista);
  const atrasados = fila.filter((c) => atrasado(c)).length;
  const posicao = (c: Chamado) => (c.status === "aberto" ? fila.indexOf(c) + 1 : undefined);

  useEffect(() => {
    document.title = fila.length ? `(${fila.length}) Fila | Dino Desk` : "Fila | Dino Desk";
    return () => { document.title = "Dino Desk"; };
  }, [fila.length]);

  async function comecar(c: Chamado) {
    setPegando(c.id);
    try {
      // outro técnico pode ter pegado no mesmo instante
      const atual = await pb.collection("chamados").getOne<Chamado>(c.id);
      if (atual.status !== "aberto" || (atual.responsavel && atual.responsavel !== eu)) {
        avisar(`O ${c.protocolo} acabou de ser pego por outro técnico. A fila foi atualizada.`, { tipo: "info" });
        await carregar();
        return;
      }
      await pb.collection("chamados").update(c.id, { status: "em_andamento", responsavel: eu });
      navegar(`/ti/chamado/${c.id}`);
    } catch (err) {
      avisar(mensagemErro(err), { tipo: "erro" });
    } finally {
      setPegando("");
    }
  }

  function depoisDeSalvar(msg: string, id: string) {
    avisar(msg);
    carregar().then(() => setRealce(id)).catch(() => {});
  }

  useEffect(() => {
    if (!realce) return;
    const el = document.getElementById(`chamado-${realce}`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const t = window.setTimeout(() => setRealce(""), 2400);
    return () => window.clearTimeout(t);
  }, [realce]);

  async function soltar(tecnicoId: string, chamadoId: string) {
    setArrastando("");
    const c = lista.find((x) => x.id === chamadoId);
    if (!c || c.responsavel === tecnicoId) return;
    try {
      await atribuir(c, tecnicoId);
      const nome = tecnicoId === eu ? "você" : primeiroNome(tecnicos.find((t) => t.id === tecnicoId)?.name);
      avisar(tecnicoId ? `${c.protocolo} agora está com ${nome}.` : `${c.protocolo} voltou para a fila.`);
      await carregar();
      setRealce(c.id);
    } catch (err) {
      avisar(mensagemErro(err), { tipo: "erro" });
    }
  }

  const cartao = (c: Chamado, destaque = false) => (
    <Cartao
      key={c.id}
      c={c}
      eu={eu}
      posicao={posicao(c)}
      destaque={destaque}
      realcado={realce === c.id}
      selecionado={verId === c.id}
      aoAtribuir={() => setMenu(c)}
      aoAcoes={() => setAcoes(c)}
      arrastavel={podeArrastar}
      aoArrastar={setArrastando}
    />
  );

  // visão filtrada (toque num técnico ou em "Livres" na faixa da equipe)
  const filtrados = filtro === "livres"
    ? fila.filter((c) => !c.responsavel)
    : filtro
      ? [
          ...lista.filter((c) => c.status === "em_andamento" && c.responsavel === filtro),
          ...fila.filter((c) => c.responsavel === filtro),
          ...lista.filter((c) => c.status === "aguardando" && c.responsavel === filtro),
        ]
      : [];
  // se a lista encolheu (chamado saiu da fila), fica na última página que existe
  const fatia = <T,>(l: T[]) => {
    if (pag.porPagina === 0) return l;
    const p = Math.min(pag.pagina, Math.max(1, Math.ceil(l.length / pag.porPagina)));
    return l.slice((p - 1) * pag.porPagina, p * pag.porPagina);
  };
  // listas das visões
  const livresFila = fila.filter((c) => !c.responsavel);
  const ordemEspera = { solicitante: 0, peca: 1, terceiro: 2 } as const;
  const esperaOrdenada = [...esperando].sort((a, b) =>
    (ordemEspera[a.aguardando_motivo || "terceiro"] - ordemEspera[b.aguardando_motivo || "terceiro"])
    || (a.aguardando_desde || "").localeCompare(b.aguardando_desde || ""));
  const listaVisao = visao === "atendendo" ? atendendo : visao === "livres" ? livresFila : visao === "espera" ? esperaOrdenada : [];
  const totalVisao: Record<Visao, number> = { atendendo: atendendo.length, livres: livresFila.length, espera: esperando.length };
  const listaPaginada = visao ? listaVisao : filtro ? filtrados : depois;
  const rodape = listaPaginada.length > 10 && (
    <Paginacao
      pagina={Math.min(pag.pagina, Math.max(1, Math.ceil(listaPaginada.length / (pag.porPagina || 1))))}
      porPagina={pag.porPagina}
      total={listaPaginada.length}
      aoMudarPagina={pag.setPagina}
      aoMudarPorPagina={pag.setPorPagina}
      rotulo="chamados"
    />
  );
  const nomeFiltro = filtro === "livres" ? "Livres" : filtro === eu ? "Com você" : `Com ${primeiroNome(tecnicos.find((t) => t.id === filtro)?.name)}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-3xl font-bold">Fila</h1>
        {chamados === null ? <Bloco className="mt-2 h-6 w-64" /> : <p className="mt-1 flex flex-wrap gap-x-4 text-tinta-2">
          <span><b className="font-display text-xl text-tinta">{fila.length}</b> aguardando</span>
          {atrasados > 0 && (
            <span className="font-semibold text-alerta"><b className="font-display text-xl">{atrasados}</b> {atrasados === 1 ? "atrasado" : "atrasados"}</span>
          )}
          <span><b className="font-display text-xl text-tinta">{atendendo.length + comOutros.length}</b> em atendimento</span>
          {esperando.length > 0 && <span><b className="font-display text-xl text-tinta">{esperando.length}</b> seus em espera</span>}
        </p>}
      </div>
      <VisaoTI />
      </div>

      {/* celular: abas das visões (no PC elas ficam na barra lateral) */}
      <div role="tablist" aria-label="Visões da fila" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:hidden">
        {[{ id: null, rotulo: "Tudo", Icone: null }, ...VISOES].map((v) => {
          const ativa = visao === v.id;
          return (
            <button
              key={v.id ?? "tudo"}
              type="button"
              role="tab"
              aria-selected={ativa}
              // a aba escolhida fica à vista (sem rolar a página: só a faixa)
              ref={(el) => { if (ativa && el?.parentElement) el.parentElement.scrollLeft = el.offsetLeft - 16; }}
              onClick={() => irParaVisao(v.id as Visao | null)}
              className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold ring-1 ${
                ativa ? "bg-mar-700 text-white ring-transparent" : "bg-superficie text-tinta-2 ring-linha"
              }`}
            >
              {v.Icone && <v.Icone className="size-4" aria-hidden="true" />}
              {v.rotulo}
              {v.id && chamados !== null && <span className="font-display">{totalVisao[v.id as Visao]}</span>}
            </button>
          );
        })}
      </div>

      {/* no PC o mural fica na barra lateral */}
      <MuralAvisos className="md:hidden" />

      {tecnicos.length > 0 && chamados !== null && (
        <FaixaEquipe
          tecnicos={tecnicos}
          eu={eu}
          carga={carga}
          livres={livres}
          filtro={filtro}
          aoFiltrar={(f) => {
            if (visao) { const p = new URLSearchParams(params); p.delete("visao"); setParams(p); }
            setFiltro(f);
            pag.voltarAoInicio();
          }}
          arrastando={!!arrastando}
          aoSoltar={soltar}
        />
      )}


      {chamados === null ? (
        <EsqueletoCartoes quantos={5} rotulo="Carregando a fila..." />
      ) : visao ? (
        <>
          <Secao titulo={VISOES.find((v) => v.id === visao)!.rotulo} total={listaVisao.length}>
            {visao === "espera" && listaVisao.length > 0 && (
              <li className="-mt-1 text-sm text-tinta-2">Fora da fila e da sua carga. "Resposta" volta sozinho quando a pessoa responder.</li>
            )}
            {visao === "livres" && listaVisao.length > 0 && (
              <li className="-mt-1 text-sm text-tinta-2">Sem responsável, na ordem da fila (prioridade, depois chegada).</li>
            )}
            {listaVisao.length
              ? fatia(listaVisao).map((c) => cartao(c, visao === "atendendo"))
              : <li className="rounded-2xl bg-superficie p-6 text-center text-tinta-2 ring-1 ring-linha">{VISOES.find((v) => v.id === visao)!.vazio}</li>}
          </Secao>
          {rodape}
        </>
      ) : filtro ? (
        <>
          <Secao titulo={nomeFiltro} total={filtrados.length}>
            {filtrados.length ? fatia(filtrados).map((c) => cartao(c, c.status === "em_andamento" && c.responsavel === eu)) : <li className="text-tinta-2">Nenhum chamado aqui.</li>}
          </Secao>
          {rodape}
        </>
      ) : (
        <>
          {atendendo.length > 0 && <Secao titulo="Você está atendendo" total={atendendo.length}>{atendendo.map((c) => cartao(c, true))}</Secao>}

          {proximo ? (
            <Proximo c={proximo} eu={eu} posicao={fila.indexOf(proximo) + 1} aoComecar={() => comecar(proximo)} aoAtribuir={() => setMenu(proximo)} aoAcoes={() => setAcoes(proximo)} ocupado={pegando === proximo.id} realcado={realce === proximo.id} />
          ) : (
            <div className="rounded-2xl bg-superficie p-8 text-center ring-1 ring-linha">
              <p className="text-xl font-bold">Nada esperando por você na fila.</p>
              <p className="mt-1 text-tinta-2">
                Pedido chegou pelo WhatsApp, por ligação ou no corredor?{" "}
                <Link to="/ti/registrar" className="font-semibold text-acento underline underline-offset-4">Registre aqui</Link>.
              </p>
            </div>
          )}

          {depois.length > 0 && <Secao titulo="Depois na fila" total={depois.length}>{fatia(depois).map((c) => cartao(c, c.responsavel === eu))}</Secao>}
          {!filtro && rodape}
          {esperando.length > 0 && (
            <Secao titulo="Seus em espera" total={esperando.length}>
              <li className="-mt-1 text-sm text-tinta-2">Fora da fila e da sua carga. Retome quando chegar o que falta.</li>
              {esperando.map((c) => cartao(c))}
            </Secao>
          )}
          {comColegas > 0 && (
            <p className="rounded-xl border-2 border-dashed border-linha px-4 py-3 text-sm text-tinta-2">
              <b className="font-display text-base text-tinta">{comColegas}</b> {comColegas === 1 ? "chamado está" : "chamados estão"} com colegas
              (na fila, em atendimento ou em espera) e não aparecem aqui. Para ver, toque no nome da pessoa em <b>Equipe</b>, lá em cima.
            </p>
          )}
        </>
      )}

      {acoes && (
        <MenuAcoes
          chamado={acoes}
          eu={eu}
          tecnicos={tecnicos}
          carga={carga}
          aoFechar={() => setAcoes(null)}
          aoSalvo={depoisDeSalvar}
        />
      )}

      {menu && (
        <MenuAtribuir
          chamado={menu}
          tecnicos={tecnicos}
          eu={eu}
          carga={carga}
          aoFechar={() => setMenu(null)}
          aoAtribuir={depoisDeSalvar}
        />
      )}
    </div>
  );
}
