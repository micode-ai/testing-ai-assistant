import { Github } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RepoProvider } from '@/types';

interface ProviderIconProps {
  provider: RepoProvider;
  className?: string;
}

function GitLabIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 01-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 014.82 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0118.6 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.51L23 13.45a.84.84 0 01-.35.94z" />
    </svg>
  );
}

function BitbucketIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M.778 1.213a.768.768 0 00-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 00.77-.646l3.27-20.03a.768.768 0 00-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z" />
    </svg>
  );
}

export function ProviderIcon({ provider, className }: ProviderIconProps) {
  const iconClass = cn('h-4 w-4', className);

  switch (provider) {
    case 'GITHUB':
      return <Github className={iconClass} />;
    case 'GITLAB':
      return <GitLabIcon className={iconClass} />;
    case 'BITBUCKET':
      return <BitbucketIcon className={iconClass} />;
    default:
      return <Github className={iconClass} />;
  }
}
