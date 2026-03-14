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
import { ProviderIcon } from '@/components/shared/provider-icon';
import { useAppStore } from '@/lib/stores/app-store';
import { getProjects } from '@/lib/api/projects';
import type { Project } from '@/types';

export default function ProjectsScreen() {
  const { currentOrgId } = useAppStore();

  const { data: projects, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['projects', currentOrgId],
    queryFn: () => getProjects(currentOrgId ?? ''),
    enabled: !!currentOrgId,
  });

  if (isLoading) {
    return <Loading message="Loading projects..." />;
  }

  function renderItem({ item }: { item: Project }) {
    return (
      <Pressable onPress={() => router.push(`/projects/${item.id}`)}>
        <Card style={styles.projectCard}>
          <View style={styles.row}>
            <ProviderIcon provider={item.provider} size={22} />
            <View style={styles.info}>
              <Text style={styles.projectName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.repoUrl} numberOfLines={1}>
                {item.repoUrl}
              </Text>
            </View>
          </View>
          <View style={styles.footer}>
            <Text style={styles.branch}>{item.defaultBranch}</Text>
            {item.lastRunStatus && (
              <RunStatusBadge status={item.lastRunStatus} />
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
      data={projects ?? []}
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
              ? 'No projects found for this organization.'
              : 'Select an organization in Settings to view projects.'}
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
  projectCard: {
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  info: {
    flex: 1,
  },
  projectName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F1F5F9',
  },
  repoUrl: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  branch: {
    fontSize: 13,
    color: '#94A3B8',
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
