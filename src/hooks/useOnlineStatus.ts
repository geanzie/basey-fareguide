import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Whether the device currently has a usable internet connection.
 *
 * Starts optimistic. A cold mount that assumed offline would flash an offline
 * banner at every rider on a good connection, and the first failed request
 * corrects us anyway — mirrors frontend/src/hooks/useOnlineStatus.ts.
 *
 * `isInternetReachable` is deliberately preferred over `isConnected`: being
 * attached to a cell tower with no working data path is the exact situation
 * this feature exists for, and `isConnected` alone reports that as online. It
 * is null until NetInfo has probed, which we read as "assume online".
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const reachable = state.isInternetReachable;
      setIsOnline(reachable === null ? state.isConnected !== false : reachable);
    });

    return unsubscribe;
  }, []);

  return isOnline;
}
