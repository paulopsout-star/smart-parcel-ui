import { CheckoutCharge } from './useCheckoutStore';

// Mock data for charges
const mockCharges: Record<string, CheckoutCharge> = {
  '1': {
    id: '1',
    totalCents: 50000, // R$ 500,00
    title: 'Produto Premium',
    description: 'Licença anual do software Premium'
  },
  '2': {
    id: '2',
    totalCents: 120000, // R$ 1.200,00
    title: 'Consultoria Especializada',
    description: 'Pacote de consultoria de 10 horas'
  },
  '3': {
    id: '3',
    totalCents: 25000, // R$ 250,00
    title: 'Curso Online',
    description: 'Acesso completo ao curso de marketing digital'
  }
};

export const getCheckoutCharge = async (id: string): Promise<CheckoutCharge | null> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Return mock data or fallback
  return mockCharges[id] || {
    id,
    totalCents: 100000, // R$ 1.000,00 - fallback
    title: 'Produto/Serviço',
    description: 'Descrição do produto ou serviço'
  };
};

export const generateMockCheckoutUrl = (chargeId: string): string => {
  return `https://checkout.autonegocie/mock/${chargeId}`;
};