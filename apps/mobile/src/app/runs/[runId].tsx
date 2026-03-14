import React from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Clock,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Timer,
} from 'lucide-react-native';
import { Card } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';
import { RunStatusBadge } from '@/components/shared/run-status-badge';
import { Badge } from '@/components/ui/badge';
import { getTestRun } from '@/lib/api/test-runs';
import type { TestRunStep } from '@/types';

export default function RunDetailScreen() {
  const { runId } = useLocalSearchParams<{ runId: string }>();

  const { data: run, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['test-run', runId],
    queryFn: () => getTestRun(runId!),
    enabled: !!runId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'RUNNING' || status === 'QUEUED' ? 5000 : false;
    },
  });

  if (isLoading) {
    return <Loading message="Loading run details..." />;
  }

  if (!run) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Run not found</Text>
      </View>
    );
  }

  function formatDuration(ms?: number): string {
    if (!ms) return '--';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  }

  function renderStep({ item, index }: { item: TestRunStep; index: number }) {
    const isCompleted =
      item.status === 'PASSED' || item.status === 'FAILED';
    const statusIcon =
      item.status === 'PASSED' ? (
        <CheckCircle2 size={18} color="#34D399" />
      ) : item.status === 'FAILED' ? (
        <XCircle size={18} color="#EF4444" />
      ) : item.status === 'RUNNING' ? (
        <Timer size={18} color="#3B82F6" />
      ) : (
        <MinusCircle size={18} color="#64748B" />
      );

    return (
      <View style={styles.stepContainer}>
        {/* Timeline connector */}
        {index > 0 && <View style={styles.timelineConnector} />}

        <View style={styles.stepRow}>
          <View style={styles.stepIcon}>{statusIcon}</View>
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepName}>{item.name}</Text>
              {item.duration != null && (
                <Text style={styles.stepDuration}>
                  {formatDuration(item.duration)}
                </Text>
              )}
            </View>
            {item.results && item.results.length > 0 && (
              <View style={styles.resultsRow}>
                {item.results.filter((r) => r.status === 'passed').length >
                  0 && (
                  <Badge
                    label={`${item.results.filter((r) => r.status === 'passed').length} passed`}
                    variant="success"
                    style={styles.resultBadge}
                  />
                )}
                {item.results.filter((r) => r.status === 'failed').length >
                  0 && (
                  <Badge
                    label={`${item.results.filter((r) => r.status === 'failed').length} failed`}
                    variant="error"
                    style={styles.resultBadge}
                  />
                )}
                {item.results.filter((r) => r.status === 'skipped').length >
                  0 && (
                  <Badge
                    label={`${item.results.filter((r) => r.status === 'skipped').length} skipped`}
                    variant="default"
                    style={styles.resultBadge}
                  />
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={run.steps ?? []}
      keyExtractor={(item) => item.id}
      renderItem={renderStep}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => refetch()}
          tintColor="#3B82F6"
        />
      }
      ListHeaderComponent={
        <View>
          {/* Run Summary */}
          <Card style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <RunStatusBadge status={run.status} />
              <Badge
                label={run.triggerType}
                variant="info"
                style={{ marginLeft: 8 }}
              />
            </View>

            <Text style={styles.commitMessage} numberOfLines={2}>
              {run.commitMessage ?? 'No commit message'}
            </Text>

            <Text style={styles.commitSha}>
              {run.branch} @ {run.commitSha?.slice(0, 7)}
            </Text>

            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{run.totalTests}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#34D399' }]}>
                  {run.passedTests}
                </Text>
                <Text style={styles.statLabel}>Passed</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#EF4444' }]}>
                  {run.failedTests}
                </Text>
                <Text style={styles.statLabel}>Failed</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#94A3B8' }]}>
                  {run.skippedTests}
                </Text>
                <Text style={styles.statLabel}>Skipped</Text>
              </View>
            </View>

            <View style={styles.durationRow}>
              <Clock size={14} color="#64748B" />
              <Text style={styles.durationText}>
                Duration: {formatDuration(run.duration)}
              </Text>
            </View>
          </Card>

          {(run.steps?.length ?? 0) > 0 && (
            <Text style={styles.sectionTitle}>Steps</Text>
          )}
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {run.status === 'QUEUED'
              ? 'Waiting for run to start...'
              : 'No steps recorded.'}
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 16,
  },
  summaryCard: {
    marginBottom: 20,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  commitMessage: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F1F5F9',
    marginBottom: 4,
  },
  commitSha: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  durationText: {
    fontSize: 13,
    color: '#64748B',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F1F5F9',
    marginBottom: 12,
  },
  stepContainer: {
    position: 'relative',
  },
  timelineConnector: {
    position: 'absolute',
    left: 15,
    top: -8,
    width: 2,
    height: 8,
    backgroundColor: '#334155',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  stepContent: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F1F5F9',
    flex: 1,
  },
  stepDuration: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 8,
  },
  resultsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  resultBadge: {
    marginBottom: 2,
  },
  empty: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
  },
});
