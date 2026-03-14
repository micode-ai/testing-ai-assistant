import React, { useEffect } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, LogOut, User, Building2, Bell } from 'lucide-react-native';
import { Card } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';
import { useAuth } from '@/lib/auth/auth-context';
import { useAppStore } from '@/lib/stores/app-store';
import { getOrganizations } from '@/lib/api/organizations';
import {
  registerForPushNotifications,
  sendPushTokenToBackend,
} from '@/lib/notifications/push-setup';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const {
    currentOrgId,
    setCurrentOrgId,
    notificationsEnabled,
    setNotificationsEnabled,
    setOrganizations,
  } = useAppStore();

  const { data: orgs, isLoading } = useQuery({
    queryKey: ['organizations'],
    queryFn: getOrganizations,
  });

  useEffect(() => {
    if (orgs) {
      setOrganizations(orgs);
      if (!currentOrgId && orgs.length > 0) {
        setCurrentOrgId(orgs[0].id);
      }
    }
  }, [orgs]);

  async function handleNotificationToggle(enabled: boolean) {
    setNotificationsEnabled(enabled);
    if (enabled) {
      try {
        const token = await registerForPushNotifications();
        if (token) {
          await sendPushTokenToBackend(token);
        }
      } catch {
        Alert.alert('Error', 'Could not enable push notifications.');
        setNotificationsEnabled(false);
      }
    }
  }

  function handleOrgSwitch() {
    if (!orgs || orgs.length === 0) return;

    const options = orgs.map((org) => org.name);
    options.push('Cancel');

    Alert.alert('Switch Organization', 'Select an organization', [
      ...orgs.map((org) => ({
        text: `${org.name}${org.id === currentOrgId ? ' (current)' : ''}`,
        onPress: () => setCurrentOrgId(org.id),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }

  function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/auth/login');
        },
      },
    ]);
  }

  const currentOrg = orgs?.find((o) => o.id === currentOrgId);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* User Profile */}
      <Text style={styles.sectionTitle}>Profile</Text>
      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={styles.iconContainer}>
            <User size={20} color="#94A3B8" />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>{user?.name ?? 'User'}</Text>
            <Text style={styles.rowValue}>{user?.email ?? ''}</Text>
          </View>
        </View>
      </Card>

      {/* Organization */}
      <Text style={styles.sectionTitle}>Organization</Text>
      <Pressable onPress={handleOrgSwitch}>
        <Card style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconContainer}>
              <Building2 size={20} color="#94A3B8" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>
                {currentOrg?.name ?? 'No organization selected'}
              </Text>
              <Text style={styles.rowValue}>
                {currentOrg
                  ? `${currentOrg.plan} plan - ${currentOrg.memberCount} members`
                  : 'Tap to select'}
              </Text>
            </View>
            <ChevronRight size={18} color="#64748B" />
          </View>
        </Card>
      </Pressable>

      {/* Notifications */}
      <Text style={styles.sectionTitle}>Notifications</Text>
      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={styles.iconContainer}>
            <Bell size={20} color="#94A3B8" />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Push Notifications</Text>
            <Text style={styles.rowValue}>
              Get notified about test run results
            </Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={handleNotificationToggle}
            trackColor={{ false: '#334155', true: '#1D4ED8' }}
            thumbColor={notificationsEnabled ? '#3B82F6' : '#64748B'}
          />
        </View>
      </Card>

      {/* Logout */}
      <Pressable onPress={handleLogout} style={styles.logoutButton}>
        <LogOut size={18} color="#EF4444" />
        <Text style={styles.logoutText}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 20,
    marginLeft: 4,
  },
  card: {
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F1F5F9',
  },
  rowValue: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 32,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#7F1D1D',
    backgroundColor: '#1E293B',
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
  },
});
