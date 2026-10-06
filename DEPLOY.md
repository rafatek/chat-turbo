# Guia de Deploy - Chat Turbo IA (Docker Swarm + Traefik)

## 1. Como fazer Build e Deploy na VPS

Na sua VPS, o fluxo é 100% desacoplado e simples:

```bash
# 1. Puxar as últimas alterações
cd ~/chat-turbo
git pull origin main

# 2. Criar a imagem Docker (compilação limpa, sem depender de .env no build)
docker build -t chat-turbo:latest .

# 3. Fazer deploy no Docker Swarm
docker stack deploy -c docker-compose.yml chat-turbo
```

*(Se você usa o Portainer Swarm, pode simplesmente ir na stack `chat-turbo` e clicar em **Update the stack** com a opção "Re-pull image" ou após o build).*

---

## 2. Configurações de Rede e Certificados (Traefik)

O arquivo `docker-compose.yml` já vem configurado com:
- **Domínio**: `app.assessoriaturbodigital.com.br`
- **Porta interna**: `3000`
- **Rede padrão**: `traefik-public` (overlay externa)
- **Certresolver**: `letsencrypt` (personalizável via `.env` com `CERT_RESOLVER=nome_do_seu_resolver`)

Se a sua rede do Traefik tiver outro nome, basta adicionar no seu `.env`:
```env
TRAEFIK_NETWORK=nome_da_sua_rede_traefik
CERT_RESOLVER=letsencrypt
```

---

## 3. Variáveis de Ambiente (.env)
As variáveis de produção são lidas exclusivamente em **runtime** a partir do arquivo `.env` na VPS ou configuradas no Portainer. O frontend recebe as variáveis públicas dinamicamente através do servidor Node.js no carregamento das páginas.
