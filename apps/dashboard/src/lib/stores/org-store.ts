'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OrgState {
  currentOrgId: string | null;
  currentProjectId: string | null;
  currentProjectName: string | null;
  setCurrentOrgId: (id: string | null) => void;
  setCurrentProject: (id: string | null, name: string | null) => void;
  clearCurrentProject: () => void;
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set, get) => ({
      currentOrgId: null,
      currentProjectId: null,
      currentProjectName: null,
      setCurrentOrgId: (id) => {
        const prev = get().currentOrgId;
        if (id !== prev) {
          set({ currentOrgId: id, currentProjectId: null, currentProjectName: null });
        } else {
          set({ currentOrgId: id });
        }
      },
      setCurrentProject: (id, name) => set({ currentProjectId: id, currentProjectName: name }),
      clearCurrentProject: () => set({ currentProjectId: null, currentProjectName: null }),
    }),
    { name: 'org-store' },
  ),
);
