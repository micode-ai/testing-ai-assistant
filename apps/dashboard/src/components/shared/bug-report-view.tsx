'use client';

import { AlertTriangle, AlertCircle, Info, Bug } from 'lucide-react';

const SEVERITY_CONFIG: Record<string, { icon: typeof AlertTriangle; color: string; bg: string; border: string }> = {
  critical: { icon: AlertCircle, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  high: { icon: AlertTriangle, color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  medium: { icon: Info, color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  low: { icon: Info, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
};

export function BugReportView({ output }: { output: string }) {
  try {
    const cleaned = output.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
    const report = JSON.parse(cleaned);
    if (!report.bugs || !Array.isArray(report.bugs)) throw new Error('not a bug report');

    return (
      <div className="space-y-4">
        {report.summary && (
          <div className="rounded-md bg-muted p-4 text-sm">{report.summary}</div>
        )}

        <div className="flex gap-3 flex-wrap">
          {report.totalBugs != null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium">
              <Bug className="h-3.5 w-3.5" /> {report.totalBugs}
            </span>
          )}
          {report.criticalCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-3 py-1 text-sm font-medium">
              {report.criticalCount} critical
            </span>
          )}
          {report.highCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-700 px-3 py-1 text-sm font-medium">
              {report.highCount} high
            </span>
          )}
          {report.mediumCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 text-yellow-700 px-3 py-1 text-sm font-medium">
              {report.mediumCount} medium
            </span>
          )}
          {report.lowCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-700 px-3 py-1 text-sm font-medium">
              {report.lowCount} low
            </span>
          )}
        </div>

        {report.bugs.map((bug: Record<string, string>, idx: number) => {
          const sev = SEVERITY_CONFIG[bug.severity] || SEVERITY_CONFIG.low;
          const Icon = sev.icon;
          return (
            <div key={idx} className={`rounded-lg border ${sev.border} ${sev.bg} p-4 space-y-2`}>
              <div className="flex items-start gap-2">
                <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${sev.color}`} />
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold uppercase ${sev.color}`}>{bug.severity}</span>
                    {bug.title && <span className="font-semibold text-sm">{bug.title}</span>}
                  </div>
                  <p className="text-sm text-foreground/80">{bug.description}</p>
                  {bug.impact && (
                    <p className="text-sm text-foreground/60 italic">{bug.impact}</p>
                  )}
                  {bug.location && (
                    <p className="text-xs text-muted-foreground font-mono">{bug.location}</p>
                  )}
                  {bug.fixSuggestion && (
                    <div className="mt-2 rounded-md bg-background/60 p-3 text-sm">
                      <pre className="whitespace-pre-wrap text-xs">{bug.fixSuggestion}</pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  } catch {
    return (
      <div className="rounded-md bg-muted p-4 overflow-x-auto">
        <pre className="text-sm"><code>{output}</code></pre>
      </div>
    );
  }
}
