# Dados de teste

> **Novo:** para gerar dados em volume (muitos usuários, chamados com fotos e vídeos falsos, simulação contínua)
> use as ferramentas de `ferramentas/`, descritas em [`FERRAMENTAS-IA.md`](FERRAMENTAS-IA.md).
> Este script continua útil para ter **contas fixas e fáceis de lembrar** (ana.engenharia, tecnico1...).
> As contas dele também são marcadas como fictícias, então `node ferramentas/dino.mjs limpar --confirmar` apaga tudo.

Contas e setores **fictícios** para testar o Dino Desk no computador de desenvolvimento.
**Não use no PC da Prefeitura em produção.**

## Como criar

Com o PocketBase rodando, na pasta do projeto:

```powershell
node scripts\dados-teste.mjs admin@local.dev SenhaForte123 --com-chamados
```

- Troque `admin@local.dev` e `SenhaForte123` pelo e-mail e senha do **seu superusuário**.
- `--com-chamados` também abre 6 chamados de exemplo (sem essa opção, cria só setores e usuários).
- Pode rodar quantas vezes quiser: o que já existe é pulado.
- Se o ntfy estiver configurado, os chamados de exemplo geram avisos no celular dos técnicos.

## Senha de todas as contas

```
Teste@1234
```

## Solicitantes (não são do TI)

| Nome | E-mail | Setor |
|---|---|---|
| Ana Engenharia | ana.engenharia@teste.dinodesk | Engenharia |
| Bruno Arquitetura | bruno.arquitetura@teste.dinodesk | Arquitetura |
| Carla Comunicação | carla.comunicacao@teste.dinodesk | Comunicação |
| Diego Jurídico | diego.juridico@teste.dinodesk | Jurídico |
| Elisa RH | elisa.rh@teste.dinodesk | Recursos Humanos |
| Fábio Finanças | fabio.financas@teste.dinodesk | Finanças |
| Gabi Protocolo | gabi.protocolo@teste.dinodesk | Protocolo |
| Hugo Educação | hugo.educacao@teste.dinodesk | Educação |
| Íris Saúde | iris.saude@teste.dinodesk | Saúde |
| João Obras | joao.obras@teste.dinodesk | Obras |

## Técnicos

| Nome | E-mail |
|---|---|
| Técnico Teste 1 | tecnico1@teste.dinodesk |
| Técnico Teste 2 | tecnico2@teste.dinodesk |

## Chamados de exemplo (`--com-chamados`)

| Quem abriu | Categoria | Impacto | Prioridade resultante |
|---|---|---|---|
| Gabi Protocolo | Sistema ou programa | Atendimento ao público parado | Urgente |
| Carla Comunicação | Internet ou rede | Setor inteiro | Alta |
| Elisa RH | Impressora | Setor inteiro | Alta |
| Ana Engenharia | Computador | Só eu | Normal |
| Diego Jurídico | Senha ou acesso | Só eu | Normal |
| Íris Saúde | Telefone | Só eu | Normal |

## Roteiro rápido de teste

1. **Solicitante:** entre como `ana.engenharia@teste.dinodesk` e veja a senha da fila (ela é a 4ª, atrás dos urgentes e altos).
2. **Técnico:** numa janela anônima, entre como `tecnico1@teste.dinodesk`. A fila mostra o chamado do Protocolo no topo, em vermelho.
3. Abra o chamado da Ana, clique em **Começar atendimento** e depois em **Resolver** (causa e solução).
4. Volte à janela da Ana: o chamado aparece como resolvido, com o botão para confirmar.
5. **Registro rápido:** como técnico, registre um pedido "por WhatsApp" em nome de `Bruno Arquitetura`.
6. Confira o **Painel** e o **Histórico**.

## Apagar os dados de teste

Mais fácil: `node ferramentas/dino.mjs limpar --confirmar`. Ou pelo painel admin (`/_/`), nesta ordem:
1. Coleção **chamados**: filtre por `solicitante.email ~ "teste.dinodesk"`, selecione tudo e exclua.
2. Coleção **users**: filtre por `email ~ "teste.dinodesk"`, selecione tudo e exclua.
