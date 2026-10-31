import { useQuery } from '@tanstack/react-query';
import { suggestTags } from './api';

export const tagQueryKeys = {
  suggest: (prefix: string) => ['tag-suggest', prefix] as const,
};

export function useTagSuggestionsQuery(prefix: string, enabled: boolean) {
  return useQuery({
    queryKey: tagQueryKeys.suggest(prefix),
    queryFn: () => suggestTags(prefix),
    enabled,
    staleTime: 30_000,
  });
}
