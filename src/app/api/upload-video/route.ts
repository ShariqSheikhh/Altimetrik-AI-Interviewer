import { NextRequest, NextResponse } from 'next/server';
import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  ListObjectsV2Command
} from '@aws-sdk/client-s3';
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
    const body = await req.json();
    const { action, fileName, fileType, uploadId, partNumber, parts, videoUrl } = body;
    const bucketName = process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME || process.env.S3_BUCKET_NAME;

    if (!bucketName) {
      return NextResponse.json({ error: 'S3 bucket name not configured in env variables.' }, { status: 500 });
    }

    const key = `interview-videos/${fileName}`;

    if (action === 'upload') {
      console.log(`[S3-UPLOAD] Generating presigned URL. Bucket: ${bucketName}, Key: ${key}`);
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        ContentType: fileType || 'video/webm',
      });
      // URL expires in 1 hour
      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      
      const region = s3Config.region;
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
      
    } else if (action === 'createMultipart') {
      const command = new CreateMultipartUploadCommand({
        Bucket: bucketName,
        Key: key,
        ContentType: fileType || 'video/webm',
      });
      const response = await s3Client.send(command);
      
      const region = s3Config.region;
      const publicUrl = process.env.CLOUDFRONT_URL
        ? `${process.env.CLOUDFRONT_URL}/${key}`
        : `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
        
      return NextResponse.json({ uploadId: response.UploadId, key, publicUrl });

    } else if (action === 'uploadPart') {
      const command = new UploadPartCommand({
        Bucket: bucketName,
        Key: key,
        PartNumber: partNumber,
        UploadId: uploadId,
      });
      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      return NextResponse.json({ signedUrl });

    } else if (action === 'completeMultipart') {
      const command = new CompleteMultipartUploadCommand({
        Bucket: bucketName,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts,
        },
      });
      const response = await s3Client.send(command);
      const region = s3Config.region;
      const cleanLocation = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
      return NextResponse.json({ success: true, location: cleanLocation });
      
    } else if (action === 'listSegments') {
      const prefix = `interview-videos/${fileName}/`; // fileName here is the candidateId
      const command = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
      });
      const response = await s3Client.send(command);
      
      const contents = response.Contents || [];
      const allKeys = contents
        .map(item => item.Key)
        .filter((key): key is string => !!key && (key.endsWith('.webm') || key.endsWith('.mp4')));

      // Priority: check for the newly implemented MP4 final video first
      const finalKey = allKeys.find(key => key.endsWith('final_interview.mp4')) || 
                      allKeys.find(key => key.endsWith('final_interview.webm'));

      const segmentKeys = allKeys
        .filter(key => key.endsWith('.webm') && !key.endsWith('final_interview.webm'))
        .sort((a, b) => a.localeCompare(b));

      let finalUrl = null;
      let finalPublicUrl = null;
      if (finalKey) {
        const getCmd = new GetObjectCommand({ Bucket: bucketName, Key: finalKey });
        finalUrl = await getSignedUrl(s3Client, getCmd, { expiresIn: 3600 });
        
        const region = s3Config.region;
        finalPublicUrl = process.env.CLOUDFRONT_URL
          ? `${process.env.CLOUDFRONT_URL}/${finalKey}`
          : `https://${bucketName}.s3.${region}.amazonaws.com/${finalKey}`;
      }

      // Generate signed URLs for all segments
      const segmentUrls = await Promise.all(
        segmentKeys.map(async (sKey) => {
          const getCmd = new GetObjectCommand({ Bucket: bucketName, Key: sKey });
          return await getSignedUrl(s3Client, getCmd, { expiresIn: 3600 });
        })
      );

        return NextResponse.json({ 
        success: true, 
        segments: segmentUrls,
        finalExists: !!finalKey,
        finalUrl,
        finalPublicUrl 
      });

    } else if (action === 'getStatus') {
      const statusKey = `interview-videos/${fileName}/stitching_status.json`;
      try {
        const command = new GetObjectCommand({
          Bucket: bucketName,
          Key: statusKey,
        });
        const response = await s3Client.send(command);
        const bodyContents = await response.Body?.transformToString();
        return NextResponse.json(JSON.parse(bodyContents || '{}'));
      } catch (err) {
        // If file doesn't exist yet, return a simple waiting status
        return NextResponse.json({ status: 'Waiting for Lambda...', logs: [] });
      }

    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('S3 Presign Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
