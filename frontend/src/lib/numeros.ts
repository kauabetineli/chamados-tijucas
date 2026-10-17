import { Hourglass, Inbox, Wrench } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./auth";
import { atrasado } from "./fila";
import { ehTecnico, pb, type Chamado } from "./pb";
import { useRealtime } from "./useRealtime";

/**
 * Visões rápidas da Fila do técnico (/ti?visao=...): subitens da barra lateral no PC, abas no topo da Fila
 * e menu do ícone Fila (tocar de novo) no celular. `?ver=` já é o painel do chamado, por isso "visao".
 */
export const VISOES = [
  { id: "atendendo", rotulo: "Atendendo", Icone: Wrench, vazio: "Você não está atendendo nenhum chamado agora." },
  { id: "livres", rotulo: "Livres", Icone: Inbox, vazio: "Nenhum chamado livre na fila." },
  { id: "espera", rotulo: "Em espera", Icone: Hourglass, vazio: "Nenhum chamado seu em espera." },
] as const;
export type Visao = (typeof VISOES)[number]["id"];
export const ehVisao = (v: string | null): v is Visao => VISOES.some((x) => x.id === v);

export interface Numeros {
  /** TI: abertos na fila e quantos estão atrasados */
  fila: number;
  atrasados: number;
  /** TI: as visões (meus em atendimento, livres, meus em espera e quantos esperam resposta de quem pediu) */
  atendendo: number;
  livres: number;
  espera: number;
  esperaResposta: number;
  /** servidor: em aberto (inclui resolvido sem confirmar) e quantos precisam DELE (responder ou confirmar) */
  meus: number;
  precisaDeVoce: number;
}

/**
 * Números ao vivo do menu (barra lateral no PC, barra de baixo no celular). Uma consulta só, com poucos campos,
 * atualizada em tempo real. Usado uma vez no Layout e passado para quem precisa.
 */
export function useNumeros(): Numeros | null {
  const { usuario } = useAuth();
  const tecnico = ehTecnico(usuario);
  const [n, setN] = useState<Numeros | null>(null);
  const carregar = useCallback(async () => {
    if (!usuario) return;
    const zero = { fila: 0, atrasados: 0, atendendo: 0, livres: 0, espera: 0, esperaResposta: 0, meus: 0, precisaDeVoce: 0 };
    if (tecnico) {
      const lista = await pb.collection("chamados").getFullList<Chamado>({
        filter: 'status != "resolvido"',
        fields: "id,created,prioridade,status,responsavel,aguardando_motivo",
        requestKey: "menu-numeros",
      });
      const eu = usuario.id;
      const abertos = lista.filter((c) => c.status === "aberto");
      const espera = lista.filter((c) => c.status === "aguardando" && c.responsavel === eu);
      setN({
        ...zero,
        fila: abertos.length,
        atrasados: abertos.filter((c) => atrasado(c)).length,
        atendendo: lista.filter((c) => c.status === "em_andamento" && c.responsavel === eu).length,
        livres: abertos.filter((c) => !c.responsavel).length,
        espera: espera.length,
        esperaResposta: espera.filter((c) => c.aguardando_motivo === "solicitante").length,
      });
    } else {
      const lista = await pb.collection("chamados").getFullList<Chamado>({
        filter: pb.filter('solicitante = {:u} && (status != "resolvido" || confirmado = false)', { u: usuario.id }),
        fields: "id,status,aguardando_motivo,confirmado",
        requestKey: "menu-numeros",
      });
      setN({
        ...zero,
        meus: lista.length,
        precisaDeVoce: lista.filter((c) =>
          (c.status === "aguardando" && c.aguardando_motivo === "solicitante") || (c.status === "resolvido" && !c.confirmado)).length,
      });
    }
  }, [usuario, tecnico]);
  useEffect(() => {
    carregar().catch(() => {});
    const t = window.setInterval(() => carregar().catch(() => {}), 60_000); // "atrasado" muda com o tempo
    return () => window.clearInterval(t);
  }, [carregar]);
  useRealtime("chamados", () => carregar().catch(() => {}));
  return n;
}
