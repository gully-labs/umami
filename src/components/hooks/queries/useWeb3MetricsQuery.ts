import type { UseQueryOptions } from '@tanstack/react-query';
import { useDateParameters } from '@/components/hooks/useDateParameters';
import type { Web3Metrics } from '@/queries/sql/web3/getWeb3Metrics';
import { useApi } from '../useApi';
import { useFilterParameters } from '../useFilterParameters';

type Web3MetricsApiResponse = {
  data: Web3Metrics;
};

/* Gully Analytics: Web3 dashboard data for the selected date range and filters. */
export function useWeb3MetricsQuery(
  { websiteId }: { websiteId: string },
  options?: UseQueryOptions<Web3MetricsApiResponse, Error, Web3Metrics>,
) {
  const { get, useQuery } = useApi();
  const { startAt, endAt } = useDateParameters();
  const filters = useFilterParameters({ includePagination: false });

  return useQuery<Web3MetricsApiResponse, Error, Web3Metrics>({
    queryKey: ['websites:web3', { websiteId, startAt, endAt, ...filters }],
    queryFn: () =>
      get(`/websites/${websiteId}/web3`, {
        startAt,
        endAt,
        ...filters,
      }),
    select: response => response.data,
    enabled: !!websiteId,
    ...options,
  });
}
