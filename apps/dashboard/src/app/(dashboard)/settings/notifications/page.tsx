'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Bell, Plus, Trash2, Mail, MessageSquare, Send, AlertCircle, SendHorizonal } from 'lucide-react';
import { useOrgStore } from '@/lib/stores/org-store';
import {
  getNotificationConfigs,
  createNotificationConfig,
  updateNotificationConfig,
  deleteNotificationConfig,
  testNotificationConfig,
} from '@/lib/api/notifications';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { NotificationConfig, NotificationChannel } from '@/types';

const EVENT_TYPES = [
  'run.finished',
  'run.failed',
  'membership.requested',
];

export default function NotificationsSettingsPage() {
  const { data: session } = useSession();
  const t = useTranslations();
  const [configs, setConfigs] = useState<NotificationConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const CHANNEL_OPTIONS: { value: NotificationChannel; label: string; icon: typeof Mail }[] = [
    { value: 'EMAIL', label: t('notificationSettings.channelEmail'), icon: Mail },
    { value: 'SLACK', label: t('notificationSettings.channelSlack'), icon: MessageSquare },
    { value: 'TELEGRAM', label: t('notificationSettings.channelTelegram'), icon: Send },
  ];

  const EVENT_TYPE_LABELS: Record<string, string> = {
    'run.finished': t('notificationSettings.eventRunCompleted'),
    'run.failed': t('notificationSettings.eventRunFailed'),
    'membership.requested': t('notificationSettings.eventMembershipRequested'),
  };

  function getChannelIcon(channel: NotificationChannel) {
    const option = CHANNEL_OPTIONS.find((o) => o.value === channel);
    return option?.icon ?? Bell;
  }

  function getChannelLabel(channel: NotificationChannel) {
    const option = CHANNEL_OPTIONS.find((o) => o.value === channel);
    return option?.label ?? channel;
  }

  function formatConfigDetails(channel: NotificationChannel, config: Record<string, unknown>): string {
    switch (channel) {
      case 'EMAIL': {
        const emails = Array.isArray(config.emails) ? config.emails : [];
        return emails.join(', ');
      }
      case 'SLACK':
        return config.slackChannel ? String(config.slackChannel) : config.channel ? String(config.channel) : '';
      case 'TELEGRAM':
        return config.chatId ? `Chat ID: ${config.chatId}` : '';
      default:
        return JSON.stringify(config);
    }
  }

  // Form state
  const [selectedChannel, setSelectedChannel] = useState<NotificationChannel>('EMAIL');
  const [selectedEvent, setSelectedEvent] = useState(EVENT_TYPES[0]);
  const [configEmail, setConfigEmail] = useState('');
  const [configSlackChannel, setConfigSlackChannel] = useState('');
  const [configTelegramChatId, setConfigTelegramChatId] = useState('');

  const token = (session as unknown as Record<string, unknown>)?.accessToken as string;
  const { currentOrgId: orgId } = useOrgStore();

  const fetchConfigs = useCallback(async () => {
    if (!token || !orgId) {
      setIsLoading(false);
      return;
    }
    try {
      const data = await getNotificationConfigs(orgId, token);
      setConfigs(data);
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [orgId, token]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  function getChannelConfig(): Record<string, unknown> {
    switch (selectedChannel) {
      case 'EMAIL':
        return { emails: configEmail.split(',').map((e) => e.trim()).filter(Boolean) };
      case 'SLACK':
        return { slackChannel: configSlackChannel };
      case 'TELEGRAM':
        return { chatId: configTelegramChatId };
    }
  }

  async function onCreateConfig() {
    if (!token || !orgId) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const newConfig = await createNotificationConfig(
        {
          orgId,
          channel: selectedChannel,
          event: selectedEvent,
          config: getChannelConfig(),
          enabled: true,
        },
        token,
      );
      setConfigs((prev) => [...prev, newConfig]);
      setIsDialogOpen(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create config');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onToggleConfig(config: NotificationConfig) {
    if (!token) return;
    try {
      const updated = await updateNotificationConfig(config.id, { enabled: !config.enabled }, token);
      setConfigs((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch {
      // Silently fail
    }
  }

  async function onDeleteConfig(id: string) {
    if (!token) return;
    try {
      await deleteNotificationConfig(id, token);
      setConfigs((prev) => prev.filter((c) => c.id !== id));
    } catch {
      // Silently fail
    }
  }

  async function onTestConfig(id: string) {
    if (!token) return;
    try {
      await testNotificationConfig(id, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test notification failed');
    }
  }

  function resetForm() {
    setSelectedChannel('EMAIL');
    setSelectedEvent(EVENT_TYPES[0]);
    setConfigEmail('');
    setConfigSlackChannel('');
    setConfigTelegramChatId('');
  }

  // Group configs by event type
  const groupedConfigs = configs.reduce<Record<string, NotificationConfig[]>>((acc, config) => {
    if (!acc[config.event]) {
      acc[config.event] = [];
    }
    acc[config.event].push(config);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight">{t('notificationSettings.title')}</h2>
          <p className="text-muted-foreground">
            {t('notificationSettings.subtitle')}
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('notificationSettings.addConfig')}
        </Button>
      </div>

      <Separator />

      {configs.length === 0 ? (
        <div className="text-center py-12">
          <Bell className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">{t('notificationSettings.noConfigs')}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('notificationSettings.noConfigsDesc')}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedConfigs).map(([event, eventConfigs]) => (
            <div key={event} className="space-y-3">
              <h3 className="text-lg font-semibold">{EVENT_TYPE_LABELS[event] || event.replace(/_/g, ' ')}</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {eventConfigs.map((config) => {
                  const ChannelIcon = getChannelIcon(config.channel);
                  return (
                    <Card key={config.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ChannelIcon className="h-4 w-4 text-muted-foreground" />
                            <CardTitle className="text-base">{getChannelLabel(config.channel)}</CardTitle>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => onToggleConfig(config)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                config.enabled ? 'bg-primary' : 'bg-muted'
                              }`}
                            >
                              <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                  config.enabled ? 'translate-x-4.5' : 'translate-x-0.5'
                                }`}
                              />
                            </button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onTestConfig(config.id)}
                              title={t('notificationSettings.testSend')}
                            >
                              <SendHorizonal className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDeleteConfig(config.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        <CardDescription className="text-xs">
                          {formatConfigDetails(config.channel, config.config as Record<string, unknown>)}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('notificationSettings.newConfig')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('notificationSettings.channel')}</Label>
              <div className="flex gap-2">
                {CHANNEL_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    variant={selectedChannel === option.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedChannel(option.value)}
                  >
                    <option.icon className="mr-2 h-4 w-4" />
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('notificationSettings.eventType')}</Label>
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {EVENT_TYPES.map((event) => (
                  <option key={event} value={event}>
                    {EVENT_TYPE_LABELS[event] || event.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            {selectedChannel === 'EMAIL' && (
              <div className="space-y-2">
                <Label>{t('notificationSettings.emailAddresses')}</Label>
                <Input
                  placeholder={t('notificationSettings.emailPlaceholder')}
                  value={configEmail}
                  onChange={(e) => setConfigEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t('notificationSettings.emailHint')}</p>
              </div>
            )}

            {selectedChannel === 'SLACK' && (
              <div className="space-y-2">
                <Label>{t('notificationSettings.slackChannel')}</Label>
                <Input
                  placeholder={t('notificationSettings.slackPlaceholder')}
                  value={configSlackChannel}
                  onChange={(e) => setConfigSlackChannel(e.target.value)}
                />
              </div>
            )}

            {selectedChannel === 'TELEGRAM' && (
              <div className="space-y-2">
                <Label>{t('notificationSettings.telegramChatId')}</Label>
                <Input
                  placeholder={t('notificationSettings.telegramPlaceholder')}
                  value={configTelegramChatId}
                  onChange={(e) => setConfigTelegramChatId(e.target.value)}
                />
              </div>
            )}
          </div>
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsDialogOpen(false); setError(null); }}>
              {t('common.cancel')}
            </Button>
            <Button onClick={onCreateConfig} disabled={isSubmitting}>
              {isSubmitting ? t('common.creating') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
