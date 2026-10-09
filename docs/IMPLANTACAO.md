# Implantação no PC servidor da Prefeitura

Guia para o Departamento de TI. Tempo estimado: 30 minutos.

## 1. Preparar o PC

- Windows 10 ou 11, ligado o tempo todo (de preferência com nobreak), usado só para isso.
- **IP fixo:** reserve o IP no DHCP do roteador ou configure IP estático. O QR code e o link dependem disso.
- Rede do Windows como **Privada** (Configurações > Rede > propriedades da conexão).
- Windows Update: defina o "horário ativo" para não reiniciar no expediente.

## 2. Instalar

1. Copie o pacote `dinodesk-AAAA-MM-DD.zip` (gerado pelo grupo com `scripts\gerar-pacote.ps1`) e extraia em `C:\DinoDesk`.
2. Abra o PowerShell **como Administrador** e rode:
   ```powershell
   cd C:\DinoDesk
   powershell -ExecutionPolicy Bypass -File scripts\instalar-servico.ps1
   ```
   O script registra o sistema para iniciar junto com o Windows, libera a porta 80 só na rede interna
   e mostra o endereço (ex.: `http://192.168.0.10`).
3. Neste PC, abra `http://localhost/_/` e crie a conta de **superusuário** (é o acesso ao painel admin; guarde a senha).

## 3. Configurar no painel admin (`/_/`)

| Onde | O que fazer |
|---|---|
| Coleção `setores` | Cadastrar os setores reais da Prefeitura (nome e prédio) |
| Coleção `categorias` | Conferir as categorias sugeridas; renomear ou desativar o que não fizer sentido |
| Settings > Application | Nome do app: `Dino Desk`. URL: `http://IP-do-PC` (usada no link do e-mail) |
| Settings > Mail settings | Ligar o SMTP com uma conta de e-mail da Prefeitura, para os avisos aos servidores |
| Settings > Backups | Ligar o backup automático (ex.: `0 3 * * *`, manter 7) |
| Coleção `users` | Depois que os 3 técnicos criarem conta pelo sistema, mudar o `papel` deles para `tecnico` |

Opcional: na coleção `users`, campo `email`, é possível restringir o cadastro ao domínio de e-mail da Prefeitura.

## 4. Backup fora do PC

Agende `scripts\copiar-backups.ps1 -Destino "D:\BackupChamados"` (ou uma pasta de rede) no Agendador de Tarefas
para rodar todo dia, depois do backup automático. Se o disco do PC falhar, o histórico continua salvo.

## 5. Página de redirecionamento e QR codes

1. Edite o IP em `redirecionamento\index.html` e peça à empresa de hospedagem para publicar em `.../dinodesk/`.
2. No sistema, como técnico: **Painel > QR codes das salas**. Use o endereço da página de redirecionamento,
   liste as salas e imprima.

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
