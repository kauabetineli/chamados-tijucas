import { Bug, Heart, ImagePlus, Lightbulb, MessageSquare, X } from "lucide-react";
import { useEffect, useRef, useState, type ClipboardEvent } from "react";
import { Link, useLocation } from "react-router";
import { avisar } from "../lib/avisos";
import { useAuth } from "../lib/auth";
import { aoAbrirOpiniao, nomeDaTela } from "../lib/opiniao";
import { ehTecnico, mensagemErro, pb } from "../lib/pb";
import { prepararArquivo } from "../lib/imagem";
import { useMediaQuery } from "../lib/useMediaQuery";
import { PainelRapido } from "./PainelRapido";
import { useVerChamado } from "../lib/verChamado";

/**
 * "Sua opinião": botão no canto de baixo do PC e janela de envio (o celular abre pela tela "Você").
 * O botão some nas telas com botão de enviar no rodapé (Novo chamado, Registrar, Configurações do TI)
 * e some enquanto um chamado está aberto na gaveta da direita.
 */

const SEM_BOTAO = ["/novo", "/ti/registrar", "/ti/configuracoes", "/projeto/feedback"];

type Tipo = "problema" | "ideia" | "elogio";
const TIPOS: { v: Tipo; rotulo: string; I: typeof Bug; pergunta: string; exemplo: string }[] = [
  { v: "problema", rotulo: "Algo deu errado", I: Bug, pergunta: "O que aconteceu?", exemplo: "Ex.: cliquei em Enviar e a tela ficou em branco." },
  { v: "ideia", rotulo: "Ideia", I: Lightbulb, pergunta: "Qual é a ideia?", exemplo: "Ex.: poder filtrar os chamados por prédio." },
  { v: "elogio", rotulo: "Elogio", I: Heart, pergunta: "O que você gostou?", exemplo: "Ex.: ficou fácil acompanhar meu chamado." },
];
const NOTAS = ["Muito difícil", "Difícil", "Mais ou menos", "Fácil", "Muito fácil"];

export function Opiniao() {
  const { usuario } = useAuth();
  const caminho = useLocation().pathname;
  const [aberta, setAberta] = useState<null | { nota?: boolean }>(null);
  // com um chamado aberto na gaveta, o botão sai da frente (a lista fica estreita)
  const { aberto: chamadoAberto } = useVerChamado();
  useEffect(() => aoAbrirOpiniao((o) => setAberta(o)), []);
  if (!usuario) return null;
  return (
    <>
      {!SEM_BOTAO.includes(caminho) && !chamadoAberto && (
        // redondo e discreto; o nome aparece ao passar o mouse ou focar (não cobre a última linha das tabelas)
        <button
          type="button"
          onClick={() => setAberta({})}
          aria-label="Sua opinião sobre o sistema"
          className="group fora-da-gaveta fixed right-6 z-30 hidden h-12 items-center rounded-full bg-noite p-1 font-bold text-white shadow-lg ring-1 ring-white/10 hover:bg-mar-700 focus-visible:bg-mar-700 md:flex print:hidden"
          style={{ bottom: "1.5rem" }}
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-campo"><MessageSquare className="size-5" aria-hidden="true" /></span>
          <span className="max-w-0 overflow-hidden whitespace-nowrap transition-[max-width,padding] duration-200 group-hover:max-w-40 group-hover:px-3 group-focus-visible:max-w-40 group-focus-visible:px-3" aria-hidden="true">
            Sua opinião
          </span>
        </button>
      )}
      {aberta && <JanelaOpiniao soNota={!!aberta.nota} tecnico={ehTecnico(usuario)} tela={nomeDaTela(caminho)} aoFechar={() => setAberta(null)} />}
    </>
  );
}

function JanelaOpiniao({ soNota, tecnico, tela, aoFechar }: { soNota: boolean; tecnico: boolean; tela: string; aoFechar: () => void }) {
  const [tipo, setTipo] = useState<Tipo | "">("");
  const [texto, setTexto] = useState("");
  const [nota, setNota] = useState(0);
  const [imagem, setImagem] = useState<{ arquivo: File; url: string } | null>(null);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const escolher = useRef<HTMLInputElement>(null);
  const noPc = useMediaQuery("(pointer: fine)");
  const t = TIPOS.find((x) => x.v === tipo);

  useEffect(() => () => { if (imagem) URL.revokeObjectURL(imagem.url); }, [imagem]);

  async function usarImagem(f: File | undefined) {
    if (!f || !f.type.startsWith("image/")) return;
    const pronto = await prepararArquivo(f);
    if (pronto.size > 10 * 1024 * 1024) return setErro("A imagem passa de 10 MB. Tente um print menor.");
    setErro("");
    setImagem({ arquivo: pronto, url: URL.createObjectURL(pronto) });
  }
  function colar(e: ClipboardEvent) {
    const img = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
    if (img) { e.preventDefault(); usarImagem(img); }
  }

  async function enviar() {
    setErro("");
    const tipoFinal = tipo || (nota ? "nota" : "");
    if (!tipoFinal) return setErro(soNota ? "Escolha uma nota de 1 a 5." : "Escolha: algo deu errado, ideia ou elogio.");
    if (tipoFinal !== "nota" && texto.trim().length < 3) return setErro("Escreva em poucas palavras.");
    setEnviando(true);
    try {
      const dados = new FormData();
      dados.append("tipo", tipoFinal);
      dados.append("texto", texto.trim());
      dados.append("tela", tela);
      dados.append("nota", String(nota));
      if (imagem) dados.append("imagem", imagem.arquivo);
      await pb.send("/api/feedback", { method: "POST", body: dados });
      avisar("Obrigado! A equipe do projeto vai ler.");
      aoFechar();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <PainelRapido
      idTitulo="titulo-opiniao"
      largura="max-w-md"
      titulo="Sua opinião"
      subtitulo={
        <p className="mt-0.5 text-sm text-tinta-2">
          Vai para quem faz o Dino Desk (UNIVALI), não para o TI.
          {!tecnico && <> Problema no computador? <Link to="/novo" onClick={aoFechar} className="font-bold text-acento underline">Abra um chamado</Link>.</>}
        </p>
      }
      aoTentarFechar={aoFechar}
      rodape={
        <button type="button" className="btn-primario w-full" disabled={enviando} onClick={enviar}>{enviando ? "Enviando..." : "Enviar"}</button>
      }
    >
      <div className="space-y-5" onPaste={colar}>
        {!soNota && (
          <fieldset>
            <legend className="sr-only">Sobre o quê?</legend>
            <div className="grid grid-cols-3 gap-2">
              {TIPOS.map(({ v, rotulo, I }) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={tipo === v}
                  onClick={() => setTipo(v)}
                  className={`flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl px-1 text-center text-sm font-bold ring-1 ${
                    tipo === v ? "bg-mar-50 text-acento ring-2 ring-acento" : "ring-linha hover:ring-acento"
                  }`}
                >
                  <I className="size-6" aria-hidden="true" />
                  {rotulo}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {(soNota || tipo) && (
          <div className="space-y-2">
            <label htmlFor="texto-opiniao" className="text-sm font-bold">{soNota ? "Quer contar algo? (opcional)" : t?.pergunta}</label>
            <textarea
              id="texto-opiniao"
              autoFocus={!soNota}
              className="campo min-h-24 w-full"
              maxLength={2000}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={t?.exemplo}
            />
            {!soNota && (imagem ? (
              <div className="relative inline-block">
                <img src={imagem.url} alt="Print anexado" className="max-h-32 rounded-lg ring-1 ring-linha" />
                <button type="button" onClick={() => setImagem(null)} aria-label="Tirar o print"
                  className="absolute -top-2 -right-2 grid size-8 place-items-center rounded-full bg-superficie ring-1 ring-linha hover:text-alerta">
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <p className="flex flex-wrap items-center gap-x-2 text-sm text-tinta-2">
                <button type="button" onClick={() => escolher.current?.click()} className="inline-flex min-h-10 items-center gap-1.5 font-semibold text-acento">
                  <ImagePlus className="size-4" aria-hidden="true" /> {tipo === "problema" ? "Anexar print da tela" : "Anexar imagem"}
                </button>
                {noPc && <span>ou cole com Ctrl+V</span>}
              </p>
            ))}
            <input ref={escolher} type="file" accept="image/*" className="hidden" onChange={(e) => { usarImagem(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
        )}

        <fieldset>
          <legend className="mb-2 text-sm font-bold">
            Como está sendo usar o Dino Desk? {!soNota && <span className="font-normal text-tinta-2">(opcional)</span>}
          </legend>
          <div className="grid grid-cols-5 gap-1.5">
            {NOTAS.map((nome, i) => (
              <button
                key={i}
                type="button"
                aria-pressed={nota === i + 1}
                aria-label={`${i + 1}: ${nome}`}
                title={nome}
                onClick={() => setNota(nota === i + 1 ? 0 : i + 1)}
                className={`h-11 rounded-xl font-bold ring-1 ${nota === i + 1 ? "bg-mar-700 text-white ring-acento" : "ring-linha hover:ring-acento"}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <p className="mt-1 flex justify-between text-xs text-tinta-2">
            <span>muito difícil</span>
            {nota > 0 && <span className="font-semibold text-tinta">{NOTAS[nota - 1]}</span>}
            <span>muito fácil</span>
          </p>
        </fieldset>

        <p className="text-xs text-tinta-2">Vai junto: seu nome, setor e a tela em que você estava ({tela}).</p>
        {erro && <p role="alert" className="font-bold text-alerta">{erro}</p>}
      </div>
    </PainelRapido>
  );
}
