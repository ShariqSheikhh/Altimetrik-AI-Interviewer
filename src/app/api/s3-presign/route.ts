import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Config: any = {
  region: process.env.S3_BUCKET_REGION || process.env.AWS_REGION || process.env.REGION || 'us-east-1',
};

if (
  (process.env.AWS_ACCESS_KEY_ID || process.env.ACCESS_KEY_ID) &&
  (process.env.AWS_SECRET_ACCESS_KEY || process.env.SECRET_ACCESS_KEY)
) {
  s3Config.credentials = {
    accessKeyId: (process.env.AWS_ACCESS_KEY_ID || process.env.ACCESS_KEY_ID) as string,
    secretAccessKey: (process.env.AWS_SECRET_ACCESS_KEY || process.env.SECRET_ACCESS_KEY) as string,
  };
}

const s3Client = new S3Client(s3Config);

export async function POST(req: NextRequest) {
  try {
    const { action, fileName, fileType } = await req.json();
    const bucketName = process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME || process.env.S3_BUCKET_NAME;

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
      try {
        // Verify the file actually exists before giving out a URL
        const headCommand = new HeadObjectCommand({
          Bucket: bucketName,
          Key: fileName,
        });
        const headData = await s3Client.send(headCommand);

        const safeName = String(fileName || '').split('/').pop() || 'document';

        const command = new GetObjectCommand({
          Bucket: bucketName,
          Key: fileName,
          ResponseContentDisposition: `inline; filename="${safeName}"`,
          ResponseContentType: headData.ContentType || undefined,
        });
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        return NextResponse.json({ signedUrl });
      } catch (headErr: any) {
        if (headErr.name === 'NotFound' || headErr.$metadata?.httpStatusCode === 404) {
          return NextResponse.json({ error: 'File not found', exists: false }, { status: 404 });
        }
        throw headErr;
      }
      
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('S3 Presign Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
