# Guia de Deploy - ProspektIA

## Pré-requisitos
- Servidor com Docker e Docker Compose instalados.
- Arquivos do projeto no servidor.

## Passos para Deploy

1. **Configurar Ambiente**
   - Copie `.env.production.example` para `.env`.
   - Preencha as variáveis, especialmente `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`.

2. **Build da Imagem**
   No diretório raiz do projeto:
   ```bash
   docker build -t prospektia-app .
   ```

3. **Executar o Container**
   ```bash
   docker run -d \
     -p 3000:3000 \
     --name prospektia-app \
     --env-file .env \
     --restart unless-stopped \
     prospektia-app
   ```

4. **Verificação**
   - Acesse `http://SEU_IP:3000` ou configure seu proxy reverso (Nginx/Traefik) para apontar para a porta 3000.
   - Verifique os logs se necessário: `docker logs prospektia-app`.

## Webhook
O webhook para inserção de leads pela Evolution API está disponível em:
`https://app.prospektia.com/api/webhook/<SEU_TOKEN>`
(Substitua `<SEU_TOKEN>` pelo token configurado no perfil do usuário no banco de dados).
