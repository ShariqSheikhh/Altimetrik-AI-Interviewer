# Resume Upload Feature - Code Changes and Functional Breakdown

## Scope Implemented
This implementation adds resume upload support in the assessment creation and candidate setup flow.

Implemented now:
- Admin-side resume link intake from Candidate Invites Excel.
- Backend ingestion of public Google Drive resume links into AWS S3.
- Candidate fallback upload if resume is not already available.
- Resume metadata persistence in Supabase candidates records.

Out of scope in this change:
- JD upload feature.
- Resume-JD match scoring.

## 1) Database Changes
File changed: supabase_setup.sql

Added new columns to public.candidates:
- resume_source_url: Original source link from admin Excel.
- resume_file_name: Stored file name.
- resume_s3_key: S3 object key used for retrieval.
- resume_source: Source type (admin_drive or candidate_upload).
- resume_uploaded_at: Upload timestamp.

Added index:
- idx_candidates_interview_email on (interview_id, email) to speed candidate mapping by interview and email.

Why this was added:
- Candidate rows now hold resume lifecycle metadata directly, enabling both admin ingestion and candidate fallback upload checks.

## 2) Admin Create Assessment - Candidate Invites Enhancements
File changed: src/app/admin/interviews/create/page.tsx

### 2.1 Candidate model update
Added typed row structure for imported candidates:
- email
- name
- passkey
- resumeDriveLink (optional)

### 2.2 Excel parsing improvements
The Candidate Invites upload parser now supports flexible header matching and reads:
- Name
- Email
- ResumeDriveLink (optional)

Behavior details:
- Header names are normalized to handle variations.
- Email is stored lowercased for reliable matching.
- Existing Name and Email import behavior remains intact.

### 2.3 Candidate preview table update
The Candidate Invites preview now includes a new Resume Link column with status badges:
- Present
- Missing

### 2.4 Save flow enhancement
During Initialize Assessment:
1. Interview is created in interviews table.
2. Candidates are inserted in candidates table (with select id, email).
3. For each inserted candidate with resumeDriveLink, frontend calls /api/upload-resume with action ingestDriveLink.
4. Success/failure counters are collected.
5. Redirect to send-email page includes query params:
- resumeImported
- resumeFailed

Why this was added:
- Resume ingestion is embedded directly into the existing Candidate Invites workflow with no separate admin page.

## 3) Resume Upload API (New)
File added: src/app/api/upload-resume/route.ts

This API introduces three actions.

### 3.1 action: ingestDriveLink
Purpose:
- Admin flow ingestion from ResumeDriveLink.

Input:
- candidateId
- interviewId
- driveUrl

Process:
1. Validate required fields.
2. Convert supported Google Drive URLs to download form when possible.
3. Download file server-side.
4. Enforce max file size (8MB).
5. Upload to S3 under key pattern:
- resume/{interviewId}/{candidateId}/admin/{timestamp}_{filename}
6. Update candidate metadata in Supabase with source admin_drive.

Output:
- success
- resumeKey
- fileName

### 3.2 action: presign
Purpose:
- Candidate fallback direct upload setup.

Input:
- candidateId
- interviewId
- fileName
- fileType

Process:
1. Build S3 key under candidate path:
- resume/{interviewId}/{candidateId}/candidate/{timestamp}_{filename}
2. Generate signed PUT URL.

Output:
- success
- signedUrl
- key
- fileName

### 3.3 action: complete
Purpose:
- Finalize candidate direct upload metadata.

Input:
- candidateId
- key
- fileName

Process:
- Update candidate row with resume_s3_key, resume_file_name, resume_source candidate_upload, resume_uploaded_at.

Output:
- success

### Security and robustness present
- S3 region and credential fallback handling from environment.
- Filename sanitization.
- Download/file size checks for Drive ingestion.
- Error responses with status codes and message bodies.

## 4) Candidate Setup Gate for Resume Availability
File changed: src/app/candidate/setup/page.tsx

New behavior in start flow:
- Before moving to interview, setup checks candidates.resume_s3_key.
- If resume_s3_key is missing, user is redirected to /candidate/resume.
- If check fails due to query error, setup shows a friendly error message and stops progression.

Why this was added:
- Ensures interview cannot start without a resume when admin ingestion did not produce one.

## 5) Candidate Resume Upload Page (New)
File added: src/app/candidate/resume/page.tsx

Functionality:
- Allows candidate to upload resume (PDF, DOC, DOCX) when missing.

Flow:
1. Validate candidate_id and interview_id from localStorage.
2. Call /api/upload-resume action presign.
3. PUT file directly to S3 using signedUrl.
4. Call /api/upload-resume action complete.
5. Redirect back to /candidate/setup.

UI behavior:
- File picker with accepted types.
- Upload progress state (Uploading).
- Inline error feedback.
- Shows selected file before submit.

## End-to-End Functional Flow After Changes

### Admin path
1. Admin uploads candidate Excel in Candidate Invites.
2. Excel rows include Name, Email, optional ResumeDriveLink.
3. Admin clicks Initialize Assessment and Send Mail.
4. System creates interview and candidates.
5. For candidates with ResumeDriveLink, resumes are downloaded and uploaded to S3.
6. Candidate rows store resume metadata.

### Candidate path
1. Candidate logs in and reaches setup.
2. Setup checks resume availability on candidate record.
3. If resume exists, candidate proceeds to interview.
4. If resume is missing, candidate is sent to resume upload page.
5. Candidate uploads file to S3 and metadata is saved.
6. Candidate returns to setup and can proceed.

## Notes
- A separate auto-generated environment file (next-env.d.ts) also changed due local Next dev type generation behavior. This change is not part of resume feature logic.
- Runtime dependency on Node version still needs to be validated if dev server fails with syntax errors from dependencies.

## Files Added/Modified Summary
Added:
- src/app/api/upload-resume/route.ts
- src/app/candidate/resume/page.tsx

Modified:
- src/app/admin/interviews/create/page.tsx
- src/app/candidate/setup/page.tsx
- supabase_setup.sql
