# Dino Desk numa imagem só: o front (React) é compilado e servido pelo próprio PocketBase.
# Uso: DEMONSTRAÇÃO online (Render, Fly e parecidos). O piloto e a produção rodam no PC da Prefeitura (docs/IMPLANTACAO.md).
# Atenção: em hospedagem sem disco permanente (ex.: Render grátis) o banco e os anexos SOMEM a cada reinício.
# Use só dados fictícios.
#
# Variáveis: PORT (a hospedagem define), PB_ADMIN_EMAIL e PB_ADMIN_SENHA (cria/atualiza o superusuário ao subir),
# DINO_AMBIENTE (padrão "teste"), NTFY_TOPICO.

FROM node:22-alpine AS front
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# o Vite grava em ../backend/pb_public
RUN mkdir -p /app/backend && npm run build

FROM alpine:3.20
ARG PB_VERSION=0.40.4
RUN apk add --no-cache ca-certificates ffmpeg wget unzip \
 && wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" -O /tmp/pb.zip \
 && unzip -q /tmp/pb.zip pocketbase -d /pb \
 && rm /tmp/pb.zip \
 && apk del wget unzip
WORKDIR /pb
COPY backend/pb_hooks ./pb_hooks
COPY backend/pb_migrations ./pb_migrations
COPY --from=front /app/backend/pb_public ./pb_public
ENV DINO_AMBIENTE=teste
EXPOSE 8090
CMD ["sh", "-c", "if [ -n \"$PB_ADMIN_EMAIL\" ] && [ -n \"$PB_ADMIN_SENHA\" ]; then ./pocketbase superuser upsert \"$PB_ADMIN_EMAIL\" \"$PB_ADMIN_SENHA\" --dir /pb/pb_data; fi; exec ./pocketbase serve --http 0.0.0.0:${PORT:-8090} --dir /pb/pb_data"]
