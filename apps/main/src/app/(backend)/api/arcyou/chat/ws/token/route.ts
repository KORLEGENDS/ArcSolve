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

    // PEM 형식 검증
    if (!privateKey.includes('BEGIN') || !privateKey.includes('PRIVATE KEY')) {
      return NextResponse.json(
        { 
          error: 'Invalid private key format',
          details: 'GATEWAY_JWT_PRIVATE_KEY must be a valid PEM format RSA private key'
        }, 
        { status: 500 }
      );
    }

    const expiresIn = '5m';
    
    try {
      // jwt.sign()에 undefined를 전달하면 에러가 발생하므로, 값이 있을 때만 포함
      const signOptions: jwt.SignOptions = {
        algorithm: 'RS256',
        subject: userId,
        expiresIn,
      };
      
      if (issuer) {
        signOptions.issuer = issuer;
      }
      
      if (audience) {
        signOptions.audience = audience;
      }
      
      const token = jwt.sign({}, privateKey, signOptions);

      return NextResponse.json({ token, expiresIn }, { status: 200 });
    } catch (signError: any) {
      return NextResponse.json(
        { 
          error: 'Token generation failed', 
          details: signError?.message ?? 'Unknown error' 
        }, 
        { status: 500 }
      );
    }
  } catch (e: any) {
    return NextResponse.json(
      { 
        error: e?.message ?? 'Internal Server Error'
      }, 
      { status: 500 }
    );
  }
}


