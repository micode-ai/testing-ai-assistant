import React from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { Card } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';
import { RunStatusBadge } from '@/components/shared/run-status-badge';
import { useAppStore } from '@/lib/stores/app-store';
import { getProjects } from '@/lib/api/projects';
import { getTestRuns } from '@/lib/api/test-runs';
import type { TestRun } from '@/types';

export default function DashboardScreen() {
  const { currentOrgId } = useAppStore();

  const projectsQuery = useQuery({
    queryKey: ['projects', currentOrgId],
    queryFn: () => getProjects(currentOrgId ?? ''),
    enabled: !!currentOrgId,
  });

  const runsQuery = useQuery({
    queryKey: ['recent-runs', currentOrgId],
    queryFn: () => getTestRuns({ orgId: currentOrgId ?? '', limit: 10 }),
    enabled: !!currentOrgId,
  });

  const isLoading = projectsQuery.isLoading || runsQuery.isLoading;
  const isRefreshing = projectsQuery.isRefetching || runsQuery.isRefetching;

  function onRefresh() {
    projectsQuery.refetch();
    runsQuery.refetch();
  }

  const projects = projectsQuery.data ?? [];
  const runs = runsQuery.data ?? [];

  const totalProjects = projects.length;
  const passedRuns = runs.filter((r) => r.status === 'PASSED').length;
  const passRate = runs.length > 0 ? Math.round((passedRuns / runs.length) * 100) : 0;

  if (isLoading) {
    return <Loading message="Loading dashboard..." />;
  }

  function renderRunItem({ item }: { item: TestRun }) {
    return (
      <Pressable onPress={() => router.push(`/runs/${item.id}`)}>
        <Card style={styles.runCard}>
          <View style={styles.runHeader}>
            <Text style={styles.runProject} numberOfLines={1}>
              {item.projectName ?? 'Project'}
            </Text>
            <RunStatusBadge status={item.status} />
          </View>
          <Text style={styles.runBranch} numberOfLines={1}>
            {item.branch} - {item.commitSha?.slice(0, 7)}
          </Text>
          <Text style={styles.runMeta}>
            {item.totalTests} tests | {item.duration ? `${(item.duration / 1000).toFixed(1)}s` : 'Pending'}
          </Text>
        </Card>
      </Pressable>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={runs}
      keyExtractor={(item) => item.id}
      renderItem={renderRunItem}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor="#3B82F6"
        />
      }
      ListHeaderComponent={
        <View>
          <Text style={styles.greeting}>Dashboard</Text>

          <View style={styles.statsRow}>
            <Card style={styles.statCard}>
              <Text style={styles.statValue}>{totalProjects}</Text>
              <Text style={styles.statLabel}>Projects</Text>
            </Card>
            <Card style={styles.statCard}>
              <Text style={styles.statValue}>{runs.length}</Text>
              <Text style={styles.statLabel}>Recent Runs</Text>
            </Card>
            <Card style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#34D399' }]}>
                {passRate}%
              </Text>
              <Text style={styles.statLabel}>Pass Rate</Text>
            </Card>
          </View>

          <Text style={styles.sectionTitle}>Recent Activity</Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {currentOrgId
              ? 'No recent test runs found.'
              : 'Select an organization in Settings to get started.'}
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
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F1F5F9',
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F1F5F9',
    marginBottom: 12,
  },
  runCard: {
    marginBottom: 10,
  },
  runHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  runProject: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F1F5F9',
    flex: 1,
    marginRight: 8,
  },
  runBranch: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 4,
  },
  runMeta: {
    fontSize: 12,
    color: '#64748B',
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
