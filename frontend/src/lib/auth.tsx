import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { pb, usuarioAtual, type Usuario } from "./pb";

interface AuthCtx {
  usuario: Usuario | null;
  sair: () => void;
}

const Ctx = createContext<AuthCtx>({ usuario: null, sair: () => {} });

function assinar(cb: () => void) {
  return pb.authStore.onChange(cb);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // o authStore muda de objeto a cada login/refresh; o token serve de "versão"
  useSyncExternalStore(assinar, () => pb.authStore.token);
  const usuario = usuarioAtual();

  // renova a sessão ao abrir o app (e descobre se o papel mudou, ex.: virou técnico)
  useEffect(() => {
    if (pb.authStore.isValid && usuario) {
      pb.collection("users").authRefresh({ expand: "setor" }).catch(() => pb.authStore.clear());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Ctx.Provider value={{ usuario, sair: () => { senhaDoLogin = ""; pb.authStore.clear(); } }}>{children}</Ctx.Provider>;
}

// Senha digitada no login, guardada SÓ na memória (some ao recarregar a página):
// se a conta está com senha provisória, a tela "Crie a sua senha" não precisa pedir de novo.
let senhaDoLogin = "";
export function lembrarSenhaDoLogin(senha: string) {
  senhaDoLogin = senha;
}
export function senhaLembrada() {
  return senhaDoLogin;
}

export function useAuth() {
  return useContext(Ctx);
}
