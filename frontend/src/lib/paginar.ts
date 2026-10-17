import type { RecordListOptions, RecordModel } from "pocketbase";
import { pb } from "./pb";

/**
 * Busca UMA página no banco (page/perPage do PocketBase). porPagina = 0 traz tudo.
 * Se a página pedida ficou além do fim (ex.: um filtro diminuiu a lista), devolve a última que existe.
 */
export async function buscarPagina<T extends RecordModel>(
  colecao: string, pagina: number, porPagina: number, opcoes: RecordListOptions = {},
): Promise<{ itens: T[]; total: number; pagina: number }> {
  if (porPagina === 0) {
    const itens = await pb.collection(colecao).getFullList<T>({ batch: 500, ...opcoes });
    return { itens, total: itens.length, pagina: 1 };
  }
  const r = await pb.collection(colecao).getList<T>(pagina, porPagina, opcoes);
  if (r.items.length === 0 && pagina > 1 && r.totalItems > 0) {
    const ultima = Math.ceil(r.totalItems / porPagina);
    const r2 = await pb.collection(colecao).getList<T>(ultima, porPagina, opcoes);
    return { itens: r2.items, total: r2.totalItems, pagina: ultima };
  }
  return { itens: r.items, total: r.totalItems, pagina };
}
