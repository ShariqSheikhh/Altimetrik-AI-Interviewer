import { NextRequest, NextResponse } from 'next/server';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import mammoth from 'mammoth';

const region = process.env.S3_BUCKET_REGION || process.env.AWS_REGION || process.env.REGION || 'us-east-1';

const sharedCredentials =
  (process.env.AWS_ACCESS_KEY_ID || process.env.ACCESS_KEY_ID) &&
    (process.env.AWS_SECRET_ACCESS_KEY || process.env.SECRET_ACCESS_KEY)
    ? {
      accessKeyId: (process.env.AWS_ACCESS_KEY_ID || process.env.ACCESS_KEY_ID) as string,
      secretAccessKey: (process.env.AWS_SECRET_ACCESS_KEY || process.env.SECRET_ACCESS_KEY) as string,
    }
    : undefined;

const s3Client = new S3Client({
  region,
  ...(sharedCredentials ? { credentials: sharedCredentials } : {}),
});

const bedrockClient = new BedrockRuntimeClient({
  region,
  ...(sharedCredentials ? { credentials: sharedCredentials } : {}),
});

const MODEL_ID = process.env.MODEL_NAME || 'amazon.nova-pro-v1:0';
const INFERENCE_PROFILE_ID =
  process.env.BEDROCK_INFERENCE_PROFILE_ID ||
  process.env.BEDROCK_INFERENCE_PROFILE_ARN ||
  '';
const FALLBACK_MODEL_ID = 'amazon.nova-lite-v1:0';
const MAX_TEXT_CHARS = parseInt(process.env.MAX_TEXT_CHARS || '32000', 10);
const TRUNCATION_HEAD_RATIO = Number.parseFloat(process.env.TRUNCATION_HEAD_RATIO || '0.55');
const SCORING_TEMP = Number.parseFloat(process.env.SCORING_TEMP || '0');
const JSON_RETRY_LIMIT = 1;
const MIN_USABLE_TEXT_LEN = 120;
const MIN_ALPHA_RATIO = 0.2;
const STRICT_EVIDENCE_GATE = String(process.env.STRICT_EVIDENCE_GATE || 'true').toLowerCase() === 'true';

type ExtractedTextResult = {
  text: string;
  method: 'txt' | 'docx' | 'pdf-parse' | 'pdf-utf8-fallback' | 'unknown-utf8-fallback';
};

function logScoreEvent(event: string, payload: Record<string, unknown>) {
  console.info(`[ScoreCandidate] ${event}: ${JSON.stringify(payload)}`);
}

async function invokeScoringModel(payload: any): Promise<{ response: any; modelId: string }> {
  const modelIdsToTry: string[] = [];

  if (INFERENCE_PROFILE_ID) modelIdsToTry.push(INFERENCE_PROFILE_ID);
  if (MODEL_ID) modelIdsToTry.push(MODEL_ID);
  if (!modelIdsToTry.includes(FALLBACK_MODEL_ID)) {
    modelIdsToTry.push(FALLBACK_MODEL_ID);
  }

  let lastErr: any;
  for (const modelId of modelIdsToTry) {
    try {
      const response = await bedrockClient.send(
        new InvokeModelCommand({
          modelId,
          contentType: 'application/json',
          accept: 'application/json',
          body: JSON.stringify(payload),
        }),
      );
      return { response, modelId };
    } catch (err: any) {
      lastErr = err;
      if (!isModelRoutingError(err)) {
        throw err;
      }
    }
  }

  throw lastErr || new Error('Failed to invoke Bedrock model');
}

function isModelRoutingError(err: any): boolean {
  const msg = String(err?.message || '').toLowerCase();
  return (
    msg.includes('on-demand throughput') ||
    msg.includes('inference profile') ||
    msg.includes('validationexception')
  );
}

function clampScore(value: any): number {
  const n = typeof value === 'number' ? value : Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function deriveLabel(score: number): 'Strong Fit' | 'Moderate Fit' | 'Needs Review' | 'Low Fit' {
  if (score >= 80) return 'Strong Fit';
  if (score >= 60) return 'Moderate Fit';
  if (score >= 40) return 'Needs Review';
  return 'Low Fit';
}

function deriveScoreBand(score: number): 'low' | 'review' | 'moderate' | 'strong' {
  if (score >= 80) return 'strong';
  if (score >= 60) return 'moderate';
  if (score >= 40) return 'review';
  return 'low';
}

function sanitizeCandidateName(value: string): string {
  const cleaned = String(value || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[{}<>`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'Candidate';
}

function normalizeWhitespace(text: string): string {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function truncateWithHeadTail(text: string, maxChars: number, headRatio = TRUNCATION_HEAD_RATIO): string {
  const source = String(text || '');
  if (maxChars <= 0 || source.length <= maxChars) return source;

  const marker = '\n\n[... content omitted for length ...]\n\n';
  if (maxChars <= marker.length + 2) {
    return source.slice(0, maxChars);
  }

  let headLen = Math.floor(maxChars * headRatio);
  let tailLen = maxChars - headLen - marker.length;

  if (headLen < 200) {
    headLen = 200;
    tailLen = maxChars - headLen - marker.length;
  }
  if (tailLen < 200) {
    tailLen = 200;
    headLen = maxChars - tailLen - marker.length;
  }

  if (headLen <= 0 || tailLen <= 0) {
    return source.slice(0, maxChars);
  }

  return `${source.slice(0, headLen)}${marker}${source.slice(-tailLen)}`;
}

function alphaRatio(text: string): number {
  const compact = String(text || '').replace(/\s+/g, '');
  if (!compact.length) return 0;
  const letters = (compact.match(/[A-Za-z]/g) || []).length;
  return letters / compact.length;
}

function isLikelyUnusableExtract(text: string): boolean {
  const normalized = normalizeWhitespace(text);
  if (normalized.length < MIN_USABLE_TEXT_LEN) return true;
  return alphaRatio(normalized) < MIN_ALPHA_RATIO;
}

function decodeModelText(response: any): string {
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const raw = String(responseBody?.output?.message?.content?.[0]?.text || '');
  return raw
    .replace(/^[\s]*```json\s*/i, '')
    .replace(/^[\s]*```\s*/i, '')
    .replace(/\s*```[\s]*$/i, '')
    .trim();
}

function buildJsonRepairPrompt(rawOutput: string): string {
  return `Rewrite the following output into valid JSON only.

Required schema:
{
  "score": <number 0-100>,
  "label": "Strong Fit" | "Moderate Fit" | "Needs Review" | "Low Fit",
  "summary": "<2 sentence recruiter-facing summary>",
  "strengths": ["<string>", "<string>", "<string>"],
  "gaps": ["<string>", "<string>"]
}

Rules:
- Output JSON only.
- No markdown fences.
- strengths must contain exactly 3 items.
- gaps can contain 0 to 3 items.

Raw output:
${rawOutput}`;
}

function isGenericStrength(strength: string): boolean {
  const text = String(strength || '').trim().toLowerCase();
  if (text.length < 18) return true;

  const genericPhrases = [
    'good communication',
    'team player',
    'hard working',
    'quick learner',
    'adaptable',
    'problem solving',
    'strong background',
    'relevant experience',
  ];

  return genericPhrases.some((phrase) => text.includes(phrase));
}

function hasEnoughEvidenceForHighScore(strengths: string[]): boolean {
  const concrete = strengths.filter((s) => !isGenericStrength(s));
  return concrete.length >= 2;
}

function parseAndValidateScoring(text: string): { ok: boolean; parsed?: any; errors?: string[] } {
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['Invalid JSON'] };
  }

  const errors: string[] = [];
  const score = Number(parsed?.score);
  const summary = String(parsed?.summary || '').trim();
  if (!Number.isFinite(score)) errors.push('score must be numeric');
  if (!summary) errors.push('summary is required');

  const strengths = Array.isArray(parsed?.strengths)
    ? parsed.strengths.map((x: any) => String(x).trim()).filter(Boolean)
    : [];
  const gaps = Array.isArray(parsed?.gaps)
    ? parsed.gaps.map((x: any) => String(x).trim()).filter(Boolean)
    : [];

  if (strengths.length === 0) errors.push('strengths should include at least one item');

  const normalized = {
    score: clampScore(score),
    summary,
    strengths: strengths.slice(0, 3),
    gaps: gaps.slice(0, 3),
  };

  return errors.length ? { ok: false, errors } : { ok: true, parsed: normalized };
}

function extractDriveFileId(urlValue: string): string | null {
  try {
    const parsed = new URL(urlValue.trim());
    if (!parsed.hostname.toLowerCase().includes('drive.google.com')) return null;

    const qId = parsed.searchParams.get('id');
    if (qId) return qId;

    const parts = parsed.pathname.split('/').filter(Boolean);
    const idx = parts.findIndex((p) => p === 'd');
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];

    return null;
  } catch {
    return null;
  }
}

function toDriveDownloadUrl(inputUrl: string): string {
  const id = extractDriveFileId(inputUrl);
  if (!id) return inputUrl;
  return `https://drive.google.com/uc?export=download&id=${id}`;
}

function inferExtension(fileName: string, contentType: string): 'pdf' | 'txt' | 'docx' | 'unknown' {
  const lower = String(fileName || '').toLowerCase();
  if (lower.endsWith('.pdf') || contentType.includes('pdf')) return 'pdf';
  if (lower.endsWith('.txt') || contentType.includes('text/plain')) return 'txt';
  if (
    lower.endsWith('.docx') ||
    contentType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  ) {
    return 'docx';
  }
  return 'unknown';
}

async function parsePdfBuffer(buffer: Buffer): Promise<string> {
  try {
    const pdfParseMod: any = await import('pdf-parse');
    const pdfParse = pdfParseMod.default || pdfParseMod;
    const parsed = await pdfParse(buffer);
    return String(parsed?.text || '').trim();
  } catch {
    return '';
  }
}

async function extractTextFromBuffer(params: {
  buffer: Buffer;
  extension: 'pdf' | 'txt' | 'docx' | 'unknown';
}): Promise<ExtractedTextResult> {
  const { buffer, extension } = params;

  if (extension === 'txt') {
    return { text: buffer.toString('utf-8').trim(), method: 'txt' };
  }

  if (extension === 'docx') {
    const result = await mammoth.extractRawText({ buffer });
    return { text: String(result?.value || '').trim(), method: 'docx' };
  }

  if (extension === 'pdf') {
    const text = await parsePdfBuffer(buffer);
    if (text) return { text, method: 'pdf-parse' };
    return {
      text: buffer.toString('utf-8').replace(/\s+/g, ' ').trim(),
      method: 'pdf-utf8-fallback',
    };
  }

  return {
    text: buffer.toString('utf-8').replace(/\s+/g, ' ').trim(),
    method: 'unknown-utf8-fallback',
  };
}

async function fetchResumeTextFromDrive(driveLink: string): Promise<ExtractedTextResult> {
  const downloadUrl = toDriveDownloadUrl(driveLink);
  const response = await fetch(downloadUrl);

  if (!response.ok) {
    throw new Error(`Failed to download resume from Google Drive (${response.status})`);
  }

  const arr = await response.arrayBuffer();
  const buffer = Buffer.from(arr);
  if (buffer.length === 0) throw new Error('Resume file is empty');

  const contentDisposition = response.headers.get('content-disposition') || '';
  const fileNameMatch = contentDisposition.match(/filename\*?=(?:UTF-8''|\")?([^\";]+)/i);
  const fileName = decodeURIComponent(fileNameMatch?.[1] || 'resume');
  const contentType = response.headers.get('content-type') || '';
  const extension = inferExtension(fileName, contentType);

  return extractTextFromBuffer({ buffer, extension });
}

async function fetchJdTextFromS3(jdS3Key: string): Promise<ExtractedTextResult> {
  const bucketName =
    process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME ||
    process.env.AWS_S3_BUCKET_NAME ||
    process.env.S3_BUCKET_NAME;

  if (!bucketName) {
    throw new Error('S3 bucket name not configured');
  }

  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: jdS3Key,
    }),
  );

  const bytes = await response.Body?.transformToByteArray();
  const buffer = Buffer.from(bytes || []);
  if (buffer.length === 0) throw new Error('JD file is empty or inaccessible');

  const extension = inferExtension(jdS3Key, String(response.ContentType || ''));
  return extractTextFromBuffer({ buffer, extension });
}

function buildPrompt(params: { candidateName: string; resumeText: string; jdText: string }) {
  const { candidateName, resumeText, jdText } = params;
  return `
You are an AI recruitment screening assistant for a company's interview shortlisting workflow. Evaluate how well the candidate resume matches the Job Description for interview eligibility.

Step 1 — Silent analysis (do not output this):
Extract required skills/tools from JD. For each, check if the resume shows: exact match, equivalent tool, or no evidence. Note years of experience required vs. actual. Flag any mandatory requirements the candidate clearly lacks.

Step 2 — Score using these dimensions (0–100 total):

[35pts] Core skills & tools: Exact match = full credit | Equivalent tool = 70% | Mentioned only = 30%
[30pts] Must-have JD requirements: Deduct proportionally for each unmet hard requirement. Award very small points if candidate aligns with good-to-have skills/experiences.
If 2 or more mandatory requirements are clearly missing, score should be below 50.

[20pts] Project/experience alignment: Domain relevance of past roles/education/academic projects; weight last 3 years more heavily.

[15pts] Role readiness: Experience years vs. JD ask; career trajectory toward this role.

Calibration: Be conservative. 75+ = confident shortlist. Treat missing context as missing skill.
Do not anchor around 55 or 65. If evidence is weak, score lower (<50). If evidence strongly satisfies mandatory requirements, score higher (75+).

Calibration examples:
- Missing 2+ mandatory skills with no equivalent tools: 25-45
- Meets some requirements but misses key hard requirements: 45-59
- Meets most mandatory requirements with evidence: 60-74
- Meets mandatory requirements with strong recent domain evidence: 75-89
- Exceeds requirements with clear, specific impact evidence: 90-100

Label mapping:
  80–100 → "Strong Fit"
  60–79  → "Moderate Fit"
  40–59  → "Needs Review"
  0–39   → "Low Fit"

Return ONLY valid JSON in this exact schema. Do not include markdown fences or extra commentary:
{
  "score": <number 0–100>,
  "label": "Strong Fit" | "Moderate Fit" | "Needs Review" | "Low Fit",
  "summary": "<2 sentence recruiter-facing summary>",
  "strengths": ["<specific JD-matched resume fact>", ...],  // exactly 3
  "gaps": ["<specific missing JD requirement>", ...]        // up to 3
}

Candidate Name: ${candidateName}

JD_CONTEXT:
${jdText}

RESUME_CONTEXT:
${resumeText}
`;
}

export async function POST(req: NextRequest) {
  const start = Date.now();

  try {
    const body = await req.json();
    const candidateName = sanitizeCandidateName(String(body?.candidateName || 'Candidate'));
    const resumeDriveLink = String(body?.resumeDriveLink || '').trim();
    const jdS3Key = String(body?.jdS3Key || '').trim();

    if (!resumeDriveLink) {
      return NextResponse.json({ error: 'resumeDriveLink is required' }, { status: 400 });
    }

    if (!jdS3Key) {
      return NextResponse.json({ error: 'jdS3Key is required' }, { status: 400 });
    }

    const [resumeExtract, jdExtract] = await Promise.all([
      fetchResumeTextFromDrive(resumeDriveLink),
      fetchJdTextFromS3(jdS3Key),
    ]);

    const resumeNormalized = normalizeWhitespace(resumeExtract.text);
    const jdNormalized = normalizeWhitespace(jdExtract.text);

    if (resumeExtract.method === 'pdf-utf8-fallback' && isLikelyUnusableExtract(resumeNormalized)) {
      return NextResponse.json(
        { error: 'Could not reliably parse resume PDF content. Please upload a text-based PDF, DOCX, or TXT file.' },
        { status: 422 },
      );
    }
    if (jdExtract.method === 'pdf-utf8-fallback' && isLikelyUnusableExtract(jdNormalized)) {
      return NextResponse.json(
        { error: 'Could not reliably parse JD PDF content. Please upload a text-based PDF, DOCX, or TXT file.' },
        { status: 422 },
      );
    }

    const resumeText = truncateWithHeadTail(resumeNormalized, MAX_TEXT_CHARS);
    const jdText = truncateWithHeadTail(jdNormalized, MAX_TEXT_CHARS);

    if (!resumeText.trim()) {
      return NextResponse.json({ error: 'Could not parse resume content' }, { status: 422 });
    }

    if (!jdText.trim()) {
      return NextResponse.json({ error: 'Could not parse JD content' }, { status: 422 });
    }

    const payload = {
      schemaVersion: 'messages-v1',
      messages: [
        {
          role: 'user',
          content: [{ text: buildPrompt({ candidateName, resumeText, jdText }) }],
        },
      ],
      inferenceConfig: {
        maxTokens: 1200,
        temperature: SCORING_TEMP,
      },
    };

    let modelIdUsed = MODEL_ID;
    const { response: firstResponse, modelId } = await invokeScoringModel(payload);
    modelIdUsed = modelId;
    let modelText = decodeModelText(firstResponse);
    let retryUsed = false;

    let validation = parseAndValidateScoring(modelText);
    if (!validation.ok && JSON_RETRY_LIMIT > 0) {
      retryUsed = true;
      const repairPayload = {
        schemaVersion: 'messages-v1',
        messages: [
          {
            role: 'user',
            content: [{ text: buildJsonRepairPrompt(modelText) }],
          },
        ],
        inferenceConfig: {
          maxTokens: 700,
          temperature: 0,
        },
      };

      const { response: repairResponse } = await invokeScoringModel(repairPayload);
      modelText = decodeModelText(repairResponse);
      validation = parseAndValidateScoring(modelText);
    }

    let fallbackUsed = false;
    const parsed = validation.ok
      ? validation.parsed
      : {
        score: 0,
        summary: 'Model response was not parseable. Please review manually.',
        strengths: [],
        gaps: ['Scoring parse failure'],
      };

    if (!validation.ok) {
      fallbackUsed = true;
      logScoreEvent('parse_fallback', {
        errors: validation.errors,
        retryUsed,
      });
    }

    const score = clampScore(parsed.score);
    let adjustedScore = score;
    const summary = String(parsed.summary || 'Screening completed.');
    const strengths = Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 3).map((x: any) => String(x)) : [];
    const gaps = Array.isArray(parsed.gaps) ? parsed.gaps.slice(0, 3).map((x: any) => String(x)) : [];

    let evidenceGateApplied = false;
    if (STRICT_EVIDENCE_GATE && adjustedScore >= 70 && !hasEnoughEvidenceForHighScore(strengths)) {
      adjustedScore = 69;
      evidenceGateApplied = true;
    }

    const label = deriveLabel(adjustedScore);
    const scoreBand = deriveScoreBand(adjustedScore);
    const scoreSource = fallbackUsed ? 'fallback' : 'model-json';

    logScoreEvent('completed', {
      modelId: modelIdUsed,
      resumeMethod: resumeExtract.method,
      jdMethod: jdExtract.method,
      resumeLengthRaw: resumeExtract.text.length,
      jdLengthRaw: jdExtract.text.length,
      resumeLengthNormalized: resumeNormalized.length,
      jdLengthNormalized: jdNormalized.length,
      resumeLengthFinal: resumeText.length,
      jdLengthFinal: jdText.length,
      retryUsed,
      fallbackUsed,
      scoreSource,
      scoreBand,
      scoringTemp: SCORING_TEMP,
      evidenceGateApplied,
      durationMs: Date.now() - start,
      score: adjustedScore,
    });

    return NextResponse.json({
      score: adjustedScore,
      label,
      summary,
      strengths,
      gaps,
      diagnostics: {
        modelId: modelIdUsed,
        retryUsed,
        fallbackUsed,
        scoreSource,
        scoreBand,
        evidenceGateApplied,
      },
    });
  } catch (err: any) {
    console.error('Score Candidate Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to score candidate' }, { status: 500 });
  }
}

