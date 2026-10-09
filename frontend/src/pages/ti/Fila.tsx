import { MapPin, User } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { IconeCategoria } from "../../components/Icone";
import { COR_PRIORIDADE, SeloPrioridade, SeloStatus } from "../../components/Selos";
import { useAuth } from "../../lib/auth";
import { resumo, ROTULO_ORIGEM, tempoRelativo } from "../../lib/formato";
import { EXPAND_CHAMADO, nomeSolicitante, pb, type Chamado } from "../../lib/pb";
import { useRealtime } from "../../lib/useRealtime";

type Filtro = "todos" | "comigo" | "sem";

export function Fila() {
  const { usuario } = useAuth();
  const [chamados, setChamados] = useState<Chamado[] | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [, setTique] = useState(0);

  const carregar = useCallback(async () => {
    const lista = await pb.collection("chamados").getFullList<Chamado>({
      filter: 'status != "resolvido"',
      // em atendimento primeiro; depois a fila: prioridade e ordem de chegada
      sort: "-status,-peso,created",
      expand: EXPAND_CHAMADO,
    });
    setChamados(lista);
  }, []);

  useEffect(() => { carregar().catch(() => setChamados([])); }, [carregar]);
  useRealtime("chamados", () => carregar().catch(() => {}));
  useEffect(() => {
    const t = window.setInterval(() => setTique((n) => n + 1), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const aguardando = chamados?.filter((c) => c.status === "aberto").length ?? 0;
  const emAtendimento = chamados?.filter((c) => c.status === "em_andamento").length ?? 0;

  useEffect(() => {
    document.title = aguardando ? `(${aguardando}) Fila | Dino Desk` : "Fila | Dino Desk";
    return () => { document.title = "Dino Desk"; };
  }, [aguardando]);

  const visiveis = (chamados ?? []).filter((c) =>
    filtro === "comigo" ? c.responsavel === usuario?.id : filtro === "sem" ? !c.responsavel : true,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Fila</h1>
          <p className="text-tinta-2">
            <span className="font-display text-xl font-bold text-tinta">{aguardando}</span> aguardando,{" "}
            <span className="font-display text-xl font-bold text-tinta">{emAtendimento}</span> em atendimento
          </p>
        </div>
        <div role="tablist" aria-label="Filtrar fila" className="flex rounded-xl bg-white p-1 ring-1 ring-linha">
          {([["todos", "Todos"], ["comigo", "Comigo"], ["sem", "Sem responsável"]] as [Filtro, string][]).map(([k, r]) => (
            <button
              key={k}
              role="tab"
              aria-selected={filtro === k}
              onClick={() => setFiltro(k)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${filtro === k ? "bg-mar-700 text-white" : "text-tinta-2"}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {chamados === null ? (
        <p className="text-tinta-2">Carregando a fila...</p>
      ) : visiveis.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-linha">
          <p className="text-xl font-bold">Nenhum chamado aqui.</p>
          <p className="mt-1 text-tinta-2">
            Pedido chegou pelo WhatsApp, por ligação ou no corredor?{" "}
            <Link to="/ti/registrar" className="font-semibold text-mar-700 underline underline-offset-4">Registre aqui</Link>.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visiveis.map((c) => (
            <li key={c.id}>
              <Link to={`/ti/chamado/${c.id}`} className="flex overflow-hidden rounded-xl bg-white ring-1 ring-linha hover:ring-mar-700">
                <span className={`w-2 shrink-0 ${COR_PRIORIDADE[c.prioridade]}`} aria-hidden="true" />
                <div className="min-w-0 flex-1 p-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-display text-lg font-bold">{c.protocolo}</span>
                    <SeloPrioridade prioridade={c.prioridade} />
                    <span className="inline-flex items-center gap-1 text-sm font-semibold">
                      <IconeCategoria nome={c.expand?.categoria?.icone} className="size-4 text-mar-700" />
                      {c.expand?.categoria?.nome}
                    </span>
                  </div>
                  <p className="mt-1.5 font-semibold">{resumo(c.descricao)}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-tinta-2">
                    <span className="inline-flex items-center gap-1"><User className="size-4" aria-hidden="true" />{nomeSolicitante(c)}</span>
                    {(c.expand?.setor || c.local) && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-4" aria-hidden="true" />
                        {[c.expand?.setor?.nome, c.local].filter(Boolean).join(", ")}
                      </span>
                    )}
                    {c.origem !== "sistema" && <span>{ROTULO_ORIGEM[c.origem]}</span>}
                    <span>aberto {tempoRelativo(c.created)}</span>
                    {c.status === "em_andamento" && (
                      <span className="ml-auto inline-flex items-center gap-2">
                        <SeloStatus status={c.status} />
                        {c.expand?.responsavel?.name}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
