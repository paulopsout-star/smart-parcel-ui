import { z } from "zod";

// Validation schemas for QuitaMais integration
export const payerSchema = z.object({
  name: z.string()
    .min(1, "Nome é obrigatório")
    .max(200, "Nome deve ter no máximo 200 caracteres"),
  email: z.string()
    .email("Email inválido")
    .max(50, "Email deve ter no máximo 50 caracteres"),
  phoneNumber: z.string()
    .regex(/^\d{10,11}$/, "Telefone deve ter 10 ou 11 dígitos (apenas números)")
    .min(10, "Telefone deve ter pelo menos 10 dígitos")
    .max(11, "Telefone deve ter no máximo 11 dígitos"),
  document: z.string()
    .regex(/^\d{11}$|^\d{14}$/, "Documento deve ser CPF (11 dígitos) ou CNPJ (14 dígitos)")
});

export const bankslipSchema = z.object({
  number: z.string()
    .regex(/^\d+$/, "Linha digitável deve conter apenas números")
    .min(47, "Linha digitável deve ter pelo menos 47 dígitos")
    .max(48, "Linha digitável deve ter no máximo 48 dígitos"),
  creditorDocument: z.string()
    .regex(/^\d{11}$|^\d{14}$/, "Documento do credor deve ser CPF (11 dígitos) ou CNPJ (14 dígitos)"),
  creditorName: z.string()
    .min(1, "Nome do credor é obrigatório")
    .max(200, "Nome do credor deve ter no máximo 200 caracteres")
});

export const checkoutSchema = z.object({
  maskFee: z.boolean(),
  installments: z.number().int().min(1).max(48).nullable()
});

export const paymentLinkRequestSchema = z.object({
  amount: z.number()
    .min(100, "Valor mínimo é R$ 1,00") // em centavos
    .max(1000000000, "Valor máximo excedido"), // R$ 10.000.000,00
  payer: payerSchema,
  bankslip: bankslipSchema.optional(),
  checkout: checkoutSchema,
  description: z.string().max(500, "Descrição deve ter no máximo 500 caracteres").optional(),
  orderId: z.string().max(100, "ID do pedido deve ter no máximo 100 caracteres").optional(),
  expirationDate: z.string().datetime().optional()
});

// Utility functions for validation and formatting
export const formatDocument = (document: string): string => {
  return document.replace(/\D/g, '');
};

export const formatPhoneNumber = (phone: string): string => {
  return phone.replace(/\D/g, '');
};

export const formatAmount = (amount: string): number => {
  // Remove tudo que não é dígito ou vírgula/ponto
  const cleaned = amount.replace(/[^\d,.-]/g, '');
  
  // Substitui vírgula por ponto
  const normalized = cleaned.replace(',', '.');
  
  // Converte para número e multiplica por 100 para centavos
  const value = parseFloat(normalized) * 100;
  
  return isNaN(value) ? 0 : Math.round(value);
};

export const formatCurrency = (amountInCents: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(amountInCents / 100);
};

export const validateCPF = (cpf: string): boolean => {
  const cleanCPF = cpf.replace(/\D/g, '');
  
  if (cleanCPF.length !== 11 || /^(\d)\1{10}$/.test(cleanCPF)) {
    return false;
  }

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
  }
  let remainder = 11 - (sum % 11);
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
  }
  remainder = 11 - (sum % 11);
  if (remainder === 10 || remainder === 11) remainder = 0;

  return remainder === parseInt(cleanCPF.charAt(10));
};

export const validateCNPJ = (cnpj: string): boolean => {
  const cleanCNPJ = cnpj.replace(/\D/g, '');
  
  if (cleanCNPJ.length !== 14 || /^(\d)\1{13}$/.test(cleanCNPJ)) {
    return false;
  }

  let sum = 0;
  let pos = 5;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleanCNPJ.charAt(i)) * pos--;
    if (pos < 2) pos = 9;
  }
  let remainder = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (remainder !== parseInt(cleanCNPJ.charAt(12))) return false;

  sum = 0;
  pos = 6;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleanCNPJ.charAt(i)) * pos--;
    if (pos < 2) pos = 9;
  }
  remainder = sum % 11 < 2 ? 0 : 11 - (sum % 11);

  return remainder === parseInt(cleanCNPJ.charAt(13));
};