import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

/**
 * GET /api/video-stream?key=interview-videos/xxx.webm
 *
 * Proxies a private S3 video to the browser, supporting HTTP Range requests
 * so the <video> element can seek without downloading the whole file.
 */

const BUCKET_REGION = process.env.S3_BUCKET_REGION || process.env.REGION || 'us-east-1';
const BUCKET_NAME = process.env.S3_BUCKET_NAME || '';

const s3Client = new S3Client({
  region: BUCKET_REGION,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID || '',
    secretAccessKey: process.env.SECRET_ACCESS_KEY || '',
  },
});

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const key = searchParams.get('key');

  if (!key) {
    return NextResponse.json({ error: 'Missing `key` query param' }, { status: 400 });
  }

  if (!BUCKET_NAME) {
    return NextResponse.json({ error: 'S3 bucket not configured' }, { status: 500 });
  }

  // Forward the browser's Range header to S3 for partial content (seeking)
  const rangeHeader = req.headers.get('range') ?? undefined;

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ...(rangeHeader ? { Range: rangeHeader } : {}),
    });

    const s3Res = await s3Client.send(command);

    const body = s3Res.Body as ReadableStream | undefined;
    if (!body) {
      return NextResponse.json({ error: 'Empty response from S3' }, { status: 502 });
    }

    const contentType = s3Res.ContentType || 'video/webm';
    const contentLength = s3Res.ContentLength;
    const contentRange = s3Res.ContentRange;

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
    };
    if (contentLength !== undefined) headers['Content-Length'] = String(contentLength);
    if (contentRange) headers['Content-Range'] = contentRange;

    // 206 Partial Content for range requests, 200 otherwise
    const status = rangeHeader ? 206 : 200;

    return new NextResponse(body as any, { status, headers });
  } catch (err: any) {
    console.error('[VideoStream] S3 error:', err?.message || err);
    return NextResponse.json(
      { error: 'Failed to stream video', detail: err?.message },
      { status: 502 }
    );
  }
}
