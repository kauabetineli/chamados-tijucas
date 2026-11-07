import { CabecalhoPagina } from "../../components/CabecalhoPagina";
import { ChevronDown, ChevronRight, GripVertical, MessageCircle, MoreVertical, Table2, Users, Wrench } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type DragEvent, type MouseEvent as ME, type PointerEvent as PE, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Avatar } from "../../components/Avatar";
import { Espera } from "../../components/Espera";
import { Bloco, EsqueletoCartoes } from "../../components/Esqueleto";
import { IconeCategoria } from "../../components/Icone";
import { MuralAvisos } from "../../components/MuralAvisos";
import { MenuAcoes } from "../../components/MenuAcoes";
import { MenuAtribuir } from "../../components/MenuAtribuir";
import { Paginacao, usePaginacao } from "../../components/Paginacao";
import { VisaoTI } from "../../components/VisaoTI";
import { EtiquetaPrioridade, MarcaTeste } from "../../components/Selos";
import { useAuth } from "../../lib/auth";
import { atribuir, useTecnicos } from "../../lib/equipe";
import { textoMinutos, useConfigTI } from "../../lib/configTI";
import { atrasado, cargaDaEquipe, organizarFila } from "../../lib/fila";
import { resumo, ROTULO_AGUARDANDO, ROTULO_ORIGEM, ROTULO_PRIORIDADE } from "../../lib/formato";
import { EXPAND_CHAMADO, mensagemErro, nomeSolicitante, pb, type Chamado, type Usuario } from "../../lib/pb";
import { useRealtime } from "../../lib/useRealtime";
import { ultimaVisita } from "../../lib/visto";
import { ehVisao, VISOES, type Visao } from "../../lib/numeros";
import { LinkChamado, useVerChamado } from "../../lib/verChamado";
import { avisar } from "../../lib/avisos";

const TIPO_ARRASTE = "application/x-dinodesk-chamado";
const primeiroNome = (n?: string) => (n || "").trim().split(/\s+/)[0] || "Técnico";

/** Marca "escolhida por quem pediu" na etiqueta de prioridade, se o administrador ligou essa opção. */
function useEscolhida() {
  const { config } = useConfigTI();
  return (c: Chamado) => (config.marcar_escolhida && c.prioridade_escolhida ? { motivo: c.motivo_urgencia } : false);
}

/** Tipo do problema: ícone da categoria num quadrado, sempre à esquerda (reconhece antes de ler). */
function TipoCategoria({ c, grande }: { c: Chamado; grande?: boolean }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-xl bg-mar-50 text-acento ${grande ? "size-11" : "size-10"}`} title={c.expand?.categoria?.nome}>
      <IconeCategoria nome={c.expand?.categoria?.icone} className={grande ? "size-6" : "size-5"} />
    </span>
  );
}

/** Linha de apoio: onde e quem; o protocolo por último, menor. No celular entra o setor (no PC ele tem coluna). */
/** Quem pediu escreveu depois da última vez que você abriu o chamado (neste aparelho). */
function NovaMensagem() {
  return (
    <span className="font-semibold text-acento">
      <MessageCircle className="inline size-3.5 align-[-2px]" aria-hidden="true" /> Nova mensagem ·{" "}
    </span>
  );
}

function LinhaApoio({ c, posicao, novaMensagem }: { c: Chamado; posicao?: number; novaMensagem?: boolean }) {
  const setor = c.expand?.setor?.nome;
  const partes = [
    posicao ? `${posicao}º` : "",
    c.status === "aguardando" ? `Aguardando ${c.aguardando_motivo ? ROTULO_AGUARDANDO[c.aguardando_motivo] : "algo"}` : "",
  ].filter(Boolean);
  return (
    <p className="mt-0.5 truncate text-sm text-tinta-2">
      {novaMensagem && <NovaMensagem />}
      {partes.map((t) => <span key={t}>{t} · </span>)}
      {/* celular: setor; PC (lg+): categoria, porque o setor tem coluna própria */}
      {setor && <span className="lg:hidden">{setor} · </span>}
      <span className="hidden lg:inline">{c.expand?.categoria?.nome ?? "Sem categoria"} · </span>
      {nomeSolicitante(c)} · <span className="tabular-nums">{c.protocolo}</span> <MarcaTeste ficticio={c.ficticio} />
    </p>
  );
}

/** Com quem está: avatar (livre = círculo tracejado); no PC o nome ao lado. Toque abre o menu de atribuir. */
function BotaoDono({ c, eu, aoAbrir, comNome }: { c: Chamado; eu: string; aoAbrir: () => void; comNome?: boolean }) {
  const dono = c.expand?.responsavel;
  const rotulo = !c.responsavel ? "Livre" : c.responsavel === eu ? "Você" : primeiroNome(dono?.name);
  return (
    <button
      type="button"
      onClick={aoAbrir}
      className="flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-full px-1 hover:bg-mar-50"
      aria-label={`Atribuir ${c.protocolo}. Agora: ${rotulo}`}
      title={`Com quem está: ${rotulo}. Toque para passar.`}
    >
      {c.responsavel
        ? <Avatar id={c.responsavel} nome={dono?.name} tamanho="sm" destaque={c.responsavel === eu} />
        : <span className="size-7 rounded-full border-2 border-dashed border-tinta-2/50" aria-hidden="true" />}
      {comNome && <span className={`w-20 truncate text-left text-sm font-semibold ${c.responsavel ? "" : "text-tinta-2"}`}>{rotulo}</span>}
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
function FaixaEquipe({ tecnicos, eu, carga, livres, filtro, aoFiltrar, arrastando, aoSoltar, className = "" }: {
  className?: string;
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
    <div className={`sticky top-0 z-10 -mx-4 px-4 md:top-0 md:-mx-8 md:px-8 py-2 backdrop-blur ${arrastando ? "bg-mar-50/95" : "bg-fundo/95"} ${className}`}>
      <p className={`mb-1.5 text-sm font-semibold ${arrastando ? "text-acento" : "text-tinta-2"}`}>
        {arrastando ? "Solte na pessoa para atribuir" : "Equipe"}
      </p>
      <div className="sem-barra -mx-1.5 flex gap-2 overflow-x-auto px-1.5" role="group" aria-label="Chamados por técnico">
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

/**
 * Uma linha da fila (lista enxuta, docs/ARQUITETURA.md "Sinais das listas"):
 * tipo (ícone) · problema (título, com a etiqueta só se for Urgente/Alta) e onde/quem embaixo · espera · com quem.
 * No PC as três últimas viram colunas alinhadas e dá para arrastar a linha (alça à esquerda) até alguém da Equipe.
 */
function Linha({ c, eu, posicao, realcado, selecionado, novaMensagem, aoAtribuir, aoAcoes, arrastavel, aoArrastar }: {
  c: Chamado;
  /** quem pediu respondeu e você ainda não viu */
  novaMensagem?: boolean;
  realcado?: boolean;
  /** aberto no painel de baixo */
  selecionado?: boolean;
  eu: string;
  posicao?: number;
  aoAtribuir: () => void;
  aoAcoes: () => void;
  arrastavel: boolean;
  aoArrastar: (id: string) => void;
}) {
  const escolhida = useEscolhida();
  const segurar = useSegurar(aoAcoes);
  return (
    <li
      id={`chamado-${c.id}`}
      {...segurar}
      draggable={arrastavel}
      onDragStart={(e) => { e.dataTransfer.setData(TIPO_ARRASTE, c.id); e.dataTransfer.effectAllowed = "move"; aoArrastar(c.id); }}
      onDragEnd={() => aoArrastar("")}
      className={`group flex items-center gap-3 py-2 pr-1.5 pl-3 md:pl-2 ${selecionado ? "bg-mar-50" : "hover:bg-fundo"} ${realcado ? "animar-realce" : ""}`}
    >
      {arrastavel && (
        <span className="hidden w-4 shrink-0 cursor-grab justify-center text-tinta-2/0 group-hover:text-tinta-2 md:flex" aria-hidden="true">
          <GripVertical className="size-4" />
        </span>
      )}
      <TipoCategoria c={c} />
      <LinkChamado id={c.id} para={`/ti/chamado/${c.id}`} draggable={false} className="min-w-0 flex-1 py-1">
        <p className="line-clamp-2 leading-snug font-semibold md:line-clamp-1">
          <EtiquetaPrioridade prioridade={c.prioridade} escolhida={escolhida(c)} />{resumo(c.descricao, 140)}
        </p>
        <LinhaApoio c={c} posicao={posicao} novaMensagem={novaMensagem} />
      </LinkChamado>
      {/* PC: colunas */}
      <span className="hidden w-36 shrink-0 truncate text-sm text-tinta-2 lg:block">{c.expand?.setor?.nome ?? "—"}</span>
      <span className="hidden w-24 shrink-0 text-sm text-tinta-2 md:block"><Espera c={c} /></span>
      <span className="hidden md:block"><BotaoDono c={c} eu={eu} aoAbrir={aoAtribuir} comNome /></span>
      <span className="hidden md:block"><BotaoMais c={c} aoAbrir={aoAcoes} /></span>
      {/* celular: espera em cima, com quem embaixo (as ações abrem segurando a linha) */}
      <span className="flex shrink-0 flex-col items-end text-xs text-tinta-2 md:hidden">
        <Espera c={c} />
        <BotaoDono c={c} eu={eu} aoAbrir={aoAtribuir} />
      </span>
    </li>
  );
}

/** O próximo chamado livre (ou passado para mim), em destaque, com começar e passar. */
function Proximo({ c, eu, posicao, aoComecar, aoAtribuir, aoAcoes, ocupado, realcado, novaMensagem }: { c: Chamado; eu: string; posicao: number; aoComecar: () => void; aoAtribuir: () => void; aoAcoes: () => void; ocupado: boolean; realcado?: boolean; novaMensagem?: boolean }) {
  const escolhida = useEscolhida();
  const meu = c.responsavel === eu;
  return (
    <section id={`chamado-${c.id}`} aria-labelledby="titulo-proximo" className={`rounded-2xl bg-superficie p-4 ring-2 ring-acento md:p-5 ${realcado ? "animar-realce" : ""}`}>
      <div className="flex items-start gap-3">
        {/* celular: sem o ícone, o texto do próximo usa a largura toda */}
        <span className="hidden sm:block"><TipoCategoria c={c} grande /></span>
        <div className="min-w-0 flex-1">
          <p id="titulo-proximo" className="flex flex-wrap items-center gap-x-2 text-xs font-bold tracking-wider text-acento uppercase">
            Seu próximo
            {posicao > 1 && <span className="font-semibold tracking-normal text-tinta-2 normal-case" title="Os de cima estão com colegas">· {posicao}º da fila</span>}
            {meu && <span className="font-semibold tracking-normal text-tinta normal-case">· passado para você</span>}
          </p>
          <p className="mt-1 text-lg leading-snug font-semibold"><EtiquetaPrioridade prioridade={c.prioridade} escolhida={escolhida(c)} />{resumo(c.descricao, 220)}</p>
          <p className="mt-1 text-sm text-tinta-2">
            {novaMensagem && <NovaMensagem />}
            {[c.expand?.categoria?.nome, c.expand?.setor?.nome, `${nomeSolicitante(c)}${c.origem !== "sistema" ? `, ${ROTULO_ORIGEM[c.origem].toLowerCase()}` : ""}`, c.protocolo].filter(Boolean).join(" · ")}
            {" · "}<Espera c={c} /> <MarcaTeste ficticio={c.ficticio} />
          </p>
        </div>
        <div className="-mt-1.5 -mr-2"><BotaoMais c={c} aoAbrir={aoAcoes} /></div>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:pl-14">
        <button type="button" className="btn-primario flex-1 sm:flex-none" onClick={aoComecar} disabled={ocupado}>
          <Wrench className="size-5" aria-hidden="true" />
          {ocupado ? "Pegando..." : "Começar atendimento"}
        </button>
        <button type="button" className="btn-secundario" onClick={aoAtribuir}>
          Passar para alguém <ChevronDown className="size-4" aria-hidden="true" />
        </button>
        <LinkChamado id={c.id} para={`/ti/chamado/${c.id}`} className="btn px-3 text-tinta-2 hover:text-tinta">Ver detalhes</LinkChamado>
      </div>
    </section>
  );
}

/**
 * Seção da fila: título + uma superfície com as linhas separadas por divisórias.
 * No PC, um cabeçalho de colunas (Problema, Setor, Espera, Com quem) alinhado com as linhas.
 */
function Secao({ titulo, total, nota, vazio, arrastavel, children }: { titulo: string; total: number; nota?: string; vazio?: string; arrastavel: boolean; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-baseline gap-2 text-lg font-bold">
        {titulo} <span className="font-display text-base text-tinta-2">{total}</span>
      </h2>
      {nota && <p className="-mt-1 text-sm text-tinta-2">{nota}</p>}
      {total === 0 && vazio ? (
        <p className="rounded-2xl bg-superficie p-6 text-center text-tinta-2 ring-1 ring-linha">{vazio}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-superficie ring-1 ring-linha">
          <div className="hidden items-center gap-3 border-b border-linha py-2 pr-1.5 pl-2 text-xs font-bold tracking-wider text-tinta-2 uppercase md:flex" aria-hidden="true">
            {arrastavel && <span className="w-4" />}
            <span className="w-10" />
            <span className="flex-1">Problema</span>
            <span className="hidden w-36 lg:block">Setor</span>
            <span className="w-24" title="Na fila: há quanto tempo espera. Em atendimento: desde que começou. Em espera: desde que parou.">Tempo</span>
            <span className="w-[7.75rem]">Com quem</span>
            <span className="w-11" />
          </div>
          <ul className="divide-y divide-linha">{children}</ul>
        </div>
      )}
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
  const { config } = useConfigTI();
  const { usuario } = useAuth();
  const eu = usuario?.id ?? "";
  const navegar = useNavigate();
  const tecnicos = useTecnicos();
  const [chamados, setChamados] = useState<Chamado[] | null>(null);
  const [ultimaDeQuemPediu, setUltimaDeQuemPediu] = useState<Record<string, number>>({});
  const novaMensagem = (c: Chamado) => (ultimaDeQuemPediu[c.id] ?? 0) > ultimaVisita(c.id);
  const [pegando, setPegando] = useState("");
  const [filtro, setFiltro] = useState("");
  // celular: a faixa da Equipe fica recolhida atrás do botão "Equipe" (cabeçalho curto); no PC sempre aparece
  const [verEquipe, setVerEquipe] = useState(false);
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
      sort: "ordem_fila,created", // a mesma ordem da senha que o servidor vê (Configurações do TI > Fila e atendimento)
      expand: EXPAND_CHAMADO,
    });
    setChamados(lista);
    // última mensagem de QUEM PEDIU em cada chamado aberto: marca "Nova mensagem" se você ainda não viu
    // (antes o TI só descobria a resposta abrindo o chamado; o servidor tem o "Nova resposta do TI")
    const msgs = await pb.collection("interacoes").getList<{ chamado: string; created: string }>(1, 200, {
      filter: 'chamado.status != "resolvido" && tipo = "comentario" && interno = false && autor != "" && autor = chamado.solicitante',
      sort: "-created",
      fields: "chamado,created",
      requestKey: "fila-mensagens",
    }).catch(() => ({ items: [] as { chamado: string; created: string }[] }));
    const mapa: Record<string, number> = {};
    for (const m of msgs.items) mapa[m.chamado] ??= Date.parse(m.created.replace(" ", "T"));
    setUltimaDeQuemPediu(mapa);
  }, []);

  useEffect(() => { carregar().catch(() => setChamados([])); }, [carregar]);
  useRealtime("chamados", () => carregar().catch(() => {}));
  useRealtime("interacoes", () => carregar().catch(() => {}));
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

  const cartao = (c: Chamado) => (
    <Linha
      key={c.id}
      c={c}
      eu={eu}
      posicao={posicao(c)}
      novaMensagem={novaMensagem(c)}
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
    : filtro === "prazo"
      ? fila.filter((c) => atrasado(c))
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
  const nomeFiltro = filtro === "prazo" ? "Fora do prazo" : filtro === "livres" ? "Livres" : filtro === eu ? "Com você" : `Com ${primeiroNome(tecnicos.find((t) => t.id === filtro)?.name)}`;

  const metas = (["urgente", "alta", "normal", "baixa"] as const).map((p) => `${ROTULO_PRIORIDADE[p]} ${textoMinutos(config.prazos[p])}`).join(", ");
  const filtroTecnico = !!filtro && filtro !== "livres" && filtro !== "prazo";
  const secao = (titulo: string, itens: Chamado[], extra?: { nota?: string; vazio?: string; paginar?: boolean }) => (
    <Secao titulo={titulo} total={itens.length} nota={extra?.nota} vazio={extra?.vazio} arrastavel={podeArrastar}>
      {(extra?.paginar ? fatia(itens) : itens).map((c) => cartao(c))}
    </Secao>
  );

  return (
    <div className="space-y-6">
      {/* cabeçalho curto: os números numa linha só; "fora do prazo" é um filtro, não um alarme em cada chamado */}
      <CabecalhoPagina
        titulo="Fila"
        subtitulo={chamados === null ? <Bloco className="mt-2 h-6 w-64" /> : (
            <p>
              <b className="font-display text-tinta">{fila.length}</b> na fila
              {" · "}<b className="font-display text-tinta">{atendendo.length + comOutros.length}</b> em atendimento
              {esperando.length > 0 && <>{" · "}<b className="font-display text-tinta">{esperando.length}</b> seus em espera</>}
            </p>
          )}
        acoes={<>
          {atrasados > 0 && (
            <button
              type="button"
              aria-pressed={filtro === "prazo"}
              onClick={() => { if (visao) { const p = new URLSearchParams(params); p.delete("visao"); setParams(p); } setFiltro(filtro === "prazo" ? "" : "prazo"); pag.voltarAoInicio(); }}
              title={`Esperando mais que a meta: ${metas}`}
              className={`inline-flex min-h-10 items-center gap-2 rounded-full px-3.5 text-sm font-semibold ring-1 ${
                filtro === "prazo" ? "bg-brasa-50 text-alerta ring-alerta/50" : "bg-superficie text-tinta ring-linha hover:ring-acento"
              }`}
            >
              <span className="size-2 rounded-full bg-brasa-700" aria-hidden="true" />
              {atrasados} fora do prazo
            </button>
          )}
          <span className="hidden md:block"><VisaoTI /></span>
        </>}
      />

      {/* celular: abas das visões (no PC elas ficam na barra lateral), a Equipe e o atalho para Todos os chamados */}
      <div className="sem-barra -mx-4 flex gap-2 overflow-x-auto px-4 md:hidden">
        <div role="tablist" aria-label="Visões da fila" className="flex gap-2">
          {[{ id: null, rotulo: "Tudo", Icone: null }, ...VISOES].map((v) => {
            const ativa = visao === v.id && !filtro;
            return (
              <button
                key={v.id ?? "tudo"}
                type="button"
                role="tab"
                aria-selected={ativa}
                // a aba escolhida fica à vista (sem rolar a página: só a faixa)
                ref={(el) => { const faixa = el?.parentElement?.parentElement; if (ativa && el && faixa) faixa.scrollLeft = el.offsetLeft - 16; }}
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
        <button
          type="button"
          aria-expanded={verEquipe || filtroTecnico}
          onClick={() => setVerEquipe((v) => !v)}
          className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold ring-1 ${
            verEquipe || filtroTecnico ? "bg-mar-50 text-acento ring-acento" : "bg-superficie text-tinta-2 ring-linha"
          }`}
        >
          <Users className="size-4" aria-hidden="true" /> Equipe
        </button>
        <Link to="/ti/chamados" className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-superficie px-4 text-sm font-semibold text-tinta-2 ring-1 ring-linha">
          <Table2 className="size-4" aria-hidden="true" /> Todos <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      {/* no PC o mural fica na barra lateral; no celular, sem aviso, vira uma linha só */}
      <MuralAvisos className="md:hidden" enxuto />

      {tecnicos.length > 0 && chamados !== null && (
        <FaixaEquipe
          className={verEquipe || filtroTecnico || arrastando ? "" : "max-md:hidden"}
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
          {secao(VISOES.find((v) => v.id === visao)!.rotulo, listaVisao, {
            paginar: true,
            vazio: VISOES.find((v) => v.id === visao)!.vazio,
            nota: !listaVisao.length ? undefined
              : visao === "espera" ? 'Fora da fila e da sua carga. "Resposta" volta sozinho quando a pessoa responder.'
              : visao === "livres" ? "Sem responsável, na ordem da fila (prioridade, depois chegada)." : undefined,
          })}
          {rodape}
        </>
      ) : filtro ? (
        <>
          {secao(nomeFiltro, filtrados, {
            paginar: true,
            vazio: "Nenhum chamado aqui.",
            nota: filtro === "prazo" && filtrados.length ? `Esperando mais que a meta da prioridade (${metas}).` : undefined,
          })}
          {rodape}
        </>
      ) : (
        <>
          {atendendo.length > 0 && secao("Você está atendendo", atendendo)}

          {proximo ? (
            <Proximo c={proximo} eu={eu} posicao={fila.indexOf(proximo) + 1} aoComecar={() => comecar(proximo)} aoAtribuir={() => setMenu(proximo)} aoAcoes={() => setAcoes(proximo)} ocupado={pegando === proximo.id} realcado={realce === proximo.id} novaMensagem={novaMensagem(proximo)} />
          ) : (
            <div className="rounded-2xl bg-superficie p-8 text-center ring-1 ring-linha">
              <p className="text-xl font-bold">Nada esperando por você na fila.</p>
              <p className="mt-1 text-tinta-2">
                Pedido chegou pelo WhatsApp, por ligação ou no corredor?{" "}
                <Link to="/ti/registrar" className="font-semibold text-acento underline underline-offset-4">Registre aqui</Link>.
              </p>
            </div>
          )}

          {depois.length > 0 && secao("Depois na fila", depois, { paginar: true })}
          {!filtro && rodape}
          {esperando.length > 0 && secao("Seus em espera", esperando, { nota: "Fora da fila e da sua carga. Retome quando chegar o que falta." })}
          {comColegas > 0 && (
            <p className="rounded-xl border-2 border-dashed border-linha px-4 py-3 text-sm text-tinta-2">
              <b className="font-display text-base text-tinta">{comColegas}</b> {comColegas === 1 ? "chamado está" : "chamados estão"} com colegas
              (na fila, em atendimento ou em espera) e não aparecem aqui. Para ver, toque no nome da pessoa em <b>Equipe</b>.
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
