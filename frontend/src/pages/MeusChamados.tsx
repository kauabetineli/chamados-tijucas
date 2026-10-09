import { Plus, Wrench } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { LinhaChamado } from "../components/LinhaChamado";
import { SenhaFila } from "../components/SenhaFila";
import { useAuth } from "../lib/auth";
import { resumo } from "../lib/formato";
import { EXPAND_CHAMADO, pb, type Chamado } from "../lib/pb";
import { useRealtime } from "../lib/useRealtime";

type Posicoes = Record<string, { a_frente: number; posicao: number }>;

export function MeusChamados() {
  const { usuario } = useAuth();
  const [chamados, setChamados] = useState<Chamado[] | null>(null);
  const [posicoes, setPosicoes] = useState<Posicoes>({});

  const carregar = useCallback(async () => {
    if (!usuario) return;
    const [lista, pos] = await Promise.all([
      pb.collection("chamados").getFullList<Chamado>({
        filter: pb.filter("solicitante = {:u}", { u: usuario.id }),
        sort: "-created",
        expand: EXPAND_CHAMADO,
      }),
      pb.send<{ itens: Posicoes }>("/api/fila/minhas-posicoes", {}),
    ]);
    setChamados(lista);
    setPosicoes(pos?.itens ?? {});
  }, [usuario]);

  useEffect(() => { carregar().catch(() => setChamados([])); }, [carregar]);
  // a posição muda quando QUALQUER chamado anda; o PocketBase só avisa dos meus,
  // então também atualizamos a cada 30 s
  useRealtime("chamados", () => carregar().catch(() => {}));
  useEffect(() => {
    const t = window.setInterval(() => carregar().catch(() => {}), 30_000);
    return () => window.clearInterval(t);
  }, [carregar]);

  if (chamados === null) return <p className="text-tinta-2">Carregando seus chamados...</p>;

  const naFila = chamados
    .filter((c) => c.status === "aberto")
    .sort((a, b) => (posicoes[a.id]?.a_frente ?? 0) - (posicoes[b.id]?.a_frente ?? 0));
  const emAtendimento = chamados.filter((c) => c.status === "em_andamento");
  const paraConfirmar = chamados.filter((c) => c.status === "resolvido" && !c.confirmado);
  const anteriores = chamados.filter((c) => c.status === "resolvido" && c.confirmado);

  if (chamados.length === 0) {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <h1 className="text-3xl font-bold">Precisa de ajuda do TI?</h1>
        <p className="mt-3 text-lg text-tinta-2">
          Abra um chamado e acompanhe por aqui a sua vez na fila e as respostas do Departamento de TI.
        </p>
        <Link to="/novo" className="btn-primario mt-6">
          <Plus className="size-5" aria-hidden="true" /> Abrir chamado
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-9">
      <h1 className="text-3xl font-bold">Meus chamados</h1>

      {naFila.length > 0 && (
        <section aria-labelledby="t-fila" className="space-y-4">
          <h2 id="t-fila" className="text-xl font-bold">Aguardando atendimento</h2>
          {naFila.map((c) => (
            <Link key={c.id} to={`/chamado/${c.id}`} className="block rounded-[18px] focus-visible:outline-offset-4">
              <SenhaFila
                aFrente={posicoes[c.id]?.a_frente ?? 0}
                protocolo={c.protocolo}
                categoria={c.expand?.categoria?.nome}
                icone={c.expand?.categoria?.icone}
              />
            </Link>
          ))}
          <p className="text-sm text-tinta-2">
            A ordem segue a urgência de cada pedido e, depois, quem pediu primeiro.
          </p>
        </section>
      )}

      {emAtendimento.length > 0 && (
        <section aria-labelledby="t-atend" className="space-y-3">
          <h2 id="t-atend" className="text-xl font-bold">Em atendimento</h2>
          {emAtendimento.map((c) => (
            <Link key={c.id} to={`/chamado/${c.id}`} className="flex items-start gap-3 rounded-2xl border-l-8 border-sol bg-white p-4 ring-1 ring-linha">
              <Wrench className="mt-0.5 size-6 shrink-0 text-tinta" aria-hidden="true" />
              <span>
                <span className="block font-bold">
                  {c.expand?.responsavel?.name ?? "Um técnico"} está cuidando do seu chamado.
                </span>
                <span className="block text-tinta-2">
                  <span className="font-display font-bold text-tinta">{c.protocolo}</span> {resumo(c.descricao, 70)}
                </span>
              </span>
            </Link>
          ))}
        </section>
      )}

      {paraConfirmar.length > 0 && (
        <section aria-labelledby="t-conf">
          <h2 id="t-conf" className="text-xl font-bold">Resolvidos: confirme se deu certo</h2>
          <ul className="divide-y divide-linha">
            {paraConfirmar.map((c) => <LinhaChamado key={c.id} c={c} para={`/chamado/${c.id}`} />)}
          </ul>
        </section>
      )}

      {anteriores.length > 0 && (
        <section aria-labelledby="t-ant">
          <h2 id="t-ant" className="text-xl font-bold">Anteriores</h2>
          <ul className="divide-y divide-linha">
            {anteriores.map((c) => <LinhaChamado key={c.id} c={c} para={`/chamado/${c.id}`} />)}
          </ul>
        </section>
      )}
    </div>
  );
}
