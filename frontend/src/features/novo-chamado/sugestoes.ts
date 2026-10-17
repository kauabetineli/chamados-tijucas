// Sugestões rápidas de texto por categoria: um toque já começa a descrição.
// A chave é o NOME da categoria (as categorias são editáveis no painel admin);
// categoria sem entrada aqui simplesmente não mostra sugestões.
export const SUGESTOES: Record<string, string[]> = {
  Computador: ["Não liga", "Está muito lento", "Trava ou reinicia sozinho", "Tela preta ou sem imagem"],
  Impressora: ["Não imprime", "Papel enroscado", "Sem tinta ou toner", "Impressão falhada ou borrada"],
  "Internet ou rede": ["Sem internet", "Internet muito lenta", "Wi-Fi não conecta", "A conexão cai toda hora"],
  "Sistema ou programa": ["Não abre", "Aparece uma mensagem de erro", "Preciso instalar um programa", "Está muito lento"],
  "Senha ou acesso": ["Esqueci a senha", "Senha bloqueada", "Preciso de acesso a um sistema ou pasta"],
  "E-mail": ["Não recebo e-mails", "Não consigo enviar e-mails", "Caixa de entrada cheia"],
  Telefone: ["Ramal sem linha", "Chiado ou ruído na ligação", "Não recebe ligações"],
};
