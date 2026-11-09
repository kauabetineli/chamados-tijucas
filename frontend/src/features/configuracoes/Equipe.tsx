import { useEffect, useState } from "react";
import { Avatar } from "../../components/Avatar";
import { Dica } from "../../components/Dica";
import { EsqueletoLinhas } from "../../components/Esqueleto";
import { SeloTeste } from "../../components/Selos";
import { avisar } from "../../lib/avisos";
import { salvarConfigTI, useConfigTI } from "../../lib/configTI";
import { mensagemErro, pb } from "../../lib/pb";
import { useEquipe, type Tecnico } from "./dados";

type Situacao = "disp" | "hoje" | "periodo";

const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const ddmm = (s: string) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : "");

function situacaoDe(t: Tecnico): Situacao {
  const hoje = hojeISO();
  if (!t.ausente_de && !t.ausente_ate) return "disp";
  if (t.ausente_ate && t.ausente_ate < hoje) return "disp";
  if (t.ausente_de === hoje && t.ausente_ate === hoje) return "hoje";
  return "periodo";
}

/** Equipe e ausências: quem está atendendo e quem recebe chamados das regras. Cada mudança salva na hora. */
export function Equipe({ equipe, recarregar }: { equipe: Tecnico[] | null; recarregar: () => void }) {
  const cfg = useConfigTI();
  const [destino, setDestino] = useState<"fica" | "fila">("fica");
  useEffect(() => { if (cfg.carregada) setDestino(cfg.config.destino_ausencia); }, [cfg.carregada, cfg.config.destino_ausencia]);

  async function salvarPessoa(t: Tecnico, corpo: Partial<Tecnico>, msg: string) {
    try {
      const r = await pb.send<{ devolvidos: number }>(`/api/ti/equipe/${t.id}`, { method: "PATCH", body: corpo });
      avisar(r.devolvidos ? `${msg} ${r.devolvidos} chamado${r.devolvidos > 1 ? "s voltaram" : " voltou"} para a fila.` : msg);
      recarregar();
    } catch (e) {
      avisar(mensagemErro(e), { tipo: "erro" });
      recarregar();
    }
  }

  async function mudarDestino(d: "fica" | "fila") {
    setDestino(d);
    try {
      await salvarConfigTI(cfg.id, { ...cfg.config, destino_ausencia: d });
      avisar(d === "fila" ? "Chamados de quem ficar ausente voltam para a fila." : "Chamados de quem ficar ausente continuam com a pessoa.");
    } catch (e) {
      avisar(mensagemErro(e), { tipo: "erro" });
    }
  }

  if (!equipe) return <EsqueletoLinhas quantos={3} />;
  const ativos = equipe.filter((t) => !t.bloqueado);

  return (
    <div className="max-w-3xl space-y-4">
      <h2 className="flex items-center gap-2 font-display text-lg font-extrabold md:text-xl">
        Quem está atendendo
        <span className="font-sans text-base font-normal">
          <Dica rotulo="Como funciona a ausência">Quem está ausente não recebe chamados das regras nem da divisão. A ausência termina sozinha na data marcada. Cada técnico também pode marcar a própria ausência no Perfil.</Dica>
        </span>
      </h2>
      {!ativos.length && <p className="rounded-xl bg-superficie p-4 text-tinta-2 ring-1 ring-linha">Nenhum técnico ativo.</p>}
      {/* uma linha por técnico (antes, um cartão grande com 3 botões cada) */}
      {ativos.length > 0 && (
        <ul className="divide-y divide-linha rounded-2xl bg-superficie ring-1 ring-linha">
          {ativos.map((t) => <li key={t.id}><CartaoPessoa t={t} salvar={(c, m) => salvarPessoa(t, c, m)} /></li>)}
        </ul>
      )}

      <fieldset className="space-y-2 rounded-2xl bg-superficie p-4 ring-1 ring-linha">
        <legend className="sr-only">Chamados de quem fica ausente</legend>
        <h3 className="font-bold" aria-hidden="true">Quando alguém fica ausente, os chamados que já estão com essa pessoa</h3>
        {([
          ["fica", "Continuam com a pessoa", "Bom para ausências curtas: ela retoma quando voltar."],
          ["fila", "Voltam para a fila, sem responsável", "Bom para férias: outro técnico pega. Quem pediu não perde o lugar na fila."],
        ] as const).map(([k, rot, ajuda]) => (
          <label key={k} className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 ${destino === k ? "bg-mar-50 ring-2 ring-acento" : "ring-linha"}`}>
            <input type="radio" name="destino-ausencia" checked={destino === k} onChange={() => mudarDestino(k)} className="mt-1 size-5 accent-acento" disabled={!cfg.carregada} />
            <span><b className="block">{rot}</b><span className="text-sm text-tinta-2">{ajuda}</span></span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}

/** Perfil do técnico: marcar a própria ausência (o "recebe chamados das regras" fica com o administrador). */
export function MinhaAusencia({ eu }: { eu: string }) {
  const { equipe, recarregar } = useEquipe();
  const t = equipe?.find((x) => x.id === eu);
  if (!equipe) return <EsqueletoLinhas quantos={1} />;
  if (!t) return null;
  return (
    <section aria-labelledby="titulo-minha-ausencia" className="space-y-2">
      <h2 id="titulo-minha-ausencia" className="text-lg font-bold md:text-xl">Minha situação</h2>
      <CartaoPessoa t={t} proprio salvar={async (corpo, msg) => {
        try {
          await pb.send(`/api/ti/equipe/${t.id}`, { method: "PATCH", body: corpo });
          avisar(msg.replace(`${t.nome.split(" ")[0]} está`, "Você está").replace(`de ${t.nome.split(" ")[0]} marcada`, "marcada"));
        } catch (e) { avisar(mensagemErro(e), { tipo: "erro" }); }
        recarregar();
      }} />
    </section>
  );
}

function CartaoPessoa({ t, salvar, proprio }: { t: Tecnico; salvar: (corpo: Partial<Tecnico>, msg: string) => void; proprio?: boolean }) {
  const sit = situacaoDe(t);
  const [de, setDe] = useState(t.ausente_de);
  const [ate, setAte] = useState(t.ausente_ate);
  const [motivo, setMotivo] = useState(t.ausencia_motivo);
  const [periodo, setPeriodo] = useState(sit === "periodo");
  useEffect(() => { setDe(t.ausente_de); setAte(t.ausente_ate); setMotivo(t.ausencia_motivo); setPeriodo(situacaoDe(t) === "periodo"); }, [t]);
  const primeiro = t.nome.split(" ")[0];
  const marcada: Situacao = periodo ? "periodo" : sit;

  const selo = t.ausente_hoje ? (sit === "hoje" ? "Fora hoje" : `Ausente até ${ddmm(t.ausente_ate)}`)
    : sit === "periodo" ? `Ausente de ${ddmm(t.ausente_de)} a ${ddmm(t.ausente_ate)}`
    : t.sem_automatico ? "Não recebe automáticos" : "Disponível";
  const ok = t.disponivel;

  function escolher(s: Situacao) {
    if (s === "disp") { setPeriodo(false); salvar({ ausente_de: "", ausente_ate: "", ausencia_motivo: "" }, `${primeiro} está disponível.`); }
    if (s === "hoje") { setPeriodo(false); const h = hojeISO(); salvar({ ausente_de: h, ausente_ate: h }, `${primeiro} está fora hoje.`); }
    if (s === "periodo") setPeriodo(true);
  }
  function salvarPeriodo(nde: string, nate: string) {
    if (!nde || !nate) return;
    if (nate < nde) { avisar("A volta não pode ser antes do começo da ausência.", { tipo: "erro" }); return; }
    salvar({ ausente_de: nde, ausente_ate: nate }, `Ausência de ${primeiro} marcada: ${ddmm(nde)} a ${ddmm(nate)}.`);
  }

  return (
    <article className={proprio ? "space-y-3 rounded-2xl bg-superficie p-4 ring-1 ring-linha" : "space-y-3 px-4 py-3"}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {proprio ? (
          // no Perfil o nome e o selo já estão no topo da página: aqui só a situação
          <span className={`rounded-full px-3 py-1 text-sm font-bold ${ok ? "bg-campo-50 text-ok" : "bg-sol-50 text-ambar-tinta"}`}>{selo}</span>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:min-w-48">
            <Avatar id={t.id} nome={t.nome} tamanho="sm" />
            <div className="min-w-0">
              <p className="flex min-w-0 items-center gap-2 font-bold"><span className="truncate">{t.nome}</span> <span className="max-sm:hidden"><SeloTeste ficticio={t.ficticio} compacto /></span></p>
              <p className="truncate text-sm text-tinta-2">
                {t.carga} em atendimento{t.admin ? ", administrador" : ""}
                {!ok && <>. <span className="font-semibold text-ambar-tinta">{selo}</span></>}
              </p>
            </div>
          </div>
        )}
        <div role="radiogroup" aria-label={`Situação de ${t.nome}`} className={`flex rounded-lg bg-fundo p-0.5 text-sm ring-1 ring-linha max-sm:order-2 max-sm:w-full ${proprio ? "sm:ml-auto" : ""}`}>
          {([["disp", "Disponível"], ["hoje", "Fora hoje"], ["periodo", "Período"]] as const).map(([k, rot]) => (
            <button key={k} type="button" role="radio" aria-checked={marcada === k} onClick={() => escolher(k)}
              title={k === "periodo" ? "Ausente por um período" : undefined}
              className={`min-h-10 rounded-md px-3 font-semibold max-sm:flex-1 ${marcada === k ? "bg-superficie text-tinta shadow-sm ring-1 ring-linha" : "text-tinta-2 hover:text-tinta"}`}>
              {rot}
            </button>
          ))}
        </div>
        {!proprio && (
          <label className="flex min-h-10 shrink-0 cursor-pointer items-center gap-2 text-sm font-semibold" title="Recebe chamados pelas regras de distribuição">
            <input type="checkbox" role="switch" className="size-5 accent-acento" checked={!t.sem_automatico}
              onChange={() => salvar({ sem_automatico: !t.sem_automatico }, t.sem_automatico ? `${primeiro} volta a receber chamados das regras.` : `${primeiro} não recebe mais chamados das regras.`)} />
            Automático
          </label>
        )}
      </div>
      {marcada === "periodo" && (
        <div className="grid gap-2 sm:grid-cols-[auto_auto_1fr]">
          <label className="flex flex-col gap-1 text-sm font-semibold">De
            <input type="date" className="campo" value={de} onChange={(e) => { setDe(e.target.value); salvarPeriodo(e.target.value, ate); }} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">Até
            <input type="date" className="campo" value={ate} min={de || undefined} onChange={(e) => { setAte(e.target.value); salvarPeriodo(de, e.target.value); }} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">Motivo (opcional, só o TI vê)
            <input className="campo" value={motivo} maxLength={120} placeholder="Ex.: férias, curso" onChange={(e) => setMotivo(e.target.value)}
              onBlur={() => { if (motivo !== t.ausencia_motivo) salvar({ ausencia_motivo: motivo }, "Motivo salvo."); }} />
          </label>
        </div>
      )}
      {proprio && t.sem_automatico && <p className="text-sm text-tinta-2">O administrador do TI deixou você fora da distribuição automática.</p>}
    </article>
  );
}
