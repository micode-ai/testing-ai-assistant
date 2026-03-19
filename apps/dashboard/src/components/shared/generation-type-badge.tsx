'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { GenerationType } from '@/types';

const typeStyles: Record<GenerationType, string> = {
  TEST_GEN: 'bg-purple-100 text-purple-700 border-purple-200',
  BUG_DETECT: 'bg-red-100 text-red-700 border-red-200',
  FLAKY_DETECT: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  COVERAGE_ADVICE: 'bg-blue-100 text-blue-700 border-blue-200',
  CHECKLIST_GEN: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  CHECKLIST_TEST_GEN: 'bg-green-100 text-green-700 border-green-200',
  CHECKLIST_ITEM_CHAT: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  PROJECT_ANALYSIS: 'bg-teal-100 text-teal-700 border-teal-200',
  TEST_PROPOSAL: 'bg-indigo-100 text-indigo-700 border-indigo-200',
};

interface GenerationTypeBadgeProps {
  type: GenerationType;
  className?: string;
}

export function GenerationTypeBadge({ type, className }: GenerationTypeBadgeProps) {
  const t = useTranslations('generationType');
  const style = typeStyles[type] ?? typeStyles.TEST_GEN;

  return (
    <Badge variant="outline" className={cn(style, className)}>
      {t(type)}
    </Badge>
  );
}
