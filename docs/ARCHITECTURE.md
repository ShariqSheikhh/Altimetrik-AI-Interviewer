# Architecture

System architecture and data flow for the AI Interviewer Platform.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT (Browser)                           │
│                                                                     │
│  ┌───────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  Admin Portal │  │ Candidate UI │  │   Landing Page (Public)  │  │
│  │  (React SPA)  │  │ (React SPA)  │  │                          │  │
│  └───────┬───────┘  └───────┬──────┘  └──────────────────────────┘  │
│          │                  │                                       │
│          │   ┌──────────────┴──────────────┐                        │
│          │   │    Browser Web APIs         │                        │
│          │   │  • SpeechRecognition (STT)  │                        │
│          │   │  • SpeechSynthesis (TTS)    │                        │
│          │   │  • MediaRecorder (Video)    │                        │
│          │   │  • AudioContext (Mic Check) │                        │
│          │   └─────────────────────────────┘                        │
└──────────┼──────────────────┬───────────────────────────────────────┘
           │                  │
           ▼                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        NEXT.JS APP SERVER                            │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                    App Router (Pages)                        │    │
│  │  /admin/*  |  /candidate/*  |  /  |  /api/*                  │    │
│  └──────────────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                     API Routes                               │    │
│  │                                                              │    │
│  │  /api/interviewer   →  AWS Bedrock (AI Agent)                │    │
│  │  /api/evaluate      →  AWS Bedrock (Evaluation Engine)       │    │
│  │  /api/send-invites  →  Nodemailer (SMTP Email)               │    │
│  │  /api/support-email →  Returns support email config          │    │
│  └──────────────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                  Server-Side Libraries                       │    │
│  │  • Supabase Client (Database + Storage)                      │    │
│  │  • AWS Bedrock Runtime (@aws-sdk/client-bedrock-runtime)     │    │
│  │  • Nodemailer (Email Transport)                              │    │
│  │  • SheetJS/xlsx (Excel Parsing)                              │    │
│  └──────────────────────────────────────────────────────────────┘    │
└──────────┬──────────────────────────────┬────────────────────────────┘
           │                              │
           ▼                              ▼
┌─────────────────────┐      ┌─────────────────────────┐
│    AWS Bedrock      │      │      Supabase Cloud     │
│                     │      │                         │
│  amazon.nova-lite   │      │  • PostgreSQL Database  │
│  -v1:0              │      │  • Auth (Admin Login)   │
│                     │      │  • Storage (Videos)     │
│  AI Interviewer     │      │                         │
│  Evaluation Engine  │      │  Tables:                │
│                     │      │  • interviews           │
└─────────────────────┘      │  • candidates           │
                             │  • results              │
                             └─────────────────────────┘
```

## Component Architecture

### Frontend Components

#### Admin Portal (`/admin/*`)
```
Admin Portal
├── Login Page
│   └── Supabase Auth
│
├── Dashboard
│   ├── Interview Cards (Question Count, Candidate Count)
│   └── Recent Evaluations Table (Green/Red Score Badges)
│
├── Create Interview
│   ├── Interview Title Form
│   ├── Question Bank Builder (Manual + Excel Upload)
│   └── Candidate Excel Upload (Auto Passkey Generation)
│
├── Interview Status
│   ├── Completion Stats (Progress Bar, Counts)
│   ├── Candidate Table (Filterable by Status)
│   └── Result Links
│
├── Send Email
│   ├── HTML Email Composer
│   ├── Template Variable System
│   ├── Live Iframe Preview
│   └── Bulk Send Button
│
├── Email Progress
│   ├── Sent/Failed Counts
│   ├── Success Rate
│   └── Per-Recipient Delivery Status
│
└── Results Detail
    ├── Video Player (.webm playback)
    ├── Q&A Transcript Display
    ├── AI Overall Score (0-100)
    └── Four-Dimension Breakdown (0-25 each)
```

#### Candidate Flow (`/candidate/*`)
```
Candidate Flow
├── Login Page
│   └── Email + Passkey Auth (Supabase candidates table)
│
├── Setup Page
│   ├── Full Name Input
│   ├── Camera Preview (getUserMedia)
│   ├── Microphone Check (AudioContext + AnalyserNode)
│   │   └── Real-time Audio Level Visualization
│   └── Fullscreen Enforcement
│
└── Interview Room
    ├── Video Recording (MediaRecorder → .webm)
    ├── AI Speech Output (SpeechSynthesis)
    │   ├── Voice Preference Selection
    │   └── Per-Sentence Rate/Pitch Tuning
    ├── Candidate Speech Input (SpeechRecognition)
    │   ├── Continuous Mode (continuous=true)
    │   └── Interim Results (interimResults=true)
    ├── Live Transcript Panel
    │   ├── AI Messages
    │   ├── Candidate Messages
    │   └── Real-time Updates
    ├── Sequential Conversation Flow
    │   └── AI Speaks → Mic Activates → Candidate Answers → Submit
    └── End Flow
        ├── Video Upload to Supabase Storage
        └── Evaluation Save to Supabase DB
```

### Backend Services

#### AI Interviewer (`/api/interviewer`)
```
Request: { questionBank, conversationHistory, currentStep, candidateAnswer }
                  │
                  ▼
┌──────────────────────────────────────────┐
│  AWS Bedrock Client                      │
│  Model: amazon.nova-lite-v1:0            │
│                                          │
│  System Prompt:                          │
│  • Act as technical interviewer          │
│  • Follow question bank                  │
│  • Ask follow-ups for partial/wrong      │
│  • Return structured JSON:               │
│    {                                     │
│      response: string,                   │
│      next_question: string|null,         │
│      is_completed: boolean,              │
│      current_step: string                │
│    }                                     │
│                                          │
│  Guardrails:                             │
│  • Input sanitization                    │
│  • Prompt injection detection            │
│  • Output markdown stripping             │
│  • JSON parse fallback heuristics        │
└──────────────────────────────────────────┘
                  │
                  ▼
Response: { response, nextQuestion, isCompleted, currentStep }
```

#### Evaluation Engine (`/api/evaluate`)
```
Request: { transcript: Array<{speaker, text}>, questionBank }
                  │
                  ▼
┌──────────────────────────────────────────┐
│  AWS Bedrock Client                      │
│  Model: amazon.nova-lite-v1:0            │
│                                          │
│  Evaluation Prompt:                      │
│  • Score on 4 dimensions (0-25 each):    │
│    1. Communication Clarity              │
│    2. Relevance & Depth                  │
│    3. Problem-Solving & Critical Think.  │
│    4. Specificity & Examples             │
│  • Calculate overall score (0-100)       │
│  • Provide detailed feedback             │
│                                          │
│  Output: JSON with scores + feedback     │
└──────────────────────────────────────────┘
                  │
                  ▼
Save to Supabase: { candidateId, interviewId, evaluation, videoUrl, transcriptData }
```

#### Email System (`/api/send-invites`)
```
Request: { candidates: [{email, name, passkey}], interviewTitle, emailTemplate }
                  │
                  ▼
┌──────────────────────────────────────────┐
│  Nodemailer Transport                    │
│  SMTP Config (Gmail default)             │
│                                          │
│  Template Variables:                     │
│  • {{candidateName}}                     │
│  • {{candidateEmail}}                    │
│  • {{passkey}}                           │
│  • {{loginLink}}                         │
│  • {{interviewTitle}}                    │
│                                          │
│  Retry Logic: 3 attempts, exponential    │
│  backoff                                 │
└──────────────────────────────────────────┘
                  │
                  ▼
Response: { sent: number, failed: number, results: [{email, status}] }
```

## Data Flow

### Interview Creation Flow (Admin)
```
Admin fills Create Interview form
    │
    ├─► Questions added (manual or Excel upload)
    │   └─► Parsed via SheetJS → JSONB array
    │
    ├─► Candidate Excel uploaded
    │   └─► Parsed → Passkeys auto-generated → Inserted into Supabase
    │
    ▼
Interview saved to Supabase `interviews` table
    │
    └─► Redirects to Send Email page
```

### Candidate Interview Flow
```
1. Login
   Email + Passkey → Supabase `candidates` table validation
     │
     ▼
2. Setup
   Confirm name → Camera/Mic check → Fullscreen enforced
     │
     ▼
3. Interview Loop
   ┌─────────────────────────────────────┐
   │ AI speaks question (TTS)            │
   │   ↓                                 │
   │ Mic activates (STT listening)       │
   │   ↓                                 │
   │ Candidate answers (spoken)          │
   │   ↓                                 │
   │ Candidate clicks "Submit Answer"    │
   │   ↓                                 │
   │ Answer sent to /api/interviewer     │
   │   ↓                                 │
   │ AI processes and responds           │
   │   ↓                                 │
   │ If is_completed → End Interview     │
   │ Else → Repeat loop                  │
   └─────────────────────────────────────┘
     │
     ▼
4. End Interview
   Video blob created (.webm)
   │
   ├─► Uploaded to Supabase Storage (`videos` bucket)
   │   └─► Public URL obtained
   │
   ├─► Transcript saved
   │
   └─► /api/evaluate called
       └─► Scores generated → Saved to Supabase `results` table
```

### Email Invitation Flow
```
Admin composes email with template
    │
    ├─► Live iframe preview rendered
    │
    └─► "Send All" clicked
        │
        ▼
    POST /api/send-invites
        │
        ├─► For each candidate:
        │   ├─► Template variables replaced
        │   ├─► Email sent via SMTP (3 retries)
        │   └─► Status recorded (sent/failed)
        │
        ▼
    Response with summary stats
        │
        └─► Email progress page updated
```

## State Management

### Client-Side State
- **Interview Room:** React `useState` + `useRef` for:
  - Conversation history
  - Current AI message
  - Transcript array
  - Recording state (MediaRecorder instance)
  - Mic/stream references
  - Step tracking (greeting, intro, questions, complete)

- **Admin Pages:** React `useState` for form data, loading states, fetched data

### Server-Side State
- **Supabase:** Persistent data (interviews, candidates, results)
- **AWS Bedrock:** Stateless API calls (no server-side session)
- **API Routes:** Request/response only (no persistent connections)

## Security Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Authentication Layers                                       │
│                                                              │
│  Admin: Supabase Auth → JWT Token → Protected Routes         │
│  Candidate: Email + Passkey → Supabase `candidates` lookup   │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  Data Protection                                             │
│                                                              │
│  • Environment variables for all secrets (.env.local)        │
│  • Supabase RLS policies (permissive for MVP)                │
│  • Input sanitization on API endpoints                       │
│  • Passkeys auto-generated (not user-chosen, harder to guess)│
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  AI Guardrails                                               │
│                                                              │
│  • Prompt injection detection                                │
│  • Input sanitization before sending to Bedrock              │
│  • Output markdown code fence stripping                      │
│  • System artifact removal (e.g., "AI thinking" tags)        │
│  • JSON parse fallback (regex extraction if parse fails)     │
└──────────────────────────────────────────────────────────────┘
```

## Speech System Architecture

### Sequential Flow Design

The key challenge: **Prevent the AI from "hearing itself"** when TTS plays back.

```
Solution: Strictly Sequential
─────────────────────────────

1. AI Response Generated
   └─► speechSynthesis.speak(utterance)
       └─► onend event fires
           └─► Mic activated (recognition.start())
               └─► Candidate speaks
                   └─► "Submit Answer" clicked
                       └─► Mic stopped (recognition.stop())
                           └─► Answer sent to API
                               └─► Repeat from step 1
```

### Speech-to-Text Pipeline
```
Microphone Input
    │
    ▼
SpeechRecognition (Web Speech API)
    │  configuration:
    │  • continuous = true (don't auto-stop)
    │  • interimResults = true (real-time feedback)
    │  • lang = "en-US"
    │
    ├─► onresult event
    │   ├─► interim transcript → UI display only
    │   └─► final transcript → Stored in state
    │
    └─► onerror event → Handled (no crash, user notified)
```

### Text-to-Speech Pipeline
```
AI Response Text
    │
    ├─► Clean special markers ([INTERVIEW_ENDED], etc.)
    │
    ├─► Split into sentences (for granular control)
    │
    ├─► For each sentence:
    │   ├─► Create SpeechSynthesisUtterance
    │   ├─► Set rate (0.9 for clarity)
    │   ├─► Set pitch (configurable)
    │   ├─► Select preferred voice
    │   └─► Queue (speechSynthesis.speak())
    │
    └─► onend of last utterance → Resolve promise → Activate mic
```

This architecture prioritizes **zero-cost speech processing** (browser-native APIs), **stateless AI interactions** (no server-side session management), and **clear separation of concerns** (admin vs. candidate flows).
