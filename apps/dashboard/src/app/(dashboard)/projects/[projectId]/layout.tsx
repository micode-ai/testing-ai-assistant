'use client';

import { useProjectContext } from '@/hooks/use-project-context';

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  useProjectContext();
  return <>{children}</>;
}
