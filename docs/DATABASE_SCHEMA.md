# Database Schema

Supabase database structure, relationships, and Row Level Security (RLS) policies for the AI Interviewer Platform.

## Overview

The application uses **Supabase (PostgreSQL)** with three main tables and one storage bucket:

| Resource | Type | Purpose |
|---|---|---|
| `interviews` | Table | Interview definitions (title, questions, candidates) |
| `candidates` | Table | Candidate information and credentials |
| `results` | Table | Evaluation results, video URLs, transcripts |
| `videos` | Storage Bucket | Public video recordings (.webm files) |

---

## Table: `interviews`

Stores interview session definitions including title and question banks.

### Schema

```sql
CREATE TABLE interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  question_bank JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Columns

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | Primary Key | Unique interview identifier |
| `title` | TEXT | NOT NULL | Interview name (e.g., "Backend Developer Q2 2026") |
| `question_bank` | JSONB | NOT NULL, DEFAULT `'[]'` | Array of questions with optional key points |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Interview creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last modification timestamp |

### `question_bank` JSONB Structure

```json
[
  {
    "question": "Explain the difference between let, const, and var in JavaScript.",
    "keyPoints": "Scope differences, hoisting behavior, reassignment rules"
  },
  {
    "question": "What is a closure? Provide an example."
  }
]
```

| Field | Type | Required | Description |
|---|---|---|---|
| `question` | String | ✅ | The question text |
| `keyPoints` | String | ❌ | Expected answer highlights (for AI evaluation context) |

### Relationships

```
interviews (1) ────────< (N) candidates
interviews (1) ────────< (N) results
```

### Indexes

```sql
CREATE INDEX idx_interviews_created_at ON interviews(created_at DESC);
```

### Example Queries

**Create interview:**
```sql
INSERT INTO interviews (title, question_bank)
VALUES (
  'Frontend Developer - React Assessment',
  '[
    {"question": "Explain the React component lifecycle.", "keyPoints": "mount, update, unmount phases"},
    {"question": "What is the virtual DOM and how does it work?"}
  ]'
)
RETURNING id;
```

**Get interview with candidate count:**
```sql
SELECT 
  i.id,
  i.title,
  i.question_bank,
  jsonb_array_length(i.question_bank) as question_count,
  COUNT(c.id) as candidate_count
FROM interviews i
LEFT JOIN candidates c ON c.interview_id = i.id
GROUP BY i.id;
```

---

## Table: `candidates`

Stores candidate information including authentication credentials and interview assignments.

### Schema

```sql
CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  passkey TEXT NOT NULL DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  is_allowed BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Columns

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | Primary Key | Unique candidate identifier |
| `name` | TEXT | NOT NULL | Candidate's full name |
| `email` | TEXT | NOT NULL | Candidate's email address |
| `passkey` | TEXT | NOT NULL, DEFAULT `gen_random_uuid()` | Auto-generated login password |
| `interview_id` | UUID | NOT NULL, FK → interviews(id) | Associated interview |
| `is_allowed` | BOOLEAN | DEFAULT true | Whether candidate is authorized to take the interview |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Record creation timestamp |

### Relationships

```
interviews (1) ────< (N) candidates
candidates (N) >──── (1) interviews
candidates (1) ────< (0..1) results
```

### Indexes

```sql
CREATE INDEX idx_candidates_interview_id ON candidates(interview_id);
CREATE INDEX idx_candidates_email ON candidates(email);
CREATE INDEX idx_candidates_passkey ON candidates(passkey);
```

### Example Queries

**Insert candidate (auto-generate passkey):**
```sql
INSERT INTO candidates (name, email, interview_id)
VALUES ('John Doe', 'john.doe@example.com', 'uuid-here')
RETURNING id, passkey;
```

**Validate candidate login:**
```sql
SELECT id, name, email, interview_id
FROM candidates
WHERE email = 'john.doe@example.com'
  AND passkey = 'a3f9k2m8x1'
  AND is_allowed = true;
```

**Get candidates with completion status:**
```sql
SELECT 
  c.id,
  c.name,
  c.email,
  c.passkey,
  c.is_allowed,
  CASE 
    WHEN r.id IS NOT NULL THEN 'completed'
    ELSE 'not_started'
  END as status,
  r.evaluation->>'overallScore' as score
FROM candidates c
LEFT JOIN results r ON r.candidate_id = c.id
WHERE c.interview_id = 'uuid-here';
```

---

## Table: `results`

Stores completed interview evaluations including scores, video URLs, and transcripts.

### Schema

```sql
CREATE TABLE results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  evaluation JSONB NOT NULL,
  video_url TEXT,
  transcript_data JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Columns

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | Primary Key | Unique result identifier |
| `candidate_id` | UUID | NOT NULL, FK → candidates(id) | Candidate who took the interview |
| `interview_id` | UUID | NOT NULL, FK → interviews(id) | Interview that was taken |
| `evaluation` | JSONB | NOT NULL | AI-generated scores and feedback |
| `video_url` | TEXT | nullable | Public URL to the recorded video |
| `transcript_data` | JSONB | NOT NULL, DEFAULT `'[]'` | Full conversation transcript |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Completion timestamp |

### `evaluation` JSONB Structure

```json
{
  "overallScore": 78,
  "breakdown": {
    "communicationClarity": 20,
    "relevanceAndDepth": 19,
    "problemSolvingAndCriticalThinking": 20,
    "specificityAndExamples": 19
  },
  "feedback": "The candidate demonstrated solid understanding of JavaScript fundamentals..."
}
```

| Field | Type | Description |
|---|---|---|
| `overallScore` | Number (0-100) | Composite score |
| `breakdown.communicationClarity` | Number (0-25) | Clarity of expression |
| `breakdown.relevanceAndDepth` | Number (0-25) | Answer quality and thoroughness |
| `breakdown.problemSolvingAndCriticalThinking` | Number (0-25) | Reasoning ability |
| `breakdown.specificityAndExamples` | Number (0-25) | Use of concrete examples |
| `feedback` | String | Detailed qualitative feedback |

### `transcript_data` JSONB Structure

```json
[
  {
    "speaker": "AI",
    "text": "Welcome to the technical interview. Let's start with the first question."
  },
  {
    "speaker": "AI",
    "text": "Explain the difference between let, const, and var in JavaScript."
  },
  {
    "speaker": "CANDIDATE",
    "text": "Var is function-scoped and can be hoisted. Let and const are block-scoped."
  }
]
```

| Field | Type | Description |
|---|---|---|
| `speaker` | String ("AI" or "CANDIDATE") | Who spoke |
| `text` | String | What was said |

### Relationships

```
candidates (1) ────< (0..N) results
interviews (1) ────< (0..N) results
```

### Indexes

```sql
CREATE INDEX idx_results_candidate_id ON results(candidate_id);
CREATE INDEX idx_results_interview_id ON results(interview_id);
CREATE INDEX idx_results_created_at ON results(created_at DESC);
```

### Example Queries

**Get result with candidate and interview details:**
```sql
SELECT 
  r.id,
  r.evaluation,
  r.video_url,
  r.transcript_data,
  r.created_at,
  c.name as candidate_name,
  c.email as candidate_email,
  i.title as interview_title
FROM results r
JOIN candidates c ON c.id = r.candidate_id
JOIN interviews i ON i.id = r.interview_id
ORDER BY r.created_at DESC;
```

**Get average scores per interview:**
```sql
SELECT 
  i.title,
  COUNT(r.id) as completed_count,
  AVG((r.evaluation->>'overallScore')::INTEGER) as avg_score,
  MAX((r.evaluation->>'overallScore')::INTEGER) as max_score,
  MIN((r.evaluation->>'overallScore')::INTEGER) as min_score
FROM interviews i
JOIN results r ON r.interview_id = i.id
GROUP BY i.id, i.title;
```

---

## Storage Bucket: `videos`

Public storage bucket for interview session recordings.

### Configuration

```sql
-- Create storage bucket (from supabase_setup.sql)
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true);
```

### Properties

| Property | Value | Description |
|---|---|---|
| `id` | `videos` | Bucket identifier |
| `name` | `videos` | Display name |
| `public` | `true` | Videos are publicly readable (for admin review) |

### File Structure

```
videos/
├── {candidate-id}-{timestamp}.webm
├── a3f9k2m8-2026-04-05T10-30-00.webm
└── b7c2n5p9-2026-04-05T11-15-00.webm
```

### Upload Flow

1. Candidate completes interview
2. Video blob created: `new Blob(chunks, { type: 'video/webm' })`
3. Upload to Supabase:
   ```typescript
   const { data, error } = await supabase
     .storage
     .from('videos')
     .upload(`${candidateId}-${timestamp}.webm`, videoBlob);
   ```
4. Get public URL:
   ```typescript
   const { data: { publicUrl } } = supabase
     .storage
     .from('videos')
     .getPublicUrl(filePath);
   ```
5. Save URL to `results.video_url`

---

## Row Level Security (RLS) Policies

### Current State (MVP - Permissive)

For MVP development, RLS policies are set to allow public read/write access:

```sql
-- Enable RLS
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;

-- Permissive policies for MVP
CREATE POLICY "Public read access" ON interviews FOR SELECT USING (true);
CREATE POLICY "Public read access" ON candidates FOR SELECT USING (true);
CREATE POLICY "Public read access" ON results FOR SELECT USING (true);

CREATE POLICY "Public write access" ON interviews FOR ALL USING (true);
CREATE POLICY "Public write access" ON candidates FOR ALL USING (true);
CREATE POLICY "Public write access" ON results FOR ALL USING (true);
```

### ⚠️ Production Recommendations

**For production, tighten RLS policies:**

```sql
-- Interviews: Admin read/write only
CREATE POLICY "Admins can read interviews" ON interviews 
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can insert interviews" ON interviews 
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Candidates: Public read (for login), admin write
CREATE POLICY "Anyone can read candidates" ON candidates 
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert candidates" ON candidates 
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Results: Admin read, system write
CREATE POLICY "Admins can read results" ON results 
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "System can insert results" ON results 
  FOR INSERT WITH CHECK (true);
```

**Additional Security:**
- Require authentication for all admin operations
- Limit candidate login queries to email+passkey match only
- Add rate limiting on API endpoints
- Audit log table for tracking changes

---

## Entity Relationship Diagram

```
┌──────────────────┐
│   interviews     │
│──────────────────│
│ id (UUID) PK     │
│ title (TEXT)     │
│ question_bank    │
│   (JSONB)        │
│ created_at       │
│ updated_at       │
└──┬───────────┬───┘
   │           │
   │           │
   │ 1         │ 1
   │           │
   │           │
   │ N         │ N
   │           │
┌──▼───────────▼───┐
│   candidates     │         ┌──────────────────┐
│──────────────────│         │   results        │
│ id (UUID) PK     │         │──────────────────│
│ name (TEXT)      │    0..1 │ id (UUID) PK     │
│ email (TEXT)     │    ────<│ candidate_id FK  │
│ passkey (TEXT)   │         │ interview_id FK  │
│ interview_id FK  │         │ evaluation(JSONB)│
│ is_allowed (BOOL)│         │ video_url(TEXT)  │
│ created_at       │         │ transcript_data  │
└──────────────────┘         │   (JSONB)        │
                             │ created_at       │
                             └──────────────────┘
```

---

## Database Migrations

### Applying Changes

For production, use a migration tool like:
- **Supabase Migrations** (built-in)
- **Prisma Migrate** (if using Prisma ORM)
- **dbmate** or **flyway** (standalone migration tools)

### Example Migration Structure

```
migrations/
├── 001_create_interviews.sql
├── 002_create_candidates.sql
├── 003_create_results.sql
├── 004_create_videos_bucket.sql
└── 005_add_indexes.sql
```

---

## Backup & Recovery

### Manual Backup

```bash
# Export database using Supabase CLI
supabase db dump -f backup.sql

# Export via pg_dump (if you have direct access)
pg_dump -h db.your-project.supabase.co -U postgres -d postgres > backup.sql
```

### Automated Backups

Supabase provides automated backups:
1. Go to **Settings** → **Database**
2. Enable **Point-in-Time Recovery** (PITR)
3. Configure backup retention period

### Restoring Data

1. Go to Supabase Dashboard → **Database** → **Backups**
2. Select the backup to restore
3. Click **Restore** (note: this overwrites current data)

---

## Performance Optimization

### Indexes

All recommended indexes are included in `supabase_setup.sql`.

### Query Optimization

- Use `jsonb_array_length()` for question count (indexed)
- Use `LEFT JOIN` for optional results (avoid N+1 queries)
- Fetch only needed columns (avoid `SELECT *` in production)

### Caching

Consider adding:
- **Redis** for session state or frequently accessed data
- **CDN** for video delivery (Supabase Storage is already CDN-backed)
- **API response caching** for dashboard stats

---

## Next Steps

- 📚 Read [SETUP.md](./SETUP.md) for database setup instructions
- 📚 Read [ARCHITECTURE.md](./ARCHITECTURE.md) for data flow details
- 📚 See [`supabase_setup.sql`](../supabase_setup.sql) for the full schema script
