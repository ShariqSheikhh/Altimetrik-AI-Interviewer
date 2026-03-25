# AI-Interviewer

A full-stack, AI-powered automated interview platform featuring live voice-to-text transcription, real-time Gemini candidate evaluation, and an admin portal for secure credential management.

## 🌟 Features

- **Automated AI Interviewer**: Leverages Google Gemini 2.5 to dynamically ask questions, naturally acknowledge answers, and evaluate candidates based on established guardrails.
- **Admin Dashboard**: Create tests, define customized question banks, and instantly parse allowed candidates using Excel spreadsheets.
- **AI Document Extraction**: Upload Job Descriptions or external question sets (PDF/TXT/DOCX) to instantly generate targeted interview questions inside the admin portal.
- **Secure Video Playback**: Fully authentic candidate video recordings are uploaded natively to Supabase Storage for offline recruiter review alongside transcripts.
- **Live Transcription**: Character-by-character real-time audio transcription powered securely by your browser's Web Speech API.

## 🛠 Tech Stack

- **Frontend**: Next.js 15 (App Router), React, Tailwind CSS
- **Backend / Routing**: Next.js Serverless API Routes
- **Database & Identity**: Supabase (Auth, Postgres DB, Storage Buckets)
- **AI Integration**: Google Gemini SDK (`@google/genai`)
- **Icons & UI**: Lucide React

## 🚀 Getting Started

1. **Clone the repo**
   ```bash
   git clone https://github.com/ShariqSheikhh/Altimetrik-AI-Interviewer.git
   ```
2. **Install dependencies**
   ```bash
   npm install
   ```
3. **Environment Setup**
   Create a `.env.local` file in the root with your API keys:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   GEMINI_API_KEY=your_gemini_api_key
   GEMINI_MODEL=gemini-2.5-flash
   ```
4. **Database Initialization**
   Paste and run the queries found inside `supabase_setup.sql` in your Supabase SQL Editor. This will generate your `interviews`, `candidates`, and `results` tables, as well as spin up a public `videos` storage bucket.
5. **Run the local development server**
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) with your browser to experience the platform.
