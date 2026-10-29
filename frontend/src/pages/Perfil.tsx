import { BarChart3, Building2, ChevronRight, Settings, ShieldCheck, SlidersHorizontal, Users, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { MinhaAusencia } from "../features/configuracoes/Equipe";
import { Avatar } from "../components/Avatar";
import { useAuth } from "../lib/auth";
import { ehAdmin, ehTecnico, pb, type Usuario } from "../lib/pb";

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
    <Link to={para} className="rounded-2xl bg-superficie p-4 ring-1 ring-linha hover:ring-acento">
      <span className="block font-display text-3xl font-extrabold">{valor ?? "–"}</span>
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
  const tipo = admin ? "Administrador do TI" : tecnico ? "Técnico do TI" : "Servidor";
  const TipoIcone = admin ? ShieldCheck : tecnico ? Wrench : Building2;

  const itens = [
    ...(tecnico ? [
      { para: "/ti/painel", Icone: BarChart3, titulo: "Painel da equipe", detalhe: "Indicadores e o piloto" },
      { para: "/ti/usuarios", Icone: Users, titulo: admin ? "Pessoas e setores" : "Pessoas", detalhe: admin ? "Contas, senha nova, bloquear e setores" : "Buscar contato e ramal" },
    ] : []),
    ...(admin ? [
      { para: "/ti/configuracoes", Icone: SlidersHorizontal, titulo: "Configurações do TI", detalhe: "Automação, equipe, categorias e a fila" },
    ] : []),
    { para: "/configuracoes", Icone: Settings, titulo: "Configurações", detalhe: "Aparência, senha, meus dados e sair" },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="flex flex-col items-center gap-2 text-center">
        <Avatar id={u.id} nome={u.name} tamanho="lg" />
        <h1 className="text-3xl font-bold break-words">{u.name}</h1>
        <p className="inline-flex items-center gap-1.5 rounded-full bg-mar-50 px-3 py-1 text-sm font-bold text-acento">
          <TipoIcone className="size-4" aria-hidden="true" /> {tipo}
        </p>
      </section>

      <Numeros u={u} />

      {tecnico && <MinhaAusencia eu={u.id} />}

      <nav aria-label="Mais opções" className="overflow-hidden rounded-2xl bg-superficie ring-1 ring-linha">
        <ul className="divide-y divide-linha">
          {itens.map(({ para, Icone, titulo, detalhe }) => (
            <li key={para}>
              <Link to={para} className="flex min-h-16 items-center gap-4 px-4 py-3 hover:bg-fundo">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-mar-50 text-acento"><Icone className="size-5" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-tinta">{titulo}</span>
                  <span className="block text-sm text-tinta-2">{detalhe}</span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-tinta-2" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
