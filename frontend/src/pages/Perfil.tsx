import { BarChart3, Building2, ChevronRight, Eye, MessageSquare, Settings, ShieldCheck, SlidersHorizontal, Users, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { MinhaAusencia } from "../features/configuracoes/Equipe";
import { Avatar } from "../components/Avatar";
import { useAuth } from "../lib/auth";
import { abrirOpiniao } from "../lib/opiniao";
import { ehAdmin, ehObservador, ehTecnico, pb, type Usuario } from "../lib/pb";

/** Números rápidos: do servidor (chamados que abriu) ou do técnico (que atendeu). */
function Numeros({ u }: { u: Usuario }) {
  const tecnico = ehTecnico(u);
  const [n, setN] = useState<{ a: number; b: number } | null>(null);
  useEffect(() => {
    const contar = (filter: string) => pb.collection("chamados").getList(1, 1, { filter, fields: "id", requestKey: null }).then((r) => r.totalItems);
    const f = (s: string) => pb.filter(s, { u: u.id });
    Promise.all(tecnico
      ? [contar(f('responsavel = {:u} && status = "em_andamento"')), contar(f('responsavel = {:u} && status = "resolvido"'))]
      : [contar(f('solicitante = {:u} && (status != "resolvido" || confirmado = false)')), contar(f('solicitante = {:u} && status = "resolvido"'))],
    ).then(([a, b]) => setN({ a, b })).catch(() => {});
  }, [u.id, tecnico]);

  const cartao = (valor: number | undefined, rotulo: string, para: string) => (
    <Link to={para} className="rounded-2xl bg-superficie px-4 py-3 ring-1 ring-linha hover:ring-acento md:p-4">
      <span className="block font-display text-2xl font-extrabold md:text-3xl">{valor ?? "–"}</span>
      <span className="text-sm font-semibold text-tinta-2">{rotulo}</span>
    </Link>
  );
  return (
    <div className="grid grid-cols-2 gap-3">
      {tecnico ? (
        <>
          {cartao(n?.a, "atendendo agora", "/ti")}
          {cartao(n?.b, "resolvidos por você", "/ti/historico")}
        </>
      ) : (
        <>
          {cartao(n?.a, "em aberto", "/")}
          {cartao(n?.b, "resolvidos", "/?aba=historico")}
        </>
      )}
    </div>
  );
}

/**
 * "Você" (o avatar na barra de baixo do celular; no PC, o nome no rodapé da barra lateral): quem eu sou, meus
 * números e, embaixo, ao alcance do polegar, o que é eventual: Painel e Pessoas (TI) e Configurações.
 */
export function Perfil() {
  const { usuario } = useAuth();
  const [u, setU] = useState<Usuario | null>(usuario);

  // dados frescos (o admin pode ter mudado setor ou ramal)
  useEffect(() => {
    if (!usuario) return;
    pb.collection("users").getOne<Usuario>(usuario.id, { expand: "setor", requestKey: null }).then(setU).catch(() => {});
  }, [usuario?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.title = "Você | Dino Desk";
    return () => { document.title = "Dino Desk"; };
  }, []);

  if (!u) return null;
  const tecnico = ehTecnico(u);
  const admin = ehAdmin(u);
  // observador: equipe do Dino Desk, vê as telas do TI (inclusive as de admin) sem mudar nada
  const soLeitura = ehObservador(u);
  const tipo = admin ? "Administrador do TI" : tecnico ? "Técnico do TI" : soLeitura ? "Equipe do Dino Desk (só leitura)" : "Servidor";
  const TipoIcone = admin ? ShieldCheck : tecnico ? Wrench : soLeitura ? Eye : Building2;

  const itens = [
    ...(tecnico || soLeitura ? [
      { para: "/ti/painel", Icone: BarChart3, titulo: "Painel da equipe" },
      { para: "/ti/usuarios", Icone: Users, titulo: admin ? "Pessoas e setores" : "Pessoas" },
    ] : []),
    ...(admin || soLeitura ? [
      { para: "/ti/configuracoes", Icone: SlidersHorizontal, titulo: "Configurações do TI" },
    ] : []),
    ...(u.equipe_projeto ? [{ para: "/projeto/feedback", Icone: MessageSquare, titulo: "Feedback do sistema" }] : []),
    { para: "/configuracoes", Icone: Settings, titulo: "Configurações", detalhe: "Aparência, senha, meus dados e sair" as string | undefined },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-4 md:space-y-6">
      <section className="flex flex-col items-center gap-2 text-center">
        <Avatar id={u.id} nome={u.name} tamanho="lg" />
        <h1 className="text-2xl font-bold break-words md:text-3xl">{u.name}</h1>
        <p className="inline-flex items-center gap-1.5 rounded-full bg-mar-50 px-3 py-1 text-sm font-bold text-acento">
          <TipoIcone className="size-4" aria-hidden="true" /> {tipo}
        </p>
      </section>

      {!soLeitura && <Numeros u={u} />}

      {tecnico && <MinhaAusencia eu={u.id} />}

      <nav aria-label="Mais opções" className="overflow-hidden rounded-2xl bg-superficie ring-1 ring-linha">
        <ul className="divide-y divide-linha">
          {itens.map(({ para, Icone, titulo, detalhe }) => (
            <li key={para}>
              <Link to={para} className="flex min-h-14 items-center gap-3.5 px-4 py-2.5 hover:bg-fundo md:min-h-16 md:gap-4 md:py-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-mar-50 text-acento"><Icone className="size-5" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-tinta">{titulo}</span>
                  {detalhe && <span className="block text-sm text-tinta-2">{detalhe}</span>}
                </span>
                <ChevronRight className="size-5 shrink-0 text-tinta-2" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* "Sua opinião": no PC também há o botão no canto; no celular este é o caminho */}
      <button type="button" onClick={() => abrirOpiniao()} className="flex min-h-14 w-full items-center gap-3.5 rounded-2xl bg-campo-50 px-4 py-2.5 md:min-h-16 md:gap-4 md:py-3 text-left ring-1 ring-linha hover:ring-acento">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-campo text-white"><MessageSquare className="size-5" aria-hidden="true" /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-tinta">Sua opinião sobre o sistema</span>
          <span className="block text-sm text-tinta-2">Problema, ideia ou elogio, direto para quem faz o Dino Desk</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-tinta-2" aria-hidden="true" />
      </button>
    </div>
  );
}
