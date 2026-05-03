import Pusher from 'pusher-js';

// Lazy singleton Pusher client. Built on first use after login (so we can
// attach the user's JWT to the channel-auth endpoint), and torn down on
// logout. The `key` and `cluster` are public values shipped to the
// browser; the secret stays server-side.

let cachedClient = null;

function resolveAuthEndpoint() {
  // Mirrors the resolution rule in lib/api.js — env override or vite proxy.
  const apiBase = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL.replace(/\/+$/, '')}/api`
    : '/api';
  return `${apiBase}/chat/pusher/auth`;
}

export function getPusher() {
  if (cachedClient) return cachedClient;

  const key = import.meta.env.VITE_PUSHER_KEY;
  const cluster = import.meta.env.VITE_PUSHER_CLUSTER;
  if (!key || !cluster) {
    throw new Error('Pusher is not configured (VITE_PUSHER_KEY / VITE_PUSHER_CLUSTER missing)');
  }

  // pusher-js v8 reads the JWT *at subscribe time* from the
  // `headers` callback of `channelAuthorization`, so token rotations
  // (login/logout) take effect on the next subscription without
  // re-creating the client.
  cachedClient = new Pusher(key, {
    cluster,
    channelAuthorization: {
      endpoint: resolveAuthEndpoint(),
      transport: 'ajax',
      headersProvider() {
        const token = localStorage.getItem('nb-token');
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    },
  });

  return cachedClient;
}

export function disconnectPusher() {
  if (cachedClient) {
    try {
      cachedClient.disconnect();
    } catch {
      // ignore
    }
    cachedClient = null;
  }
}
