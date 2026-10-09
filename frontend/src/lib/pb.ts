import PocketBase, { type RecordModel } from "pocketbase";

// O front é servido pelo próprio PocketBase (mesma origem),
// e no desenvolvimento o Vite repassa /api para ele.
export const pb = new PocketBase(window.location.origin);
pb.autoCancellation(false);

export type Papel = "solicitante" | "tecnico";
export type Status = "aberto" | "em_andamento" | "resolvido";
export type Prioridade = "baixa" | "normal" | "alta" | "urgente";
export type Impacto = "so_eu" | "setor" | "publico";
export type Origem = "sistema" | "whatsapp" | "ligacao" | "presencial";

export interface Setor extends RecordModel {
  nome: string;
  predio: string;
  ativo: boolean;
}

export interface Categoria extends RecordModel {
  nome: string;
  icone: string;
  ordem: number;
  ativa: boolean;
}

export interface Usuario extends RecordModel {
  email: string;
  name: string;
  setor: string;
  papel: Papel | "";
  telefone: string;
  expand?: { setor?: Setor };
}

export interface Chamado extends RecordModel {
  protocolo: string;
  descricao: string;
  categoria: string;
  solicitante: string;
  solicitante_nome: string;
  setor: string;
  local: string;
  impacto: Impacto;
  prioridade: Prioridade;
  peso: number;
  status: Status;
  origem: Origem;
  responsavel: string;
  registrado_por: string;
  anexos: string[];
  diagnostico: string;
  solucao: string;
  confirmado: boolean;
  iniciado_em: string;
  resolvido_em: string;
  created: string;
  updated: string;
  expand?: {
    categoria?: Categoria;
    solicitante?: Usuario;
    setor?: Setor;
    responsavel?: Usuario;
  };
}

export interface Interacao extends RecordModel {
  chamado: string;
  autor: string;
  tipo: "comentario" | "status" | "prioridade" | "atribuicao" | "sistema";
  texto: string;
  interno: boolean;
  created: string;
  expand?: { autor?: Usuario };
}

export const EXPAND_CHAMADO = "categoria,solicitante,setor,responsavel";

export function usuarioAtual(): Usuario | null {
  const r = pb.authStore.record;
  return r && r.collectionName === "users" ? (r as Usuario) : null;
}

export function ehTecnico(u: Usuario | null) {
  return u?.papel === "tecnico";
}

export function nomeSolicitante(c: Chamado) {
  return c.expand?.solicitante?.name || c.solicitante_nome || "Sem nome";
}

/** Só aceita caminhos internos (evita redirecionar para outro site). */
export function destinoSeguro(caminho: string | null): string | null {
  return caminho && caminho.startsWith("/") && !caminho.startsWith("//") ? caminho : null;
}

/** Mensagem de erro legível a partir de um erro do PocketBase. */
export function mensagemErro(err: unknown): string {
  const e = err as { response?: { message?: string; data?: Record<string, { message?: string }> }; message?: string };
  const campos = e?.response?.data;
  if (campos && Object.keys(campos).length) {
    const [campo, info] = Object.entries(campos)[0];
    return `${ROTULO_CAMPO[campo] ?? campo}: ${traduzir(info?.message ?? "")}`;
  }
  const msg = e?.response?.message || e?.message || "";
  return traduzir(msg) || "Não foi possível concluir. Verifique a conexão com a rede da Prefeitura.";
}

const ROTULO_CAMPO: Record<string, string> = {
  email: "E-mail",
  password: "Senha",
  passwordConfirm: "Confirmação da senha",
  name: "Nome",
  descricao: "Descrição",
  categoria: "Categoria",
  impacto: "Quem é afetado",
  anexos: "Anexos",
};

function traduzir(msg: string) {
  const mapa: Record<string, string> = {
    "Failed to authenticate.": "E-mail ou senha incorretos.",
    "Cannot be blank.": "preencha este campo.",
    "Value must be unique.": "já está em uso.",
    "The value must be a valid email address.": "e-mail inválido.",
    "Must be at least 8 character(s).": "use pelo menos 8 caracteres.",
    "Values don't match.": "as senhas não conferem.",
  };
  return mapa[msg] ?? msg;
}
