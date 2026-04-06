# Admin Guide

Complete guide to using the Admin Portal for managing interviews, candidates, and evaluating results.

## Table of Contents

1. [Admin Login](#admin-login)
2. [Dashboard](#dashboard)
3. [Creating an Interview](#creating-an-interview)
4. [Managing Candidates](#managing-candidates)
5. [Sending Email Invitations](#sending-email-invitations)
6. [Tracking Candidate Progress](#tracking-candidate-progress)
7. [Monitoring Email Delivery](#monitoring-email-delivery)
8. [Reviewing Results](#reviewing-results)

---

## Admin Login

**URL:** `/admin/login`

### Authentication Methods

The admin portal supports two authentication methods:

1. **Supabase Auth (Recommended)**
   - Create an admin user in Supabase Dashboard → Authentication → Users
   - Log in with email and password

### After Login

You'll be redirected to the **Admin Dashboard** showing an overview of all interviews and recent evaluations.

---

## Dashboard

**URL:** `/admin/dashboard`

The dashboard provides a high-level overview of your interview platform activity.

### Interview Cards

Each card displays:
- **Interview Title**
- **Number of Questions** in the question bank
- **Number of Candidates** invited
- **Completion Rate** (how many candidates have finished)

### Recent Evaluations Table

A table showing the most recently completed interviews with:
- **Candidate Name**
- **Interview Title**
- **Score** (color-coded: green for scores >= 60, red for scores < 60)
- **Completion Date**
- **Link** to detailed results

### Navigation

Use the sidebar or header navigation to:
- Create a new interview
- View interview status tracking
- Access email tools

---

## Creating an Interview

**URL:** `/admin/interviews/create`

This is where you define a new interview session with questions and candidates.

### Step 1: Define Interview Details

**Interview Title:**
Enter a descriptive name (e.g., "Backend Developer - Node.js Assessment Q2 2026")

### Step 2: Build the Question Bank

You have two options for adding questions:

#### Option A: Manual Entry

1. Click **"Add Question"**
2. Type or paste the question text
3. (Optional) Add expected key points or answer hints
4. Repeat for each question
5. Questions are added to a JSONB array stored in the database

#### Option B: Excel Upload

1. Prepare an Excel file (`.xlsx` or `.xls`) with questions
2. **Required format:**
   - Column A: Question text
   - Column B: (Optional) Answer hints/key points
   - Row 1: Headers (ignored)
   - Row 2+: Questions
3. Click **"Upload Excel"** and select your file
4. The system parses the file using SheetJS and displays a preview
5. Review and confirm the questions

**Example Excel Format:**

| Question | Key Points |
|---|---|
| Explain the difference between `let`, `const`, and `var` in JavaScript | Scope, hoisting, reassignment |
| What is a closure and give an example | Function + lexical environment, practical use case |

### Step 3: Upload Candidate List

1. Prepare an Excel file with candidate information
2. **Required format:**
   - Column A: Full Name
   - Column B: Email Address
   - Row 1: Headers (ignored)
   - Row 2+: Candidates
3. Click **"Upload Candidates"** and select your file
4. The system:
   - Parses the file
   - Validates email addresses
   - **Auto-generates unique passkeys** for each candidate
   - Marks candidates as `is_allowed = true`
5. Review the parsed candidates before confirming

**Example Candidate Excel Format:**

| Name | Email |
|---|---|
| John Doe | john.doe@example.com |
| Jane Smith | jane.smith@example.com |

### Step 4: Save Interview

Click **"Create Interview"** to save everything to Supabase:
- Interview details → `interviews` table
- Questions → `question_bank` (JSONB)
- Candidates → `candidates` table with auto-generated passkeys

After saving, you'll be automatically redirected to the **Send Email** page.

---

## Managing Candidates

Candidates are managed per-interview and can be accessed through:
- **Create Interview** page (during setup)
- **Interview Status** page (after creation)

### Candidate Status Values

| Status | Meaning |
|---|---|
| **Not Started** | Candidate has not logged in yet |
| **In Progress** | Candidate has started the interview but not finished |
| **Completed** | Candidate finished and evaluation is saved |

### Viewing Candidate Details

Go to `/admin/interviews/[id]/status` to see:
- Full name
- Email address
- Passkey (for manual sharing if needed)
- Current status
- Score (if completed)
- Link to detailed results

### Filtering

Use the status filter dropdown to show:
- All candidates
- Only completed
- Only in progress
- Only not started

---

## Sending Email Invitations

**URL:** `/admin/interviews/[id]/send-email`

This page allows you to compose and send personalized invitation emails to all candidates.

### Email Composer

#### Subject Line
Enter the email subject (e.g., "Invitation: Technical Interview at [Company Name]")

#### Email Body (HTML)

Write your email using HTML with **template variables** for personalization:

**Available Template Variables:**

| Variable | Replaced With |
|---|---|
| `{{candidateName}}` | Candidate's full name |
| `{{candidateEmail}}` | Candidate's email address |
| `{{passkey}}` | Auto-generated passkey |
| `{{loginLink}}` | Full URL to candidate login page |
| `{{interviewTitle}}` | The interview name you defined |

#### Example Email Template

```html
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #333;">
  <h2>Dear {{candidateName}},</h2>
  
  <p>You have been invited to participate in a technical interview:</p>
  
  <p><strong>Interview:</strong> {{interviewTitle}}</p>
  
  <p>Please log in using the following credentials:</p>
  <ul>
    <li><strong>Email:</strong> {{candidateEmail}}</li>
    <li><strong>Passkey:</strong> {{passkey}}</li>
  </ul>
  
  <p><a href="{{loginLink}}">Click here to start your interview</a></p>
  
  <p>If you need assistance, contact our support team.</p>
  
  <p>Best regards,<br/>Hiring Team</p>
</body>
</html>
```

### Live Iframe Preview

As you type HTML, the right panel shows a **real-time preview** of how the email will look. This helps you verify formatting before sending.

### Sending Emails

1. Review your email content and preview
2. Click **"Send to All Candidates"**
3. The system calls `/api/send-invites` which:
   - Iterates through all candidates for this interview
   - Replaces template variables with actual values
   - Sends individual emails via SMTP (Nodemailer)
   - Retries up to 3 times with exponential backoff on failure
4. After sending, you'll see a summary:
   - Number of emails sent successfully
   - Number of emails failed
   - Success rate percentage

### After Sending

You'll be redirected to the **Email Progress** page to monitor delivery status.

---

## Monitoring Email Delivery

**URL:** `/admin/interviews/[id]/email-progress`

This page shows the results of your email campaign.

### Summary Statistics

- **Total Candidates:** Number of candidates in the interview
- **Emails Sent:** Successfully delivered
- **Emails Failed:** Could not be delivered (check logs for reasons)
- **Success Rate:** Percentage of successful deliveries

### Per-Recipient Status Table

| Candidate | Email | Status | Details |
|---|---|---|---|
| John Doe | john@example.com | Sent | Delivered at [timestamp] |
| Jane Smith | jane@example.com | Failed | SMTP error: [error message] |

### Troubleshooting Failed Emails

Common failure reasons:
- Invalid email address
- SMTP server rejection (spam filter, rate limit)
- Network timeout

**Solutions:**
1. Verify the email address is correct
2. Check your SMTP provider's logs
3. Manually send the email using the candidate's details
4. Use a more reliable SMTP provider (e.g., SendGrid, AWS SES)

---

## Tracking Candidate Progress

**URL:** `/admin/interviews/[id]/status`

Monitor which candidates have started, are in progress, or have completed their interviews.

### Progress Overview

- **Progress Bar:** Visual completion percentage
- **Stats Cards:**
  - Total Candidates
  - Completed
  - In Progress
  - Not Started

### Candidate Table

| Name | Email | Status | Score | Actions |
|---|---|---|---|---|
| John Doe | john@example.com | Completed | 78/100 | [View Results] |
| Jane Smith | jane@example.com | In Progress | — | — |
| Bob Wilson | bob@example.com | Not Started | — | — |

### Filtering

Use the dropdown to filter by status:
- **All:** Show everyone
- **Completed:** Only finished interviews
- **In Progress:** Currently active interviews
- **Not Started:** Candidates who haven't logged in yet

### Viewing Results

Click **"View Results"** next to a completed candidate to go to the detailed results page.

---

## Reviewing Results

**URL:** `/admin/results/[id]`

This page provides a comprehensive view of a completed interview, including video playback, transcript, and AI evaluation scores.

### Video Playback

- **Player:** Embedded `.webm` video player
- **Source:** Video URL from Supabase Storage (public bucket)
- **Controls:** Play, pause, seek, fullscreen
- **Use Case:** Review candidate's body language, communication style, and interview environment

### AI Evaluation Scores

#### Overall Score (0-100)

Displayed prominently at the top. This is a composite score calculated from the four dimension scores.

#### Dimension Breakdown (0-25 each)

| Dimension | Score | Description |
|---|---|---|
| **Communication Clarity** | /25 | How clearly the candidate expressed ideas |
| **Relevance & Depth** | /25 | Whether answers were on-topic and thorough |
| **Problem-Solving & Critical Thinking** | /25 | Analytical approach and reasoning quality |
| **Specificity & Examples** | /25 | Use of concrete examples and details |

### Q&A Transcript

A chronological display of the entire interview conversation:
- **AI Questions** (displayed in one style)
- **Candidate Answers** (displayed in another style)
- **Follow-up Questions** (if AI asked probing questions)

This allows you to:
- Read exactly what was said
- Evaluate the AI's questioning quality
- Identify where the candidate struggled or excelled

### Additional Details

- **Interview Title**
- **Candidate Name**
- **Completion Timestamp**
- **Evaluation Metadata** (model used, scoring details)

---

## Tips & Best Practices

### Creating Effective Questions

1. **Be specific:** Avoid vague questions like "Tell me about JavaScript"
2. **Focus on concepts:** Ask about principles, not just syntax
3. **Include scenarios:** "How would you debug X?" is better than "What is X?"
4. **Provide key points:** Help the AI evaluate answers more accurately

### Writing Good Email Templates

1. **Keep it professional:** Use clear, formal language
2. **Include all details:** What, when, how long, what to expect
3. **Test before sending:** Send a test email to yourself first
4. **Use HTML styling:** Make it visually appealing with your company branding

### Monitoring Progress

1. **Check daily:** See who has started and follow up with stragglers
2. **Set deadlines:** Mention a completion deadline in your email
3. **Review results promptly:** Evaluate scores and decide on next steps

### Interpreting Scores

- **60-100:** Strong candidate, proceed to next round
- **Below 60:** Weak performance, consider rejection

### Interpreting Metric Scores (Out of 25)

Each of the 4 evaluation metrics is color-coded:
- **Score >= 15:** Green (passing)
- **Score < 15:** Red (needs improvement)

⚠️ **Note:** AI scores are **assistive**, not definitive. Always review transcripts and videos for final decisions.

---

## Next Steps

- Read [CANDIDATE_GUIDE.md](./CANDIDATE_GUIDE.md) to understand what candidates experience
- Read [API_REFERENCE.md](./API_REFERENCE.md) for technical API details
- Read [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for database structure
