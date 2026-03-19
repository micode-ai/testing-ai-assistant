'use client';

import { Activity, AlertTriangle, CheckCircle, TrendingDown } from 'lucide-react';

const PATTERN_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  'timing-dependent': { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  'order-dependent': { color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  'environment-dependent': { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  'race-condition': { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  'unknown': { color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' },
};

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 60 ? 'text-red-700 bg-red-100' : pct >= 30 ? 'text-orange-700 bg-orange-100' : 'text-yellow-700 bg-yellow-100';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>
      {pct}%
    </span>
  );
}

function HealthScore({ score }: { score: number }) {
  const color = score >= 80 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-red-600';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded-full bg-gray-200 overflow-hidden">
        <div
          className={`h-full rounded-full ${score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-sm font-bold ${color}`}>{score}/100</span>
    </div>
  );
}

export function FlakyReportView({ output }: { output: string }) {
  try {
    const cleaned = output.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
    const report = JSON.parse(cleaned);
    if (!report.flakyTests || !Array.isArray(report.flakyTests)) throw new Error('not a flaky report');

    return (
      <div className="space-y-4">
        {/* Summary */}
        {report.summary && (
          <div className="rounded-md bg-muted p-4 text-sm">{report.summary}</div>
        )}

        {/* Stats */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {report.overallHealthScore != null && (
            <div className="rounded-lg border p-3 space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Activity className="h-3.5 w-3.5" />
                Health
              </div>
              <HealthScore score={report.overallHealthScore} />
            </div>
          )}
          {report.totalAnalyzed != null && (
            <div className="rounded-lg border p-3 space-y-1">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-lg font-bold">{report.totalAnalyzed}</div>
            </div>
          )}
          {report.stableCount != null && (
            <div className="rounded-lg border p-3 space-y-1">
              <div className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle className="h-3.5 w-3.5" />
                Stable
              </div>
              <div className="text-lg font-bold text-green-600">{report.stableCount}</div>
            </div>
          )}
          {report.flakyCount != null && (
            <div className="rounded-lg border p-3 space-y-1">
              <div className="flex items-center gap-1 text-xs text-orange-600">
                <TrendingDown className="h-3.5 w-3.5" />
                Flaky
              </div>
              <div className="text-lg font-bold text-orange-600">{report.flakyCount}</div>
            </div>
          )}
        </div>

        {/* Flaky Test Cards */}
        {report.flakyTests.length === 0 ? (
          <div className="rounded-md bg-green-50 border border-green-200 p-4 text-sm text-green-800 flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            No flaky tests detected
          </div>
        ) : (
          report.flakyTests.map((test: Record<string, unknown>, idx: number) => {
            const patternKey = String(test.pattern || 'unknown');
            const testName = String(test.testName || '');
            const patternLabel = test.patternLabel ? String(test.patternLabel) : '';
            const description = test.description ? String(test.description) : '';
            const impact = test.impact ? String(test.impact) : '';
            const recommendation = test.recommendation ? String(test.recommendation) : '';
            const flakinessScore = Number(test.flakinessScore) || 0;
            const failRate = test.failRate != null ? Number(test.failRate) : null;
            const style = PATTERN_COLORS[patternKey] || PATTERN_COLORS.unknown;
            return (
              <div key={idx} className={`rounded-lg border ${style.border} ${style.bg} p-4 space-y-2`}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className={`h-5 w-5 mt-0.5 shrink-0 ${style.color}`} />
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm font-mono">{testName}</span>
                      <ScoreBadge score={flakinessScore} />
                      {patternLabel && (
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${style.color} ${style.border}`}>
                          {patternLabel}
                        </span>
                      )}
                    </div>
                    {description && (
                      <p className="text-sm text-foreground/80">{description}</p>
                    )}
                    {impact && (
                      <p className="text-sm text-foreground/60 italic">{impact}</p>
                    )}
                    {failRate != null && (
                      <p className="text-xs text-muted-foreground">
                        Fail rate: {Math.round(failRate * 100)}%
                      </p>
                    )}
                    {recommendation && (
                      <div className="mt-2 rounded-md bg-background/60 p-3">
                        <pre className="whitespace-pre-wrap text-xs">{recommendation}</pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
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
