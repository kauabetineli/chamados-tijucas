# Página de redirecionamento

Arquivo para a empresa que hospeda o site da Prefeitura publicar em um endereço fixo,
por exemplo `https://<site-da-prefeitura>/dinodesk/`.

1. Troque o IP na linha `window.DESTINO = "http://192.168.0.10";` pelo IP fixo do PC servidor
   (e a porta, se não for 80: `http://192.168.0.10:8080`).
2. Envie o `index.html` para a hospedagem. É uma página estática: não precisa de PHP nem banco.
3. Use esse endereço nos QR codes (tela **Painel > QR codes das salas** no sistema).

Como funciona: `.../chamados/?local=Recepcao` abre `http://IP/novo?local=Recepcao`, com o local preenchido.
Se o IP do servidor mudar, basta atualizar esta página; as etiquetas impressas continuam valendo.

Limitação: o IP é interno, então só abre para quem está na rede da Prefeitura.
