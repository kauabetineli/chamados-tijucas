import { AvisoNoNovoChamado } from "../../components/MuralAvisos";
import { ArrowLeft, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ProgressoEnvio } from "../../components/ProgressoEnvio";
import { mensagemErro } from "../../lib/pb";
import { BarraAcao } from "./BarraAcao";
import { ETAPAS } from "./etapas";
import type { FormularioChamado } from "./useNovoChamado";

/**
 * Celular: uma etapa por tela.
 * A etapa atual fica no endereço (?passo=2), então o botão "voltar" do Android volta uma etapa.
 */
export function Assistente({ f }: { f: FormularioChamado }) {
  const navegar = useNavigate();
  const [params, setParams] = useSearchParams();
  const [erro, setErro] = useState("");
  const titulo = useRef<HTMLDivElement>(null);

  // não deixa pular etapa sem preencher (ex.: recarregou a página no passo 3)
  const primeiraPendente = ETAPAS.findIndex((e) => !e.pronta(f));
  const pedido = Math.max(0, (parseInt(params.get("passo") ?? "1", 10) || 1) - 1);
  const atual = Math.min(pedido, primeiraPendente === -1 ? ETAPAS.length - 1 : primeiraPendente, ETAPAS.length - 1);
  const etapa = ETAPAS[atual];
  const ultima = atual === ETAPAS.length - 1;

  useEffect(() => {
    titulo.current?.focus();
    window.scrollTo({ top: 0 });
  }, [atual]);

  function irPara(indice: number, substituir = false) {
    const p = new URLSearchParams(params);
    p.set("passo", String(indice + 1));
    setParams(p, { replace: substituir });
  }

  function avancar() {
    if (atual < ETAPAS.length - 1) irPara(atual + 1);
  }

  function voltar() {
    if (atual === 0) return navegar("/");
    // se viemos da etapa anterior, o "voltar" do navegador mantém o histórico certinho
    if ((window.history.state?.idx ?? 0) > 0) navegar(-1);
    else irPara(atual - 1, true);
  }

  async function enviar() {
    setErro("");
    const pendente = ETAPAS.find((e) => !e.pronta(f));
    if (pendente) return setErro(pendente.falta);
    try {
      const c = await f.enviar();
      navegar(`/chamado/${c.id}`, { state: { novo: true }, replace: true });
    } catch (err) {
      setErro(mensagemErro(err));
    }
  }

  return (
    <div className="mx-auto max-w-xl pb-28">
      <div className="mb-6 flex items-center gap-3">
        <button type="button" onClick={voltar} className="-ml-2 rounded-lg p-2 text-acento" aria-label={atual === 0 ? "Cancelar" : "Voltar"}>
          <ArrowLeft className="size-6" />
        </button>
        <div className="flex-1">
          <p className="text-sm font-semibold text-tinta-2">
            Passo {atual + 1} de {ETAPAS.length}
            {f.setor && <span className="font-normal">, para {f.setor}</span>}
          </p>
          <div className="mt-1.5 flex gap-1" aria-hidden="true">
            {ETAPAS.map((e, i) => (
              <span key={e.id} className={`h-1.5 flex-1 rounded-full ${i <= atual ? "bg-mar-700" : "bg-linha"}`} />
            ))}
          </div>
        </div>
        {atual > 0 && (
          <button type="button" onClick={() => navegar("/")} className="-mr-2 rounded-lg p-2 text-tinta-2" aria-label="Cancelar e sair">
            <X className="size-6" />
          </button>
        )}
      </div>

      {atual === 0 && <AvisoNoNovoChamado className="mb-6" />}
      <div ref={titulo} tabIndex={-1} className="outline-none">
        <etapa.Componente f={f} modo="passo" avancar={avancar} irPara={(id) => irPara(ETAPAS.findIndex((e) => e.id === id))} />
      </div>

      {ultima && (
        <BarraAcao>
          {erro && <p role="alert" className="font-semibold text-alerta">{erro}</p>}
          <ProgressoEnvio pct={f.progresso} />
          <button type="button" className="btn-primario flex w-full items-center justify-center gap-2 text-lg" disabled={f.enviando} onClick={enviar}>
            <Send className="size-5" aria-hidden="true" />
            {f.enviando ? "Enviando..." : "Enviar chamado"}
          </button>
        </BarraAcao>
      )}
    </div>
  );
}
