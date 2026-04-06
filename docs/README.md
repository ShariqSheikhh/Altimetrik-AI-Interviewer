# AI Interviewer Platform

> A full-stack, AI-powered automated interview system that conducts technical interviews, evaluates candidates in real-time, and generates comprehensive scoring reports.

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black)](https://nextjs.org/) [![React](https://img.shields.io/badge/React-19.2-blue)](https://react.dev/) [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/) [![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38bdf8)](https://tailwindcss.com/)

## Overview

The AI Interviewer Platform automates the technical interview process by combining:
- **AI-driven questioning** using AWS Bedrock (Amazon Nova Lite)
- **Real-time speech processing** via browser-native Web Speech API (zero-cost STT/TTS)
- **Video recording** of interview sessions for later review
- **Automated evaluation** with multi-dimensional scoring
- **Admin dashboard** for interview management and candidate tracking
- **Email invitations** with customizable HTML templates

Built for recruiters and hiring teams to streamline technical assessments at scale.

## Key Features

### For Recruiters/Admins
- **Interview Creation** — Define interviews with custom question banks (manual entry or Excel upload)
- **Candidate Management** — Bulk upload candidates via Excel with auto-generated passkeys
- **Email Invitations** — Compose and send personalized invitations with HTML email templates
- **Real-time Tracking** — Monitor candidate progress, completion status, and email delivery
- **Detailed Results** — Review video recordings, full transcripts, and AI-generated scores

### For Candidates
- **Seamless Login** — Email + passkey authentication
- **Pre-interview Setup** — Camera/microphone system check with audio level visualization
- **Live Interview Room** — Real-time conversation with AI interviewer
- **Speech-to-Text** — Natural speaking experience with live transcript
- **Video Recording** — Full session recording stored in cloud storage
- **Fullscreen Mode** — Enforced fullscreen for distraction-free experience

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16.2.1 (App Router) |
| **Language** | TypeScript 5 (strict mode) |
| **UI Library** | React 19.2.4 |
| **Styling** | Tailwind CSS 4.0 + PostCSS |
| **Icons** | Lucide React |
| **Fonts** | Geist Sans + Geist Mono (Google Fonts) |
| **AI/LLM** | AWS Bedrock (`amazon.nova-lite-v1:0`) |
| **Database** | Supabase (PostgreSQL) |
| **Authentication** | Supabase Auth |
| **Storage** | Supabase Storage (public `videos` bucket) |
| **Speech** | Web Speech API (STT + TTS) — zero-cost |
| **Video** | MediaRecorder API (`.webm` output) |
| **Email** | Nodemailer (SMTP-based, Gmail default) |
| **Excel** | SheetJS (`xlsx`) |

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── admin/                      # Admin portal
│   │   ├── login/                  # Admin authentication
│   │   ├── dashboard/              # Interview overview
│   │   ├── interviews/
│   │   │   ├── create/             # Create interview + upload candidates
│   │   │   └── [id]/
│   │   │       ├── status/         # Candidate progress tracking
│   │   │       ├── send-email/     # Email composition
│   │   │       └── email-progress/ # Email delivery status
│   │   └── results/[id]/           # Detailed evaluation view
│   ├── candidate/                  # Candidate flow
│   │   ├── login/                  # Candidate authentication
│   │   ├── setup/                  # Pre-interview system check
│   │   └── interview/              # Live AI interview room
│   └── api/
│       ├── interviewer/            # AI interviewer agent (AWS Bedrock)
│       ├── evaluate/               # Post-interview evaluation
│       ├── send-invites/           # Bulk email dispatch
│       └── support-email/          # Support email endpoint
├── lib/
│   └── supabase.ts                 # Supabase client
└── app/
    ├── globals.css                 # Tailwind CSS v4 styles
    ├── layout.tsx                  # Root layout with fonts
    └── icon.svg                    # Favicon

docs/                               # Documentation
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Supabase account (free tier works)
- AWS account with Bedrock access
- SMTP credentials (Gmail recommended)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/ShariqSheikhh/Altimetrik-AI-Interviewer.git
cd Altimetrik-AI-Interviewer

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials (see docs/SETUP.md)

# 4. Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Documentation

Comprehensive documentation is available in the `docs/` folder:

| Document | Description |
|---|---|
| [SETUP.md](./docs/SETUP.md) | Installation and environment configuration |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System architecture and data flow |
| [ADMIN_GUIDE.md](./docs/ADMIN_GUIDE.md) | Complete admin portal usage guide |
| [CANDIDATE_GUIDE.md](./docs/CANDIDATE_GUIDE.md) | Candidate interview flow walkthrough |
| [API_REFERENCE.md](./docs/API_REFERENCE.md) | API endpoints and integration details |
| [DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md) | Supabase schema and relationships |
| [TECH_DOC.md](./docs/TECH_DOC.md) | Technical deep dive (speech systems, AI workflows) |
| [DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Production deployment guide |

## Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint checks
```

## Database Setup

The application requires a Supabase database. Run the SQL schema from [`supabase_setup.sql`](./supabase_setup.sql) in your Supabase SQL editor to create:
- `interviews` table (title + JSONB question bank)
- `candidates` table (email, passkey, interview relationship)
- `results` table (evaluation data, video URLs, transcripts)
- `videos` storage bucket (public access)

See [DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md) for full details.

## AI Architecture

### Interviewer Agent
- **Endpoint:** `/api/interviewer` (POST)
- **Model:** AWS Bedrock `amazon.nova-lite-v1:0`
- **Mode:** Stateless agent with conversation history
- **Flow:** Greeting → Introduction → Technical Questions → Completion
- **Features:** Follow-up questions for partial/wrong answers, structured JSON output

### Evaluation Engine
- **Endpoint:** `/api/evaluate` (POST)
- **Scoring Dimensions:**
  - Communication Clarity (0-25)
  - Relevance & Depth (0-25)
  - Problem-Solving & Critical Thinking (0-25)
  - Specificity & Examples (0-25)
- **Output:** Overall score (0-100) + detailed breakdown

## Speech System

Uses **browser-native Web Speech API** for zero-cost speech processing:

- **Speech-to-Text:** Continuous listening with interim results for real-time transcript display
- **Text-to-Speech:** Configurable voice selection with per-sentence rate/pitch tuning
- **Sequential Flow:** AI finishes speaking before mic activates (prevents self-hearing)

## Security

- Supabase Row Level Security (RLS) policies
- Passkey-based candidate authentication
- Input sanitization on all API endpoints
- Environment variable protection for secrets

## License

This project is proprietary. All rights reserved.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/) by Vercel
- AI powered by [AWS Bedrock](https://aws.amazon.com/bedrock/)
- Database and storage by [Supabase](https://supabase.com/)
