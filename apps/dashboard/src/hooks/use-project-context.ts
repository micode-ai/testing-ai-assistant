'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useOrgStore } from '@/lib/stores/org-store';

const PROJECT_API_URL = process.env.NEXT_PUBLIC_PROJECT_API_URL || 'http://localhost:3003';

export function useProjectContext() {
  const params = useParams();
  const { data: session } = useSession();
  const { currentProjectId, setCurrentProject } = useOrgStore();

  const projectId = params?.projectId as string | undefined;

  useEffect(() => {
    if (!projectId || !session) return;
    if (currentProjectId === projectId) return;

    async function fetchAndSet() {
      try {
        const token = (session as unknown as Record<string, unknown>).accessToken as string;
        const res = await fetch(`${PROJECT_API_URL}/projects/${projectId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (res.ok) {
          const project = await res.json();
          setCurrentProject(projectId!, project.name);
        }
      } catch {
        // Best-effort
      }
    }

    fetchAndSet();
  }, [projectId, session, currentProjectId, setCurrentProject]);
}
