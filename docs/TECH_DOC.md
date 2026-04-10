# AI Interviewer - Technical Documentation

The AI Interviewer is a modern web application designed to conduct fully automated, conversational technical interviews using AWS Bedrock AI, integrated with real-time speech processing and video recording.

---

## 🛠 Tech Stack

### Frontend
- **Framework:** Next.js 16.2.1 (App Router)
- **Library:** React 19.2.4
- **Language:** TypeScript 5 (strict mode)
- **Styling:** Tailwind CSS 4.0 (for premium, dynamic UI)
- **Icons:** Lucide React
- **Fonts:** Geist Sans + Geist Mono (Google Fonts)

### Backend & AI
- **Runtime:** Next.js API Routes (Serverless)
- **AI Model:** AWS Bedrock (`amazon.nova-lite-v1:0` default, configurable)
- **SDK:** `@aws-sdk/client-bedrock-runtime`
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth (with hardcoded MVP fallback)
- **Storage:** Supabase Storage (Videos - public `videos` bucket)
- **Email:** Nodemailer (SMTP-based, Gmail default)
- **Excel Parsing:** SheetJS (`xlsx`)

---

## Speech Systems

The project uses native browser APIs for speech to ensure low latency and zero additional costs.

### 1. Speech-to-Text (STT) - How it Works
**API:** Web Speech API (`window.SpeechRecognition`)

**Implementation Details:**
- **Continuous Listening:** The engine is set to `continuous = true`, allowing the candidate to speak long-form answers without the microphone cutting off.
- **Interim Results:** `interimResults = true` provides immediate visual feedback in the UI as the candidate speaks.
- **Language:** Configured to `en-US` for English recognition.
- **Transcript Lifecycle:**
    1. Candidate clicks "Start Interview" or the AI finishes speaking.
    2. Microphone activates; the system listens for audio.
    3. `onresult` event fires, processing both `interim` (temporary) and `final` (confirmed) transcripts.
    4. The UI displays the live transcript in real-time.
    5. Upon "Submit Answer", the finalized text is sent to the AWS Bedrock API for processing.
- **Error Handling:** Graceful handling of `no-speech`, `audio-capture`, and `not-allowed` errors.

### 2. Text-to-Speech (TTS) - How it Works
**API:** Web Speech Synthesis (`window.speechSynthesis`)

**Implementation Details:**
- **Voice Selection:** Users can select from available system voices (browser/OS dependent).
- **Natural Pacing:** The system uses a slightly slower rate (`0.9`) to ensure clear professional articulation.
- **Sentence-Level Control:** AI responses are split into sentences for granular rate/pitch tuning.
- **Sequential Flow:** The application uses Promises to ensure the AI finishes speaking before the microphone reactivates, preventing the system from "hearing itself."
- **Cleanup:** Special markers like `[INTERVIEW_ENDED]` are stripped from the text before being passed to the synthesis engine to maintain immersion.
- **Pitch Tuning:** Adjustable per-sentence for more natural intonation.

---

## Core Workflows

### AI Interviewer API (`/api/interviewer`)
The interviewer operates as a **stateless agent**. The entire conversation history and current step (Greeting, Introduction, Question Index) are passed back and forth between the client and the AWS Bedrock API in a `state` object.

**AI Model:** `amazon.nova-lite-v1:0` (configurable via `MODEL_NAME` env var)

**SDK:** `@aws-sdk/client-bedrock-runtime` with `InvokeModelCommand`

**Follow-up Logic:** If a candidate's answer is "partial" or "wrong," the AI is instructed to ask exactly one probing follow-up before moving to the next core question.

**Guardrails:**
- Input sanitization before sending to Bedrock
- Prompt injection detection
- Output markdown code fence stripping (``` removal)
- System artifact removal (AI thinking tags)
- JSON parse fallback heuristics (regex extraction if parse fails)

### Evaluation System (`/api/evaluate`)
Once the interview concludes, the entire transcript is sent to a specialized evaluation prompt.

**Dimensions:** Scores are generated for:
    1. Communication Clarity (0-25)
    2. Relevance & Depth (0-25)
    3. Problem-Solving & Critical Thinking (0-25)
    4. Specificity & Examples (0-25)

**Final Result:** A consolidated report is saved to Supabase, including:
- Overall score (0-100, sum of all dimensions)
- Detailed breakdown per dimension
- Qualitative feedback summary
- Public URL to the session recording

### Video Recording
Uses the `MediaRecorder` API to capture the `MediaStream` from the camera and microphone. Chunks are collected and bundled into a `.webm` file, which is then uploaded to the Supabase `videos` bucket (public) at the end of the session.

**Flow:**
1. `navigator.mediaDevices.getUserMedia()` captures camera + mic
2. `MediaRecorder` starts recording with `mimeType: 'video/webm'`
3. `ondataavailable` collects chunks into array
4. On interview end: `Blob(chunks, { type: 'video/webm' })` creates final file
5. Uploaded to Supabase Storage via `supabase.storage.from('videos').upload()`
6. Public URL obtained and saved to `results` table

### Email System
Uses Nodemailer for SMTP-based email delivery with:
- HTML email templating with variable replacement
- Retry logic (3 attempts with exponential backoff)
- Per-recipient status tracking
- Template variables: `{{candidateName}}`, `{{candidateEmail}}`, `{{passkey}}`, `{{loginLink}}`, `{{interviewTitle}}`
