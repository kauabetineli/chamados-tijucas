import type { ReactNode } from "react";

/**
 * Esqueletos de carregamento (skeleton): blocos cinzas no formato do que vai aparecer,
 * para a tela não "piscar vazia" enquanto a consulta volta do servidor.
 * O leitor de tela ouve "Carregando..." (aria-busy + texto escondido), não os blocos.
 */

/** Um bloco cinza que pulsa. Passe tamanho e forma pelo className (ex.: "h-4 w-40"). */
export function Bloco({ className = "" }: { className?: string }) {
  // sem "rounded-..." no className, usa o canto padrão (duas classes rounded brigariam no CSS)
  const canto = /\brounded-/.test(className) ? "" : "rounded-lg";
  return <span className={`block animate-pulse bg-linha ${canto} ${className}`} aria-hidden="true" />;
}

function Carregando({ rotulo, children, className = "" }: { rotulo: string; children: ReactNode; className?: string }) {
  return (
    <div aria-busy="true" className={className}>
      <span className="sr-only" role="status">{rotulo}</span>
      {children}
    </div>
  );
}

/** Cartões no formato da fila (identidade · problema · detalhes, dono à direita). */
export function EsqueletoCartoes({ quantos = 4, rotulo = "Carregando..." }: { quantos?: number; rotulo?: string }) {
  return (
    <Carregando rotulo={rotulo} className="space-y-2">
      {Array.from({ length: quantos }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl bg-superficie p-4 ring-1 ring-linha">
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="flex items-center gap-2"><Bloco className="h-5 w-28" /><Bloco className="h-5 w-16 rounded-full" /></div>
            <Bloco className={`h-4 ${i % 2 ? "w-2/3" : "w-4/5"}`} />
            <Bloco className="h-3.5 w-1/2" />
          </div>
          <Bloco className="size-8 shrink-0 rounded-full" />
        </div>
      ))}
    </Carregando>
  );
}

/** Linhas de lista (ícone, título e detalhes), como em Meus chamados e no Histórico. */
export function EsqueletoLinhas({ quantos = 4, rotulo = "Carregando..." }: { quantos?: number; rotulo?: string }) {
  return (
    <Carregando rotulo={rotulo} className="divide-y divide-linha">
      {Array.from({ length: quantos }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-4">
          <Bloco className="size-11 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2"><Bloco className="h-4 w-24" /><Bloco className="h-4 w-20 rounded-full" /></div>
            <Bloco className={`h-4 ${i % 2 ? "w-3/5" : "w-4/5"}`} />
            <Bloco className="h-3 w-2/5" />
          </div>
        </div>
      ))}
    </Carregando>
  );
}

/** Tabela (Todos os chamados): cabeçalho e linhas. */
export function EsqueletoTabela({ linhas = 8 }: { linhas?: number }) {
  return (
    <Carregando rotulo="Carregando chamados..." className="overflow-hidden rounded-2xl bg-superficie ring-1 ring-linha">
      <div className="flex gap-6 border-b border-linha px-4 py-3">
        {[10, 8, 8, 30, 12, 12, 10].map((w, i) => <span key={i} style={{ width: `${w}%` }}><Bloco className="h-3.5" /></span>)}
      </div>
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="flex items-center gap-6 border-b border-linha px-4 py-4 last:border-0">
          <span style={{ width: "10%" }}><Bloco className="h-4" /></span>
          <span style={{ width: "8%" }}><Bloco className="h-5 rounded-full" /></span>
          <span style={{ width: "8%" }}><Bloco className="h-5 rounded-full" /></span>
          <span className="space-y-2" style={{ width: "30%" }}><Bloco className="h-4 w-1/2" /><Bloco className={`h-3.5 ${i % 2 ? "w-3/4" : "w-full"}`} /></span>
          <span style={{ width: "12%" }}><Bloco className="h-4" /></span>
          <span style={{ width: "12%" }}><Bloco className="size-7 rounded-full" /></span>
          <span style={{ width: "10%" }}><Bloco className="h-4" /></span>
        </div>
      ))}
    </Carregando>
  );
}

/** O chamado aberto (página inteira ou painel de baixo), com a lateral de ações do técnico. */
export function EsqueletoChamado({ tecnico }: { tecnico?: boolean }) {
  return (
    <Carregando rotulo="Carregando chamado..." className="mx-auto max-w-5xl">
      <div className={`grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-7 ${tecnico ? "md:grid-cols-[minmax(0,1fr)_20rem]" : ""}`}>
        <div className="space-y-7">
          <div className="space-y-3">
            <Bloco className="h-10 w-56" />
            <div className="flex flex-wrap gap-3"><Bloco className="h-7 w-24 rounded-full" /><Bloco className="h-7 w-32" /><Bloco className="h-7 w-44" /></div>
          </div>
          <div className="flex items-center gap-2">
            {[0, 1, 2].map((i) => (
              <span key={i} className="flex min-w-0 flex-1 items-center gap-2"><Bloco className="size-8 shrink-0 rounded-full" /><Bloco className="h-3.5 w-full max-w-20" /></span>
            ))}
          </div>
          <div className="space-y-2"><Bloco className="h-5 w-full" /><Bloco className="h-5 w-4/5" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => <div key={i} className="space-y-1.5"><Bloco className="h-3 w-20" /><Bloco className="h-4 w-36" /></div>)}
          </div>
          <div className="space-y-3">
            <Bloco className="h-6 w-48" />
            {[0, 1].map((i) => <Bloco key={i} className={`h-16 rounded-2xl ${i ? "ml-auto w-3/5" : "w-2/3"}`} />)}
          </div>
        </div>
        {tecnico && (
          <div className="space-y-4 rounded-2xl p-5 ring-1 ring-linha">
            <Bloco className="h-6 w-32" />
            <Bloco className="h-12 w-full rounded-xl" />
            <div className="grid grid-cols-2 gap-2">{[0, 1, 2, 3].map((i) => <Bloco key={i} className="h-12 rounded-xl" />)}</div>
            <Bloco className="h-12 w-full rounded-xl" />
          </div>
        )}
      </div>
    </Carregando>
  );
}

/** Conversa carregando (balões). */
export function EsqueletoConversa() {
  return (
    <Carregando rotulo="Carregando conversa..." className="space-y-3">
      <Bloco className="h-3.5 w-1/2" />
      <Bloco className="h-16 w-2/3 rounded-2xl" />
      <Bloco className="ml-auto h-12 w-1/2 rounded-2xl" />
    </Carregando>
  );
}
