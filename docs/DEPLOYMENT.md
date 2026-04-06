# Deployment Guide

Production deployment instructions and best practices for the AI Interviewer Platform.

## Table of Contents

1. [Overview](#overview)
2. [Deployment Options](#deployment-options)
3. [Vercel Deployment (Recommended)](#vercel-deployment-recommended)
4. [Alternative Deployments](#alternative-deployments)
5. [Environment Configuration](#environment-configuration)
6. [Production Checklist](#production-checklist)
7. [Monitoring & Logging](#monitoring--logging)
8. [Security Hardening](#security-hardening)
9. [Cost Estimation](#cost-estimation)
10. [Scaling Considerations](#scaling-considerations)
11. [Troubleshooting](#troubleshooting)

---

## Overview

The AI Interviewer Platform is a Next.js application that can be deployed to any platform supporting Node.js. This guide covers the recommended deployment path and alternatives.

### Architecture in Production

```
┌───────────────────────────────────────────────────────┐
│                    CDN / Edge Network                 │
│              (Vercel Edge, Cloudflare)                │
└───────────────────────┬───────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────┐
│               Next.js Application Server               │
│         (Serverless Functions or Node Server)          │
│                                                        │
│  • Admin Pages (SSR/CSR)                               │
│  • Candidate Pages (CSR)                               │
│  • API Routes (Serverless Functions)                   │
└───────┬───────────────┬────────────────┬───────────────┘
        │               │                │
        ▼               ▼                ▼
   ┌────────┐    ┌──────────┐    ┌─────────────┐
   │ AWS    │    │ Supabase │    │ SMTP Service│
   │Bedrock │    │(DB+Auth) │    │ (SendGrid,  │
   │  (AI)  │    │          │    │   SES, etc) │
   └────────┘    └──────────┘    └─────────────┘
```

---

## Deployment Options

| Platform | Pros | Cons | Best For |
|---|---|---|---|
| **Vercel** (Recommended) | Zero-config, Next.js native, edge network | Vendor lock-in | Most users |
| **Netlify** | Easy setup, good free tier | Slightly slower builds | Small teams |
| **AWS (ECS/Elastic Beanstalk)** | Full control, integrates with Bedrock | Complex setup, more ops work | Enterprise |
| **Railway/Render** | Simple PaaS, good pricing | Less optimized for Next.js | Startups |
| **Self-hosted (VPS)** | Full control, cheapest at scale | Requires DevOps knowledge | Advanced users |

---

## Vercel Deployment (Recommended)

Vercel is the creators of Next.js and provide the most seamless deployment experience with optimal performance.

### Step 1: Prepare Your Repository

Ensure your code is pushed to GitHub:

```bash
git add .
git commit -m "Prepare for production deployment"
git push origin main
```

### Step 2: Connect to Vercel

1. Go to [vercel.com](https://vercel.com/) and sign up/login
2. Click **"Add New..."** → **Project**
3. Import your GitHub repository
4. Vercel will auto-detect Next.js configuration

### Step 3: Configure Environment Variables

In the Vercel project settings, add all environment variables:

**Navigate to:** Settings → Environment Variables

Add the following:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=https://your-domain.com

AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_MODEL_NAME=amazon.nova-lite-v1:0

SUPPORT_MAIL=support@yourdomain.com

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=youremail@gmail.com
SMTP_PASS=your-app-password
```

**Important:** Set variables for **Production**, **Preview**, and **Development** environments as needed.

### Step 4: Deploy

1. Click **"Deploy"**
2. Vercel will:
   - Run `npm install`
   - Run `npm run build`
   - Deploy to edge network
3. Your app will be live at `https://your-project.vercel.app`

### Step 5: Configure Custom Domain (Optional)

1. Go to **Settings** → **Domains**
2. Add your custom domain (e.g., `interviews.yourcompany.com`)
3. Follow DNS configuration instructions
4. Wait for SSL certificate provisioning (automatic)

### Step 6: Verify Deployment

Test all critical flows:
- ✅ Landing page loads
- ✅ Admin login works
- ✅ Candidate login works
- ✅ Interview creation works
- ✅ Email sending works
- ✅ Speech recognition works (requires HTTPS)
- ✅ Video upload works
- ✅ AI responses work

---

## Alternative Deployments

### Docker Deployment

For containerized deployment (AWS ECS, Railway, self-hosted):

**Create `Dockerfile`:**

```dockerfile
FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

**Create `.dockerignore`:**

```
node_modules
.next
.env*
.git
.dockerignore
Dockerfile
```

**Build and Run:**

```bash
docker build -t ai-interviewer .
docker run -p 3000:3000 --env-file .env.production ai-interviewer
```

### Next.js Standalone Mode

Update `next.config.ts`:

```typescript
const nextConfig = {
  output: 'standalone',
};

export default nextConfig;
```

This creates a minimal server in `.next/standalone` that can be deployed without the entire source tree.

---

## Environment Configuration

### Production Environment Variables

Create a `.env.production` file (do not commit to Git):

```env
# Supabase (Production Project)
NEXT_PUBLIC_SUPABASE_URL=https://your-prod-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=prod-anon-key

# Application URL (Your production domain)
NEXT_PUBLIC_APP_URL=https://your-domain.com

# AWS Bedrock (Production IAM User)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=prod-aws-key
AWS_SECRET_ACCESS_KEY=prod-aws-secret
AWS_MODEL_NAME=amazon.nova-lite-v1:0

# Support Email
SUPPORT_MAIL=support@yourcompany.com

# Production SMTP (e.g., SendGrid)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=sendgrid-api-key
```

### Environment Variable Validation

Create `lib/env-validation.ts`:

```typescript
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}
```

Import this in your API routes to fail fast on startup.

---

## Production Checklist

### Before Deployment

- [ ] **Supabase Production Project Created**
  - Create a separate Supabase project for production
  - Run `supabase_setup.sql` in the production project
  - Tighten RLS policies (see DATABASE_SCHEMA.md)

- [ ] **AWS IAM User Created**
  - Create production IAM user with minimal permissions
  - Policy should only allow `bedrock:InvokeModel`
  - Rotate access keys

- [ ] **Email Service Configured**
  - Use a dedicated email service (SendGrid, AWS SES, Mailgun)
  - Verify sending domain
  - Set up DKIM/SPF records
  - Test email deliverability

- [ ] **Environment Variables Set**
  - All variables configured in deployment platform
  - No hardcoded secrets in code
  - `.env.local` not committed to Git

- [ ] **Custom Domain Configured**
  - DNS records updated
  - SSL certificate active
  - HTTPS enforced

### Post-Deployment

- [ ] **All Flows Tested End-to-End**
  - Create interview → Upload candidates → Send emails → Candidate completes → Review results

- [ ] **Error Monitoring Set Up**
  - Sentry, LogRocket, or similar
  - AWS CloudWatch alarms for Bedrock errors
  - Supabase logs monitored

- [ ] **Performance Tested**
  - Page load times < 2 seconds
  - API response times < 5 seconds
  - Video upload works reliably

- [ ] **Backup Strategy Implemented**
  - Supabase automated backups enabled
  - Video storage retention policy defined
  - Database export schedule configured

- [ ] **Security Review Completed**
  - RLS policies tightened
  - Rate limiting added (if needed)
  - Dependencies audited (`npm audit`)

---

## Monitoring & Logging

### Vercel Logs

**Access logs:**
- Dashboard → Your Project → **Logs**
- View runtime logs for all serverless functions
- Filter by environment (Production/Preview)

**Key logs to monitor:**
- API route errors (`/api/interviewer`, `/api/evaluate`)
- SMTP failures (`/api/send-invites`)
- Supabase connection issues

### AWS CloudWatch

Monitor Bedrock usage:
1. Go to **CloudWatch** → **Metrics**
2. Filter by `Bedrock` service
3. Track:
   - `Invocations` (API call count)
   - `InputTokenCount` / `OutputTokenCount` (usage volume)
   - `InvocationLatency` (response times)
   - `InvocationError` (failures)

**Set up alarms:**
- Error rate > 5% → Notify
- Latency > 10s → Notify
- Daily spend > threshold → Alert

### Supabase Logs

**Dashboard → Logs:**
- Database query logs
- Auth logs (login attempts)
- Storage logs (video uploads)

**Key queries to monitor:**
- Failed login attempts (potential abuse)
- Large result inserts (anomaly detection)

### Error Tracking (Recommended: Sentry)

**Setup:**

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

**Configure `sentry.client.config.ts` and `sentry.server.config.ts`:**

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
});
```

**Capture errors in API routes:**

```typescript
import * as Sentry from '@sentry/nextjs';

try {
  // Your code
} catch (error) {
  Sentry.captureException(error);
  throw error;
}
```

---

## Security Hardening

### 1. Tighten Supabase RLS Policies

See [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for production RLS policy recommendations.

### 2. Add Rate Limiting

Create middleware for rate limiting:

**Install:**
```bash
npm install express-rate-limit
```

**Create `middleware.ts`:**
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const rateLimit = new Map<string, { count: number; resetTime: number }>();

export function middleware(request: NextRequest) {
  const ip = request.ip || 'unknown';
  const now = Date.now();
  
  const limit = rateLimit.get(ip);
  
  if (!limit || now > limit.resetTime) {
    rateLimit.set(ip, { count: 1, resetTime: now + 60000 });
    return NextResponse.next();
  }
  
  if (limit.count > 10) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  
  limit.count++;
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
```

### 3. Rotate Secrets Regularly

- **AWS Access Keys:** Every 90 days
- **Supabase Anon Key:** If compromised
- **SMTP Passwords:** Every 60 days

### 4. Enable HTTPS Everywhere

- Force HTTPS redirects (Vercel does this automatically)
- Use HSTS headers
- Ensure all external services use HTTPS

### 5. Audit Dependencies

```bash
npm audit
npm audit fix
```

Run this regularly or set up automated Dependabot/Renovate PRs.

### 6. Add CORS Restrictions

If API routes are publicly accessible, add CORS validation:

```typescript
const allowedOrigins = [process.env.NEXT_PUBLIC_APP_URL];

const origin = request.headers.get('origin');
if (!allowedOrigins.includes(origin)) {
  return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
}
```

---

## Cost Estimation

### Monthly Cost Breakdown (Approximate)

| Service | Free Tier | Paid (100 interviews/mo) | Paid (1000 interviews/mo) |
|---|---|---|---|
| **Vercel** | ✅ Free (hobby) | $20/mo (Pro) | $20/mo (Pro) |
| **Supabase** | ✅ Free (500MB DB, 1GB storage) | $25/mo (Pro) | $25/mo (Pro) |
| **AWS Bedrock** | ❌ No free tier | ~$5-15/mo | ~$50-150/mo |
| **Email (SendGrid)** | ✅ Free (100/day) | $20/mo (50k emails) | $90/mo (100k emails) |
| **Video Storage** | ✅ Included in Supabase | Extra: ~$5/mo | Extra: ~$20/mo |
| **Domain/SSL** | ~$10/yr | ~$10/yr | ~$10/yr |
| **Total** | **~$0-10/mo** | **~$75-85/mo** | **~$315-325/mo** |

### AWS Bedrock Cost Details

**Pricing for `amazon.nova-lite-v1:0`:**
- Input: $0.0006 / 1K tokens
- Output: $0.0024 / 1K tokens

**Per interview (estimate):**
- Interviewer API: ~10 calls × 2K tokens = ~20K tokens = $0.012
- Evaluation: ~1 call × 5K tokens = ~5K tokens = $0.009
- **Total per interview:** ~$0.02

**For 100 interviews:** ~$2
**For 1000 interviews:** ~$20

### Cost Optimization Tips

1. **Use `nova-lite` instead of `nova-pro`:** 5x cheaper
2. **Cache frequent responses:** If questions repeat
3. **Batch evaluations:** If running multiple candidates
4. **Monitor usage:** Set up AWS Budgets alerts
5. **Delete old videos:** Move to cold storage (S3 Glacier)

---

## Scaling Considerations

### Current Architecture Limits

| Component | Limit | When to Scale |
|---|---|---|
| **Vercel Serverless Functions** | 10s timeout (Hobby), 60s (Pro) | If AI responses take > 10s consistently |
| **Supabase DB** | 500MB (Free), 8GB (Pro) | When approaching storage limit |
| **Supabase Storage** | 1GB (Free), 100GB (Pro) | When video storage exceeds limit |
| **AWS Bedrock** | Rate limits (requests/sec) | If concurrent interviews spike |
| **SMTP** | Provider-dependent (e.g., 100/day free) | When email volume exceeds quota |

### Horizontal Scaling

**Next.js:** Already scales horizontally (stateless serverless functions)

**Supabase:** Upgrade plan or use connection pooling

**AWS Bedrock:** No scaling needed (managed service)

### Performance Optimization

1. **Enable Next.js caching:**
   ```typescript
   const nextConfig = {
     experimental: {
       staleTimes: {
         dynamic: 30,
         static: 300,
       },
     },
   };
   ```

2. **Use Edge Functions for simple APIs:**
   ```typescript
   export const runtime = 'edge';
   ```

3. **Optimize video delivery:**
   - Use CDN (already CDN-backed by Supabase)
   - Compress videos before upload
   - Consider streaming (HLS/DASH) for large files

4. **Database query optimization:**
   - Add indexes (already in schema)
   - Use connection pooling (Supabase provides this)
   - Cache frequent queries (Redis or Vercel KV)

---

## Troubleshooting

### ❌ Deployment Fails

**Symptoms:** Build errors, missing environment variables

**Solutions:**
1. Check build logs in deployment dashboard
2. Verify all environment variables are set
3. Run `npm run build` locally to catch errors
4. Check Node.js version compatibility

### ❌ API Routes Timeout

**Symptoms:** AWS Bedrock calls take > 10s

**Solutions:**
1. Increase Vercel function timeout (Pro plan: up to 60s)
2. Optimize AI prompts (shorter = faster)
3. Use a faster AI model (`nova-lite` vs `nova-pro`)
4. Add retry logic with shorter timeouts

### ❌ Videos Not Uploading

**Symptoms:** Interview completes but video_url is null

**Solutions:**
1. Check Supabase Storage bucket exists and is public
2. Verify storage permissions/RLS policies
3. Check video file size (may exceed limit)
4. Review browser console for upload errors

### ❌ Emails Going to Spam

**Symptoms:** Candidates report emails in spam folder

**Solutions:**
1. Use a dedicated email service (SendGrid, SES)
2. Verify your domain (DKIM, SPF, DMARC)
3. Avoid spam trigger words in subject/body
4. Include unsubscribe link
5. Warm up your sending domain gradually

### ❌ Speech Recognition Fails in Production

**Symptoms:** Works locally but not on deployed site

**Solutions:**
1. **Ensure HTTPS:** Web Speech API requires secure context
2. Check browser permissions
3. Test in multiple browsers
4. Verify microphone access is allowed

---

## Continuous Deployment

### GitHub Actions (Optional)

For automated deployments on push to main:

**.github/workflows/deploy.yml:**
```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install Vercel CLI
        run: npm install -g vercel
      
      - name: Pull Vercel Environment
        run: vercel pull --yes --environment=production --token=$VERCEL_TOKEN
      
      - name: Build
        run: vercel build --prod --token=$VERCEL_TOKEN
      
      - name: Deploy
        run: vercel deploy --prebuilt --prod --token=$VERCEL_TOKEN
```

---

## Next Steps

- 📚 Read [SETUP.md](./SETUP.md) for initial configuration
- 📚 Read [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for production database hardening
- 📚 Read [ADMIN_GUIDE.md](./ADMIN_GUIDE.md) for post-deployment usage instructions
