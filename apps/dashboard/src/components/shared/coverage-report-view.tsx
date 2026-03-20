'use client';

import { FileCode, ArrowUpRight } from 'lucide-react';

const PRIORITY_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  high: { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  medium: { color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  low: { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
};

const TEST_TYPE_LABELS: Record<string, string> = {
  unit: 'Unit',
  integration: 'Integration',
  e2e: 'E2E',
};

export function CoverageReportView({ output }: { output: string }) {
  try {
    const cleaned = output.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
    const report = JSON.parse(cleaned);
    if (!report.recommendations || !Array.isArray(report.recommendations)) throw new Error('not a coverage report');

    return (
      <div className="space-y-4">
        {report.summary && (
          <div className="rounded-md bg-muted p-4 text-sm">{report.summary}</div>
        )}

        {report.overallPercentage != null && (
          <div className="flex items-center gap-3">
            <div className="h-3 w-32 rounded-full bg-gray-200 overflow-hidden">
              <div
                className={`h-full rounded-full ${report.overallPercentage >= 80 ? 'bg-green-500' : report.overallPercentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min(report.overallPercentage, 100)}%` }}
              />
            </div>
            <span className="text-sm font-bold">{report.overallPercentage}%</span>
          </div>
        )}

        {report.recommendations.map((rec: Record<string, string>, idx: number) => {
          const priority = rec.priority || 'medium';
          const style = PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium;
          const testType = TEST_TYPE_LABELS[rec.testType] || rec.testType || '';

          return (
            <div key={idx} className={`rounded-lg border ${style.border} ${style.bg} p-4 space-y-2`}>
              <div className="flex items-start gap-2">
                <FileCode className={`h-5 w-5 mt-0.5 shrink-0 ${style.color}`} />
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold uppercase ${style.color}`}>{priority}</span>
                    {testType && (
                      <span className="inline-flex items-center rounded-full bg-background/60 border px-2 py-0.5 text-xs">
                        {testType}
                      </span>
                    )}
                    {rec.title && <span className="font-semibold text-sm">{rec.title}</span>}
                  </div>
                  {rec.filePath && (
                    <p className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                      <ArrowUpRight className="h-3 w-3" />
                      {rec.filePath}
                    </p>
                  )}
                  {rec.description && (
                    <p className="text-sm text-foreground/80">{rec.description}</p>
                  )}
                  {rec.sampleTestStub && (
                    <div className="mt-2 rounded-md bg-background/60 p-3">
                      <pre className="whitespace-pre-wrap text-xs font-mono">{rec.sampleTestStub}</pre>
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
