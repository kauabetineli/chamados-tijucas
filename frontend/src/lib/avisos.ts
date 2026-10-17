/**
 * Avisos rápidos (toasts): aparecem no canto da tela, somem sozinhos e não atrapalham a navegação.
 * Use para CONFIRMAR uma ação ("2026-00012 agora está com Hugo."). Para erro que a pessoa precisa
 * corrigir num formulário, mostre o erro perto do campo, não aqui.
 *
 *   import { avisar } from "../lib/avisos";
 *   avisar("Chamado movido.");
 *   avisar("Não foi possível salvar.", { tipo: "erro" });
 *   avisar("Registrado como 2026-00031.", { link: { para: "/ti/chamado/abc", rotulo: "Abrir" } });
 */
export type TipoAviso = "ok" | "info" | "erro";
export interface Aviso {
  id: number;
  texto: string;
  tipo: TipoAviso;
  link?: { para: string; rotulo: string };
  /** milissegundos na tela */
  duracao: number;
}

let lista: Aviso[] = [];
let proximo = 1;
const ouvintes = new Set<() => void>();
const MAXIMO = 3;

function mudou() {
  for (const o of ouvintes) o();
}

export function avisar(texto: string, opcoes: { tipo?: TipoAviso; link?: Aviso["link"]; duracao?: number } = {}) {
  const tipo = opcoes.tipo ?? "ok";
  // erro fica um pouco mais, para dar tempo de ler
  const aviso: Aviso = { id: proximo++, texto, tipo, link: opcoes.link, duracao: opcoes.duracao ?? (tipo === "erro" ? 6000 : 3500) };
  // o mesmo texto de novo não empilha: substitui
  lista = [...lista.filter((a) => a.texto !== texto), aviso].slice(-MAXIMO);
  mudou();
  return aviso.id;
}

export function fecharAviso(id: number) {
  lista = lista.filter((a) => a.id !== id);
  mudou();
}

export function assinarAvisos(cb: () => void) {
  ouvintes.add(cb);
  return () => { ouvintes.delete(cb); };
}

export function avisosAtuais() {
  return lista;
}
