import { env } from '@/share/configs/environments/server-constants';
import { auth } from '@auth';
import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const privateKey = env.GATEWAY_JWT_PRIVATE_KEY as string | undefined;
    const issuer = env.GATEWAY_JWT_ISSUER as string | undefined;
    const audience = env.GATEWAY_JWT_AUDIENCE as string | undefined;

    if (!privateKey) {
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

    return NextResponse.json({ token, expiresIn }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Internal Server Error' }, { status: 500 });
  }
}


