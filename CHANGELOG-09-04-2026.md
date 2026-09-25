# 🚀 Changelog Legado Chat - 09 de Abril de 2026

## 🎯 Resumo das Atualizações
O foco do dia foi unificar o sistema de **Atendimento**, **CRM (Kanban)** e a inteligência de conexões do WhatsApp através da **UazAPI**. Resolvemos bugs críticos de instâncias presas (zumbis), estabelecemos o Webhook para receber mensagens e reestruturamos a tabela de Leads no banco para garantir que ambos os lados do sistema (Inbox e Kanban) enxerguem os mesmos contatos sem duplicações.

---

## 🛠️ Correções e Melhorias na Plataforma

### 1. Conexões e UazAPI (Correção Crítica)
*   **Limpeza de Instâncias Zumbi:** Implementamos um fluxo agressivo ao criar um novo WhatsApp, que primeiro varre e deleta a instância anterior caso a desconexão manual tenha falhado. A limpeza agora tenta excluir por nome (usando `admintoken`), por path legado e também via logout normal, garantindo um ambiente limpo antes do novo QR Code.
*   **Identificação do Número Conectado:** Mapeamos os endpoints da UazAPI mudando de rotas não-existentes (`/instance/infos`) para `/instance/status`. Agora o app extrai com sucesso o número conectado do campo `data.instance.owner` e exibe em tempo real (ex: `+5511997703248`) acima do identificador, ficando com uma cara super profissional.
*   **Simplificação de UX:** Removemos blocos de configuração mortos que confundiam o cliente: retiramos o card "Webhook Inteligente" e o botão de "Reconfigurar Webhook".

### 2. Sincronização CRM ⇄ Atendimento
*   **Unificação de Abas e Botões:** A aba lateral antes chamada de "CRM" foi renomeada para **"CRM/Kanban"**. No cartão do Kanban, o botão de "WhatsApp" redireciona inteligentemente e sem abrir nova guia (`wa.me`) para o módulo interno `/atendimento`, compartilhando dados via URL. Removemos o segundo botão "Atender" pois já era redundante.
*   **Criação de Leads de Forma Síncrona:** Criamos a ponte que faltava! Antes o Atendimento não conversava com os Leads. Agora, sempre que o usuário inicia uma Nova Conversa no Atendimento, o sistema automaticamente aciona um `upsert` na tabela do CRM (`leads`), colocando o contato virgem na coluna inicial "Novos Leads" com a *origin* `'WhatsApp'`.

### 3. Ajustes Visuais e Identidade
*   **Atualização de Logo:** Substituímos o arquivo `apple-icon.png` por uma versão otimizada com fundo transparente, garantindo que o logo da Legado seja renderizado perfeitamente, sem o bloco opaco nas bordas, aprimorando o visual interno da plataforma.

### 4. Modificações de Banco de Dados (Supabase & SQL)
Realizamos ajustes agressivos nas constraints nativas para abraçar todas as integrações atuais.

*   **Expansão da Constraint (origin):** A tabela rejeitava cadastros de Leads novos feitos pelo Atendimento porque a restrição da origin (`leads_origin_check`) não previa redes dinâmicas. Normalizamos contatos antigos quebrados (NULL e "Anúncios" viraram "Outros") e expandimos a regra para aceitar `'WhatsApp'`.
*   **Sincronização Retroativa:** Criamos uma rotina SQL pontual para popular a dashboard com dados defasados do Atendimento. 

> [!NOTE]
> Todos os SQLs abaixo rodaram direto no Banco para salvar o estado sem gerar quebras de aplicação. Nenhuma migration automática arriscada no cliente.

#### Códigos SQL de Manutenção Ocorridos:
```sql
-- 1. Normalização de dados para o Kanban
UPDATE public.leads 
SET origin = 'Outros' 
WHERE origin IS NULL OR origin = 'Anúncios';

-- 2. Correção de Restrição para aceitar o WhatsApp como via de origem
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_origin_check;

ALTER TABLE public.leads ADD CONSTRAINT leads_origin_check 
  CHECK (origin IN ('Instagram', 'Google Maps', 'Extração CNPJ', 'Outros', 'WhatsApp'));

-- 3. Inserção Inédita de Todas as Conversas Ativas que Faltavam
INSERT INTO public.leads (
  user_id, full_name, whatsapp, origin, column_id,
  last_message, last_message_at, conversation_id, created_at
)
SELECT
  c.user_id,
  COALESCE(NULLIF(c.contact_name, ''), c.contact_phone),
  c.contact_phone,
  'WhatsApp',
  (SELECT kc.id FROM public.kanban_columns kc WHERE kc.user_id = c.user_id ORDER BY kc.position ASC LIMIT 1),
  c.last_message, c.last_message_at, c.id, c.created_at
FROM public.conversations c
WHERE NOT EXISTS (
  SELECT 1 FROM public.leads l
  WHERE l.user_id = c.user_id AND l.whatsapp = c.contact_phone
);

-- 4. Vinculação da Sessão de Chat nos Cards do CRM
UPDATE public.leads l
SET
  conversation_id = c.id,
  last_message = COALESCE(c.last_message, l.last_message),
  last_message_at = GREATEST(c.last_message_at, l.last_message_at)
FROM public.conversations c
WHERE l.user_id = c.user_id
  AND l.whatsapp = c.contact_phone
  AND l.conversation_id IS NULL;
```
