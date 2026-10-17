// Cliente HTTP do Dino Desk para as ferramentas (CLI e servidor MCP).
// Fala com a API do PocketBase como SUPERUSUÁRIO e, quando precisa agir "como" um
// servidor ou técnico (abrir chamado, atender), usa a personificação do PocketBase
// (POST /api/collections/users/impersonate/{id}). Assim todas as regras dos hooks
// valem como se a pessoa estivesse usando o sistema.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PASTA = dirname(dirname(fileURLToPath(import.meta.url)));

/** Lê ferramentas/.env (CHAVE=valor) sem dependências. Variáveis já definidas no ambiente têm preferência. */
export function carregarEnv(arquivo = join(PASTA, ".env")) {
  if (!existsSync(arquivo)) return;
  for (const linha of readFileSync(arquivo, "utf8").split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || linha.trim().startsWith("#")) continue;
    const valor = m[2].replace(/^(['"])(.*)\1$/, "$2");
    if (process.env[m[1]] === undefined) process.env[m[1]] = valor;
  }
}

export class ErroDino extends Error {
  constructor(mensagem, status, dados) {
    super(mensagem);
    this.status = status;
    this.dados = dados;
  }
}

export class Dino {
  constructor({ url, email, senha } = {}) {
    carregarEnv();
    this.url = (url || process.env.DINO_URL || "http://127.0.0.1:8090").replace(/\/$/, "");
    this.email = email || process.env.DINO_ADMIN_EMAIL || "";
    this.senha = senha || process.env.DINO_ADMIN_SENHA || "";
    this.token = "";
    this.tokensUsuario = new Map();
  }

  /** Autentica como superusuário (uma vez). */
  async entrar() {
    if (this.token) return this.token;
    if (!this.email || !this.senha) {
      throw new ErroDino(
        "Faltam as credenciais do superusuário. Rode: node ferramentas/configurar.mjs (ou crie ferramentas/.env a partir de ferramentas/modelos/env.exemplo).",
      );
    }
    try {
      const r = await this.req("POST", "/api/collections/_superusers/auth-with-password", {
        corpo: { identity: this.email, password: this.senha },
        semToken: true,
      });
      this.token = r.token;
      return this.token;
    } catch (err) {
      if (err.cause?.code === "ECONNREFUSED" || /fetch failed/.test(err.message)) {
        throw new ErroDino(`O Dino Desk não respondeu em ${this.url}. O PocketBase está rodando?`);
      }
      throw new ErroDino(`Não consegui entrar como superusuário em ${this.url}: e-mail ou senha errados.`);
    }
  }

  /** Token de um usuário (servidor ou técnico), sem precisar da senha dele. */
  async tokenDe(usuarioId) {
    const guardado = this.tokensUsuario.get(usuarioId);
    if (guardado) return guardado;
    const r = await this.req("POST", `/api/collections/users/impersonate/${usuarioId}`, { corpo: { duration: 3600 } });
    this.tokensUsuario.set(usuarioId, r.token);
    return r.token;
  }

  /**
   * Requisição à API. `corpo` vira JSON; `form` (FormData) vai como multipart.
   * `como` = id de usuário para agir em nome dele; padrão: superusuário.
   */
  async req(metodo, caminho, { corpo, form, como, semToken } = {}) {
    let token = "";
    if (!semToken) token = como ? await this.tokenDe(como) : await this.entrar();
    const headers = {};
    if (token) headers.Authorization = token;
    let body;
    if (form) body = form;
    else if (corpo !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(corpo);
    }
    const r = await fetch(this.url + caminho, { method: metodo, headers, body });
    const texto = await r.text();
    let dados = {};
    try { dados = texto ? JSON.parse(texto) : {}; } catch { dados = { bruto: texto.slice(0, 300) }; }
    if (!r.ok) {
      const detalhe = dados?.data && Object.keys(dados.data).length
        ? " " + Object.entries(dados.data).map(([k, v]) => `${k}: ${v.message || v.code}`).join("; ")
        : "";
      throw new ErroDino(`${metodo} ${caminho} → ${r.status}: ${dados?.message || "erro"}${detalhe}`, r.status, dados);
    }
    return dados;
  }

  /** Lista todos os registros de uma coleção que batem com o filtro (pagina sozinho). */
  async todos(colecao, { filtro = "", ordem = "", expand = "", campos = "", como } = {}) {
    const itens = [];
    for (let pagina = 1; ; pagina++) {
      const q = new URLSearchParams({ page: String(pagina), perPage: "200", skipTotal: "1" });
      if (filtro) q.set("filter", filtro);
      if (ordem) q.set("sort", ordem);
      if (expand) q.set("expand", expand);
      if (campos) q.set("fields", campos);
      const r = await this.req("GET", `/api/collections/${colecao}/records?${q}`, { como });
      itens.push(...r.items);
      if (r.items.length < 200) return itens;
    }
  }
}

/** Escapa um valor para usar dentro de aspas num filtro do PocketBase. */
export const aspas = (s) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
