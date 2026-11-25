import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { chatSocket } from '../../services/chatSocket';

export const OfflineIndicator: React.FC = () => {
  const { isDmsConnected, refreshDmsData } = useAppStore();
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showReconnectedBanner, setShowReconnectedBanner] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnectedBanner(true);

      // Reconnect chat socket & refresh data
      chatSocket.reconnect();
      refreshDmsData();

      const timer = setTimeout(() => {
        setShowReconnectedBanner(false);
      }, 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnectedBanner(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshDmsData]);

  const handleManualRetry = () => {
    setIsReconnecting(true);
    chatSocket.reconnect();
    refreshDmsData();
    setTimeout(() => {
      setIsReconnecting(false);
    }, 1500);
  };

  // If network is completely offline
  if (!isOnline) {
    return (
      <aside aria-label="Offline status" className="bg-amber-600 dark:bg-amber-700 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between gap-3 shadow-md z-50 sticky top-0 transition-all select-none">
        <div className="flex items-center gap-2 min-w-0">
          <WifiOff className="w-4 h-4 shrink-0 animate-pulse text-amber-200" />
          <span className="truncate">
            You are currently offline. Displaying cached content.
          </span>
        </div>
        <button
          onClick={handleManualRetry}
          disabled={isReconnecting}
          className="shrink-0 px-2.5 py-1 bg-amber-800/80 hover:bg-amber-800 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isReconnecting ? 'animate-spin' : ''}`} />
          <span>{isReconnecting ? 'Retrying...' : 'Retry'}</span>
        </button>
      </aside>
    );
  }

  // If network is online, but socket disconnected
  if (!isDmsConnected) {
    return (
      <aside aria-label="Connecting status" className="bg-rose-600/90 dark:bg-rose-700/90 text-white px-4 py-1.5 text-xs font-semibold flex items-center justify-between gap-3 shadow-sm z-50 sticky top-0 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-rose-300 animate-ping shrink-0" />
          <span className="truncate">
            Connecting to real-time chat &amp; task gateway...
          </span>
        </div>
        <button
          onClick={handleManualRetry}
          disabled={isReconnecting}
          className="shrink-0 px-2.5 py-0.5 bg-rose-800 hover:bg-rose-900 rounded text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3 h-3 ${isReconnecting ? 'animate-spin' : ''}`} />
          <span>Reconnect</span>
        </button>
      </aside>
    );
  }

  // Brief reconnected banner
  if (showReconnectedBanner) {
    return (
      <aside aria-label="Online status" className="bg-emerald-600 text-white px-4 py-1.5 text-xs font-semibold flex items-center justify-center gap-2 shadow-sm z-50 sticky top-0 animate-in fade-in slide-in-from-top duration-300 select-none">
        <Wifi className="w-4 h-4 text-emerald-200" />
        <span>Connected — Back online</span>
      </aside>
    );
  }

  return null;
};
