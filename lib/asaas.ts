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

export const ASAAS_API_URL = (process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3').split(' ')[0];
export const ASAAS_API_KEY = process.env.ASAAS_API_KEY || '';

const headers = {
  'Content-Type': 'application/json',
  access_token: ASAAS_API_KEY,
};

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
  throw new Error(`${defaultMessage}: ${typeof errorData === 'string' ? errorData : JSON.stringify(errorData)} (Status: ${response.status})`);
}

export async function createAsaasCustomer(data: AsaasCustomerData) {
  const response = await fetch(`${ASAAS_API_URL}/customers`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    await handleAsaasError(response, "Erro ao criar cliente Asaas");
  }

  return response.json();
}

export async function createAsaasPayment(data: AsaasPaymentData) {
  const response = await fetch(`${ASAAS_API_URL}/payments`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    await handleAsaasError(response, "Erro ao criar pagamento Asaas");
  }

  return response.json();
}

export async function getPixQrCode(paymentId: string) {
  const response = await fetch(`${ASAAS_API_URL}/payments/${paymentId}/pixQrCode`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    await handleAsaasError(response, "Erro ao obter QR Code Pix Asaas");
  }

  return response.json();
}

export async function createAsaasSubscription(data: AsaasSubscriptionData) {
  const response = await fetch(`${ASAAS_API_URL}/subscriptions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    await handleAsaasError(response, "Erro ao criar assinatura Asaas");
  }

  return response.json();
}

export async function updateAsaasSubscription(subscriptionId: string, data: Partial<AsaasSubscriptionData>) {
  const response = await fetch(`${ASAAS_API_URL}/subscriptions/${subscriptionId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    await handleAsaasError(response, "Erro ao atualizar assinatura Asaas");
  }

  return response.json();
}

export async function listAsaasPayments(customerId: string) {
  const response = await fetch(`${ASAAS_API_URL}/payments?customer=${customerId}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    await handleAsaasError(response, "Erro ao buscar faturas Asaas");
  }

  return response.json();
}

export async function getAsaasSubscription(subscriptionId: string) {
  const response = await fetch(`${ASAAS_API_URL}/subscriptions/${subscriptionId}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    await handleAsaasError(response, "Erro ao buscar assinatura Asaas");
  }

  return response.json();
}

export async function deleteAsaasSubscription(subscriptionId: string) {
  const response = await fetch(`${ASAAS_API_URL}/subscriptions/${subscriptionId}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    await handleAsaasError(response, "Erro ao deletar assinatura Asaas");
  }

  return response.json();
}

export async function deleteAsaasPayment(paymentId: string) {
  const response = await fetch(`${ASAAS_API_URL}/payments/${paymentId}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    await handleAsaasError(response, "Erro ao deletar cobrança Asaas");
  }

  return response.json();
}

export async function deleteAsaasCustomer(customerId: string) {
  const response = await fetch(`${ASAAS_API_URL}/customers/${customerId}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    await handleAsaasError(response, "Erro ao deletar cliente Asaas");
  }

  return response.json();
}

export async function updateAsaasPayment(paymentId: string, data: any) {
  const response = await fetch(`${ASAAS_API_URL}/payments/${paymentId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    await handleAsaasError(response, "Erro ao atualizar pagamento Asaas");
  }

  return response.json();
}
