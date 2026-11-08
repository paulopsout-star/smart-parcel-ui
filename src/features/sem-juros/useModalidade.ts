import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePaymentSimulation, type SimulationResponse } from '@/hooks/usePaymentSimulation';
import type { Modalidade } from './index';

export interface ModalidadeInfo {
  modalidade: Modalidade;
  chargeId: string | null;
  semJuros?: { parcelasMaximas: number; cartaoCents: number };
}

const COM_JUROS: ModalidadeInfo = { modalidade: 'com_juros', chargeId: null };

/**
 * Descobre a modalidade de uma cobrança no checkout público (id do payment_link ou da cobrança).
 * Só lê o banco. Qualquer falha devolve com_juros, que é o comportamento atual.
 */
export function useChargeModalidade(id: string | null | undefined) {
  return useQuery({
    queryKey: ['charge-modalidade', id],
    queryFn: async (): Promise<ModalidadeInfo> => {
      const { data, error } = await supabase.functions.invoke('public-charge-modalidade', { body: { id } });
      if (error || !data?.modalidade) return COM_JUROS;
      return data as ModalidadeInfo;
    },
    enabled: !!id,
    staleTime: 60_000,
    retry: 1,
  });
}

/**
 * Simulação de parcelas conforme a modalidade:
 *  - com_juros: usePaymentSimulation (fluxo atual, intacto) com o valor informado;
 *  - sem_juros: quitaplus-sj-simulation pela cobrança (o servidor decide valor, lojista e faixa).
 * Enquanto a modalidade não é conhecida, não simula (evita exibir juros para cobrança sem juros).
 */
export function useModalidadeSimulation(id: string | null | undefined, amountCents: number | null) {
  const modalidadeQuery = useChargeModalidade(id);
  const info = modalidadeQuery.data;
  const modalidade: Modalidade | null = info?.modalidade ?? (modalidadeQuery.isError ? 'com_juros' : null);

  const comJuros = usePaymentSimulation(modalidade === 'com_juros' && amountCents && amountCents > 0 ? amountCents : null);

  const semJuros = useQuery({
    queryKey: ['sj-simulation', info?.chargeId],
    queryFn: async (): Promise<SimulationResponse> => {
      const { data, error } = await supabase.functions.invoke('quitaplus-sj-simulation', { body: { chargeId: info?.chargeId } });
      if (error) throw error;
      if (!data?.success) {
        const err = new Error(data?.error || 'Erro na simulação sem juros') as Error & { code?: string };
        err.code = data?.code;
        throw err;
      }
      return data as SimulationResponse;
    },
    enabled: modalidade === 'sem_juros' && !!info?.chargeId,
    staleTime: 0,
    gcTime: 0,
    retry: 1,
  });

  if (modalidade === 'sem_juros') {
    return { modalidade, data: semJuros.data, isLoading: modalidadeQuery.isLoading || semJuros.isLoading, error: semJuros.error, semJuros: info?.semJuros };
  }
  return { modalidade, data: comJuros.data, isLoading: modalidadeQuery.isLoading || comJuros.isLoading, error: comJuros.error, semJuros: undefined };
}
