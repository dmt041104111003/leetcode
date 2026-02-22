import { NextResponse } from 'next/server';
import { clearExamineeCookie } from '@/lib/auth';

export async function POST() {
  await clearExamineeCookie();
  return NextResponse.json({ success: true });
}
