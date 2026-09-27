/**
 * Safe AsyncStorage wrapper with in-memory fallback.
 * Prevents app crashes if the native module hasn't been compiled into the current APK build.
 */

interface IStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
  clear: () => Promise<void>;
}

const memoryStore = new Map<string, string>();

let nativeStorage: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('@react-native-async-storage/async-storage');
  nativeStorage = mod.default || mod;
} catch (error) {
  // Gracefully fallback without triggering yellow box warning on screen
}

export const appStorage: IStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (nativeStorage) {
      try {
        return await nativeStorage.getItem(key);
      } catch (err) {
        console.warn('[Storage] native getItem failed, falling back to memory', err);
      }
    }
    return memoryStore.get(key) ?? null;
  },

  setItem: async (key: string, value: string): Promise<void> => {
    if (nativeStorage) {
      try {
        await nativeStorage.setItem(key, value);
        return;
      } catch (err) {
        console.warn('[Storage] native setItem failed, falling back to memory', err);
      }
    }
    memoryStore.set(key, value);
  },

  removeItem: async (key: string): Promise<void> => {
    if (nativeStorage) {
      try {
        await nativeStorage.removeItem(key);
        return;
      } catch (err) {
        console.warn('[Storage] native removeItem failed, falling back to memory', err);
      }
    }
    memoryStore.delete(key);
  },

  clear: async (): Promise<void> => {
    if (nativeStorage) {
      try {
        await nativeStorage.clear();
        return;
      } catch (err) {
        console.warn('[Storage] native clear failed, falling back to memory', err);
      }
    }
    memoryStore.clear();
  },
};

export default appStorage;
