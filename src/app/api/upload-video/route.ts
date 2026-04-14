import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: process.env.S3_BUCKET_REGION || process.env.AWS_REGION || process.env.REGION || 'us-east-1',
  credentials: {
    accessKeyId: (process.env.AWS_ACCESS_KEY_ID || process.env.ACCESS_KEY_ID) as string,
    secretAccessKey: (process.env.AWS_SECRET_ACCESS_KEY || process.env.SECRET_ACCESS_KEY) as string,
  },
});

export async function POST(req: NextRequest) {
  try {
    const { action, fileName, fileType } = await req.json();
    const bucketName = process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME || process.env.S3_BUCKET_NAME;

    if (!bucketName) {
      return NextResponse.json({ error: 'S3 bucket name not configured in env variables.' }, { status: 500 });
    }

    const key = `interview-videos/${fileName}`;

    if (action === 'upload') {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        ContentType: fileType || 'video/webm',
      });
      // URL expires in 1 hour
      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      
      const region = await s3Client.config.region();
      const publicUrl = process.env.CLOUDFRONT_URL
        ? `${process.env.CLOUDFRONT_URL}/${key}`
        : `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;

      return NextResponse.json({ signedUrl, fileName: key, publicUrl });
      
    } else if (action === 'get') {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
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
