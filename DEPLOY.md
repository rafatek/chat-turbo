# Guia de Deploy - Chat Turbo IA

## Pré-requisitos
- Servidor com Docker e Docker Compose instalados.
- Arquivos do projeto no servidor.

## Deploy via Portainer (Stacks > Repository)

1. No Portainer, vá em **Stacks** -> **Add stack**.
2. Selecione o método **Repository**.
3. Preencha os campos:
   - **Repository URL**: `https://github.com/rafatek/chat-turbo`
   - **Repository reference**: `refs/heads/main`
   - **Compose path**: `docker-compose.yml`
4. Na seção **Environment variables**:
   - Clique em **Advanced mode** e cole as variáveis do seu arquivo `.env` (ou use `.env.example` como base).
5. Clique em **Deploy the stack**.

## Deploy via Terminal (Docker / Docker Compose)

1. Clone o repositório na sua VPS:
   ```bash
   git clone https://github.com/rafatek/chat-turbo.git
   cd chat-turbo
   ```

2. Crie o arquivo `.env`:
   ```bash
   cp .env.example .env
   # Edite o .env com suas credenciais reais
   nano .env
   ```

3. Suba com Docker Compose:
   ```bash
   docker compose up -d --build
   ```

4. **Verificação**
   - Acesse `http://SEU_IP:3000` ou configure seu proxy reverso (Nginx/Traefik) para apontar para a porta 3000.
   - Verifique os logs se necessário: `docker logs chat-turbo-app`.

## Webhook
O webhook para inserção de leads pela Evolution API está disponível em:
`https://app.assessoriaturbodigital.com.br/api/webhook/<SEU_TOKEN>`
(Substitua `<SEU_TOKEN>` pelo token configurado no perfil do usuário no banco de dados).
