# Implantação no PC servidor da Prefeitura

Guia para o Departamento de TI. Tempo estimado: 30 minutos.

## 1. Preparar o PC

- Windows 10 ou 11, ligado o tempo todo (de preferência com nobreak), usado só para isso.
- **IP fixo:** reserve o IP no DHCP do roteador ou configure IP estático. O QR code e o link dependem disso.
- Rede do Windows como **Privada** (Configurações > Rede > propriedades da conexão).
- Windows Update: defina o "horário ativo" para não reiniciar no expediente.

## 2. Instalar

1. Copie o pacote `dinodesk-AAAA-MM-DD.zip` (gerado pelo grupo com `scripts\gerar-pacote.ps1`) e extraia em `C:\DinoDesk`.
2. Se o pacote não trouxer `backend\bin\ffmpeg.exe`, rode `scripts\baixar-ffmpeg.ps1` (comprime os vídeos enviados pelo celular).
3. Abra o PowerShell **como Administrador** e rode:
   ```powershell
   cd C:\DinoDesk
   powershell -ExecutionPolicy Bypass -File scripts\instalar-servico.ps1
   ```
   O script registra o sistema para iniciar junto com o Windows, libera a porta 80 só na rede interna
   e mostra o endereço (ex.: `http://192.168.0.10`).
4. Neste PC, abra `http://localhost/_/` e crie a conta de **superusuário** (é o acesso ao painel admin; guarde a senha).

## 3. Configurar no painel admin (`/_/`)

| Onde | O que fazer |
|---|---|
| Coleção `setores` | Cadastrar os setores reais da Prefeitura (nome e prédio) |
| Coleção `categorias` | Conferir as categorias sugeridas; renomear ou desativar o que não fizer sentido |
| Settings > Application | Nome do app: `Dino Desk`. URL: `http://IP-do-PC` (usada no link do e-mail) |
| Settings > Mail settings | Ligar o SMTP com uma conta de e-mail da Prefeitura, para os avisos aos servidores |
| Settings > Backups | Ligar o backup automático (ex.: `0 3 * * *`, manter 7) |
| Coleção `users` | Criar a conta do **primeiro técnico** (matrícula, `papel = tecnico`, `admin` marcado, `trocar_senha` marcado). Daí em diante o admin cria setores e contas pela tela **Pessoas e setores** |

Não existe cadastro público: só o administrador do TI cria contas (login pela matrícula; e-mail é opcional).
Pela CLI: `node ferramentas/dino.mjs usuario:criar --real --nome "..." --matricula 12345 --papel tecnico --admin`.

## 4. Avisos no celular dos técnicos (ntfy)

1. Cada técnico instala o app **ntfy** (Android ou iPhone) e assina o tópico do TI (nome longo e aleatório,
   combinado só entre os técnicos; ele funciona como senha).
2. No PC servidor, crie `backend\config.json` a partir de `backend\config.exemplo.json` com o nome do tópico
   (ou rode o instalador com `-NtfyTopico "<topico>"`) e reinicie com `scripts\atualizar.ps1`.
3. Confira em Settings > Application que a URL é `http://IP-do-PC`: é o link que abre ao tocar no aviso.

O aviso chega quando um servidor abre chamado, responde ou reabre. Por privacidade, leva só protocolo,
categoria, setor e prioridade; o resto se vê no Dino Desk.

## 5. Backup fora do PC

Agende `scripts\copiar-backups.ps1 -Destino "D:\BackupChamados"` (ou uma pasta de rede) no Agendador de Tarefas
para rodar todo dia, depois do backup automático. Se o disco do PC falhar, o histórico continua salvo.

## 6. Página de redirecionamento e QR codes

1. Edite o IP em `redirecionamento\index.html` e peça à empresa de hospedagem para publicar em `.../dinodesk/`.
2. No sistema, como técnico: **Painel > QR code para abrir chamado**. Use o endereço da página de redirecionamento,
   escolha quantas etiquetas e imprima. O QR é o mesmo para todos: o lugar do chamado é o setor de quem abre.

## Atualizar para uma versão nova

Extraia o pacote novo por cima de `C:\DinoDesk` (a pasta `backend\pb_data` não vem no pacote e não é tocada)
e rode `scripts\atualizar.ps1` como Administrador.

## Se algo der errado

| Sintoma | Verificar |
|---|---|
| Não abre de outro computador | O PC está ligado? Rede como Privada? Regra de firewall "Dino Desk" existe? |
| Abre no PC, mas não no celular | O celular está no Wi-Fi da Prefeitura (e não no 4G)? |
| E-mails não chegam | Settings > Mail settings > "Send test email" |
| Ver erros | Painel admin > Logs |
