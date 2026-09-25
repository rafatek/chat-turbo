# Chat Legado

Bem-vindo ao **Chat Legado**! Este é um sistema completo de CRM e Atendimento Omnichannel projetado para otimizar vendas e suporte através do WhatsApp.

## 🚀 Visão Geral

O Chat Legado centraliza o atendimento ao cliente e o acompanhamento de leads em uma plataforma robusta e responsiva. Construído com as tecnologias mais modernas do ecossistema React, ele oferece recursos de chat em tempo real, gestão visual de funis de vendas (Kanban) e integrações poderosas.

## ✨ Funcionalidades Principais

- **Atendimento em Tempo Real:** Tela de atendimento no formato de chat, com suporte a envio de áudios gravados na hora, arquivos, e sincronização de mensagens do WhatsApp.
- **CRM Kanban Integrado:** Gestão visual de leads e negócios através de quadros Kanban interativos com arrastar-e-soltar.
- **Automações e Agentes de IA:** Capacidade de integrar bots e fluxos automáticos de conversa para qualificação de leads.
- **Gestão de Contatos e Leads:** Edição e gerenciamento detalhado de informações dos contatos, atribuindo valores, tags e acompanhando a origem dos leads.

## 🛠️ Tecnologias Utilizadas

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript
- **Estilização:** Tailwind CSS v4, Radix UI, shadcn/ui, Framer Motion
- **Backend & Banco de Dados:** Supabase (PostgreSQL, Auth, Realtime, Storage)
- **Gestão de Estado & Drag and Drop:** `@hello-pangea/dnd`, React Hook Form, Zod

## 🏗️ Como Rodar o Projeto

1. Clone o repositório:
   ```bash
   git clone https://github.com/rafatek/chat-legado.git
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Configure as variáveis de ambiente `.env` (Supabase, etc).
4. Rode o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
5. Acesse `http://localhost:3000` em seu navegador.