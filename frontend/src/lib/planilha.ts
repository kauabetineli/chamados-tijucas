import { dataHora, ROTULO_ORIGEM, ROTULO_PRIORIDADE, ROTULO_STATUS } from "./formato";
import { nomeSolicitante, type Chamado } from "./pb";

/** Baixa os chamados como CSV que abre direto no Excel em português (";" e acentos). */
export function baixarCsvChamados(lista: Chamado[], nomeArquivo: string) {
  const cab = ["protocolo", "aberto_em", "origem", "categoria", "setor", "solicitante", "prioridade", "status", "responsavel", "iniciado_em", "resolvido_em", "descricao", "diagnostico", "solucao"];
  const linhas = lista.map((c) => [
    c.protocolo, dataHora(c.created), ROTULO_ORIGEM[c.origem], c.expand?.categoria?.nome ?? "", c.expand?.setor?.nome ?? "",
    nomeSolicitante(c), ROTULO_PRIORIDADE[c.prioridade], ROTULO_STATUS[c.status], c.expand?.responsavel?.name ?? "",
    dataHora(c.iniciado_em), dataHora(c.resolvido_em), c.descricao, c.diagnostico, c.solucao,
  ]);
  const csv = [cab, ...linhas].map((l) => l.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nomeArquivo });
  a.click();
  URL.revokeObjectURL(url);
}
