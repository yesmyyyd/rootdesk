import { NextResponse } from 'next/server';

export async function GET() {
  // 返回硬编码的密钥，避免依赖环境变量
  const encryptionKey = "dGVzdF9rZXlfMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=";
  return NextResponse.json({ key: encryptionKey });
}
