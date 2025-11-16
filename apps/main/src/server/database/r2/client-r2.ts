import { env } from '@/share/configs/environments/server-constants';
import { S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';

// 환경변수 기반 설정
export const r2Config = {
  region: 'auto' as const,
  accountId: env.R2_ACCOUNT_ID,
  accessKeyId: env.R2_ACCESS_KEY_ID,
  secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  bucketName: env.R2_BUCKET_NAME,
  publicUrl: env.R2_PUBLIC_URL,
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
} as const;

// 간소화된 export - 주로 사용되는 BUCKET만 유지
export const BUCKET = r2Config.bucketName;

// R2 클라이언트 초기화
const clientConfig: S3ClientConfig = {
  region: r2Config.region,
  endpoint: r2Config.endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: r2Config.accessKeyId,
    secretAccessKey: r2Config.secretAccessKey,
  },
};

export const r2Client = new S3Client(clientConfig);
