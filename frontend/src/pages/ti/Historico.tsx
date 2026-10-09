import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { IconeCategoria } from "../../components/Icone";
import { useCategorias } from "../../components/CamposChamado";
import { dataCurta } from "../../lib/formato";
import { EXPAND_CHAMADO, nomeSolicitante, pb, type Chamado } from "../../lib/pb";

const POR_PAGINA = 20;

/** Base de soluções: o que já foi resolvido, pesquisável pelo problema, causa ou solução. */
export function Historico() {
  const categorias = useCategorias();
  const [q, setQ] = useState("");
  const [categoria, setCategoria] = useState("");
  const [itens, setItens] = useState<Chamado[] | null>(null);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    const t = window.setTimeout(async () => {
      const partes = ['status = "resolvido"'];
      const params: Record<string, string> = {};
      if (q.trim()) {
        partes.push("(descricao ~ {:q} || diagnostico ~ {:q} || solucao ~ {:q} || protocolo ~ {:q})");
        params.q = q.trim();
      }
      if (categoria) { partes.push("categoria = {:c}"); params.c = categoria; }
      try {
        const r = await pb.collection("chamados").getList<Chamado>(1, POR_PAGINA * pagina, {
          filter: pb.filter(partes.join(" && "), params),
          sort: "-resolvido_em",
          expand: EXPAND_CHAMADO,
        });
        setItens(r.items);
        setTotal(r.totalItems);
      } catch {
        setItens([]);
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [q, categoria, pagina]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-3xl font-bold">Histórico de soluções</h1>
        <p className="mt-1 text-tinta-2">Antes de começar um atendimento, veja se o problema já foi resolvido antes.</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Pesquisar</span>
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-tinta-2" aria-hidden="true" />
          <input
            type="search"
            className="campo pl-12"
            placeholder="Ex.: spooler, senha bloqueada, 2026-00012"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPagina(1); }}
          />
        </label>
        <label>
          <span className="sr-only">Categoria</span>
          <select className="campo sm:w-56" value={categoria} onChange={(e) => { setCategoria(e.target.value); setPagina(1); }}>
            <option value="">Todas as categorias</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
      </div>

      {itens === null ? (
        <p className="text-tinta-2">Carregando...</p>
      ) : itens.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center ring-1 ring-linha">
          {q || categoria ? "Nada encontrado com esse filtro." : "Os chamados resolvidos aparecem aqui, com a causa e a solução."}
        </p>
      ) : (
        <>
          <p className="text-sm text-tinta-2">{total} {total === 1 ? "chamado resolvido" : "chamados resolvidos"}</p>
          <ul className="space-y-3">
            {itens.map((c) => (
              <li key={c.id}>
                <Link to={`/ti/chamado/${c.id}`} className="block rounded-xl bg-white p-4 ring-1 ring-linha hover:ring-mar-700">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-tinta-2">
                    <span className="font-display text-base font-bold text-tinta">{c.protocolo}</span>
                    <span className="inline-flex items-center gap-1">
                      <IconeCategoria nome={c.expand?.categoria?.icone} className="size-4 text-mar-700" />
                      {c.expand?.categoria?.nome}
                    </span>
                    <span>{nomeSolicitante(c)}{c.expand?.setor ? `, ${c.expand.setor.nome}` : ""}</span>
                    <span className="ml-auto">{dataCurta(c.resolvido_em)}{c.expand?.responsavel ? `, por ${c.expand.responsavel.name}` : ""}</span>
                  </div>
                  <p className="mt-2 font-semibold">{c.descricao}</p>
                  <div className="mt-3 grid gap-2 border-t border-linha pt-3 sm:grid-cols-2">
                    <p><span className="block text-sm text-tinta-2">Causa</span>{c.diagnostico || "—"}</p>
                    <p><span className="block text-sm text-tinta-2">Solução</span>{c.solucao || "—"}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {itens.length < total && (
            <button className="btn-secundario w-full" onClick={() => setPagina((p) => p + 1)}>Mostrar mais</button>
          )}
        </>
      )}
    </div>
  );
}
