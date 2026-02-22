import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-in-production'
);

const COOKIE_ADMIN = 'admin_token';
const COOKIE_EXAMINEE = 'examinee_token';

interface TokenPayload {
  sub: string;
  role: 'admin';
}

interface ExamineeTokenPayload {
  sub: string;
  role: 'examinee';
  sessionId?: number;
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

export async function setAdminCookie() {
  const token = await signToken({ sub: 'admin', role: 'admin' });
  const store = await cookies();
  store.set(COOKIE_ADMIN, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function verifyAdmin(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(COOKIE_ADMIN)?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return payload?.role === 'admin';
}

export async function clearAdminCookie() {
  const store = await cookies();
  store.delete(COOKIE_ADMIN);
}

export async function signExamineeToken(payload: ExamineeTokenPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('12h')
    .sign(SECRET);
}

export async function verifyExamineeToken(token: string): Promise<ExamineeTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as ExamineeTokenPayload;
  } catch {
    return null;
  }
}

export async function setExamineeCookie(examineeId: number, sessionId?: number) {
  const token = await signExamineeToken({
    sub: String(examineeId),
    role: 'examinee',
    ...(sessionId != null && { sessionId }),
  });
  const store = await cookies();
  store.set(COOKIE_EXAMINEE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
}

export async function verifyExaminee(): Promise<{ examineeId: number; sessionId?: number } | null> {
  const store = await cookies();
  const token = store.get(COOKIE_EXAMINEE)?.value;
  if (!token) return null;
  const payload = await verifyExamineeToken(token);
  if (payload?.role !== 'examinee') return null;
  const examineeId = parseInt(payload.sub, 10);
  if (Number.isNaN(examineeId)) return null;
  return { examineeId, sessionId: payload.sessionId };
}

export async function clearExamineeCookie() {
  const store = await cookies();
  store.delete(COOKIE_EXAMINEE);
}
