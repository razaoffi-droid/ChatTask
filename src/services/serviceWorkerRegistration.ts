/**
 * ChatTask Progressive Web App — Service Worker & Notification Manager
 */

export interface PwaNavigationEvent {
  chatId?: string | null;
  taskId?: string | null;
  tab?: 'chats' | 'tasks' | 'notifications' | 'profile';
}

export interface SystemNotificationOptions extends NotificationOptions {
  vibrate?: number[];
  badge?: string;
  data?: any;
  actions?: Array<{ action: string; title: string }>;
  chatId?: string | number | null;
  taskId?: string | number | null;
  tab?: 'chats' | 'tasks' | 'notifications' | 'profile';
}

type NavigationCallback = (nav: PwaNavigationEvent) => void;
type UpdateCallback = (registration: ServiceWorkerRegistration) => void;

let navigationListeners: NavigationCallback[] = [];
let updateListeners: UpdateCallback[] = [];
let swRegistration: ServiceWorkerRegistration | null = null;

/**
 * Register Service Worker in production / supported environments
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    swRegistration = registration;

    // Check for updates periodically
    registration.addEventListener('updatefound', () => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;

      installingWorker.addEventListener('statechange', () => {
        if (installingWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            // New version available!
            console.log('[ChatTask PWA] New version ready for activation');
            updateListeners.forEach((fn) => fn(registration));
          } else {
            console.log('[ChatTask PWA] Content is cached for offline use');
          }
        }
      });
    });

    // Listen for messages from Service Worker (e.g., Notification click navigation)
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (!event.data) return;

      if (event.data.type === 'NAVIGATE_TO') {
        const navEvent: PwaNavigationEvent = {
          chatId: event.data.chatId,
          taskId: event.data.taskId,
          tab: event.data.tab
        };
        navigationListeners.forEach((fn) => fn(navEvent));
      }
    });

    return registration;
  } catch (err) {
    console.warn('[ChatTask PWA] Service Worker registration failed:', err);
    return null;
  }
}

/**
 * Listen for navigation triggers from notification clicks
 */
export function onPwaNavigate(callback: NavigationCallback): () => void {
  navigationListeners.push(callback);
  return () => {
    navigationListeners = navigationListeners.filter((fn) => fn !== callback);
  };
}

/**
 * Listen for new service worker version waiting to activate
 */
export function onPwaUpdateAvailable(callback: UpdateCallback): () => void {
  updateListeners.push(callback);
  return () => {
    updateListeners = updateListeners.filter((fn) => fn !== callback);
  };
}

/**
 * Force the waiting service worker to skip waiting and activate
 */
export function activateWaitingServiceWorker() {
  if (!swRegistration || !swRegistration.waiting) return;
  swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
  window.location.reload();
}

/**
 * Check if Web Notifications are supported in the current environment
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Get current notification permission state
 */
export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

/**
 * Request system notification permission from user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied';

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.warn('[ChatTask] Notification permission request error:', err);
    return 'denied';
  }
}

/**
 * Get current Service Worker registration instance
 */
export function getServiceWorkerRegistration(): ServiceWorkerRegistration | null {
  return swRegistration;
}

/**
 * Show a local system notification (used when the user is minimized or backgrounded)
 */
export async function showSystemNotification(
  title: string,
  options?: SystemNotificationOptions
): Promise<void> {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return;
  }

  const notifData = {
    chatId: options?.chatId != null ? String(options.chatId) : null,
    taskId: options?.taskId != null ? String(options.taskId) : null,
    tab: options?.tab || 'chats',
    timestamp: Date.now(),
    ...(options?.data || {})
  };

  const notifOptions: any = {
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [100, 50, 100],
    ...options,
    data: notifData
  };

  // 1. Try displaying via Service Worker registration (preferred for PWA & mobile background)
  let reg = swRegistration;
  if (!reg && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      reg = await navigator.serviceWorker.ready;
      swRegistration = reg;
    } catch {
      // ignore
    }
  }

  if (reg && 'showNotification' in reg) {
    try {
      await reg.showNotification(title, notifOptions);
      return;
    } catch (swErr) {
      console.warn('[ChatTask] Service Worker showNotification failed, trying window Notification:', swErr);
      // Fall through to standard constructor
    }
  }

  // 2. Fallback to standard window Notification constructor
  try {
    const n = new Notification(title, notifOptions);
    n.onclick = () => {
      window.focus();
      if (options?.chatId != null || options?.taskId != null || options?.tab) {
        navigationListeners.forEach((fn) =>
          fn({
            chatId: options.chatId != null ? String(options.chatId) : null,
            taskId: options.taskId != null ? String(options.taskId) : null,
            tab: options.tab
          })
        );
      }
      n.close();
    };
  } catch (err) {
    console.warn('[ChatTask] Failed to display notification:', err);
  }
}
