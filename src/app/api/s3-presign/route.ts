import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(req: NextRequest) {
  try {
    const { action, fileName, fileType } = await req.json();
    const bucketName = process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME;

    if (!bucketName) {
      return NextResponse.json({ error: 'S3 bucket name not configured in env variables.' }, { status: 500 });
    }

    if (action === 'upload') {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        ContentType: fileType || 'video/webm',
      });
      // URL expires in 1 hour
      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      return NextResponse.json({ signedUrl, fileName });
      
    } else if (action === 'get') {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: fileName,
      });
      // URL expires in 1 hour
      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      return NextResponse.json({ signedUrl });
      
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('S3 Presign Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
