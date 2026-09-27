import { create } from 'zustand';
import { UserProfile, IncomeProfile } from '../types';
import { apiClient } from '../api/client';

interface UserState {
  user: UserProfile | null;
  incomeProfile: IncomeProfile | null;
  deviceId: string;
  isOnboarded: boolean;
  consentGranted: boolean;

  setDeviceId: (id: string) => void;
  setConsent: (granted: boolean) => void;
  initSession: () => Promise<UserProfile>;
  saveIncomeProfile: (profile: Partial<IncomeProfile>) => Promise<void>;
  setOnboarded: (status: boolean) => void;
  reset: () => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  incomeProfile: null,
  deviceId: 'android-device-' + Math.random().toString(36).substring(2, 9),
  isOnboarded: false,
  consentGranted: false,

  reset: () => {
    set({
      user: null,
      incomeProfile: null,
      isOnboarded: false,
      consentGranted: false,
      deviceId: 'android-device-' + Math.random().toString(36).substring(2, 9),
    });
  },

  setDeviceId: (id: string) => {
    set({ deviceId: id });
    apiClient.setCredentials(id);
  },

  setConsent: (granted: boolean) => set({ consentGranted: granted }),

  initSession: async () => {
    const { deviceId } = get();
    apiClient.setCredentials(deviceId);
    const user = await apiClient.createUser(deviceId);
    set({ user });
    return user;
  },

  saveIncomeProfile: async (profileData) => {
    const { user } = get();
    if (!user) throw new Error('User not initialized');

    const profile = await apiClient.saveIncomeProfile(user.id, profileData);
    set({ incomeProfile: profile, isOnboarded: true });
  },

  setOnboarded: (status) => set({ isOnboarded: status }),
}));
