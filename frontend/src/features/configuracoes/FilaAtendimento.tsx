import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Dica } from "../../components/Dica";
import { EsqueletoLinhas } from "../../components/Esqueleto";
import { BarraSalvar } from "./BarraSalvar";
import { EtiquetaPrioridade } from "../../components/Selos";
import { avisar } from "../../lib/avisos";
import {
  DIAS_CURTOS, mensagemForaDoHorario, OPCOES_PRAZO, ROTULO_ORDEM, salvarConfigTI, textoHorario, textoMinutos, useConfigTI, type ConfigTI,
} from "../../lib/configTI";
import { tempoRelativo } from "../../lib/formato";
import { mensagemErro, pb, type Chamado, type Prioridade } from "../../lib/pb";

const PESO: Record<Prioridade, number> = { baixa: 1, normal: 2, alta: 3, urgente: 4 };
const ROT_PRIO: Record<Prioridade, string> = { baixa: "Baixa", normal: "Normal", alta: "Alta", urgente: "Urgente" };
const MODOS: { k: ConfigTI["ordem_fila"]; ajuda: string; rec?: boolean }[] = [
  { k: "prazo", rec: true, ajuda: "Quem vence antes vem antes." },
  { k: "prioridade", ajuda: "Urgentes primeiro, depois por chegada." },
  { k: "chegada", ajuda: "Na ordem em que chegaram." },
];

/** Prévia da ordem (aproximada: não conta o horário de atendimento). */
function ordenar(lista: Chamado[], cfg: ConfigTI) {
  const criado = (c: Chamado) => new Date(c.created.replace(" ", "T")).getTime();
  const prazo = (c: Chamado) => criado(c) + (c.prazo_regra_min || cfg.prazos[c.prioridade]) * 60000;
  const chave = (c: Chamado) => cfg.ordem_fila === "prazo" ? prazo(c)
    : cfg.ordem_fila === "prioridade" ? (5 - PESO[c.prioridade]) * 1e13 + criado(c) : criado(c);
  return [...lista].sort((a, b) => chave(a) - chave(b)).map((c) => ({ c, vence: prazo(c) }));
}

export function FilaAtendimento() {
  const { id, config, carregada } = useConfigTI();
  const [salva, setSalva] = useState<ConfigTI | null>(null);
  const [cfg, setCfg] = useState<ConfigTI | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [amostra, setAmostra] = useState<Chamado[] | null>(null);

  useEffect(() => { if (carregada && !salva) { setSalva(config); setCfg(config); } }, [carregada, config, salva]);
  useEffect(() => {
    pb.collection("chamados").getList<Chamado>(1, 40, { filter: 'status = "aberto"', sort: "ordem_fila,created", fields: "id,protocolo,descricao,prioridade,created,prazo_regra_min" })
      .then((r) => setAmostra(r.items)).catch(() => setAmostra([]));
  }, []);

  const sujo = !!cfg && !!salva && JSON.stringify(cfg) !== JSON.stringify(salva);
  useEffect(() => {
    if (!sujo) return;
    const f = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [sujo]);
  const previa = useMemo(() => (cfg && amostra ? ordenar(amostra, cfg).slice(0, 6) : []), [cfg, amostra]);

  if (!cfg || !salva) return <EsqueletoLinhas quantos={5} />;
  const set = (o: Partial<ConfigTI>) => setCfg({ ...cfg, ...o });
  const erroHorario = cfg.horario.ativo && (!cfg.horario.dias.length ? "Escolha pelo menos um dia." : cfg.horario.fim <= cfg.horario.inicio ? "O fim precisa ser depois do começo." : "");

  async function salvar() {
    if (!cfg || erroHorario) return;
    setSalvando(true);
    try {
      const nova = await salvarConfigTI(id, cfg);
      setSalva(nova); setCfg(nova);
      avisar(cfg.ordem_fila !== salva?.ordem_fila || JSON.stringify(cfg.prazos) !== JSON.stringify(salva?.prazos) || JSON.stringify(cfg.horario) !== JSON.stringify(salva?.horario)
        ? "Salvo. A fila foi reorganizada com a configuração nova." : "Salvo.");
    } catch (e) {
      avisar(mensagemErro(e), { tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-4">
          <Secao titulo="Ordem da fila" ajuda="Define quem é o “Seu próximo” do técnico e a posição que o servidor vê na senha amarela.">
            <div role="radiogroup" aria-label="Ordem da fila" className="grid gap-2 md:grid-cols-3">
              {MODOS.map((m) => {
                const on = cfg.ordem_fila === m.k;
                return (
                  <button key={m.k} type="button" role="radio" aria-checked={on} onClick={() => set({ ordem_fila: m.k })}
                    className={`flex min-h-12 flex-col items-start gap-1 rounded-xl p-3 text-left ${on ? "bg-mar-50 ring-2 ring-acento" : "ring-1 ring-linha hover:ring-acento"}`}>
                    <span className="flex flex-wrap items-center gap-2 font-bold">
                      {ROTULO_ORDEM[m.k]}
                      {m.rec && <span className="rounded-full bg-campo-50 px-2 py-0.5 text-xs font-bold text-ok">Recomendado</span>}
                    </span>
                    <span className="text-sm text-tinta-2">{m.ajuda}</span>
                  </button>
                );
              })}
            </div>
            <div className="rounded-xl bg-fundo p-3 ring-1 ring-linha">
              <p className="mb-2 text-xs font-bold tracking-wider text-tinta-2 uppercase">Como ficaria a fila agora</p>
              {!amostra ? <EsqueletoLinhas quantos={3} /> : !previa.length ? (
                <p className="text-sm text-tinta-2">Nenhum chamado esperando na fila agora.</p>
              ) : (
                <ol className="space-y-1.5">
                  {previa.map(({ c, vence }, i) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg bg-superficie px-3 py-2 text-sm ring-1 ring-linha">
                      <b className="w-6 font-display">{i + 1}º</b>
                      <EtiquetaPrioridade prioridade={c.prioridade} sempre />
                      <span className="min-w-0 flex-[1_1_12rem] truncate">{c.descricao}</span>
                      <span className="text-tinta-2">{tempoRelativo(c.created)}</span>
                      <span className={vence < Date.now() ? "font-bold text-alerta" : "text-tinta-2"}>
                        {vence < Date.now() ? "passou do prazo" : `prazo ${new Date(vence).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </Secao>

          <Secao titulo="Prazo para começar o atendimento"
            ajuda={<>
              Passou do prazo, o chamado aparece como atrasado na Fila. No modo “Pelo prazo”, também define a ordem.
              Uma regra da automação pode dar outro prazo a um caso específico.
              {cfg.horario.ativo && <> Os prazos só contam dentro do horário de atendimento ({textoHorario(cfg)}).</>}
            </>}>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {(["urgente", "alta", "normal", "baixa"] as Prioridade[]).map((p) => (
                <label key={p} className="flex flex-col gap-1 font-semibold">
                  {ROT_PRIO[p]}
                  <select className="campo" value={cfg.prazos[p]} onChange={(e) => set({ prazos: { ...cfg.prazos, [p]: parseInt(e.target.value, 10) } })}>
                    {OPCOES_PRAZO.map((m) => <option key={m} value={m}>{textoMinutos(m)}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </Secao>

          <section className="space-y-3 rounded-2xl bg-superficie p-4 ring-1 ring-linha md:p-5">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" role="switch" className="mt-1 size-5 accent-acento" checked={cfg.servidor_prioridade} onChange={() => set({ servidor_prioridade: !cfg.servidor_prioridade })} />
              <span>
                <span className="flex items-center gap-2 font-display text-lg font-extrabold">
                  Quem abre o chamado pode aumentar a prioridade
                  <span className="font-sans text-base font-normal"><Dica rotulo="Como funciona">O “Isso está atrapalhando quem?” continua sugerindo. Logo abaixo, a pessoa pode subir a prioridade, por exemplo para Urgente mesmo quando só ela foi afetada.</Dica></span>
                </span>
              </span>
            </label>
            {cfg.servidor_prioridade && (
              <div className="space-y-3 border-t border-linha pt-3 sm:pl-8">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold">Pode subir até</span>
                  <div role="radiogroup" aria-label="Pode subir até" className="flex gap-2">
                    {(["alta", "urgente"] as const).map((t) => (
                      <button key={t} type="button" role="radio" aria-checked={cfg.teto_prioridade === t} onClick={() => set({ teto_prioridade: t })}
                        className={`min-h-11 rounded-xl px-4 font-bold ${cfg.teto_prioridade === t ? "bg-mar-50 ring-2 ring-acento" : "text-tinta-2 ring-1 ring-linha"}`}>
                        {ROT_PRIO[t]}
                      </button>
                    ))}
                  </div>
                </div>
                {cfg.teto_prioridade === "urgente" && (
                  <Caixa marcado={cfg.pedir_motivo_urgente} aoMudar={() => set({ pedir_motivo_urgente: !cfg.pedir_motivo_urgente })}>
                    Pedir um motivo curto quando subir para Urgente
                  </Caixa>
                )}
                <Caixa marcado={cfg.marcar_escolhida} aoMudar={() => set({ marcar_escolhida: !cfg.marcar_escolhida })}>
                  Mostrar na Fila que a prioridade foi escolhida por quem pediu
                </Caixa>
              </div>
            )}
          </section>

          <Secao titulo="Chamado parado sobe até"
            ajuda="Os fluxos de tempo (por exemplo, ninguém começou em 30 minutos) podem subir a prioridade sozinhos. Com Alta, Urgente fica só para o que quem pediu marcou e para o TI; senão, com o tempo, tudo vira urgente.">
            <div role="radiogroup" aria-label="Chamado parado sobe até" className="flex gap-2">
              {(["alta", "urgente"] as const).map((t) => (
                <button key={t} type="button" role="radio" aria-checked={cfg.teto_tempo === t} onClick={() => set({ teto_tempo: t })}
                  className={`min-h-11 rounded-xl px-4 font-bold ${cfg.teto_tempo === t ? "bg-mar-50 ring-2 ring-acento" : "text-tinta-2 ring-1 ring-linha"}`}>
                  {ROT_PRIO[t]}{t === "alta" ? " (recomendado)" : ""}
                </button>
              ))}
            </div>
          </Secao>

          <Secao titulo="Resolvido sem resposta"
            ajuda="Se quem pediu não responder “Deu certo?”, o chamado é considerado resolvido depois desse prazo. A pessoa vê quantos dias faltam. Não conta como satisfação no Painel, e ela ainda pode reabrir.">
            <label className="flex flex-wrap items-center gap-3 font-semibold">
              Considerar resolvido depois de
              <select className="campo w-auto" value={cfg.dias_confirmar} onChange={(e) => set({ dias_confirmar: parseInt(e.target.value, 10) })}>
                <option value={0}>nunca (espera a resposta)</option>
                {[1, 2, 3, 5, 7, 10].map((n) => <option key={n} value={n}>{n} {n === 1 ? "dia útil" : "dias úteis"}</option>)}
              </select>
            </label>
          </Secao>

          <section className="space-y-3 rounded-2xl bg-superficie p-4 ring-1 ring-linha md:p-5">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" role="switch" className="mt-1 size-5 accent-acento" checked={cfg.horario.ativo} onChange={() => set({ horario: { ...cfg.horario, ativo: !cfg.horario.ativo } })} />
              <span>
                <span className="flex items-center gap-2 font-display text-lg font-extrabold">
                  Horário de atendimento do TI
                  <span className="font-sans text-base font-normal"><Dica rotulo="O que muda fora do horário">Fora desse horário o chamado é aceito normalmente, e quem abriu fica sabendo quando o TI volta. O prazo só conta dentro do horário.</Dica></span>
                </span>
              </span>
            </label>
            {cfg.horario.ativo && (
              <div className="space-y-3 border-t border-linha pt-3 sm:pl-8">
                <div className="flex flex-wrap gap-2" role="group" aria-label="Dias de atendimento">
                  {DIAS_CURTOS.map((d, i) => {
                    const on = cfg.horario.dias.includes(i);
                    return (
                      <button key={d} type="button" aria-pressed={on}
                        onClick={() => set({ horario: { ...cfg.horario, dias: on ? cfg.horario.dias.filter((x) => x !== i) : [...cfg.horario.dias, i].sort() } })}
                        className={`min-h-12 min-w-14 rounded-xl px-3 font-bold ${on ? "bg-mar-700 text-white" : "text-tinta-2 ring-1 ring-linha"}`}>
                        {d}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-3">
                  <label className="flex flex-col gap-1 font-semibold">Das
                    <input type="time" className="campo" value={cfg.horario.inicio} onChange={(e) => set({ horario: { ...cfg.horario, inicio: e.target.value } })} />
                  </label>
                  <label className="flex flex-col gap-1 font-semibold">Às
                    <input type="time" className="campo" value={cfg.horario.fim} onChange={(e) => set({ horario: { ...cfg.horario, fim: e.target.value } })} />
                  </label>
                </div>
                {erroHorario && <p role="alert" className="font-bold text-alerta">{erroHorario}</p>}
              </div>
            )}
          </section>
        </div>

        {/* prévia: o que quem abre o chamado vê */}
        <aside className="space-y-3 lg:sticky lg:top-4 lg:w-80 lg:shrink-0" aria-label="Como aparece para quem abre o chamado">
          <p className="text-xs font-bold tracking-wider text-tinta-2 uppercase">Para quem abre o chamado</p>
          <div className="space-y-2 rounded-2xl bg-superficie p-4 ring-1 ring-linha">
            <p className="font-bold">Isso está atrapalhando quem?</p>
            {["Só eu", "Meu setor inteiro", "O atendimento ao público parou"].map((t) => (
              <p key={t} className="rounded-lg px-3 py-2 text-sm ring-1 ring-linha">{t}</p>
            ))}
            {cfg.servidor_prioridade ? (
              <div className="border-t border-linha pt-2 text-sm">
                <p className="font-bold">Prioridade</p>
                <p className="text-tinta-2">
                  Pode escolher {cfg.teto_prioridade === "urgente" ? "Normal, Alta ou Urgente" : "Normal ou Alta"}
                  {cfg.teto_prioridade === "urgente" && cfg.pedir_motivo_urgente ? "; para Urgente, conta o motivo" : ""}.
                </p>
              </div>
            ) : <p className="text-sm text-tinta-2">A prioridade vem só da resposta acima.</p>}
          </div>
          {cfg.horario.ativo && (
            <>
              <p className="text-xs font-bold tracking-wider text-tinta-2 uppercase">Depois de enviar, fora do horário</p>
              <p className="rounded-2xl bg-sol-50 p-4 text-sm font-semibold text-ambar-tinta">
                Chamado aberto. {mensagemForaDoHorario(cfg)}
              </p>
            </>
          )}
        </aside>
      </div>
      {sujo && (
        <BarraSalvar salvando={salvando} aoSalvar={salvar} desabilitado={!!erroHorario} aoDescartar={() => setCfg(salva)} texto="Alterações não salvas." />
      )}
    </div>
  );
}

function Secao({ titulo, ajuda, children }: { titulo: string; ajuda: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl bg-superficie p-4 ring-1 ring-linha md:p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-extrabold">
        {titulo}
        <span className="font-sans text-base font-normal"><Dica rotulo={`Ajuda: ${titulo.toLowerCase()}`}>{ajuda}</Dica></span>
      </h2>
      {children}
    </section>
  );
}

function Caixa({ marcado, aoMudar, children }: { marcado: boolean; aoMudar: () => void; children: ReactNode }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 font-semibold">
      <input type="checkbox" className="size-5 accent-acento" checked={marcado} onChange={aoMudar} />
      {children}
    </label>
  );
}
