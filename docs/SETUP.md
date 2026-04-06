# Setup Guide

Step-by-step installation and environment configuration for the AI Interviewer Platform.

## Prerequisites

Before you begin, ensure you have the following:

- **Node.js 18+** and **npm** installed ([Download](https://nodejs.org/))
- **Supabase account** (free tier is sufficient) — [Sign up](https://supabase.com/)
- **AWS account** with Bedrock access enabled — [AWS Console](https://aws.amazon.com/)
- **SMTP credentials** (Gmail recommended for ease of setup)

---

## Installation Steps

### Step 1: Clone the Repository

```bash
git clone https://github.com/ShariqSheikhh/Altimetrik-AI-Interviewer.git
cd Altimetrik-AI-Interviewer
```

### Step 2: Install Dependencies

```bash
npm install
```

This installs all required packages including:
- Next.js 16.2.1 + React 19.2.4
- `@aws-sdk/client-bedrock-runtime` (AI integration)
- `@supabase/supabase-js` (Database + Storage)
- `nodemailer` (Email sending)
- `xlsx` (Excel parsing)
- `lucide-react` (Icons)
- Tailwind CSS 4.0 + PostCSS

### Step 3: Set Up Environment Variables

```bash
cp .env.example .env.local
```

Now edit `.env.local` with your credentials. See the [Environment Variables](#environment-variables) section below for detailed instructions.

### Step 4: Set Up Supabase Database

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of [`supabase_setup.sql`](../supabase_setup.sql)
4. Paste and run the SQL script

This creates:
- `interviews` table
- `candidates` table
- `results` table
- `videos` storage bucket (public)
- Row Level Security (RLS) policies

### Step 5: Enable AWS Bedrock Model Access

1. Go to the **AWS Management Console** → **Bedrock**
2. Navigate to **Model Access**
3. Request access to `amazon.nova-lite-v1:0` (or your chosen model)
4. Wait for approval (usually instant)
5. Create an IAM user with Bedrock permissions and generate access keys

### Step 6: Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Environment Variables

All variables are defined in `.env.local`. Here's a detailed breakdown:

### Supabase Configuration

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-from-supabase-dashboard
```

**How to get these:**
1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Copy the **Project URL** and **anon public key**
4. Paste them into `.env.local`

### Application URL

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- **Development:** `http://localhost:3000`
- **Production:** Your deployed URL (e.g., `https://your-domain.com`)

**Why this matters:** This is used to generate login links in invitation emails. If set incorrectly, candidates won't be able to access the interview.

### AWS Bedrock Configuration

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_MODEL_NAME=amazon.nova-lite-v1:0
```

**How to get these:**
1. Go to **AWS Console** → **IAM** → **Users**
2. Create a user with `BedrockFullAccess` policy (or custom policy with `bedrock:InvokeModel`)
3. Generate **Access Key ID** and **Secret Access Key** under the **Security credentials** tab
4. Set `AWS_REGION` to your preferred region (e.g., `us-east-1`, `us-west-2`)
5. `AWS_MODEL_NAME` defaults to `amazon.nova-lite-v1:0`. You can change this to other supported models.

**Supported models:** Any text model available in AWS Bedrock. Recommended:
- `amazon.nova-lite-v1:0` (default, fast, cost-effective)
- `amazon.nova-pro-v1:0` (higher quality)
- `anthropic.claude-3-sonnet-20240229-v1:0` (alternative)

### Support Email

```env
SUPPORT_MAIL=support@yourdomain.com
```

Displayed on the candidate login page for assistance contact.

### SMTP Configuration (Email Sending)

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

**Gmail Setup (Recommended):**
1. Go to your Google Account → **Security**
2. Enable **2-Step Verification** (if not already enabled)
3. Go to **App Passwords** (search "App Passwords" in Google Account)
4. Generate a new app password for "Mail"
5. Use this 16-character password as `SMTP_PASS` (not your regular Gmail password)

**Alternative SMTP Providers:**

| Provider | Host | Port | Secure |
|---|---|---|---|
| Gmail | smtp.gmail.com | 465 | true |
| Outlook | smtp-mail.outlook.com | 587 | false |
| SendGrid | smtp.sendgrid.net | 587 | false |
| Mailgun | smtp.mailgun.org | 587 | false |

**Important:** For production, consider using a dedicated email service (SendGrid, Mailgun, AWS SES) for better deliverability and rate limits.

---

## Full `.env.local` Example

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# AWS Bedrock
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_MODEL_NAME=amazon.nova-lite-v1:0

# Support
SUPPORT_MAIL=support@yourdomain.com

# SMTP (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=youremail@gmail.com
SMTP_PASS=abcd efgh ijkl mnop
```

---

## Verification

After setting up, verify everything works:

### 1. Test Development Server

```bash
npm run dev
```

Visit http://localhost:3000 — you should see the landing page.

### 2. Test Supabase Connection

- Visit `/candidate/login`
- If the page loads without errors, Supabase is connected

### 3. Test AWS Bedrock

- Create an interview in admin panel
- Start a candidate interview
- If the AI responds, Bedrock is configured correctly

### 4. Test Email (Optional)

- Go to `/admin/interviews/[id]/send-email`
- Send a test email to yourself
- Check if it arrives in your inbox

---

## Common Issues

### ❌ "AWS Bedrock: AccessDeniedException"

**Cause:** Model access not enabled or invalid credentials.

**Fix:**
1. Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are correct
2. Go to AWS Console → Bedrock → Model Access and ensure the model is enabled
3. Check IAM user has `bedrock:InvokeModel` permission

### ❌ "Supabase: Invalid API key"

**Cause:** Wrong Supabase URL or anon key.

**Fix:**
1. Go to Supabase Dashboard → Settings → API
2. Copy the **Project URL** and **anon public key** exactly
3. Ensure no extra spaces or quotes in `.env.local`

### ❌ Emails not sending

**Cause:** SMTP configuration error or Gmail security blocking.

**Fix:**
1. Use an **App Password**, not your regular Gmail password
2. Ensure 2-Step Verification is enabled on your Google account
3. Check `SMTP_PORT` (465 for SSL, 587 for TLS) matches `SMTP_SECURE` setting
4. Review console/server logs for SMTP error messages

### ❌ Video upload fails

**Cause:** Supabase Storage bucket not created or permissions issue.

**Fix:**
1. Run the `supabase_setup.sql` script again
2. Verify the `videos` bucket exists in Supabase Dashboard → Storage
3. Ensure bucket is set to **public**

### ❌ Speech recognition not working

**Cause:** Browser compatibility or microphone permissions.

**Fix:**
1. Use **Chrome** or **Edge** (best Web Speech API support)
2. Allow microphone access when prompted by the browser
3. Ensure the candidate page is served over **HTTPS** (required for mic access in production)
4. In localhost, HTTP is allowed for development

---

## Production Checklist

Before deploying to production:

- [ ] Set `NEXT_PUBLIC_APP_URL` to your production domain
- [ ] Use production Supabase project (not development)
- [ ] Rotate AWS access keys (use production IAM user)
- [ ] Use a dedicated email service (SendGrid, SES, Mailgun)
- [ ] Enable HTTPS (required for microphone access)
- [ ] Review Supabase RLS policies (tighten from MVP defaults)
- [ ] Set up monitoring and error logging
- [ ] Test full candidate flow end-to-end
- [ ] Test admin email sending with production candidates

---

## Next Steps

- 📚 Read [ADMIN_GUIDE.md](./ADMIN_GUIDE.md) to learn how to create interviews and manage candidates
- 📚 Read [CANDIDATE_GUIDE.md](./CANDIDATE_GUIDE.md) to understand the interview experience
- 📚 Read [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment instructions
