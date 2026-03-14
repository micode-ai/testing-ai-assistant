import React from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Card } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';
import { RunStatusBadge } from '@/components/shared/run-status-badge';
import { useAppStore } from '@/lib/stores/app-store';
import { getTestRuns } from '@/lib/api/test-runs';
import type { TestRun } from '@/types';

export default function RunsScreen() {
  const { currentOrgId } = useAppStore();

  const { data: runs, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['test-runs', currentOrgId],
    queryFn: () => getTestRuns({ orgId: currentOrgId ?? '', limit: 50 }),
    enabled: !!currentOrgId,
  });

  if (isLoading) {
    return <Loading message="Loading test runs..." />;
  }

  function formatTime(dateStr?: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  function renderItem({ item }: { item: TestRun }) {
    return (
      <Pressable onPress={() => router.push(`/runs/${item.id}`)}>
        <Card style={styles.runCard}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.projectName} numberOfLines={1}>
                {item.projectName ?? 'Test Run'}
              </Text>
              <RunStatusBadge status={item.status} />
            </View>
            <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
          </View>

          <Text style={styles.commit} numberOfLines={1}>
            {item.commitMessage ?? item.commitSha?.slice(0, 7) ?? ''}
          </Text>

          <View style={styles.meta}>
            <Text style={styles.metaText}>{item.branch}</Text>
            <Text style={styles.metaDivider}>|</Text>
            <Text style={styles.metaText}>
              {item.passedTests}/{item.totalTests} passed
            </Text>
            {item.duration != null && (
              <>
                <Text style={styles.metaDivider}>|</Text>
                <Text style={styles.metaText}>
                  {(item.duration / 1000).toFixed(1)}s
                </Text>
              </>
            )}
          </View>
        </Card>
      </Pressable>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={runs ?? []}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => refetch()}
          tintColor="#3B82F6"
        />
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {currentOrgId
              ? 'No test runs found.'
              : 'Select an organization in Settings to view test runs.'}
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
  runCard: {
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  projectName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F1F5F9',
    flexShrink: 1,
  },
  time: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 8,
  },
  commit: {
    fontSize: 13,
    color: '#CBD5E1',
    marginBottom: 8,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: '#64748B',
  },
  metaDivider: {
    fontSize: 12,
    color: '#334155',
    marginHorizontal: 6,
  },
  empty: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
  },
});
