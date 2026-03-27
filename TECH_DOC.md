# AI Interviewer - Technical Documentation

## 🚀 Overview
The AI Interviewer is a modern web application designed to conduct fully automated, conversational technical interviews using Google Gemini AI, integrated with real-time speech processing and video recording.

---

## 🛠 Tech Stack

### Frontend
- **Framework:** Next.js 16.2.1 (App Router)
- **Library:** React 19.2.4
- **Styling:** Tailwind CSS 4.0 (for premium, dynamic UI)
- **Icons:** Lucide React
- **Client-Side Storage:** LocalStorage (for session persistence) and SessionStorage (for state tracking).

### Backend & AI
- **Runtime:** Next.js API Routes (Edge-ready)
- **AI Model:** Google Gemini 2.0 Flash (`gemini-2.0-flash`)
- **SDK:** `@google/genai`
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage (Videos)

---

## 🎙 Speech Systems

The project uses native browser APIs for speech to ensure low latency and zero additional costs.

### 1. Speech-to-Text (STT) - How it Works
**API:** Web Speech API (`window.SpeechRecognition`)

**Implementation Details:**
- **Continuous Listening:** The engine is set to `continuous = true`, allowing the candidate to speak long-form answers without the microphone cutting off.
- **Interim Results:** `interimResults = true` provides immediate visual feedback in the UI as the candidate speaks.
- **Transcript Lifecycle:**
    1. Candidate clicks "Start Interview" or the AI finishes speaking.
    2. Microphone activates; the system listens for audio.
    3. `onresult` event fires, processing both `interim` (temporary) and `final` (confirmed) transcripts.
    4. The UI displays the live transcript in real-time.
    5. Upon "Submit", the finalized text is sent to the Gemini API for evaluation.

### 2. Text-to-Speech (TTS) - How it Works
**API:** Web Speech Synthesis (`window.speechSynthesis`)

**Implementation Details:**
- **Utterance Generation:** Every response from Gemini is wrapped in a `SpeechSynthesisUtterance`.
- **Natural Pacing:** The system uses a slightly slower rate (`0.9`) to ensure clear professional articulation.
- **Sequential Flow:** The application uses Promises to ensure the AI finishes speaking before the microphone reactivates, preventing the system from "hearing itself."
- **Cleanup:** Special markers like `[INTERVIEW_ENDED]` are stripped from the text before being passed to the synthesis engine to maintain immersion.

---

## 🧠 Core Workflows

### AI Interviewer API (`/api/interviewer`)
The interviewer operates as a **stateless agent**. The entire conversation history and current step (Greeting, Introduction, Question Index) are passed back and forth between the client and the Gemini API in a `state` object.
- **Follow-up Logic:** If a candidate's answer is "partial" or "wrong," the AI is instructed to ask exactly one probing follow-up before moving to the next core question.

### Evaluation System (`/api/evaluate`)
Once the interview concludes, the entire transcript is sent to a specialized evaluation prompt.
- **Dimensions:** Scores are generated for:
    1. Communication Clarity (0-25)
    2. Relevance & Depth (0-25)
    3. Problem-Solving & Critical Thinking (0-25)
    4. Specificity & Examples (0-25)
- **Final Result:** A consolidated report is saved to Supabase, including a public URL to the session recording.

### Video Recording
Uses the `MediaRecorder` API to capture the `MediaStream` from the camera and microphone. Chunks are collected and bundled into a `.webm` file, which is then uploaded to the Supabase `videos` bucket at the end of the session.
