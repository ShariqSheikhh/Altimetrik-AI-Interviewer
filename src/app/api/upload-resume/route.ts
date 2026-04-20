import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseKey =
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) as string;
const supabase = createClient(supabaseUrl, supabaseKey);

const MAX_RESUME_BYTES = 8 * 1024 * 1024;

function sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function extractDriveFileId(urlValue: string): string | null {
    try {
        const parsed = new URL(urlValue.trim());
        const host = parsed.hostname.toLowerCase();
        if (!host.includes('drive.google.com')) return null;

        const fromQuery = parsed.searchParams.get('id');
        if (fromQuery) return fromQuery;

        const pathParts = parsed.pathname.split('/').filter(Boolean);
        const fileIndex = pathParts.findIndex((part) => part === 'd');
        if (fileIndex >= 0 && pathParts[fileIndex + 1]) {
            return pathParts[fileIndex + 1];
        }

        return null;
    } catch {
        return null;
    }
}

function getDownloadUrl(inputUrl: string): string {
    const fileId = extractDriveFileId(inputUrl);
    if (!fileId) return inputUrl;
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

function inferFileName(contentDisposition: string | null, fallback: string): string {
    if (!contentDisposition) return fallback;
    const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1]);
    const basicMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
    if (basicMatch?.[1]) return basicMatch[1];
    return fallback;
}

async function uploadDriveResume(params: {
    driveUrl: string;
    interviewId: string;
    candidateId: string;
}): Promise<{ key: string; fileName: string }> {
    const { driveUrl, interviewId, candidateId } = params;
    const downloadUrl = getDownloadUrl(driveUrl);
    const response = await fetch(downloadUrl);

    if (!response.ok) {
        throw new Error(`Failed to download resume link (${response.status})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
        throw new Error('Resume file is empty');
    }
    if (arrayBuffer.byteLength > MAX_RESUME_BYTES) {
        throw new Error('Resume file exceeds 8MB limit');
    }

    const fileName = sanitizeFileName(
        inferFileName(response.headers.get('content-disposition'), `resume_${candidateId}.pdf`),
    );
    const key = `resume/${interviewId}/${candidateId}/admin/${Date.now()}_${fileName}`;

    await s3Client.send(
        new PutObjectCommand({
            Bucket:
                process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME ||
                process.env.AWS_S3_BUCKET_NAME ||
                process.env.S3_BUCKET_NAME,
            Key: key,
            Body: Buffer.from(arrayBuffer),
            ContentType: response.headers.get('content-type') || 'application/pdf',
        }),
    );

    return { key, fileName };
}

export async function POST(req: NextRequest) {
    try {
        const bucketName =
            process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME ||
            process.env.AWS_S3_BUCKET_NAME ||
            process.env.S3_BUCKET_NAME;

        if (!bucketName) {
            return NextResponse.json({ error: 'S3 bucket name not configured.' }, { status: 500 });
        }

        const body = await req.json();
        const action = body?.action as string;

        if (action === 'ingestDriveLink') {
            const candidateId = String(body?.candidateId || '');
            const interviewId = String(body?.interviewId || '');
            const driveUrl = String(body?.driveUrl || '').trim();

            if (!candidateId || !interviewId || !driveUrl) {
                return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
            }

            const { key, fileName } = await uploadDriveResume({ driveUrl, interviewId, candidateId });

            const { error: updateErr } = await supabase
                .from('candidates')
                .update({
                    resume_source_url: driveUrl,
                    resume_file_name: fileName,
                    resume_s3_key: key,
                    resume_source: 'admin_drive',
                    resume_uploaded_at: new Date().toISOString(),
                })
                .eq('id', candidateId);

            if (updateErr) {
                return NextResponse.json({ error: updateErr.message }, { status: 500 });
            }

            return NextResponse.json({ success: true, resumeKey: key, fileName });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (err: any) {
        console.error('Upload Resume Error:', err);
        return NextResponse.json({ error: err.message || 'Unexpected error' }, { status: 500 });
    }
}
