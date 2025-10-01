import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PaymentOption } from '@/pages/Checkout';

export interface CheckoutCharge {
  id: string;
  totalCents: number;
  title: string;
  description: string;
}

export interface PaymentSplit {
  method: 'PIX' | 'CARD';
  amountCents: number;
  percentage: number;
  installments?: number;
}

interface CheckoutState {
  charge: CheckoutCharge | null;
  selectedOption: PaymentOption | null;
  customAmount: number;
  customInstallments: number;
  isSplitModalOpen: boolean;
  paymentSplits: PaymentSplit[];
  checkoutUrl: string | null;
  
  // Actions
  setCharge: (charge: CheckoutCharge) => void;
  setSelectedOption: (option: PaymentOption | null) => void;
  setCustomAmount: (amount: number) => void;
  setCustomInstallments: (installments: number) => void;
  setSplitModalOpen: (open: boolean) => void;
  setPaymentSplits: (splits: PaymentSplit[]) => void;
  setCheckoutUrl: (url: string) => void;
  reset: () => void;
}

export const useCheckoutStore = create<CheckoutState>()(
  persist(
    (set, get) => ({
      charge: null,
      selectedOption: null,
      customAmount: 0,
      customInstallments: 1,
      isSplitModalOpen: false,
      paymentSplits: [],
      checkoutUrl: null,

      setCharge: (charge) => set({ charge }),
      setSelectedOption: (selectedOption) => set({ selectedOption }),
      setCustomAmount: (customAmount) => set({ customAmount }),
      setCustomInstallments: (customInstallments) => set({ customInstallments }),
      setSplitModalOpen: (isSplitModalOpen) => set({ isSplitModalOpen }),
      setPaymentSplits: (paymentSplits) => set({ paymentSplits }),
      setCheckoutUrl: (checkoutUrl) => set({ checkoutUrl }),
      
      reset: () => set({
        charge: null,
        selectedOption: null,
        customAmount: 0,
        customInstallments: 1,
        isSplitModalOpen: false,
        paymentSplits: [],
        checkoutUrl: null
      })
    }),
    {
      name: 'checkout-store',
      partialize: (state) => ({
        paymentSplits: state.paymentSplits,
        checkoutUrl: state.checkoutUrl
      })
    }
  )
);