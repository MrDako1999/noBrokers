import { create } from 'zustand';
import api from '@/lib/api';

// Buyer/seller dashboard mode. The server is the source of truth (via
// `user.preferences.lastMode`), but we mirror the value into localStorage so
// the sidebar doesn't flicker on hard reload while `/auth/me` resolves.
//
// Enforcement rules:
//   - Non-enrolled users can never enter `seller` mode (the switcher hides).
//   - On boot, if `lastMode === 'seller'` but the user lost enrollment
//     (admin revoke, data corruption) we silently fall back to `buyer`.

const STORAGE_KEY = 'nb-mode';

function readStored() {
  if (typeof window === 'undefined') return 'buyer';
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'seller' ? 'seller' : 'buyer';
}

function writeStored(mode) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, mode);
}

let persistTimer = null;

function persistToServer(mode) {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    api.put('/auth/preferences', { lastMode: mode }).catch(() => {
      // Non-fatal — next /auth/me will reconcile.
    });
  }, 350);
}

const useModeStore = create((set, get) => ({
  mode: readStored(),

  // Called from App boot (after checkAuth resolves) with the fresh user.
  hydrateFromUser: (user) => {
    if (!user) {
      set({ mode: 'buyer' });
      writeStored('buyer');
      return;
    }
    const serverMode = user.preferences?.lastMode;
    const enrolled = !!user.sellerProfile?.enrolled;
    const next = serverMode === 'seller' && enrolled ? 'seller' : (serverMode || 'buyer');
    set({ mode: next });
    writeStored(next);
  },

  setMode: (mode, { user } = {}) => {
    if (mode !== 'buyer' && mode !== 'seller') return;
    if (mode === 'seller' && !user?.sellerProfile?.enrolled && user?.role !== 'admin') {
      return;
    }
    if (get().mode === mode) return;
    set({ mode });
    writeStored(mode);
    persistToServer(mode);
  },

  // After seller enrollment the API echoes the user with lastMode='seller';
  // this keeps the local store in sync without another round-trip.
  syncFromUser: (user) => {
    const next = user?.preferences?.lastMode || 'buyer';
    if (get().mode !== next) {
      set({ mode: next });
      writeStored(next);
    }
  },
}));

export default useModeStore;
