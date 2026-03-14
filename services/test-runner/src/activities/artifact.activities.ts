import { log } from '@temporalio/activity';
import fs from 'fs';
import path from 'path';
import { Client as MinioClient } from 'minio';

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost';
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000', 10);
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin';
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true';

let minioClient: MinioClient | null = null;

function getMinioClient(): MinioClient {
  if (!minioClient) {
    minioClient = new MinioClient({
      endPoint: MINIO_ENDPOINT,
      port: MINIO_PORT,
      useSSL: MINIO_USE_SSL,
      accessKey: MINIO_ACCESS_KEY,
      secretKey: MINIO_SECRET_KEY,
    });
  }
  return minioClient;
}

/**
 * Ensures a MinIO bucket exists, creating it if necessary.
 */
async function ensureBucket(bucket: string): Promise<void> {
  const client = getMinioClient();
  const exists = await client.bucketExists(bucket);
  if (!exists) {
    await client.makeBucket(bucket);
    log.info('Created MinIO bucket', { bucket });
  }
}

/**
 * Uploads a single file to MinIO (S3-compatible object storage).
 * @returns The URL of the uploaded artifact.
 */
export async function uploadArtifact(
  filePath: string,
  bucket: string,
  key: string
): Promise<string> {
  log.info('Uploading artifact to MinIO', { filePath, bucket, key });

  if (!fs.existsSync(filePath)) {
    log.warn('Artifact file not found, skipping upload', { filePath });
    return '';
  }

  try {
    await ensureBucket(bucket);
    const client = getMinioClient();

    await client.fPutObject(bucket, key, filePath);

    const protocol = MINIO_USE_SSL ? 'https' : 'http';
    const url = `${protocol}://${MINIO_ENDPOINT}:${MINIO_PORT}/${bucket}/${key}`;

    log.info('Artifact uploaded', { url });
    return url;
  } catch (err) {
    log.warn('Failed to upload artifact', { filePath, error: String(err) });
    return '';
  }
}

/**
 * Uploads all files in a directory to MinIO under a given prefix.
 * @returns Array of URLs for all uploaded artifacts.
 */
export async function uploadDirectory(
  dirPath: string,
  bucket: string,
  prefix: string
): Promise<string[]> {
  log.info('Uploading directory to MinIO', { dirPath, bucket, prefix });

  if (!fs.existsSync(dirPath)) {
    log.warn('Directory not found, skipping upload', { dirPath });
    return [];
  }

  try {
    await ensureBucket(bucket);
  } catch (err) {
    log.warn('Failed to ensure bucket exists', { bucket, error: String(err) });
    return [];
  }

  const files = collectFiles(dirPath);
  const urls: string[] = [];

  for (const filePath of files) {
    const relativePath = path.relative(dirPath, filePath).replace(/\\/g, '/');
    const key = `${prefix}/${relativePath}`;

    try {
      const url = await uploadArtifact(filePath, bucket, key);
      if (url) {
        urls.push(url);
      }
    } catch {
      // Best-effort per file
    }
  }

  log.info('Directory upload completed', { fileCount: urls.length });
  return urls;
}

/**
 * Recursively collects all file paths in a directory.
 */
function collectFiles(dir: string): string[] {
  const files: string[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...collectFiles(fullPath));
      } else {
        files.push(fullPath);
      }
    }
  } catch {
    // Permission or access error
  }

  return files;
}
