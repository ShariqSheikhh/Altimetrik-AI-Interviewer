import { NextRequest, NextResponse } from 'next/server';
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        let { 
            candidateId, 
            interviewId, 
            questionBank, 
            transcript, 
            coverageData, 
            followUpData, 
            candidateName,
            tabSwitches,
            fullscreenExits,
            candidateAnswersStructured
        } = body;

        const lambdaName = process.env.EVALUATION_LAMBDA_NAME || "AltimetrikEvaluationLambda";

        if (!candidateId) {
            console.error('[TRIGGER-EVAL] ERROR: Missing candidateId');
            return NextResponse.json({ error: 'Missing candidateId' }, { status: 400 });
        }

        // 1. Initialize Supabase Admin for data fetching if needed
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        console.log(`[TRIGGER-EVAL] Start for Candidate: ${candidateId}`);

        if (!supabaseUrl || !supabaseKey) {
            console.error('[TRIGGER-EVAL] ERROR: Supabase credentials missing');
            throw new Error('Supabase URL or Key is missing in environment variables.');
        }

        const { createClient } = await import('@supabase/supabase-js');
        const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

        // 2. Data Fallback Logic: If data is missing (e.g. from Admin trigger), fetch it from DB
        if (!interviewId || !questionBank || !transcript) {
            console.log(`[TRIGGER-EVAL] Data missing in payload, fetching from DB for candidate: ${candidateId}`);
            
            const { data: candidate, error: cErr } = await supabaseAdmin
                .from('candidates')
                .select('*, interviews(*)')
                .eq('id', candidateId)
                .single();

            if (cErr || !candidate) {
                console.error(`[TRIGGER-EVAL] ERROR: Candidate ${candidateId} not found in DB`, cErr);
                throw new Error('Candidate not found');
            }
            
            console.log(`[TRIGGER-EVAL] DB Data found. Session State present: ${!!candidate.session_state}`);
            
            const session = candidate.session_state || {};
            interviewId = candidate.interview_id;
            candidateName = candidate.name;
            questionBank = candidate.interviews?.question_bank || [];
            transcript = session.transcript || [];
            coverageData = { per_question: session.coveragePerQuestion || [] };
            followUpData = { per_question: session.followUpsPerQuestion || [] };
            candidateAnswersStructured = session.candidateAnswers || [];
            tabSwitches = session.tabSwitches || 0;
            fullscreenExits = session.fullscreenExits || 0;

            console.log(`[TRIGGER-EVAL] Reconstructed session: ${transcript.length} transcript entries found`);
        }

        // 3. Initialize Status in DB
        console.log(`[TRIGGER-EVAL] Initializing evaluation_status in database...`);
        const { error: upErr } = await supabaseAdmin.from('candidates').update({
            evaluation_status: 'INITIATED',
            evaluation_progress: 0
        }).eq('id', candidateId);
        
        if (upErr) console.warn('[TRIGGER-EVAL] Warning: Failed to initialize status in DB', upErr);

        // 4. Initialize Lambda Client
        console.log(`[TRIGGER-EVAL] Preparing Lambda Invocation (Region: ${process.env.S3_BUCKET_REGION || 'eu-north-1'})`);
        const client = new LambdaClient({
            region: process.env.S3_BUCKET_REGION || 'eu-north-1',
            credentials: {
                accessKeyId: (process.env.ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID) as string,
                secretAccessKey: (process.env.SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY) as string,
            }
        });

        // 5. Build Final Payload (Using Database Source of Truth)
        const { data: dbCandidate } = await supabaseAdmin
            .from('candidates')
            .select('session_state, name, interview_id')
            .eq('id', candidateId)
            .single();

        const dbSession = dbCandidate?.session_state || {};

        console.log(`[DEBUG] Body Transcript Length: ${transcript?.length || 0}`);
        console.log(`[DEBUG] DB Session Transcript Length: ${dbSession.transcript?.length || 0}`);

        // Build the payload using the Database Session State as the primary source
        const payload = {
            candidateId,
            interviewId: dbCandidate?.interview_id || interviewId,
            candidateName: dbCandidate?.name || candidateName,
            questionBank, 
            transcript: dbSession.transcript || [],
            coverageData: { per_question: dbSession.coveragePerQuestion || [] },
            followUpData: { per_question: dbSession.followUpsPerQuestion || [] },
            candidateAnswersStructured: dbSession.candidateAnswers || [],
            tabSwitches: dbSession.tabSwitches || 0,
            fullscreenExits: dbSession.fullscreenExits || 0,
            sessionState: dbSession 
        };

        console.log('--- [FINAL LAMBDA PAYLOAD START] ---');
        console.log(JSON.stringify(payload, null, 2));
        console.log('--- [FINAL LAMBDA PAYLOAD END] ---');

        // Async Invocation (Event)
        const command = new InvokeCommand({
            FunctionName: lambdaName,
            InvocationType: "Event", 
            Payload: Buffer.from(JSON.stringify(payload)),
        });

        // Fire and Forget
        console.log(`[TRIGGER-EVAL] Sending asynchronous InvokeCommand to: ${lambdaName}`);
        await client.send(command);

        console.log(`[TRIGGER-EVAL] SUCCESS: Evaluation triggered for candidate: ${candidateId}`);
        
        return NextResponse.json({ 
            success: true, 
            message: "Evaluation started in background" 
        });

    } catch (err: any) {
        console.error('Trigger Evaluation error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
