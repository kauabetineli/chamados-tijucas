import { useEffect, useState } from "react";
import { useCategorias } from "../../components/CamposChamado";
import { useAuth } from "../../lib/auth";
import { criarComProgresso } from "../../lib/envio";
import type { Categoria, Chamado, Impacto } from "../../lib/pb";

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

  const categoriaEscolhida: Categoria | undefined = categorias.find((c) => c.id === categoria);

  async function enviar(): Promise<Chamado> {
    setEnviando(true);
    setProgresso(arquivos.length ? 0 : null);
    try {
      const dados = new FormData();
      dados.append("categoria", categoria);
      dados.append("descricao", descricao);
      dados.append("impacto", impacto);
      arquivos.forEach((f) => dados.append("anexos", f));
      const c = await criarComProgresso<Chamado>("chamados", dados, setProgresso);
      try { sessionStorage.removeItem(CHAVE_RASCUNHO); } catch { /* ok */ }
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
    impacto, setImpacto,
    arquivos, setArquivos,
    preparandoAnexo, setPreparandoAnexo,
    progresso, enviando, enviar,
  };
}

export type FormularioChamado = ReturnType<typeof useNovoChamado>;
