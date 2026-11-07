import PocketBase, { type RecordModel } from "pocketbase";

// O front é servido pelo próprio PocketBase (mesma origem),
// e no desenvolvimento o Vite repassa /api para ele.
export const pb = new PocketBase(window.location.origin);
pb.autoCancellation(false);

export type Papel = "solicitante" | "tecnico";
export type Status = "aberto" | "em_andamento" | "aguardando" | "resolvido";
export type MotivoAguardando = "peca" | "solicitante" | "terceiro";
export type Prioridade = "baixa" | "normal" | "alta" | "urgente";
export type Impacto = "so_eu" | "setor" | "publico";
export type Origem = "sistema" | "whatsapp" | "ligacao" | "presencial";

export interface Setor extends RecordModel {
  nome: string;
  predio: string;
  /** ramal do setor, cadastrado pelo admin do TI */
  ramal: string;
  ativo: boolean;
}

export interface Categoria extends RecordModel {
  nome: string;
  icone: string;
  ordem: number;
  ativa: boolean;
  /** botões "O que pode ter acontecido" (até 6), editados em Configurações do TI > Categorias */
  sugestoes?: string[] | null;
  /** perguntas "O que ajuda o TI" */
  dicas?: string[] | null;
  /** "Outro": sempre aparece, não dá para ocultar */
  protegida?: boolean;
}

export interface Usuario extends RecordModel {
  email: string;
  name: string;
  setor: string;
  papel: Papel | "";
  /** matrícula (até 8 dígitos): é o login. O e-mail é opcional */
  matricula: string;
  /** ramal próprio, se for diferente do ramal do setor (cadastrado pelo TI) */
  ramal: string;
  /** administrador do TI: cria setores e contas, troca senhas */
  admin?: boolean;
  /** conta nova ou senha trocada pelo TI: precisa escolher a própria senha antes de usar */
  trocar_senha?: boolean;
  bloqueado?: boolean;
  ficticio?: boolean;
  /** ausência (só o TI vê): as regras de automação não mandam chamados para quem está ausente */
  ausente_de?: string;
  ausente_ate?: string;
  ausencia_motivo?: string;
  sem_automatico?: boolean;
  /** conta da equipe do projeto (extensão): vê o feedback do sistema. Só o superusuário marca */
  equipe_projeto?: boolean;
  expand?: { setor?: Setor };
}

/** "Sua opinião" sobre o sistema (coleção feedbacks; só a equipe do projeto lê) */
export interface Feedback extends RecordModel {
  autor: string;
  autor_nome?: string;
  tipo: "problema" | "ideia" | "elogio" | "nota";
  texto: string;
  tela: string;
  nota: number;
  papel: string;
  setor: string;
  situacao: "novo" | "visto" | "resolvido" | "melhoria";
  anotacao: string;
  ficticio: boolean;
  created: string;
  expand?: { setor?: Setor };
}

export interface Chamado extends RecordModel {
  protocolo: string;
  descricao: string;
  categoria: string;
  solicitante: string;
  solicitante_nome: string;
  setor: string;
  /** legado: não é mais preenchido nem mostrado (o lugar é o setor) */
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
  /** só com status "aguardando": o que falta para continuar */
  aguardando_motivo?: MotivoAguardando | "";
  aguardando_desde?: string;
  /** avaliação do solicitante ao confirmar */
  avaliacao?: "bom" | "ruim" | "";
  avaliacao_comentario?: string;
  midia_pendente: boolean;
  ficticio?: boolean;
  /** prazo para COMEÇAR o atendimento (Configurações do TI > Fila e atendimento, ou uma regra) */
  prazo_em?: string;
  /** prazo dado por uma regra da automação (minutos; 0 = o da prioridade) */
  prazo_regra_min?: number;
  /** chave da ordem da fila (menor = antes); calculada no servidor */
  ordem_fila?: number;
  /** quem abriu escolheu uma prioridade diferente da sugerida pelo impacto */
  prioridade_escolhida?: boolean;
  motivo_urgencia?: string;
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
  /** imagens da mensagem (print, foto do erro) */
  anexos?: string[];
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

/** Administrador do TI (cria setores e contas). */
export function ehAdmin(u: Usuario | null) {
  return ehTecnico(u) && !!u?.admin;
}

/** Ramal para falar com a pessoa: o próprio, senão o do setor. */
export function ramalDe(u?: Usuario | null, setor?: Setor | null) {
  return u?.ramal || u?.expand?.setor?.ramal || setor?.ramal || "";
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
  const e = err as {
    status?: number;
    response?: { message?: string; data?: Record<string, { code?: string; message?: string }> };
    message?: string;
  };
  if (e?.status === 429) return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
  if (e?.status === 413) return "O arquivo é grande demais para enviar. Grave um vídeo mais curto (até 1 minuto).";
  const campos = e?.response?.data;
  if (campos && Object.keys(campos).length) {
    const [campo, info] = Object.entries(campos)[0];
    const porCodigo = info?.code ? ERRO_POR_CODIGO[info.code] : undefined;
    return `${ROTULO_CAMPO[campo] ?? campo}: ${porCodigo ?? traduzir(info?.message ?? "")}`;
  }
  const msg = e?.response?.message || e?.message || "";
  return traduzir(msg) || "Não foi possível concluir. Verifique a conexão com a rede da Prefeitura.";
}

const ROTULO_CAMPO: Record<string, string> = {
  email: "E-mail",
  matricula: "Matrícula",
  oldPassword: "Senha provisória",
  password: "Senha",
  passwordConfirm: "Confirmação da senha",
  name: "Nome",
  descricao: "Descrição",
  categoria: "Categoria",
  impacto: "Quem é afetado",
  anexos: "Anexos",
};

const ERRO_POR_CODIGO: Record<string, string> = {
  validation_file_size_limit: "um dos arquivos passa de 250 MB. Grave um vídeo mais curto (até 1 minuto).",
  validation_invalid_mime_type: "formato não aceito. Envie foto (JPG, PNG, HEIC) ou vídeo (MP4, MOV).",
  validation_max_select_constraint: "envie no máximo 5 arquivos.",
};

function traduzir(msg: string) {
  const mapa: Record<string, string> = {
    "Failed to authenticate.": "Matrícula ou senha incorretas.",
    "Missing or invalid old password.": "não confere.",
    "Cannot be blank.": "preencha este campo.",
    "Value must be unique.": "já está em uso.",
    "The value must be a valid email address.": "e-mail inválido.",
    "Must be at least 8 character(s).": "use pelo menos 8 caracteres.",
    "Values don't match.": "as senhas não conferem.",
  };
  return mapa[msg] ?? msg;
}
