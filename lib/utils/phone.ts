export function formatBrazilianPhone(phone: string | null | undefined): string {
  if (!phone) return ''

  // Remove everything that is not a digit
  let cleanPhone = String(phone).replace(/\D/g, '')

  if (!cleanPhone) return ''

  // If it's just 10 or 11 digits, we assume it's a Brazilian number missing the country code
  if (cleanPhone.length === 10 || cleanPhone.length === 11) {
    cleanPhone = '55' + cleanPhone
  }

  // Se tem 12 dígitos começando com 55 (ex: 55 11 9999-9999) e deveria ter o 9
  // Ou seja: 55 + DDD (2) + Numero (8) = 12 digitos
  // Idealmente no Brasil celulares têm 9 dígitos: 55 + DDD (2) + Numero (9) = 13 digitos
  // Nós apenas garantimos que começa com 55. A adição do 9º dígito automaticamente
  // pode ser arriscada pois telefones fixos têm 8 dígitos.
  
  return cleanPhone
}
