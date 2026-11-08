import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useSearchParams } from "react-router";
import { Layout } from "./components/Layout";
import { AuthProvider, useAuth } from "./lib/auth";
import { destinoSeguro, ehObservador, veComoTI } from "./lib/pb";
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
import { Feedback } from "./pages/projeto/Feedback";

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

/** Telas do TI: técnico e observador (equipe do Dino Desk, só leitura). Com `age`, só quem pode mudar algo. */
function SoTecnico({ children, age }: { children: ReactNode; age?: boolean }) {
  const { usuario } = useAuth();
  if (age && ehObservador(usuario)) return <Navigate to="/ti" replace />;
  return veComoTI(usuario) ? children : <Navigate to="/" replace />;
}

/** Abrir chamado: a conta só de leitura (observador) não abre. */
function SemObservador({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  return ehObservador(usuario) ? <Navigate to="/ti" replace /> : children;
}

/** Área da equipe do projeto (extensão): contas marcadas com equipe_projeto. */
function SoEquipe({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  return usuario?.equipe_projeto ? children : <Navigate to="/" replace />;
}

function Inicio() {
  const { usuario } = useAuth();
  return veComoTI(usuario) ? <Navigate to="/ti" replace /> : <MeusChamados />;
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
            <Route path="novo" element={<SemObservador><NovoChamado /></SemObservador>} />
            <Route path="chamado/:id" element={<Chamado />} />
            <Route path="perfil" element={<Perfil />} />
            <Route path="configuracoes" element={<Configuracoes />} />
            <Route path="ti" element={<SoTecnico><Fila /></SoTecnico>} />
            <Route path="ti/registrar" element={<SoTecnico age><Registrar /></SoTecnico>} />
            <Route path="ti/historico" element={<SoTecnico><Historico /></SoTecnico>} />
            <Route path="ti/painel" element={<SoTecnico><Painel /></SoTecnico>} />
            <Route path="ti/chamados" element={<SoTecnico><TodosChamados /></SoTecnico>} />
            <Route path="ti/usuarios" element={<SoTecnico><Usuarios /></SoTecnico>} />
            <Route path="ti/configuracoes" element={<SoTecnico><ConfiguracoesTI /></SoTecnico>} />
            <Route path="projeto/feedback" element={<SoEquipe><Feedback /></SoEquipe>} />
            <Route path="ti/qrcodes" element={<SoTecnico><QrCodes /></SoTecnico>} />
            <Route path="ti/chamado/:id" element={<SoTecnico><Chamado /></SoTecnico>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
