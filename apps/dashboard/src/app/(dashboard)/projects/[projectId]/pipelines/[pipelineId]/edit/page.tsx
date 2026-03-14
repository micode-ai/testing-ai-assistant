'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createPipelineSchema, type CreatePipelineInput } from '@/lib/validations/pipeline';
import { getPipeline, updatePipeline } from '@/lib/api/pipelines';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';

const CHECK_TYPES = [
  'LINT',
  'UNIT_TEST',
  'INTEGRATION_TEST',
  'E2E_TEST',
  'COVERAGE',
  'SECURITY_SCAN',
] as const;

const CHECK_TYPE_KEYS: Record<string, string> = {
  LINT: 'checkLint',
  UNIT_TEST: 'checkUnit',
  INTEGRATION_TEST: 'checkIntegration',
  E2E_TEST: 'checkE2E',
  COVERAGE: 'checkCoverage',
  SECURITY_SCAN: 'checkSecurity',
};

const TRIGGER_TYPES = [
  'PUSH',
  'PULL_REQUEST',
  'SCHEDULE',
  'MANUAL',
] as const;

const TRIGGER_TYPE_KEYS: Record<string, string> = {
  PUSH: 'triggerPush',
  PULL_REQUEST: 'triggerPR',
  SCHEDULE: 'triggerCron',
  MANUAL: 'triggerManual',
};

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export default function EditPipelinePage() {
  const router = useRouter();
  const params = useParams<{ projectId: string; pipelineId: string }>();
  const { projectId, pipelineId } = params;
  const { data: session } = useSession();
  const t = useTranslations('editPipeline');
  const tn = useTranslations('newPipeline');
  const tc = useTranslations('common');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const token = (session as unknown as Record<string, unknown>)?.accessToken as string;

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreatePipelineInput>({
    resolver: zodResolver(createPipelineSchema),
    defaultValues: {
      name: '',
      triggerType: 'PUSH',
      steps: [{ name: '', checkType: 'LINT', config: {}, order: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'steps',
  });

  const triggerType = watch('triggerType');

  const fetchPipeline = useCallback(async () => {
    if (!token) {
      setIsLoadingData(false);
      return;
    }
    try {
      const pipeline = await getPipeline(pipelineId, token);
      const steps = (pipeline.steps ?? []).map((s, i) => ({
        name: s.name || '',
        checkType: s.checkType as CreatePipelineInput['steps'][number]['checkType'],
        config: s.config || {},
        order: s.order ?? i,
      }));
      reset({
        name: pipeline.name,
        triggerType: pipeline.triggerType,
        cronExpression: pipeline.cronExpression || undefined,
        steps: steps.length > 0 ? steps : [{ name: '', checkType: 'LINT', config: {}, order: 0 }],
      });
    } catch {
      setError('Failed to load pipeline.');
    } finally {
      setIsLoadingData(false);
    }
  }, [pipelineId, token, reset]);

  useEffect(() => {
    fetchPipeline();
  }, [fetchPipeline]);

  async function onSubmit(data: CreatePipelineInput) {
    setIsSaving(true);
    setError(null);

    try {
      await updatePipeline(
        pipelineId,
        {
          name: data.name,
          triggerType: data.triggerType,
          cronExpression: data.cronExpression,
          steps: data.steps,
        },
        token,
      );
      router.push(`/projects/${projectId}/pipelines/${pipelineId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update pipeline.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoadingData) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form id="edit-pipeline-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">{tn('nameLabel')}</Label>
              <Input
                id="name"
                placeholder={tn('namePlaceholder')}
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="triggerType">{tn('triggerLabel')}</Label>
              <select
                id="triggerType"
                {...register('triggerType')}
                className={selectClass}
              >
                {TRIGGER_TYPES.map((val) => (
                  <option key={val} value={val}>{tn(TRIGGER_TYPE_KEYS[val])}</option>
                ))}
              </select>
              {errors.triggerType && (
                <p className="text-sm text-destructive">{errors.triggerType.message}</p>
              )}
            </div>

            {triggerType === 'SCHEDULE' && (
              <div className="space-y-2">
                <Label htmlFor="cronExpression">{tn('cronLabel')}</Label>
                <Input
                  id="cronExpression"
                  placeholder={tn('cronPlaceholder')}
                  {...register('cronExpression')}
                />
                {errors.cronExpression && (
                  <p className="text-sm text-destructive">{errors.cronExpression.message}</p>
                )}
              </div>
            )}

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>{tn('stepsLabel')}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({
                      name: '',
                      checkType: 'LINT',
                      config: {},
                      order: fields.length,
                    })
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {tn('addStep')}
                </Button>
              </div>

              {errors.steps?.message && (
                <p className="text-sm text-destructive">{errors.steps.message}</p>
              )}

              {fields.map((field, index) => (
                <Card key={field.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor={`steps.${index}.name`}>{tn('stepNameLabel')}</Label>
                            <Input
                              id={`steps.${index}.name`}
                              placeholder={tn('stepNamePlaceholder')}
                              {...register(`steps.${index}.name`)}
                            />
                            {errors.steps?.[index]?.name && (
                              <p className="text-sm text-destructive">
                                {errors.steps[index].name?.message}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`steps.${index}.checkType`}>{tn('checkTypeLabel')}</Label>
                            <select
                              id={`steps.${index}.checkType`}
                              {...register(`steps.${index}.checkType`)}
                              className={selectClass}
                            >
                              {CHECK_TYPES.map((val) => (
                                <option key={val} value={val}>{tn(CHECK_TYPE_KEYS[val])}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <input type="hidden" {...register(`steps.${index}.order`)} value={index} />
                      </div>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-6"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => router.back()}>
            {tc('cancel')}
          </Button>
          <Button type="submit" form="edit-pipeline-form" disabled={isSaving}>
            {isSaving ? tc('saving') : t('saveButton')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
