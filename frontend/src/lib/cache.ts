/**
 * Cache curto, na memória da aba, para listas que quase nunca mudam (categorias, setores, técnicos).
 * Antes, cada tela pedia de novo ao servidor; agora a primeira tela busca e as outras reaproveitam
 * por alguns minutos. Pedidos iguais feitos ao mesmo tempo viram um só.
 */
const guardados = new Map<string, { quando: number; promessa: Promise<unknown> }>();

export function emCache<T>(chave: string, buscar: () => Promise<T>, validadeMs = 5 * 60_000): Promise<T> {
  const g = guardados.get(chave);
  if (g && Date.now() - g.quando < validadeMs) return g.promessa as Promise<T>;
  const promessa = buscar().catch((err) => {
    guardados.delete(chave); // erro não fica guardado
    throw err;
  });
  guardados.set(chave, { quando: Date.now(), promessa });
  return promessa;
}

/** Esquece um item (ex.: depois de criar um setor ou técnico). */
export function limparCache(chave?: string) {
  if (chave) guardados.delete(chave);
  else guardados.clear();
}
