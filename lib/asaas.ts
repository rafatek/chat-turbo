export interface AsaasCustomerData {
  name: string;
  cpfCnpj: string;
  email?: string;
  phone?: string;
}

export interface AsaasPaymentData {
  customer: string;
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO' | 'UNDEFINED';
  value: number;
  dueDate: string;
  description?: string;
  externalReference?: string;
}

export interface AsaasSubscriptionData {
  customer: string;
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO' | 'UNDEFINED';
  value: number;
  nextDueDate: string;
  cycle: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'YEARLY';
  description?: string;
}

// Sanitização robusta para runtime / Docker / .env
export function getAsaasApiKey(): string {
  let key = process.env.ASAAS_API_KEY || '';
  key = key.trim();
  // Remove aspas que o Docker ou .env possam ter mantido
  key = key.replace(/^["']|["']$/g, '');
  // Se a chave foi escapada com \$ no .env, remove a barra invertida
  if (key.startsWith('\\$')) {
    key = key.slice(1);
  }
  return key;
}

export function getAsaasApiUrl(): string {
  let url = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';
  url = url.trim().replace(/^["']|["']$/g, '').split(' ')[0].replace(/\/$/, '');
  return url;
}

export function getAsaasHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    access_token: getAsaasApiKey(),
  };
}

// Getters retrocompatíveis para imports diretos de ASAAS_API_URL e ASAAS_API_KEY
export const ASAAS_API_URL = getAsaasApiUrl();
export const ASAAS_API_KEY = getAsaasApiKey();

async function handleAsaasError(response: Response, defaultMessage: string) {
  let errorData;
  try {
    const text = await response.text();
    try {
      errorData = JSON.parse(text);
    } catch {
      errorData = text;
    }
  } catch (e) {
    errorData = "Não foi possível ler a resposta do servidor.";
  }
  console.error(`[Asaas Error] ${defaultMessage} (Status: ${response.status}) URL: ${response.url}`, errorData);
  throw new Error(`${defaultMessage}: ${typeof errorData === 'string' ? errorData : JSON.stringify(errorData)} (Status: ${response.status})`);
}

export async function createAsaasCustomer(data: AsaasCustomerData) {
  const response = await fetch(`${getAsaasApiUrl()}/customers`, {
    method: 'POST',
    headers: getAsaasHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    await handleAsaasError(response, "Erro ao criar cliente Asaas");
  }

  return response.json();
}

export async function createAsaasPayment(data: AsaasPaymentData) {
  const response = await fetch(`${getAsaasApiUrl()}/payments`, {
    method: 'POST',
    headers: getAsaasHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    await handleAsaasError(response, "Erro ao criar pagamento Asaas");
  }

  return response.json();
}

export async function getAsaasPixQrCode(paymentId: string) {
  const response = await fetch(`${getAsaasApiUrl()}/payments/${paymentId}/pixQrCode`, {
    method: 'GET',
    headers: getAsaasHeaders(),
  });

  if (!response.ok) {
    await handleAsaasError(response, "Erro ao obter QR Code Pix Asaas");
  }

  return response.json();
}

export async function createAsaasSubscription(data: AsaasSubscriptionData) {
  const response = await fetch(`${getAsaasApiUrl()}/subscriptions`, {
    method: 'POST',
    headers: getAsaasHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    await handleAsaasError(response, "Erro ao criar assinatura Asaas");
  }

  return response.json();
}

export async function updateAsaasSubscription(subscriptionId: string, data: Partial<AsaasSubscriptionData>) {
  const response = await fetch(`${getAsaasApiUrl()}/subscriptions/${subscriptionId}`, {
    method: 'POST',
    headers: getAsaasHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    await handleAsaasError(response, "Erro ao atualizar assinatura Asaas");
  }

  return response.json();
}

export async function listAsaasPayments(customerId: string) {
  const response = await fetch(`${getAsaasApiUrl()}/payments?customer=${customerId}`, {
    method: 'GET',
    headers: getAsaasHeaders(),
  });

  if (!response.ok) {
    await handleAsaasError(response, "Erro ao buscar faturas Asaas");
  }

  return response.json();
}

export async function getAsaasSubscription(subscriptionId: string) {
  const response = await fetch(`${getAsaasApiUrl()}/subscriptions/${subscriptionId}`, {
    method: 'GET',
    headers: getAsaasHeaders(),
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    await handleAsaasError(response, "Erro ao buscar assinatura Asaas");
  }

  return response.json();
}

export async function deleteAsaasSubscription(subscriptionId: string) {
  const response = await fetch(`${getAsaasApiUrl()}/subscriptions/${subscriptionId}`, {
    method: 'DELETE',
    headers: getAsaasHeaders(),
  });

  if (!response.ok) {
    await handleAsaasError(response, "Erro ao deletar assinatura Asaas");
  }

  return response.json();
}

export async function deleteAsaasPayment(paymentId: string) {
  const response = await fetch(`${getAsaasApiUrl()}/payments/${paymentId}`, {
    method: 'DELETE',
    headers: getAsaasHeaders(),
  });

  if (!response.ok) {
    await handleAsaasError(response, "Erro ao deletar cobrança Asaas");
  }

  return response.json();
}

export async function deleteAsaasCustomer(customerId: string) {
  const response = await fetch(`${getAsaasApiUrl()}/customers/${customerId}`, {
    method: 'DELETE',
    headers: getAsaasHeaders(),
  });

  if (!response.ok) {
    await handleAsaasError(response, "Erro ao deletar cliente Asaas");
  }

  return response.json();
}

export async function updateAsaasPayment(paymentId: string, data: any) {
  const response = await fetch(`${getAsaasApiUrl()}/payments/${paymentId}`, {
    method: 'POST',
    headers: getAsaasHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    await handleAsaasError(response, "Erro ao atualizar pagamento Asaas");
  }

  return response.json();
}
