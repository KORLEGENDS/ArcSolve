import { env } from '@/share/configs/environments/server-constants';
import { auth } from '@auth';
import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  try {
    console.log('[ws/token] handler invoked');
    const session = await auth();
    const userId = session?.user?.id;
    console.log('[ws/token] session', {
      hasSession: !!session,
      userIdPresent: !!userId,
    });
    if (!userId) {
      console.warn('[ws/token] unauthorized: missing userId');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const privateKey = env.GATEWAY_JWT_PRIVATE_KEY as string | undefined;
    const issuer = env.GATEWAY_JWT_ISSUER as string | undefined;
    const audience = env.GATEWAY_JWT_AUDIENCE as string | undefined;
    console.log('[ws/token] env readiness', {
      hasPrivateKey: !!privateKey,
      issuer: issuer ?? null,
      audience: audience ?? null,
    });

    if (!privateKey) {
      console.error('[ws/token] missing private key');
      return NextResponse.json({ error: 'Gateway signing key not configured' }, { status: 500 });
    }

    const expiresIn = '5m';
    const token = jwt.sign(
      {},
      privateKey,
      {
        algorithm: 'RS256',
        subject: userId,
        issuer,
        audience,
        expiresIn,
      },
    );

    console.log('[ws/token] token issued', { userId, expiresIn });
    return NextResponse.json({ token, expiresIn }, { status: 200 });
  } catch (e: any) {
    console.error('[ws/token] error', {
      name: e?.name ?? null,
      message: e?.message ?? String(e),
      stack: e?.stack ?? null,
    });
    return NextResponse.json({ error: e?.message ?? 'Internal Server Error' }, { status: 500 });
  }
}


