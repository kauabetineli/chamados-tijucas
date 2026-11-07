import { MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { avisar } from "../lib/avisos";
import { useAuth } from "../lib/auth";
import { aoAbrirOpiniao, nomeDaTela } from "../lib/opiniao";
import { ehTecnico, mensagemErro, pb } from "../lib/pb";
import { PainelRapido } from "./PainelRapido";

/**
 * "Sua opinião": botão no canto de baixo do PC e janela de envio (o celular abre pela tela "Você").
 * O botão some nas telas com botão de enviar no rodapé (Novo chamado, Registrar, Configurações do TI)
 * e sobe junto com o painel do chamado aberto.
 */

const SEM_BOTAO = ["/novo", "/ti/registrar", "/ti/configuracoes", "/projeto/feedback"];

type Tipo = "problema" | "ideia" | "elogio";
const TIPOS: { v: Tipo; titulo: string; detalhe?: string }[] = [
  { v: "problema", titulo: "Algo no sistema não funcionou", detalhe: "um botão, uma tela, uma mensagem estranha" },
  { v: "ideia", titulo: "Tenho uma ideia" },
  { v: "elogio", titulo: "Quero elogiar" },
];

export function Opiniao() {
  const { usuario } = useAuth();
  const caminho = useLocation().pathname;
  const [aberta, setAberta] = useState<null | { nota?: boolean }>(null);
  useEffect(() => aoAbrirOpiniao((o) => setAberta(o)), []);
  if (!usuario) return null;
  return (
    <>
      {!SEM_BOTAO.includes(caminho) && (
        <button
          type="button"
          onClick={() => setAberta({})}
          className="fixed right-6 z-30 hidden h-14 items-center gap-2.5 rounded-full bg-noite py-2 pr-5 pl-2 font-bold text-white shadow-lg ring-1 ring-white/10 hover:bg-mar-700 md:flex print:hidden"
          style={{ bottom: "calc(1.5rem + var(--altura-painel, 0px))" }}
        >
          <span className="grid size-10 place-items-center rounded-full bg-campo"><MessageSquare className="size-5" aria-hidden="true" /></span>
          Sua opinião
        </button>
      )}
      {aberta && <JanelaOpiniao soNota={!!aberta.nota} tecnico={ehTecnico(usuario)} tela={nomeDaTela(caminho)} aoFechar={() => setAberta(null)} />}
    </>
  );
}

function JanelaOpiniao({ soNota, tecnico, tela, aoFechar }: { soNota: boolean; tecnico: boolean; tela: string; aoFechar: () => void }) {
  const [tipo, setTipo] = useState<Tipo | "">(soNota ? "" : "problema");
  const [texto, setTexto] = useState("");
  const [comTela, setComTela] = useState(true);
  const [nota, setNota] = useState(0);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setErro("");
    const t = tipo || (nota ? "nota" : "");
    if (!t) return setErro("Escolha sobre o que é a sua opinião, ou dê uma nota.");
    if (t !== "nota" && texto.trim().length < 3) return setErro("Escreva em poucas palavras o que aconteceu ou o que você pensou.");
    setEnviando(true);
    try {
      await pb.send("/api/feedback", { method: "POST", body: { tipo: t, texto: texto.trim(), tela: comTela ? tela : "", nota } });
      avisar("Obrigado! A equipe do projeto vai ler a sua opinião.");
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
      titulo="Fale com quem faz o Dino Desk"
      subtitulo={
        <p className="mt-0.5 text-sm text-tinta-2">
          Vai para a equipe do projeto (UNIVALI), não para o TI.{" "}
          {!tecnico && <>Problema no seu computador? <Link to="/novo" onClick={aoFechar} className="font-bold text-acento underline">Abra um chamado</Link>.</>}
        </p>
      }
      aoTentarFechar={aoFechar}
      rodape={
        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <button type="button" className="btn-secundario" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="btn-primario" disabled={enviando} onClick={enviar}>{enviando ? "Enviando..." : "Enviar"}</button>
        </div>
      }
    >
      <div className="space-y-4">
        {soNota ? (
          <p className="font-semibold">Dê uma nota para o sistema e, se quiser, conte por quê.</p>
        ) : (
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-bold">Sobre o quê?</legend>
            {TIPOS.map((o) => (
              <label key={o.v} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 ring-1 ${tipo === o.v ? "bg-mar-50 ring-2 ring-acento" : "ring-linha hover:ring-acento"}`}>
                <input type="radio" name="tipo-opiniao" className="size-5 accent-acento" checked={tipo === o.v} onChange={() => setTipo(o.v)} />
                <span>
                  <span className="block font-bold">{o.titulo}</span>
                  {o.detalhe && <span className="block text-sm text-tinta-2">{o.detalhe}</span>}
                </span>
              </label>
            ))}
          </fieldset>
        )}

        <label className="block space-y-1">
          <span className="text-sm font-bold">{soNota ? "Quer contar algo? (opcional)" : tipo === "elogio" ? "O que você gostou?" : tipo === "ideia" ? "Qual é a ideia?" : "Conte o que aconteceu"}</span>
          <textarea
            className="campo min-h-24 w-full"
            maxLength={2000}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={tipo === "problema" ? "Ex.: cliquei em Enviar e a tela ficou em branco." : ""}
          />
        </label>

        {!soNota && (
          <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm">
            <input type="checkbox" className="size-5 accent-acento" checked={comTela} onChange={() => setComTela(!comTela)} />
            Enviar junto em qual tela eu estava ({tela})
          </label>
        )}

        <fieldset>
          <legend className="mb-2 text-sm font-bold">De 1 a 5, como está sendo usar o sistema? {!soNota && <span className="font-normal text-tinta-2">(opcional)</span>}</legend>
          <div className="grid grid-cols-5 gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={nota === n}
                onClick={() => setNota(nota === n ? 0 : n)}
                className={`h-11 rounded-xl font-bold ring-1 ${nota === n ? "bg-mar-700 text-white ring-acento" : "ring-linha hover:ring-acento"}`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="mt-1 flex justify-between text-xs text-tinta-2"><span>difícil</span><span>muito fácil</span></p>
        </fieldset>

        {erro && <p role="alert" className="font-bold text-alerta">{erro}</p>}
      </div>
    </PainelRapido>
  );
}
