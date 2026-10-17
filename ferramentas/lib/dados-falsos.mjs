// Banco de dados FALSOS e plausíveis para testes: nomes, setores e
// problemas típicos de um TI de prefeitura (descrição + diagnóstico + solução).
// Todas as pessoas são inventadas. E-mails usam o domínio reservado @teste.dinodesk.

export const DOMINIO_TESTE = "teste.dinodesk";

const NOMES = [
  "Ana", "Bruno", "Carla", "Diego", "Elisa", "Fábio", "Gabriela", "Hugo", "Íris", "João",
  "Karina", "Lucas", "Marina", "Nelson", "Olívia", "Paulo", "Quésia", "Rafael", "Sílvia", "Tiago",
  "Úrsula", "Vinícius", "Wesley", "Yasmin", "Zeca", "Beatriz", "Cláudio", "Denise", "Everton", "Fernanda",
];
const SOBRENOMES = [
  "Silva", "Souza", "Oliveira", "Pereira", "Costa", "Rodrigues", "Almeida", "Nascimento", "Lima", "Araújo",
  "Fernandes", "Carvalho", "Gomes", "Martins", "Rocha", "Ribeiro", "Alves", "Monteiro", "Mendes", "Barros",
  "Freitas", "Barbosa", "Pinto", "Moura", "Cavalcanti", "Dias", "Castro", "Campos", "Cardoso", "Teixeira",
];

/** Setores fictícios de uma prefeitura, com o prédio. */
export const SETORES = [
  ["Engenharia", "Paço Municipal"],
  ["Arquitetura", "Paço Municipal"],
  ["Comunicação", "Paço Municipal"],
  ["Jurídico", "Paço Municipal"],
  ["Recursos Humanos", "Paço Municipal"],
  ["Finanças", "Paço Municipal"],
  ["Protocolo", "Paço Municipal"],
  ["Educação", "Secretaria de Educação"],
  ["Saúde", "Secretaria de Saúde"],
  ["Obras", "Pátio de Obras"],
];

/**
 * Problemas por categoria (o nome tem de bater com a coleção "categorias").
 * [descrição do servidor, diagnóstico do TI, solução do TI]
 */
export const PROBLEMAS = {
  "Computador": [
    ["O computador demora muito para ligar e trava quando abro mais de um programa.", "Disco quase cheio e muitos programas iniciando com o Windows.", "Limpeza de arquivos temporários e desativação de programas na inicialização."],
    ["A tela fica preta depois que aparece o logo do Windows.", "Cabo de vídeo mal encaixado no monitor.", "Cabo HDMI reencaixado e testado."],
    ["O computador desliga sozinho no meio do expediente.", "Superaquecimento por poeira no cooler.", "Limpeza interna e troca da pasta térmica."],
    ["O mouse para de funcionar do nada.", "Pilha do mouse sem fio fraca.", "Pilhas trocadas."],
  ],
  "Impressora": [
    ["A impressora puxa várias folhas de uma vez e amassa o papel.", "Rolete de tração gasto.", "Rolete limpo; troca agendada."],
    ["A impressora está com uma luz laranja piscando e não imprime.", "Papel enroscado na bandeja traseira.", "Papel removido e impressora reiniciada."],
    ["As impressões saem com listras e borradas.", "Toner no fim.", "Toner substituído."],
    ["Meu computador não encontra a impressora do setor.", "Impressora mudou de IP após queda de energia.", "IP fixado na impressora e fila reinstalada."],
  ],
  "Internet ou rede": [
    ["A internet do setor caiu e ninguém consegue acessar os sistemas.", "Switch do setor travado.", "Switch reiniciado; monitoramento ativado."],
    ["O Wi-Fi da sala de reuniões fica caindo.", "Roteador antigo sobrecarregado.", "Canal do Wi-Fi alterado; troca do equipamento no backlog."],
    ["A internet está muito lenta desde ontem.", "Um computador do setor baixando atualizações sem parar.", "Atualizações agendadas para fora do expediente."],
  ],
  "Sistema ou programa": [
    ["O sistema de protocolo não abre e tem cidadão esperando no balcão.", "Serviço do sistema parado no servidor.", "Serviço reiniciado e chamado aberto com o fornecedor."],
    ["O programa da folha de pagamento mostra uma mensagem de erro ao gerar o relatório.", "Versão desatualizada do programa.", "Programa atualizado para a versão nova."],
    ["Preciso instalar o AutoCAD no computador novo.", "Programa não instalado na máquina nova.", "AutoCAD instalado com a licença do setor."],
  ],
  "Senha ou acesso": [
    ["Minha senha do sistema expirou e não consigo trocar.", "Conta bloqueada por tentativas erradas.", "Conta desbloqueada e senha redefinida com o servidor presente."],
    ["Servidor novo no setor precisa de acesso à pasta compartilhada.", "Usuário sem permissão no grupo do setor.", "Usuário incluído no grupo da pasta."],
  ],
  "E-mail": [
    ["Não estou recebendo e-mails desde a manhã.", "Caixa de entrada cheia.", "Mensagens antigas arquivadas; cota liberada."],
    ["Meus e-mails estão indo para o spam dos cidadãos.", "Assinatura com link encurtado suspeito.", "Assinatura corrigida."],
  ],
  "Telefone": [
    ["O ramal da recepção está sem linha.", "Cabo do ramal desconectado no rack.", "Cabo reconectado e ramal testado."],
    ["O telefone faz ligação, mas não recebe.", "Desvio de chamadas ativado por engano.", "Desvio desativado."],
  ],
  "Outro": [
    ["O projetor da sala de reuniões não liga.", "Lâmpada do projetor queimada.", "Lâmpada trocada."],
    ["Preciso de ajuda para fazer uma videoconferência às 14h.", "Primeira vez usando a ferramenta.", "Configuração da câmera e orientação ao servidor."],
  ],
};

const COMENTARIOS_TI = [
  "Estou indo até o setor em 10 minutos.",
  "Consegue me dizer se aparece alguma mensagem na tela?",
  "Peça já foi solicitada, aguardando entrega.",
  "Vou acessar remotamente, deixe o computador ligado.",
];
const COMENTARIOS_SOLICITANTE = [
  "Obrigado! Ficamos no aguardo.",
  "Continua acontecendo, mas com menos frequência.",
  "Pode vir depois das 14h, por favor.",
];

export const sortear = (lista) => lista[Math.floor(Math.random() * lista.length)];
export const chance = (p) => Math.random() < p;

/**
 * Nome, e-mail e matrícula fictícios únicos (sufixo aleatório evita colisão entre rodadas).
 * Matrícula fictícia tem 8 dígitos e começa com 9: não colide com as reais (hoje com 5 dígitos).
 */
export function pessoaFalsa() {
  const nome = sortear(NOMES), sobrenome = sortear(SOBRENOMES);
  const base = `${nome}.${sobrenome}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const sufixo = Math.random().toString(36).slice(2, 6);
  const matricula = "9" + String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  return { nome: `${nome} ${sobrenome}`, email: `${base}.${sufixo}@${DOMINIO_TESTE}`, matricula };
}

/** Impacto com a distribuição de um dia comum: a maioria "só eu". */
export function impactoFalso() {
  const r = Math.random();
  return r < 0.6 ? "so_eu" : r < 0.9 ? "setor" : "publico";
}

export function problemaFalso(categoria) {
  const lista = PROBLEMAS[categoria] || PROBLEMAS["Outro"];
  const [descricao, diagnostico, solucao] = sortear(lista);
  return { descricao, diagnostico, solucao };
}

export const comentarioTI = () => sortear(COMENTARIOS_TI);
export const comentarioSolicitante = () => sortear(COMENTARIOS_SOLICITANTE);

/** Ramal de sala com 4 dígitos (ramais de teste começam com 9). */
export const ramalFalso = () => "9" + String(Math.floor(Math.random() * 1000)).padStart(3, "0");
