import { useEffect, useRef } from "react";
import { pb } from "./pb";

/**
 * Chama `aoMudar` sempre que algo muda na coleção (tempo real do PocketBase).
 * As regras de acesso valem aqui também: o solicitante só recebe os próprios chamados.
 *
 * DESEMPENHO: o tempo real mantém uma conexão aberta com o servidor. O navegador só abre
 * 6 conexões ao mesmo tempo para o mesmo endereço (HTTP/1.1); com 6 abas do Dino Desk abertas,
 * as outras requisições ficavam na fila e trocar de página levava 10+ segundos.
 * Por isso, aba em segundo plano solta a conexão (depois de 5 s escondida) e, ao voltar,
 * reconecta e recarrega os dados na hora.
 */
const ESPERA_AO_ESCONDER = 5000;

export function useRealtime(colecao: string, aoMudar: () => void) {
  const ref = useRef(aoMudar);
  ref.current = aoMudar;

  useEffect(() => {
    let debounce: number | undefined;
    let esconder: number | undefined;
    let cancelar: (() => void) | undefined;
    let ativo = true;
    let conectado = false;

    function conectar() {
      if (conectado || !ativo) return;
      conectado = true;
      pb.collection(colecao)
        .subscribe("*", () => {
          window.clearTimeout(debounce);
          debounce = window.setTimeout(() => ref.current(), 250);
        })
        .then((fn) => {
          if (ativo && conectado) cancelar = fn;
          else fn();
        })
        .catch(() => { conectado = false; });
    }

    function desconectar() {
      conectado = false;
      cancelar?.();
      cancelar = undefined;
    }

    function aoMudarVisibilidade() {
      window.clearTimeout(esconder);
      if (document.visibilityState === "hidden") {
        esconder = window.setTimeout(desconectar, ESPERA_AO_ESCONDER);
      } else if (!conectado) {
        conectar();
        ref.current(); // pode ter mudado algo enquanto a aba estava escondida
      }
    }

    if (document.visibilityState !== "hidden") conectar();
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    return () => {
      ativo = false;
      window.clearTimeout(debounce);
      window.clearTimeout(esconder);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
      desconectar();
    };
  }, [colecao]);
}
