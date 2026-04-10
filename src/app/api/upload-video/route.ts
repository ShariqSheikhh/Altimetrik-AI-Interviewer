import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

/**
 * Server-side proxy upload: browser → Next.js API → S3
 *
 * Accepts: multipart/form-data  { file: Blob, fileName: string }
 * Returns: { publicUrl: string, key: string }
 */

// S3_BUCKET_REGION is the region where the S3 bucket lives (eu-north-1).
// REGION is used by other AWS services (Bedrock, etc.) and may differ.
const BUCKET_REGION = process.env.S3_BUCKET_REGION || process.env.REGION || 'us-east-1';
const BUCKET_NAME = process.env.S3_BUCKET_NAME || '';

const s3Client = new S3Client({
  region: BUCKET_REGION,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID || '',
    secretAccessKey: process.env.SECRET_ACCESS_KEY || '',
  },
});

// Raise the default Next.js body size limit for large video files.
export const maxDuration = 60; // seconds (increase on Vercel Pro if needed)

export async function POST(req: Request) {
  try {
    if (!BUCKET_NAME) {
      console.error('[UploadVideo] S3_BUCKET_NAME env var is not set');
      return NextResponse.json({ error: 'AWS S3 bucket not configured' }, { status: 500 });
    }

    if (!process.env.ACCESS_KEY_ID || !process.env.SECRET_ACCESS_KEY) {
      console.error('[UploadVideo] AWS credentials are not set');
      return NextResponse.json({ error: 'AWS credentials not configured' }, { status: 500 });
    }

    // Parse multipart form-data sent by the browser
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const fileName = formData.get('fileName') as string | null;

    if (!file || !fileName) {
      return NextResponse.json(
        { error: '`file` (Blob) and `fileName` (string) are required' },
        { status: 400 }
      );
    }

    const key = `interview-videos/${fileName}`;

    // Read the file into a Buffer and upload to S3 server-side (no browser CORS needed)
    const arrayBuffer = await file.arrayBuffer();
    const body = Buffer.from(arrayBuffer);

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: file.type || 'video/webm',
      })
    );

    const publicUrl = process.env.CLOUDFRONT_URL
      ? `${process.env.CLOUDFRONT_URL}/${key}`
      : `https://${BUCKET_NAME}.s3.${BUCKET_REGION}.amazonaws.com/${key}`;

    console.log('[UploadVideo] Uploaded successfully:', publicUrl);
    return NextResponse.json({ publicUrl, key });
  } catch (error: any) {
    console.error('[UploadVideo] Error:', error?.message || error);
    return NextResponse.json(
      { error: 'Failed to upload video', detail: error?.message },
      { status: 500 }
    );
  }
}
