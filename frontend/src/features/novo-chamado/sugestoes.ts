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

// Perguntas que ajudam o TI a resolver mais rápido (coluna "O que ajuda o TI" no computador).
// Um toque coloca a pergunta no fim da descrição para a pessoa responder.
export const DICAS: Record<string, string[]> = {
  Computador: ["Aparece alguma mensagem na tela?", "Já tentou reiniciar?", "Desde quando acontece?"],
  Impressora: ["Qual impressora (sala ou número na etiqueta)?", "Aparece alguma luz ou mensagem no visor?", "Outras pessoas conseguem imprimir nela?"],
  "Internet ou rede": ["Mais alguém do setor está sem internet?", "É no cabo ou no Wi-Fi?", "Desde que horas?"],
  "Sistema ou programa": ["Qual o nome do sistema?", "Qual mensagem de erro aparece?", "Funcionava antes? Desde quando parou?"],
  "Senha ou acesso": ["Qual sistema ou pasta?", "Aparece alguma mensagem ao entrar?"],
  "E-mail": ["Qual endereço de e-mail?", "Aparece alguma mensagem de erro?", "É no celular, no computador ou nos dois?"],
  Telefone: ["Qual o número do ramal?", "É só para fazer ou também para receber ligações?"],
};
export const DICAS_GERAIS = ["O que aparece na tela?", "Desde quando acontece?", "Já tentou alguma coisa?"];
