/**
 * useRefresh — Hook réutilisable pour pull-to-refresh
 *
 * Encapsule le pattern refreshing state + callback async
 * utilisé sur tous les écrans avec RefreshControl.
 */

import { useState, useCallback } from 'react';

export function useRefresh(refreshFn: () => Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshFn();
    } finally {
      setRefreshing(false);
    }
  }, [refreshFn]);

  return { refreshing, onRefresh };
}
