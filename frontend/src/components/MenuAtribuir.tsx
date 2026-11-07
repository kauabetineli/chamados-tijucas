import { useEffect, useState } from "react";
import { atribuir } from "../lib/equipe";
import { mensagemErro, type Chamado, type Usuario } from "../lib/pb";
import { EscolhaResponsavel, PainelRapido, RodapeRascunho } from "./PainelRapido";

/**
 * Escolher quem fica com o chamado: eu, um colega ou ninguém (volta para a fila).
 * Escolher só marca; vale ao confirmar (o botão diz o que vai acontecer). Duplo clique confirma direto.
 * No celular abre como painel de baixo; no computador, como janela pequena.
 */
export function MenuAtribuir({ chamado: c, tecnicos, eu, carga, aoFechar, aoAtribuir }: {
  chamado: Chamado;
  tecnicos: Usuario[];
  eu: string;
  /** quantos chamados cada técnico já tem (id → total) */
  carga: Record<string, number>;
  aoFechar: () => void;
  aoAtribuir: (msg: string, id: string) => void;
}) {
  const original = c.responsavel ?? "";
  const [escolhido, setEscolhido] = useState(original);
  const [saindo, setSaindo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const mudou = escolhido !== original;
  const nome = (id: string) => id === eu ? "você" : (tecnicos.find((t) => t.id === id)?.name ?? "colega").split(" ")[0];

  async function confirmar(id = escolhido) {
    if (id === original || salvando) return;
    setErro("");
    setSalvando(true);
    try {
      await atribuir(c, id);
      aoAtribuir(id ? `${c.protocolo} agora está com ${nome(id)}.` : `${c.protocolo} voltou para a fila.`, c.id);
      aoFechar();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  }

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); confirmar(); }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  const rotulo = !escolhido ? "Devolver para a fila" : escolhido === eu ? "Pegar para mim" : `Passar para ${nome(escolhido)}`;

  return (
    <PainelRapido
      idTitulo="titulo-atribuir"
      largura="max-w-lg"
      titulo={`Quem fica com o ${c.protocolo}?`}
      aoTentarFechar={() => {
        if (salvando) return;
        if (!mudou) return aoFechar();
        setSaindo((s) => !s);
      }}
      rodape={
        <>
          {erro && <p role="alert" className="mb-2 font-semibold text-alerta">{erro}</p>}
          <RodapeRascunho
            mudancas={mudou ? 1 : 0}
            saindo={saindo}
            salvando={salvando}
            rotuloSalvar={rotulo}
            aoSalvar={() => confirmar()}
            aoDescartar={() => setEscolhido(original)}
            aoContinuar={() => setSaindo(false)}
            aoSairSemSalvar={aoFechar}
            semMudancas={
              <div className="flex justify-end">
                <button type="button" className="btn-secundario" onClick={aoFechar}>Fechar</button>
              </div>
            }
          />
        </>
      }
    >
      <div onDoubleClick={(e) => { if ((e.target as HTMLElement).closest("label")) confirmar(); }}>
        <EscolhaResponsavel
          nomeGrupo="responsavel-atribuir"
          tecnicos={tecnicos}
          eu={eu}
          carga={carga}
          valor={escolhido}
          original={original}
          aoEscolher={(id) => { setSaindo(false); setEscolhido(id); }}
        />
      </div>
    </PainelRapido>
  );
}
