import { create } from 'zustand';
import type { User, Organization } from '@/types';

interface AppState {
  currentOrgId: string | null;
  user: User | null;
  organizations: Organization[];
  notificationsEnabled: boolean;

  setCurrentOrgId: (orgId: string | null) => void;
  setUser: (user: User | null) => void;
  setOrganizations: (orgs: Organization[]) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  reset: () => void;
}

const initialState = {
  currentOrgId: null,
  user: null,
  organizations: [],
  notificationsEnabled: true,
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setCurrentOrgId: (orgId) => set({ currentOrgId: orgId }),
  setUser: (user) => set({ user }),
  setOrganizations: (organizations) => set({ organizations }),
  setNotificationsEnabled: (notificationsEnabled) =>
    set({ notificationsEnabled }),
  reset: () => set(initialState),
}));
