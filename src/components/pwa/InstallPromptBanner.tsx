import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallPromptBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // Check if already installed & running in standalone display mode
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    setIsStandalone(isStandaloneMode);

    // Check dismissal status in local storage (suppress for 3 days if dismissed)
    const dismissedTime = localStorage.getItem('chattask_pwa_install_dismissed');
    if (dismissedTime) {
      const elapsed = Date.now() - parseInt(dismissedTime, 10);
      if (elapsed < 3 * 24 * 60 * 60 * 1000) {
        setIsDismissed(true);
      }
    }

    // Detect iOS devices for manual Add-to-Home-Screen prompt
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    setIsIos(isIosDevice);

    // Listen for Chrome / Edge / Android install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Track appinstalled event
    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
      console.log('[ChatTask PWA] App successfully installed');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          console.log('[ChatTask PWA] User accepted installation prompt');
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.warn('[ChatTask PWA] Install prompt failed:', err);
      }
    } else if (isIos) {
      setShowIosGuide(true);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    setShowIosGuide(false);
    localStorage.setItem('chattask_pwa_install_dismissed', Date.now().toString());
  };

  // Do not show if already running as installed app or dismissed
  if (isStandalone || isDismissed) {
    return null;
  }

  // Only display if install prompt is ready, or if on iOS Safari
  if (!deferredPrompt && !isIos) {
    return null;
  }

  return (
    <>
      <div className="bg-emerald-800 text-white px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3 shadow-md z-40 border-b border-emerald-700/60 transition-all select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-600/80 flex items-center justify-center shrink-0 border border-emerald-400/40">
            <Smartphone className="w-4 h-4 text-emerald-100" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold leading-tight truncate">
              Install ChatTask as an App
            </span>
            <span className="text-[11px] text-emerald-200/90 leading-tight truncate">
              Quick launch from your desktop or phone home screen
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleInstallClick}
            className="px-3 py-1.5 bg-white text-emerald-900 hover:bg-emerald-50 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-800" />
            <span>Install</span>
          </button>
          <button
            onClick={handleDismiss}
            className="w-7 h-7 rounded-lg hover:bg-emerald-700/60 flex items-center justify-center text-emerald-200 hover:text-white transition-colors cursor-pointer"
            aria-label="Dismiss install banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* iOS Safari Installation Instructions Modal */}
      {showIosGuide && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowIosGuide(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-sm w-full shadow-2xl text-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Share className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Install on iOS / Safari</span>
              </h3>
              <button
                onClick={() => setShowIosGuide(false)}
                className="w-7 h-7 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ol className="text-xs space-y-3 text-slate-600 dark:text-slate-300 mb-5">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold shrink-0">
                  1
                </span>
                <span>
                  Tap the <strong>Share</strong> button at the bottom of your Safari toolbar (the box with an upward arrow).
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold shrink-0">
                  2
                </span>
                <span>
                  Scroll down the menu and tap <strong>Add to Home Screen</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold shrink-0">
                  3
                </span>
                <span>
                  Tap <strong>Add</strong> in the top right corner to install ChatTask!
                </span>
              </li>
            </ol>

            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
