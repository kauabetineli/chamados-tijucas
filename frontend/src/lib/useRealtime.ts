import { useEffect, useRef } from "react";
import { pb } from "./pb";

/**
 * Chama `aoMudar` sempre que algo muda na coleção (tempo real do PocketBase).
 * As regras de acesso valem aqui também: o solicitante só recebe os próprios chamados.
 */
export function useRealtime(colecao: string, aoMudar: () => void) {
  const ref = useRef(aoMudar);
  ref.current = aoMudar;
  useEffect(() => {
    let timer: number | undefined;
    let cancelar: (() => void) | undefined;
    let ativo = true;
    pb.collection(colecao)
      .subscribe("*", () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => ref.current(), 250);
      })
      .then((fn) => {
        if (ativo) cancelar = fn;
        else fn();
      })
      .catch(() => {});
    return () => {
      ativo = false;
      window.clearTimeout(timer);
      cancelar?.();
    };
  }, [colecao]);
}
