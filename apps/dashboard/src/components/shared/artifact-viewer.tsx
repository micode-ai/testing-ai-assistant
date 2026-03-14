'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { FileImage, FileVideo, FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export type ArtifactType = 'screenshot' | 'video' | 'report';

export interface Artifact {
  id: string;
  name: string;
  type: ArtifactType;
  url: string;
  stepName?: string;
}

interface ScreenshotGridProps {
  artifacts: Artifact[];
}

function ScreenshotGrid({ artifacts }: ScreenshotGridProps) {
  const [selectedImage, setSelectedImage] = useState<Artifact | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {artifacts.map((artifact) => (
          <button
            key={artifact.id}
            className="group relative aspect-video overflow-hidden rounded-lg border bg-muted transition-colors hover:border-primary"
            onClick={() => setSelectedImage(artifact)}
          >
            <img
              src={artifact.url}
              alt={artifact.name}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
              <p className="truncate text-xs text-white">{artifact.name}</p>
            </div>
          </button>
        ))}
      </div>

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedImage?.name}</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="relative">
              <img
                src={selectedImage.url}
                alt={selectedImage.name}
                className="w-full rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

interface VideoPlayerProps {
  artifacts: Artifact[];
  videoNotSupported: string;
}

function VideoPlayer({ artifacts, videoNotSupported }: VideoPlayerProps) {
  return (
    <div className="space-y-4">
      {artifacts.map((artifact) => (
        <div key={artifact.id} className="space-y-2">
          <p className="text-sm font-medium">{artifact.name}</p>
          <video
            controls
            className="w-full rounded-lg border"
            preload="metadata"
          >
            <source src={artifact.url} />
            {videoNotSupported}
          </video>
        </div>
      ))}
    </div>
  );
}

interface ReportListProps {
  artifacts: Artifact[];
  downloadLabel: string;
}

function ReportList({ artifacts, downloadLabel }: ReportListProps) {
  return (
    <div className="space-y-2">
      {artifacts.map((artifact) => (
        <div
          key={artifact.id}
          className="flex items-center justify-between rounded-lg border p-3"
        >
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">{artifact.name}</span>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href={artifact.url} download>
              <Download className="mr-2 h-4 w-4" />
              {downloadLabel}
            </a>
          </Button>
        </div>
      ))}
    </div>
  );
}

interface ArtifactViewerProps {
  artifacts: Artifact[];
  className?: string;
}

export function ArtifactViewer({ artifacts, className }: ArtifactViewerProps) {
  const t = useTranslations('artifactViewer');

  const screenshots = artifacts.filter((a) => a.type === 'screenshot');
  const videos = artifacts.filter((a) => a.type === 'video');
  const reports = artifacts.filter((a) => a.type === 'report');

  if (artifacts.length === 0) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-muted-foreground">{t('noArtifacts')}</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-8', className)}>
      {screenshots.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileImage className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold">{t('screenshots')} ({screenshots.length})</h4>
          </div>
          <ScreenshotGrid artifacts={screenshots} />
        </div>
      )}

      {videos.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileVideo className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold">{t('videos')} ({videos.length})</h4>
          </div>
          <VideoPlayer artifacts={videos} videoNotSupported={t('videoNotSupported')} />
        </div>
      )}

      {reports.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold">{t('reports')} ({reports.length})</h4>
          </div>
          <ReportList artifacts={reports} downloadLabel={t('download')} />
        </div>
      )}
    </div>
  );
}
