import { ChevronDown, History, Lightbulb } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { dataCurta, resumo } from "../lib/formato";
import { pb } from "../lib/pb";
import { LinkChamado } from "../lib/verChamado";
import { Bloco } from "./Esqueleto";

interface Parecido {
  id: string;
  protocolo: string;
  descricao: string;
  diagnostico: string;
  solucao: string;
  resolvido_em: string;
}

/**
 * "Veja como chamados desse tipo já foram resolvidos": até 5 chamados resolvidos da mesma categoria,
 * os de descrição mais parecida primeiro (palavras em comum). É o histórico do TI trabalhando a favor
 * de quem atende agora. Só aparece se houver algum; fica fechado para não empurrar a conversa para baixo.
 */
export type DadosParecidas = { total: number; itens: Parecido[] } | null;

/** Busca as soluções parecidas (null enquanto carrega). */
export function useSolucoesParecidas(chamadoId: string, ligado = true): DadosParecidas {
  const [dados, setDados] = useState<DadosParecidas>(null);
  useEffect(() => {
    setDados(null);
    if (!ligado) return;
    pb.send<{ total: number; itens: Parecido[] }>(`/api/chamados/${chamadoId}/solucoes-parecidas`, { requestKey: `parecidas-${chamadoId}` })
      .then(setDados)
      .catch(() => setDados({ total: 0, itens: [] }));
  }, [chamadoId, ligado]);
  return dados;
}

/** A lista em si (aberta): usada no cartão que abre e fecha e na aba "Soluções parecidas" do painel do chamado. */
export function ListaParecidas({ dados, categoriaId }: { dados: { total: number; itens: Parecido[] }; categoriaId: string }) {
  return (
    <>
      <ul className="divide-y divide-linha">
        {dados.itens.map((p) => (
          <li key={p.id} className="py-3">
            <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-tinta-2">
              <LinkChamado id={p.id} para={`/ti/chamado/${p.id}`} className="font-display font-bold text-acento hover:underline">{p.protocolo}</LinkChamado>
              {p.resolvido_em && <span>resolvido em {dataCurta(p.resolvido_em)}</span>}
            </p>
            <p className="mt-0.5 text-sm text-tinta-2">{resumo(p.descricao, 110)}</p>
            {p.diagnostico && <p className="mt-1.5 text-sm"><b>Causa:</b> {p.diagnostico}</p>}
            <p className="mt-0.5 text-sm"><b>Solução:</b> <span className="selecionavel">{p.solucao}</span></p>
          </li>
        ))}
      </ul>
      {dados.total > dados.itens.length && (
        <Link to={`/ti/historico?categoria=${categoriaId}`} className="mt-1 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-acento hover:underline">
          <History className="size-4" aria-hidden="true" /> Ver todas as {dados.total} em Soluções
        </Link>
      )}
    </>
  );
}

export function SolucoesParecidas({ chamadoId, categoriaId, categoriaNome }: { chamadoId: string; categoriaId: string; categoriaNome?: string }) {
  const dados = useSolucoesParecidas(chamadoId);
  const [aberto, setAberto] = useState(false);

  if (dados === null) return <Bloco className="h-14 w-full rounded-2xl" />;
  if (!dados.itens.length) return null;

  return (
    <section className="rounded-2xl bg-superficie ring-1 ring-linha">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left hover:bg-fundo"
      >
        <Lightbulb className="size-5 shrink-0 text-acento" aria-hidden="true" />
        <span className="flex-1">
          <span className="block font-bold">Como chamados desse tipo foram resolvidos</span>
          <span className="block text-sm text-tinta-2">
            {dados.itens.length} {dados.itens.length === 1 ? "solução" : "soluções"} de {categoriaNome ?? "mesma categoria"}, as mais parecidas primeiro
          </span>
        </span>
        <ChevronDown className={`size-5 shrink-0 text-tinta-2 transition-transform ${aberto ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {aberto && (
        <div className="border-t border-linha px-4 pb-4">
          <ListaParecidas dados={dados} categoriaId={categoriaId} />
        </div>
      )}
    </section>
  );
}
