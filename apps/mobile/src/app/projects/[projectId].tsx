import React from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, GitBranch, Webhook } from 'lucide-react-native';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { RunStatusBadge } from '@/components/shared/run-status-badge';
import { ProviderIcon } from '@/components/shared/provider-icon';
import { getProject } from '@/lib/api/projects';
import { getTestRuns } from '@/lib/api/test-runs';
import type { TestRun } from '@/types';

export default function ProjectDetailScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();

  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId!),
    enabled: !!projectId,
  });

  const runsQuery = useQuery({
    queryKey: ['project-runs', projectId],
    queryFn: () => getTestRuns({ projectId: projectId!, limit: 20 }),
    enabled: !!projectId,
  });

  const project = projectQuery.data;
  const runs = runsQuery.data ?? [];
  const isLoading = projectQuery.isLoading;
  const isRefreshing = projectQuery.isRefetching || runsQuery.isRefetching;

  function onRefresh() {
    projectQuery.refetch();
    runsQuery.refetch();
  }

  if (isLoading) {
    return <Loading message="Loading project..." />;
  }

  if (!project) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Project not found</Text>
      </View>
    );
  }

  function renderRunItem({ item }: { item: TestRun }) {
    return (
      <Pressable onPress={() => router.push(`/runs/${item.id}`)}>
        <Card style={styles.runCard}>
          <View style={styles.runHeader}>
            <Text style={styles.runCommit} numberOfLines={1}>
              {item.commitMessage ?? item.commitSha?.slice(0, 7)}
            </Text>
            <RunStatusBadge status={item.status} />
          </View>
          <View style={styles.runMeta}>
            <Text style={styles.runMetaText}>{item.branch}</Text>
            <Text style={styles.runMetaDivider}>|</Text>
            <Text style={styles.runMetaText}>
              {item.passedTests}/{item.totalTests} passed
            </Text>
          </View>
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
          {/* Project Info */}
          <Card style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <ProviderIcon provider={project.provider} size={28} />
              <View style={styles.infoTitle}>
                <Text style={styles.projectName}>{project.name}</Text>
                <Text style={styles.repoUrl} numberOfLines={1}>
                  {project.repoUrl}
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoPill}>
                <GitBranch size={14} color="#94A3B8" />
                <Text style={styles.infoPillText}>
                  {project.defaultBranch}
                </Text>
              </View>

              <Badge
                label={project.isActive ? 'Active' : 'Inactive'}
                variant={project.isActive ? 'success' : 'default'}
              />
            </View>

            <View style={styles.webhookRow}>
              <Webhook size={14} color="#94A3B8" />
              <Text style={styles.webhookText}>
                Webhook:{' '}
                {project.webhookActive ? (
                  <Text style={{ color: '#34D399' }}>Connected</Text>
                ) : (
                  <Text style={{ color: '#EF4444' }}>Disconnected</Text>
                )}
              </Text>
            </View>
          </Card>

          <Text style={styles.sectionTitle}>Recent Runs</Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No test runs yet.</Text>
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
  infoCard: {
    marginBottom: 20,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  infoTitle: {
    flex: 1,
  },
  projectName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  repoUrl: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  infoPillText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  webhookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  webhookText: {
    fontSize: 13,
    color: '#94A3B8',
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
  runCommit: {
    fontSize: 14,
    fontWeight: '500',
    color: '#CBD5E1',
    flex: 1,
    marginRight: 8,
  },
  runMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  runMetaText: {
    fontSize: 12,
    color: '#64748B',
  },
  runMetaDivider: {
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
  },
});
