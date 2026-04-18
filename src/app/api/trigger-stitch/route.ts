import { NextRequest, NextResponse } from 'next/server';
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

export async function POST(req: NextRequest) {
    try {
        const { candidateId } = await req.json();
        const lambdaName = process.env.VIDEO_STITCHER_LAMBDA_NAME || "AltimetrikVideoStitcher";

        if (!candidateId) {
            return NextResponse.json({ error: 'Missing candidateId' }, { status: 400 });
        }

        // Initialize Lambda Client with credentials from env
        const client = new LambdaClient({
            region: process.env.S3_BUCKET_REGION || 'eu-north-1',
            credentials: {
                accessKeyId: (process.env.ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID) as string,
                secretAccessKey: (process.env.SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY) as string,
            }
        });

        // 1. Prepare the Async Invocation (Event)
        // This stops the "Headers Timeout" by returning immediately (202 Accepted)
        const command = new InvokeCommand({
            FunctionName: lambdaName,
            InvocationType: "Event", 
            Payload: JSON.stringify({ 
                candidate_id: candidateId,
                bucket_name: process.env.S3_BUCKET_NAME 
            }),
        });

        // 2. Fire and Forget
        await client.send(command);

        console.log(`[STITCH] Asynchronously triggered Lambda for candidate: ${candidateId}`);
        return NextResponse.json({ 
            success: true, 
            message: "Stitching started in background" 
        });

    } catch (err: any) {
        console.error('Trigger Stitch error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
