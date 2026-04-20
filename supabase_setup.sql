-- Create Interviews Table
CREATE TABLE public.interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  question_bank JSONB NOT NULL DEFAULT '[]', -- Array of questions
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create Candidates Table
CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  passkey TEXT NOT NULL,
  interview_id UUID REFERENCES public.interviews(id),
  name TEXT,
  is_allowed BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create Results Table
CREATE TABLE public.results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.candidates(id),
  interview_id UUID REFERENCES public.interviews(id),
  evaluation JSONB,
  video_url TEXT,
  transcript_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optional: RLS (Row Level Security) - initially disabled or open for MVP, but to be secure:
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

-- Allow public read/write for MVP (You should restrict this in production!)
CREATE POLICY "Public Interviews" ON public.interviews FOR ALL USING (true);
CREATE POLICY "Public Candidates" ON public.candidates FOR ALL USING (true);
CREATE POLICY "Public Results" ON public.results FOR ALL USING (true);

-- Create Storage Bucket for Videos
insert into storage.buckets (id, name, public) 
values ('videos', 'videos', true)
on conflict (id) do nothing;

create policy "Public Access Videos" 
on storage.objects for all 
using ( bucket_id = 'videos' );

-- Interview Resume / S3 Multipart Migration --
ALTER TABLE public.candidates 
ADD COLUMN IF NOT EXISTS session_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS session_state JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS s3_upload_id TEXT,    
ADD COLUMN IF NOT EXISTS s3_upload_key TEXT,
ADD COLUMN IF NOT EXISTS s3_uploaded_parts JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS resume_source_url TEXT,
ADD COLUMN IF NOT EXISTS resume_file_name TEXT,
ADD COLUMN IF NOT EXISTS resume_s3_key TEXT,
ADD COLUMN IF NOT EXISTS resume_source TEXT,
ADD COLUMN IF NOT EXISTS resume_uploaded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_candidates_interview_email ON public.candidates(interview_id, email);
