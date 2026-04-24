import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  
  let ip = 'unknown';
  if (forwardedFor) {
    ip = forwardedFor.split(',')[0].trim();
  } else if (realIp) {
    ip = realIp.trim();
  }

  return NextResponse.json({ ip });
}
