import { Info } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { tempoRelativo } from "../../lib/formato";
import { pb } from "../../lib/pb";

interface Semelhante {
  id: string;
  protocolo: string;
  status: string;
  created: string;
  meu: boolean;
}

/**
 * Avisa se já existe chamado aberto da mesma categoria no setor da pessoa.
 * Evita que cada servidor do setor abra o seu quando a rede ou a impressora param.
 */
export function AvisoSemelhantes({ categoria }: { categoria: string }) {
  const [itens, setItens] = useState<Semelhante[]>([]);

  useEffect(() => {
    if (!categoria) return setItens([]);
    let ativo = true;
    pb.send<{ itens: Semelhante[] }>("/api/chamados/semelhantes", { query: { categoria } })
      .then((r) => ativo && setItens(r?.itens ?? []))
      .catch(() => ativo && setItens([]));
    return () => { ativo = false; };
  }, [categoria]);

  if (!itens.length) return null;
  const meu = itens.find((i) => i.meu);
  const primeiro = meu ?? itens[0];

  return (
    <div role="status" className="flex gap-3 rounded-2xl bg-sol-50 p-4 ring-1 ring-sol">
      <Info className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="text-sm">
        {meu ? (
          <p>
            Você já tem o chamado <Link to={`/chamado/${meu.id}`} className="font-bold underline underline-offset-2">{meu.protocolo}</Link> aberto
            sobre isso ({tempoRelativo(meu.created)}). Se for o mesmo problema, acompanhe por ele.
          </p>
        ) : (
          <p>
            O seu setor já tem o chamado <span className="font-bold">{primeiro.protocolo}</span> aberto sobre isso
            ({tempoRelativo(primeiro.created)}). Já estamos sabendo: se for o mesmo problema, não precisa abrir outro.
          </p>
        )}
        <p className="mt-1 text-tinta-2">Se for outro problema, pode continuar.</p>
      </div>
    </div>
  );
}
