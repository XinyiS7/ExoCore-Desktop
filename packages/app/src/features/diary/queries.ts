import { useQuery } from '@tanstack/react-query';
import { fetchCanonicalDiary } from './api';

export const diaryQueryKeys = { detail: (presetId: number | null, day: string | null) => ['canonical-diary', presetId, day] as const };
export function useCanonicalDiaryQuery(presetId: number | null, day: string | null) {
  return useQuery({
    queryKey: diaryQueryKeys.detail(presetId, day),
    queryFn: ({ signal }) => fetchCanonicalDiary(presetId!, day!, signal),
    enabled: presetId !== null && day !== null,
    retry: false,
  });
}
