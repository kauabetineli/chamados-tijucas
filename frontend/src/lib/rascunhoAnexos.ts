/**
 * Anexos do rascunho guardados no navegador (IndexedDB).
 *
 * No Android, abrir a câmera (principalmente para gravar vídeo) pode fazer o navegador descartar a aba
 * para liberar memória. Ao voltar, a página recarrega do zero: o texto volta pelo sessionStorage, mas
 * arquivo não cabe lá. Aqui as fotos e vídeos escolhidos ficam guardados até o chamado ser enviado.
 * Expira em 24 h (celular compartilhado não guarda anexo de outra pessoa para sempre).
 * Tudo em try/catch: sem IndexedDB (aba anônima, navegador antigo), segue como antes.
 */
const BANCO = "dinodesk";
const LOJA = "rascunho";
const VALIDADE = 24 * 60 * 60 * 1000;

type Guardado = { em: number; arquivos: { nome: string; tipo: string; modificado: number; dados: Blob }[] };

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, falha) => {
    const req = indexedDB.open(BANCO, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(LOJA);
    req.onsuccess = () => ok(req.result);
    req.onerror = () => falha(req.error);
  });
}

async function operar<T>(modo: IDBTransactionMode, fazer: (loja: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await abrir();
  try {
    return await new Promise<T>((ok, falha) => {
      const req = fazer(db.transaction(LOJA, modo).objectStore(LOJA));
      req.onsuccess = () => ok(req.result as T);
      req.onerror = () => falha(req.error);
    });
  } finally {
    db.close();
  }
}

export async function guardarAnexos(chave: string, arquivos: File[]) {
  try {
    if (!arquivos.length) { await operar("readwrite", (l) => l.delete(chave)); return; }
    const valor: Guardado = {
      em: Date.now(),
      arquivos: arquivos.map((f) => ({ nome: f.name, tipo: f.type, modificado: f.lastModified, dados: f })),
    };
    await operar("readwrite", (l) => l.put(valor, chave));
  } catch (e) {
    console.warn("[anexos] não deu para guardar o rascunho dos anexos", e);
  }
}

export async function lerAnexos(chave: string): Promise<File[]> {
  try {
    const v = await operar<Guardado | undefined>("readonly", (l) => l.get(chave));
    if (!v || Date.now() - v.em > VALIDADE) return [];
    return v.arquivos.map((a) => new File([a.dados], a.nome, { type: a.tipo, lastModified: a.modificado }));
  } catch (e) {
    console.warn("[anexos] não deu para ler o rascunho dos anexos", e);
    return [];
  }
}

export async function apagarAnexos(chave: string) {
  try { await operar("readwrite", (l) => l.delete(chave)); } catch { /* ok */ }
}
