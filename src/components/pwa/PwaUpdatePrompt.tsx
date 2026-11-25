import React, { useState, useEffect } from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import { onPwaUpdateAvailable, activateWaitingServiceWorker } from '../../services/serviceWorkerRegistration';

export const PwaUpdatePrompt: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const unsubscribe = onPwaUpdateAvailable(() => {
      setUpdateAvailable(true);
    });
    return () => unsubscribe();
  }, []);

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 animate-in slide-in-from-bottom duration-300">
      <div className="bg-slate-900 dark:bg-slate-800 text-white border border-slate-700/80 rounded-2xl p-4 shadow-2xl max-w-sm flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          <h4 className="text-xs font-bold text-white leading-tight">
            Update Available
          </h4>
          <p className="text-[11px] text-slate-300 leading-tight mt-0.5">
            A new version of ChatTask is ready.
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => activateWaitingServiceWorker()}
            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-bold text-white flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Update</span>
          </button>
          <button
            onClick={() => setUpdateAvailable(false)}
            className="w-7 h-7 rounded-lg hover:bg-slate-700/60 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Dismiss update"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
