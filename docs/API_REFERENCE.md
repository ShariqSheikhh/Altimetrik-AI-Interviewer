# API Reference

Complete documentation for all API endpoints in the AI Interviewer Platform.

## Table of Contents

1. [AI Interviewer](#1-post-apiinterviewer)
2. [AI Evaluation](#2-post-apievaluate)
3. [Send Invitations](#3-post-apisend-invites)
4. [Support Email](#4-get-apisupport-email)

---

## 1. POST `/api/interviewer`

AI interviewer agent endpoint. Processes candidate answers and generates the next question or response using AWS Bedrock.

### Overview

| Property | Value |
|---|---|
| **Method** | `POST` |
| **Content-Type** | `application/json` |
| **Authentication** | None (stateless) |
| **AI Model** | AWS Bedrock `amazon.nova-lite-v1:0` |
| **Response Time** | 2-8 seconds (depends on model and answer length) |

### Request Body

```typescript
{
  questionBank: {
    question: string;
    keyPoints?: string;
  }[];
  conversationHistory: {
    speaker: 'AI' | 'CANDIDATE';
    text: string;
  }[];
  currentStep: 'GREETING' | 'INTRODUCTION' | 'QUESTION' | 'COMPLETED';
  questionIndex: number;
  candidateAnswer?: string;
  followUpCount: number;
}
```

#### Field Descriptions

| Field | Type | Required | Description |
|---|---|---|---|
| `questionBank` | Array | ✅ | Array of questions with optional key points |
| `conversationHistory` | Array | ✅ | Full conversation context for the AI |
| `currentStep` | String | ✅ | Current interview phase |
| `questionIndex` | Number | ✅ | Index of the current question (0-based) |
| `candidateAnswer` | String | ❌ | Candidate's spoken answer (STT output) |
| `followUpCount` | Number | ✅ | Number of follow-ups already asked (max 1) |

### Response

```typescript
{
  response: string;
  nextQuestion: string | null;
  isCompleted: boolean;
  currentStep: 'GREETING' | 'INTRODUCTION' | 'QUESTION' | 'COMPLETED';
}
```

#### Field Descriptions

| Field | Type | Description |
|---|---|---|
| `response` | String | AI's spoken response (question or acknowledgment) |
| `nextQuestion` | String or null | Next question to ask (null if continuing current) |
| `isCompleted` | Boolean | Whether the interview is complete |
| `currentStep` | String | Updated step for the next request |

### Example Request

```json
POST /api/interviewer
Content-Type: application/json

{
  "questionBank": [
    {
      "question": "Explain the difference between let, const, and var in JavaScript.",
      "keyPoints": "Scope differences, hoisting behavior, reassignment rules"
    },
    {
      "question": "What is a closure? Provide an example.",
      "keyPoints": "Function + lexical environment, practical use case"
    }
  ],
  "conversationHistory": [
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
      "text": "Well, var is function scoped and let and const are block scoped. Const can't be reassigned."
    }
  ],
  "currentStep": "QUESTION",
  "questionIndex": 0,
  "candidateAnswer": "Well, var is function scoped and let and const are block scoped. Const can't be reassigned.",
  "followUpCount": 0
}
```

### Example Response

```json
{
  "response": "Good start. You mentioned the key differences. Can you elaborate on how hoisting behaves differently with var compared to let and const?",
  "nextQuestion": null,
  "isCompleted": false,
  "currentStep": "QUESTION"
}
```

### AI Behavior

The system prompt instructs the AI to:

1. **Act as a professional technical interviewer**
2. **Follow the question bank** sequentially
3. **Acknowledge answers** positively before moving on
4. **Ask one follow-up** if the answer is partial/wrong (when `followUpCount === 0`)
5. **Move to the next question** after a satisfactory answer or follow-up
6. **Complete the interview** when all questions are answered

### Guardrails

| Protection | Implementation |
|---|---|
| **Input Sanitization** | Candidate answers are sanitized before sending to Bedrock |
| **Prompt Injection Detection** | Inputs are checked for malicious patterns |
| **Output Cleaning** | Markdown code fences (` ``` `) are stripped from responses |
| **System Artifact Removal** | AI thinking tags and internal markers are removed |
| **JSON Parse Fallback** | If JSON parsing fails, regex extraction is used as fallback |
| **Error Handling** | Returns graceful error response instead of crashing |

### Error Response

```json
{
  "response": "I apologize, but I encountered an error processing your answer. Let's move to the next question.",
  "nextQuestion": "What is a closure? Provide an example.",
  "isCompleted": false,
  "currentStep": "QUESTION"
}
```

### AWS Bedrock Integration

```typescript
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({
  region: process.env.REGION,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID!,
    secretAccessKey: process.env.SECRET_ACCESS_KEY!,
  },
});

const command = new InvokeModelCommand({
  modelId: process.env.MODEL_NAME || 'amazon.nova-lite-v1:0',
  contentType: 'application/json',
  accept: 'application/json',
  body: JSON.stringify({
    messages: [{ role: 'user', content: prompt }],
    inferenceConfig: { maxTokens: 1000, temperature: 0.7 },
  }),
});

const response = await client.send(command);
```

---

## 2. POST `/api/evaluate`

Post-interview evaluation endpoint. Analyzes the full transcript and generates AI scores across four dimensions.

### Overview

| Property | Value |
|---|---|
| **Method** | `POST` |
| **Content-Type** | `application/json` |
| **Authentication** | None (stateless) |
| **AI Model** | AWS Bedrock `amazon.nova-lite-v1:0` |
| **Response Time** | 5-15 seconds (depends on transcript length) |

### Request Body

```typescript
{
  transcript: {
    speaker: 'AI' | 'CANDIDATE';
    text: string;
  }[];
  questionBank: {
    question: string;
    keyPoints?: string;
  }[];
}
```

#### Field Descriptions

| Field | Type | Required | Description |
|---|---|---|---|
| `transcript` | Array | ✅ | Full interview conversation (AI + candidate) |
| `questionBank` | Array | ✅ | Questions with key points for scoring context |

### Response

```typescript
{
  evaluation: {
    overallScore: number;
    breakdown: {
      communicationClarity: number;
      relevanceAndDepth: number;
      problemSolvingAndCriticalThinking: number;
      specificityAndExamples: number;
    };
    feedback: string;
  };
}
```

#### Field Descriptions

| Field | Type | Description |
|---|---|---|
| `overallScore` | Number (0-100) | Composite score across all dimensions |
| `communicationClarity` | Number (0-25) | How clearly the candidate expressed ideas |
| `relevanceAndDepth` | Number (0-25) | Whether answers were on-topic and thorough |
| `problemSolvingAndCriticalThinking` | Number (0-25) | Analytical approach and reasoning quality |
| `specificityAndExamples` | Number (0-25) | Use of concrete examples and details |
| `feedback` | String | Detailed qualitative feedback summarizing performance |

### Example Request

```json
POST /api/evaluate
Content-Type: application/json

{
  "transcript": [
    {
      "speaker": "AI",
      "text": "Welcome to the interview. Let's start with the first question."
    },
    {
      "speaker": "AI",
      "text": "Explain the difference between let, const, and var in JavaScript."
    },
    {
      "speaker": "CANDIDATE",
      "text": "Var is function-scoped and can be hoisted. Let and const are block-scoped. Const cannot be reassigned while let can."
    },
    {
      "speaker": "AI",
      "text": "Great. Next question: What is a closure? Provide an example."
    },
    {
      "speaker": "CANDIDATE",
      "text": "A closure is when a function remembers its lexical scope even when executed outside that scope. For example, a counter function that maintains a private variable."
    }
  ],
  "questionBank": [
    {
      "question": "Explain the difference between let, const, and var in JavaScript.",
      "keyPoints": "Scope differences, hoisting behavior, reassignment rules"
    },
    {
      "question": "What is a closure? Provide an example.",
      "keyPoints": "Function + lexical environment, practical use case"
    }
  ]
}
```

### Example Response

```json
{
  "evaluation": {
    "overallScore": 78,
    "breakdown": {
      "communicationClarity": 20,
      "relevanceAndDepth": 19,
      "problemSolvingAndCriticalThinking": 20,
      "specificityAndExamples": 19
    },
    "feedback": "The candidate demonstrated a solid understanding of JavaScript fundamentals. Answers were clear and well-structured, with good use of examples. Could improve by providing more in-depth explanations and edge case awareness."
  }
}
```

### Evaluation Prompt

The AI is instructed to:

1. **Score each dimension independently** (0-25 scale)
2. **Consider the question bank** when evaluating answer quality
3. **Be fair but strict** — scores should reflect actual performance
4. **Provide actionable feedback** — specific strengths and areas for improvement
5. **Calculate overall score** as the sum of all four dimensions (0-100)

### Guardrails

Same as `/api/interviewer`:
- Input sanitization
- Output markdown stripping
- JSON parse fallback
- Error handling with graceful degradation

---

## 3. POST `/api/send-invites`

Bulk email sending endpoint. Sends personalized invitation emails to candidates using Nodemailer.

### Overview

| Property | Value |
|---|---|
| **Method** | `POST` |
| **Content-Type** | `application/json` |
| **Authentication** | None (called from admin UI) |
| **Email Library** | Nodemailer |
| **SMTP** | Configurable (Gmail default) |
| **Retry Logic** | 3 attempts with exponential backoff |

### Request Body

```typescript
{
  candidates: {
    name: string;
    email: string;
    passkey: string;
  }[];
  interviewTitle: string;
  subject: string;
  emailTemplate: string; // HTML with template variables
  loginLink: string;
}
```

#### Field Descriptions

| Field | Type | Required | Description |
|---|---|---|---|
| `candidates` | Array | ✅ | List of candidates with credentials |
| `interviewTitle` | String | ✅ | Name of the interview for context |
| `subject` | String | ✅ | Email subject line |
| `emailTemplate` | String | ✅ | HTML body with template variables |
| `loginLink` | String | ✅ | Full URL to candidate login page |

### Response

```typescript
{
  success: boolean;
  sent: number;
  failed: number;
  total: number;
  results: {
    email: string;
    status: 'sent' | 'failed';
    error?: string;
  }[];
}
```

#### Field Descriptions

| Field | Type | Description |
|---|---|---|
| `success` | Boolean | Whether the operation completed (even with some failures) |
| `sent` | Number | Count of successfully sent emails |
| `failed` | Number | Count of failed emails |
| `total` | Number | Total candidates processed |
| `results` | Array | Per-candidate delivery status |

### Example Request

```json
POST /api/send-invites
Content-Type: application/json

{
  "candidates": [
    {
      "name": "John Doe",
      "email": "john.doe@example.com",
      "passkey": "a3f9k2m8x1"
    },
    {
      "name": "Jane Smith",
      "email": "jane.smith@example.com",
      "passkey": "b7c2n5p9w4"
    }
  ],
  "interviewTitle": "Backend Developer - Node.js Assessment Q2 2026",
  "subject": "Invitation: Technical Interview at Altimetrik",
  "emailTemplate": "<h2>Dear {{candidateName}},</h2><p>You are invited to: {{interviewTitle}}</p><p>Login with passkey: {{passkey}}</p><a href=\"{{loginLink}}\">Start Interview</a>",
  "loginLink": "http://localhost:3000/candidate/login"
}
```

### Example Response

```json
{
  "success": true,
  "sent": 2,
  "failed": 0,
  "total": 2,
  "results": [
    {
      "email": "john.doe@example.com",
      "status": "sent"
    },
    {
      "email": "jane.smith@example.com",
      "status": "sent"
    }
  ]
}
```

### Template Variables

The following variables are replaced in the HTML template:

| Variable | Replaced With |
|---|---|
| `{{candidateName}}` | Candidate's full name |
| `{{candidateEmail}}` | Candidate's email address |
| `{{passkey}}` | Auto-generated passkey |
| `{{loginLink}}` | Full URL to candidate login |
| `{{interviewTitle}}` | Interview name |

### SMTP Configuration

Uses environment variables from `.env.local`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=youremail@gmail.com
SMTP_PASS=your-app-password
```

### Retry Logic

Each email is sent with up to **3 retry attempts** using exponential backoff:

```
Attempt 1: Immediate
Attempt 2: After 2 seconds
Attempt 3: After 4 seconds
```

This handles transient failures like network timeouts or SMTP server throttling.

### Nodemailer Transport

```typescript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

await transporter.sendMail({
  from: `"Hiring Team" <${process.env.SMTP_USER}>`,
  to: candidateEmail,
  subject: subject,
  html: processedHtml,
});
```

---

## 4. GET `/api/support-email`

Returns the configured support email address for display in the UI.

### Overview

| Property | Value |
|---|---|
| **Method** | `GET` |
| **Authentication** | None |
| **Response Type** | JSON |

### Request

```
GET /api/support-email
```

No parameters or body required.

### Response

```typescript
{
  supportEmail: string;
}
```

### Example Response

```json
{
  "supportEmail": "support@yourdomain.com"
}
```

### Source

Returns the value of the `SUPPORT_MAIL` environment variable from `.env.local`.

### Usage

Called by the candidate login page to display a support contact:

```typescript
const response = await fetch('/api/support-email');
const { supportEmail } = await response.json();
// Display: "Need help? Contact: {supportEmail}"
```

---

## Rate Limiting & Security

### Current State (MVP)

| Endpoint | Rate Limiting | Authentication |
|---|---|---|
| `/api/interviewer` | ❌ None | None (stateless) |
| `/api/evaluate` | ❌ None | None (stateless) |
| `/api/send-invites` | ❌ None | None (called from admin UI) |
| `/api/support-email` | ❌ None | None |

### To-Do before Production

1. **Add rate limiting** using middleware (e.g., `express-rate-limit` or custom)
2. **Protect `/api/send-invites`** with admin authentication check
3. **Add request validation** (Zod or Joi schemas)
4. **Implement logging** for all API calls
5. **Add CORS restrictions** if API is exposed publicly
6. **Monitor AWS Bedrock usage** to control costs

---

## Error Handling

All endpoints follow a consistent error handling pattern:

### Error Response Format

```json
{
  "error": "Description of what went wrong"
}
```

### HTTP Status Codes

| Code | Meaning | When |
|---|---|---|
| `200` | OK | Successful response |
| `400` | Bad Request | Invalid or missing request data |
| `500` | Internal Server Error | Server-side failure (AWS, SMTP, DB) |

### Common Errors

| Endpoint | Error | Cause |
|---|---|---|
| `/api/interviewer` | `AWS Bedrock invocation failed` | Invalid credentials, model not accessible |
| `/api/evaluate` | `Failed to parse evaluation JSON` | AI returned malformed JSON (fallback used) |
| `/api/send-invites` | `SMTP connection failed` | Wrong SMTP config, network issue |
| `/api/support-email` | `Support email not configured` | `SUPPORT_MAIL` env var not set |

---

## Next Steps

- Read [ARCHITECTURE.md](./ARCHITECTURE.md) for system design details
- Read [TECH_DOC.md](./TECH_DOC.md) for technical deep dive
- Read [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for database structure
