/**
 * AuthContext.tsx — Protection biométrique / PIN au lancement
 *
 * Gère le verrouillage de l'app (Face ID / Touch ID / PIN 4 chiffres).
 * Stockage SecureStore : auth_enabled, auth_pin_hash, auth_lock_delay.
 *
 * Hiérarchie : VaultProvider > AuthProvider > ThemeProvider > ...
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// ─── Hash simple (SHA-256 JS pur) ────────────────────────────────────────────

/**
 * Hash SHA-256 implémenté en JS pur (pas de dépendance native).
 * Suffisant pour un PIN local — pas de réseau.
 */
function sha256(message: string): string {
  // Pré-traitement
  const msgBuffer = new Uint8Array(
    [...message].map((c) => c.charCodeAt(0))
  );

  // Constantes SHA-256
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let H0 = 0x6a09e667, H1 = 0xbb67ae85, H2 = 0x3c6ef372, H3 = 0xa54ff53a;
  let H4 = 0x510e527f, H5 = 0x9b05688c, H6 = 0x1f83d9ab, H7 = 0x5be0cd19;

  // Pré-traitement : padding
  const bitLen = msgBuffer.length * 8;
  const padded = new Uint8Array(Math.ceil((msgBuffer.length + 9) / 64) * 64);
  padded.set(msgBuffer);
  padded[msgBuffer.length] = 0x80;
  // Longueur en bits (big endian 64-bit)
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, bitLen, false);

  // Traitement par blocs de 64 octets
  for (let offset = 0; offset < padded.length; offset += 64) {
    const W = new Uint32Array(64);
    for (let i = 0; i < 16; i++) {
      W[i] = view.getUint32(offset + i * 4, false);
    }

    for (let i = 16; i < 64; i++) {
      const s0 = (rr(W[i - 15], 7) ^ rr(W[i - 15], 18) ^ (W[i - 15] >>> 3)) >>> 0;
      const s1 = (rr(W[i - 2], 17) ^ rr(W[i - 2], 19) ^ (W[i - 2] >>> 10)) >>> 0;
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }

    let a = H0, b = H1, c = H2, d = H3, e = H4, f = H5, g = H6, h = H7;

    for (let i = 0; i < 64; i++) {
      const S1 = (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (S0 + maj) >>> 0;

      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }

    H0 = (H0 + a) >>> 0; H1 = (H1 + b) >>> 0; H2 = (H2 + c) >>> 0; H3 = (H3 + d) >>> 0;
    H4 = (H4 + e) >>> 0; H5 = (H5 + f) >>> 0; H6 = (H6 + g) >>> 0; H7 = (H7 + h) >>> 0;
  }

  return [H0, H1, H2, H3, H4, H5, H6, H7]
    .map((v) => v.toString(16).padStart(8, '0'))
    .join('');
}

/** Rotation droite 32-bit */
function rr(n: number, shift: number): number {
  return ((n >>> shift) | (n << (32 - shift))) >>> 0;
}

/** Hash un PIN avec un sel fixe local */
export function hashPin(pin: string): string {
  return sha256(`family-vault-pin:${pin}`);
}

// ─── Types & constantes ──────────────────────────────────────────────────────

export type LockDelay = '0' | '30' | '60' | '300';

export const LOCK_DELAY_OPTIONS: { value: LockDelay; label: string }[] = [
  { value: '0', label: 'Immédiat' },
  { value: '30', label: '30 secondes' },
  { value: '60', label: '1 minute' },
  { value: '300', label: '5 minutes' },
];

const KEYS = {
  enabled: 'auth_enabled',
  pinHash: 'auth_pin_hash',
  lockDelay: 'auth_lock_delay',
} as const;

// ─── Context ─────────────────────────────────────────────────────────────────

interface AuthState {
  /** L'utilisateur a déverrouillé l'app */
  isAuthenticated: boolean;
  /** La protection est activée */
  isAuthEnabled: boolean;
  /** Un PIN est configuré */
  hasPin: boolean;
  /** Délai avant re-verrouillage (secondes) */
  lockDelay: LockDelay;
  /** Infos biométrie disponible */
  biometryType: 'face' | 'fingerprint' | 'iris' | null;
  /** Biométrie disponible et inscrite */
  biometryAvailable: boolean;
  /** Tente biométrie, fallback PIN vérifié en interne */
  authenticate: () => Promise<boolean>;
  /** Vérifie un PIN (retourne true si correct) */
  verifyPin: (pin: string) => boolean;
  /** Enregistre un nouveau PIN et active la protection */
  setPin: (pin: string) => Promise<void>;
  /** Supprime le PIN et désactive la protection */
  removePin: () => Promise<void>;
  /** Active/désactive la protection (toggle) */
  setAuthEnabled: (enabled: boolean) => Promise<void>;
  /** Change le délai de verrouillage */
  setLockDelay: (delay: LockDelay) => Promise<void>;
  /** Verrouille l'app manuellement */
  lockApp: () => void;
  /** Chargement initial terminé */
  isReady: boolean;
}

const Ctx = createContext<AuthState | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthEnabled, setIsAuthEnabledState] = useState(false);
  const [pinHash, setPinHash] = useState<string | null>(null);
  const [lockDelay, setLockDelayState] = useState<LockDelay>('0');
  const [biometryType, setBiometryType] = useState<'face' | 'fingerprint' | 'iris' | null>(null);
  const [biometryAvailable, setBiometryAvailable] = useState(false);

  // Timestamp du dernier passage en background
  const backgroundTimestamp = useRef<number | null>(null);
  // Empêche le re-lock pendant l'authentification (Face ID = inactive → active)
  const isAuthenticatingRef = useRef(false);

  // ── Chargement initial ──
  useEffect(() => {
    (async () => {
      try {
        const [enabledRaw, storedHash, delayRaw] = await Promise.all([
          SecureStore.getItemAsync(KEYS.enabled),
          SecureStore.getItemAsync(KEYS.pinHash),
          SecureStore.getItemAsync(KEYS.lockDelay),
        ]);

        const enabled = enabledRaw === 'true';
        setIsAuthEnabledState(enabled);
        setPinHash(storedHash);
        if (delayRaw && ['0', '30', '60', '300'].includes(delayRaw)) {
          setLockDelayState(delayRaw as LockDelay);
        }

        // Si pas de protection → déjà authentifié
        if (!enabled || !storedHash) {
          setIsAuthenticated(true);
        }

        // Détecter la biométrie disponible
        try {
          const LocalAuth = require('expo-local-authentication');
          const hasHardware = await LocalAuth.hasHardwareAsync();
          const isEnrolled = await LocalAuth.isEnrolledAsync();
          setBiometryAvailable(hasHardware && isEnrolled);

          if (hasHardware && isEnrolled) {
            const types: number[] = await LocalAuth.supportedAuthenticationTypesAsync();
            // 1 = FINGERPRINT, 2 = FACIAL_RECOGNITION, 3 = IRIS
            if (types.includes(2)) setBiometryType('face');
            else if (types.includes(1)) setBiometryType('fingerprint');
            else if (types.includes(3)) setBiometryType('iris');
          }
        } catch {
          // expo-local-authentication pas disponible
        }
      } catch {
        // SecureStore indisponible — pas de protection
        setIsAuthenticated(true);
      }
      setIsReady(true);
    })();
  }, []);

  // ── AppState : verrouiller au retour foreground après délai ──
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (!isAuthEnabled || !pinHash) return;
      // Ne pas re-lock pendant Face ID (inactive → active rapide)
      if (isAuthenticatingRef.current) return;

      if (nextState === 'background') {
        backgroundTimestamp.current = Date.now();
      } else if (nextState === 'active') {
        if (backgroundTimestamp.current !== null) {
          const elapsed = (Date.now() - backgroundTimestamp.current) / 1000;
          const delaySeconds = parseInt(lockDelay, 10);
          if (elapsed >= delaySeconds) {
            setIsAuthenticated(false);
          }
          backgroundTimestamp.current = null;
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isAuthEnabled, pinHash, lockDelay]);

  // ── Authentification biométrique ──
  const authenticate = useCallback(async (): Promise<boolean> => {
    // Si pas de protection, toujours OK
    if (!isAuthEnabled || !pinHash) {
      setIsAuthenticated(true);
      return true;
    }

    // Tenter la biométrie
    if (biometryAvailable) {
      try {
        isAuthenticatingRef.current = true;
        const LocalAuth = require('expo-local-authentication');
        const result = await LocalAuth.authenticateAsync({
          promptMessage: 'Déverrouiller Family Vault',
          cancelLabel: 'Utiliser le PIN',
          disableDeviceFallback: true,
        });
        isAuthenticatingRef.current = false;
        if (result.success) {
          setIsAuthenticated(true);
          return true;
        }
      } catch {
        isAuthenticatingRef.current = false;
        // Fallback au PIN
      }
    }

    // Pas de biométrie ou échec → le PIN sera géré par le LockScreen
    return false;
  }, [isAuthEnabled, pinHash, biometryAvailable]);

  // ── Vérification PIN ──
  const verifyPin = useCallback(
    (pin: string): boolean => {
      if (!pinHash) return false;
      const match = hashPin(pin) === pinHash;
      if (match) setIsAuthenticated(true);
      return match;
    },
    [pinHash],
  );

  // ── Enregistrer un PIN ──
  const setPin = useCallback(async (pin: string) => {
    const hash = hashPin(pin);
    await SecureStore.setItemAsync(KEYS.pinHash, hash);
    await SecureStore.setItemAsync(KEYS.enabled, 'true');
    setPinHash(hash);
    setIsAuthEnabledState(true);
    setIsAuthenticated(true);
  }, []);

  // ── Supprimer le PIN ──
  const removePin = useCallback(async () => {
    await SecureStore.deleteItemAsync(KEYS.pinHash);
    await SecureStore.setItemAsync(KEYS.enabled, 'false');
    setPinHash(null);
    setIsAuthEnabledState(false);
    setIsAuthenticated(true);
  }, []);

  // ── Toggle protection ──
  const setAuthEnabled = useCallback(async (enabled: boolean) => {
    await SecureStore.setItemAsync(KEYS.enabled, enabled ? 'true' : 'false');
    setIsAuthEnabledState(enabled);
    if (!enabled) setIsAuthenticated(true);
  }, []);

  // ── Changer le délai ──
  const setLockDelay = useCallback(async (delay: LockDelay) => {
    await SecureStore.setItemAsync(KEYS.lockDelay, delay);
    setLockDelayState(delay);
  }, []);

  // ── Verrouiller manuellement ──
  const lockApp = useCallback(() => {
    if (isAuthEnabled && pinHash) {
      setIsAuthenticated(false);
    }
  }, [isAuthEnabled, pinHash]);

  const value = useMemo<AuthState>(
    () => ({
      isAuthenticated,
      isAuthEnabled,
      hasPin: !!pinHash,
      lockDelay,
      biometryType,
      biometryAvailable,
      authenticate,
      verifyPin,
      setPin,
      removePin,
      setAuthEnabled,
      setLockDelay,
      lockApp,
      isReady,
    }),
    [
      isAuthenticated, isAuthEnabled, pinHash, lockDelay, biometryType, biometryAvailable,
      authenticate, verifyPin, setPin, removePin, setAuthEnabled, setLockDelay, lockApp, isReady,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return ctx;
}
