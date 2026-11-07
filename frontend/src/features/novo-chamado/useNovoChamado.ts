import { useEffect, useState } from "react";
import { useCategorias } from "../../components/CamposChamado";
import { useAuth } from "../../lib/auth";
import { PRIORIDADE_DO_IMPACTO, pedeMotivo, prioridadesDoServidor, useConfigTI } from "../../lib/configTI";
import { avisar } from "../../lib/avisos";
import { criarComProgresso } from "../../lib/envio";
import { apagarAnexos, guardarAnexos, lerAnexos } from "../../lib/rascunhoAnexos";
import type { Categoria, Chamado, Impacto, Prioridade } from "../../lib/pb";

// Rascunho: no Android, abrir a câmera às vezes faz o navegador recarregar a página.
const CHAVE_RASCUNHO = "dinodesk:rascunho-chamado";
type Rascunho = { categoria: string; descricao: string; impacto: Impacto | "" };

function lerRascunho(): Partial<Rascunho> {
  try {
    return JSON.parse(sessionStorage.getItem(CHAVE_RASCUNHO) || "{}");
  } catch {
    return {};
  }
}

/** Estado e envio do formulário de abertura de chamado, compartilhado pelos dois layouts. */
export function useNovoChamado() {
  const { usuario } = useAuth();
  const [rascunho] = useState(lerRascunho);
  const categorias = useCategorias();

  const [categoria, setCategoria] = useState(rascunho.categoria ?? "");
  const [descricao, setDescricao] = useState(rascunho.descricao ?? "");
  const [impacto, setImpacto] = useState<Impacto | "">(rascunho.impacto ?? "");
  // prioridade: o impacto sugere; se o TI liberou (Configurações do TI > Fila e atendimento), a pessoa ajusta
  const { config } = useConfigTI();
  const [prioridadePedida, setPrioridade] = useState<Prioridade | "">("");
  const [motivoUrgencia, setMotivoUrgencia] = useState("");
  const sugerida: Prioridade = impacto ? PRIORIDADE_DO_IMPACTO[impacto] : "normal";
  const escolhePrioridade = config.servidor_prioridade;
  const opcoesPrioridade = prioridadesDoServidor(config, sugerida);
  const prioridade: Prioridade = escolhePrioridade && prioridadePedida && opcoesPrioridade.includes(prioridadePedida) ? prioridadePedida : sugerida;
  const precisaMotivo = pedeMotivo(config, sugerida, prioridade);
  // o lugar do chamado é o setor da conta de quem abre (não há campo "local")
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [preparandoAnexo, setPreparandoAnexo] = useState(false);
  const [progresso, setProgresso] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.setItem(CHAVE_RASCUNHO, JSON.stringify({ categoria, descricao, impacto }));
    } catch {
      /* sem armazenamento: segue sem rascunho */
    }
  }, [categoria, descricao, impacto]);

  // anexos também sobrevivem à página recarregar (lib/rascunhoAnexos.ts): primeiro lê o que ficou guardado,
  // só depois passa a guardar (senão a lista vazia do início apagaria o rascunho)
  const [anexosLidos, setAnexosLidos] = useState(false);
  useEffect(() => {
    let vivo = true;
    lerAnexos(CHAVE_RASCUNHO).then((guardados) => {
      if (!vivo) return;
      if (guardados.length) {
        console.info(`[anexos] recuperados após recarregar: ${guardados.map((f) => `${f.name} (${Math.round(f.size / 1048576)} MB)`).join(", ")}`);
        setArquivos((atual) => (atual.length ? atual : guardados));
        avisar(guardados.length === 1 ? "Seu anexo foi recuperado." : `Seus ${guardados.length} anexos foram recuperados.`);
      }
      setAnexosLidos(true);
    });
    return () => { vivo = false; };
  }, []);
  useEffect(() => { if (anexosLidos) guardarAnexos(CHAVE_RASCUNHO, arquivos); }, [arquivos, anexosLidos]);

  const categoriaEscolhida: Categoria | undefined = categorias.find((c) => c.id === categoria);

  async function enviar(): Promise<Chamado> {
    setEnviando(true);
    setProgresso(arquivos.length ? 0 : null);
    try {
      const dados = new FormData();
      dados.append("categoria", categoria);
      dados.append("descricao", descricao);
      dados.append("impacto", impacto);
      if (escolhePrioridade) {
        dados.append("prioridade", prioridade);
        if (prioridade !== sugerida && motivoUrgencia.trim()) dados.append("motivo_urgencia", motivoUrgencia.trim());
      }
      arquivos.forEach((f) => dados.append("anexos", f));
      const c = await criarComProgresso<Chamado>("chamados", dados, setProgresso);
      try { sessionStorage.removeItem(CHAVE_RASCUNHO); } catch { /* ok */ }
      await apagarAnexos(CHAVE_RASCUNHO);
      return c;
    } finally {
      setEnviando(false);
      setProgresso(null);
    }
  }

  return {
    setor: usuario?.expand?.setor?.nome ?? "",
    categorias,
    categoria, setCategoria, categoriaEscolhida,
    descricao, setDescricao,
    impacto, setImpacto: (i: Impacto) => { setImpacto(i); setPrioridade(""); },
    config, escolhePrioridade, opcoesPrioridade, sugerida, prioridade, setPrioridade, precisaMotivo, motivoUrgencia, setMotivoUrgencia,
    arquivos, setArquivos,
    preparandoAnexo, setPreparandoAnexo,
    progresso, enviando, enviar,
  };
}

export type FormularioChamado = ReturnType<typeof useNovoChamado>;
