/**
 * R2 업로드 프로세스 관리 (Redis 연동)
 *
 * - 업로드 프로세스는 도메인에 중립적인 메타데이터만을 관리합니다.
 *   (document/file 등 상위 도메인에서는 id/경로/용량/스토리지 키를 주입)
 */

import { getRedis } from '@/server/database/redis/connection/client-redis';
import { CacheKey } from '@/share/configs/constants/server/cache-constants';
import { generateUUID } from '@/share/share-utils/id-utils';

export type UploadProcessStatus =
  | 'pending'
  | 'uploading'
  | 'uploaded'
  | 'upload_failed';

export interface UploadProcess {
  processId: string;
  userId: string;
  id: string;
  name: string;
  path: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  status: UploadProcessStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  expiresAt: string;
}

export interface CreateUploadProcessInput {
  userId: string;
  id: string;
  name: string;
  path: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  ttl?: number; // seconds, default 1 hour
}

// 프로세스 키 생성
const getProcessKey = (processId: string): string =>
  CacheKey.upload.process(processId);

/**
 * 업로드 프로세스 생성
 */
export async function createUploadProcess(
  params: CreateUploadProcessInput
): Promise<UploadProcess> {
  const processId = generateUUID();
  const now = new Date();
  const ttl = params.ttl ?? 3600; // 1시간

  if (!params.mimeType || !params.storageKey) {
    throw new Error('파일 업로드에는 mimeType과 storageKey가 필요합니다');
  }

  const createdAt = params.createdAt ?? now.toISOString();
  const updatedAt = params.updatedAt ?? createdAt;

  const process: UploadProcess = {
    processId,
    userId: params.userId,
    id: params.id,
    name: params.name,
    path: params.path,
    fileSize: params.fileSize,
    mimeType: params.mimeType,
    storageKey: params.storageKey,
    status: 'pending',
    metadata: params.metadata ?? {},
    createdAt,
    updatedAt,
    deletedAt: params.deletedAt ?? null,
    expiresAt: new Date(now.getTime() + ttl * 1000).toISOString(),
  };

  // Redis에 저장
  const redis = getRedis();
  if (!redis) {
    throw new Error('Redis 연결이 필요합니다');
  }

  await redis.set(getProcessKey(processId), JSON.stringify(process), 'EX', ttl);

  return process;
}

/**
 * 업로드 프로세스 조회
 */
export async function getUploadProcess(
  processId: string
): Promise<UploadProcess | null> {
  const redis = getRedis();
  if (!redis) {
    return null;
  }

  const data = await redis.get(getProcessKey(processId));

  if (!data) {
    return null;
  }

  return JSON.parse(data) as UploadProcess;
}

/**
 * 업로드 프로세스 상태 업데이트
 */
export async function updateProcessStatus(
  processId: string,
  status: UploadProcess['status']
): Promise<boolean> {
  const process = await getUploadProcess(processId);

  if (!process) {
    return false;
  }

  process.status = status;

  // TTL 유지하면서 업데이트
  const redis = getRedis();
  if (!redis) {
    return false;
  }

  const ttl = await redis.ttl(getProcessKey(processId));

  if (ttl > 0) {
    await redis.set(
      getProcessKey(processId),
      JSON.stringify(process),
      'EX',
      ttl
    );
    return true;
  }

  return false;
}

/**
 * 사용자의 일일 업로드 카운트 증가
 */
// 일일 업로드 카운트 로직 제거됨

/**
 * 사용자의 일일 업로드 카운트 조회
 */
// 일일 업로드 카운트 로직 제거됨
