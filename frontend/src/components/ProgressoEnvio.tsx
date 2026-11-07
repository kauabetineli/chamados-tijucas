/** Barra de envio dos anexos. */
export function ProgressoEnvio({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  return (
    <div className="space-y-1" role="status" aria-live="polite">
      <div className="h-3 overflow-hidden rounded-full bg-linha">
        <div className="h-full rounded-full bg-mar-700 transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-sm text-tinta-2">
        {pct < 100 ? `Enviando: ${pct}%. Não feche a página nem deixe a tela apagar.` : "Envio concluído. Registrando o chamado..."}
      </p>
    </div>
  );
}
