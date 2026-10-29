import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useSearchParams } from "react-router";
import { Layout } from "./components/Layout";
import { AuthProvider, useAuth } from "./lib/auth";
import { destinoSeguro, ehTecnico } from "./lib/pb";
import { Chamado } from "./pages/Chamado";
import { Entrar } from "./pages/Entrar";
import { MeusChamados } from "./pages/MeusChamados";
import { NovoChamado } from "./pages/NovoChamado";
import { Perfil } from "./pages/Perfil";
import { Configuracoes } from "./pages/Configuracoes";
import { TrocarSenha } from "./pages/TrocarSenha";
import { ConfiguracoesTI } from "./pages/ti/ConfiguracoesTI";
import { Fila } from "./pages/ti/Fila";
import { Historico } from "./pages/ti/Historico";
import { Painel } from "./pages/ti/Painel";
import { QrCodes } from "./pages/ti/QrCodes";
import { Registrar } from "./pages/ti/Registrar";
import { TodosChamados } from "./pages/ti/TodosChamados";
import { Usuarios } from "./pages/ti/Usuarios";

function Protegida({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const loc = useLocation();
  if (!usuario) {
    // guarda o destino (ex.: /novo, vindo do QR code) para depois do login
    return <Navigate to={`/entrar?voltar=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  }
  // senha provisória: nada do sistema antes de escolher a própria senha
  if (usuario.trocar_senha) return <TrocarSenha />;
  return children;
}

function SoTecnico({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  return ehTecnico(usuario) ? children : <Navigate to="/" replace />;
}

function Inicio() {
  const { usuario } = useAuth();
  return ehTecnico(usuario) ? <Navigate to="/ti" replace /> : <MeusChamados />;
}

function SoVisitante({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const [params] = useSearchParams();
  return usuario ? <Navigate to={destinoSeguro(params.get("voltar")) ?? "/"} replace /> : children;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/entrar" element={<SoVisitante><Entrar /></SoVisitante>} />
          {/* contas são criadas pelo TI: o antigo "criar conta" volta para o login */}
          <Route path="/cadastro" element={<Navigate to="/entrar" replace />} />
          <Route element={<Protegida><Layout /></Protegida>}>
            <Route index element={<Inicio />} />
            <Route path="novo" element={<NovoChamado />} />
            <Route path="chamado/:id" element={<Chamado />} />
            <Route path="perfil" element={<Perfil />} />
            <Route path="configuracoes" element={<Configuracoes />} />
            <Route path="ti" element={<SoTecnico><Fila /></SoTecnico>} />
            <Route path="ti/registrar" element={<SoTecnico><Registrar /></SoTecnico>} />
            <Route path="ti/historico" element={<SoTecnico><Historico /></SoTecnico>} />
            <Route path="ti/painel" element={<SoTecnico><Painel /></SoTecnico>} />
            <Route path="ti/chamados" element={<SoTecnico><TodosChamados /></SoTecnico>} />
            <Route path="ti/usuarios" element={<SoTecnico><Usuarios /></SoTecnico>} />
            <Route path="ti/configuracoes" element={<SoTecnico><ConfiguracoesTI /></SoTecnico>} />
            <Route path="ti/qrcodes" element={<SoTecnico><QrCodes /></SoTecnico>} />
            <Route path="ti/chamado/:id" element={<SoTecnico><Chamado /></SoTecnico>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
