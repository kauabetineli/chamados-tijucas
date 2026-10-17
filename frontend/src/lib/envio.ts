import { pb } from "./pb";

/**
 * Cria um registro com arquivos mostrando o progresso do envio.
 * (O SDK do PocketBase usa fetch, que não informa progresso; vídeo grande no Wi-Fi
 * pode levar um tempo, e sem a barra a pessoa acha que travou.)
 * Os erros têm o mesmo formato dos do SDK, então mensagemErro() funciona igual.
 */
export function criarComProgresso<T>(colecao: string, dados: FormData, aoProgredir: (pct: number) => void): Promise<T> {
  return new Promise((ok, falha) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/collections/${colecao}/records`);
    if (pb.authStore.token) xhr.setRequestHeader("Authorization", pb.authStore.token);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) aoProgredir(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      let corpo: unknown = {};
      try {
        corpo = JSON.parse(xhr.responseText || "{}");
      } catch {
        /* resposta sem JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        aoProgredir(100);
        ok(corpo as T);
      } else {
        falha({ status: xhr.status, response: corpo });
      }
    };
    xhr.onerror = () =>
      falha({ message: "A conexão caiu durante o envio. Confira se o celular está no Wi-Fi da Prefeitura e tente de novo." });
    xhr.send(dados);
  });
}
