# Candidate Guide

Complete guide to the candidate interview experience — from login to completion.

## Table of Contents

1. [Overview](#overview)
2. [Candidate Login](#candidate-login)
3. [Pre-Interview Setup](#pre-interview-setup)
4. [The Interview Room](#the-interview-room)
5. [Answering Questions](#answering-questions)
6. [Interview Completion](#interview-completion)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

---

## Overview

As a candidate, you will experience a fully automated AI-driven technical interview. The system will:

- ✅ Ask you technical questions from a predefined question bank
- 🎙️ Listen to your spoken answers using speech-to-text
- 🔊 Speak questions aloud using text-to-speech
- 📹 Record your video throughout the session
- 📝 Maintain a live transcript of the conversation
- 🤖 Evaluate your answers using AI scoring

The entire process is automated and typically takes **20-45 minutes** depending on the number of questions.

---

## Candidate Login

**URL:** `/candidate/login`

### How to Log In

You should have received an **invitation email** with the following information:

- **Email Address:** Your registered email
- **Passkey:** A unique auto-generated password
- **Login Link:** Direct URL to the login page

**Steps:**

1. Click the login link in your email (or navigate to `/candidate/login`)
2. Enter your **email address** (the one from the invitation)
3. Enter your **passkey** (from the invitation email)
4. Click **"Login"**

### Authentication

The system validates your credentials against the Supabase `candidates` table:
- Checks if email matches a record
- Verifies the passkey is correct
- Confirms `is_allowed = true` (you're authorized for this interview)

If successful, you'll be redirected to the **Setup** page.

### Issues Logging In?

- **Double-check** your email and passkey (case-sensitive)
- **Copy-paste** from the email to avoid typos
- Contact the support email shown on the login page
- Reach out to your recruiter/hiring manager

---

## Pre-Interview Setup

**URL:** `/candidate/setup`

Before starting the interview, you must complete a system check to ensure your camera and microphone are working properly.

### Step 1: Confirm Your Name

- Enter your **full name** as you'd like it to appear in the results
- This name will be used in the evaluation report and video filename
- Click **"Confirm"** to proceed

### Step 2: Camera Check

The system will request access to your camera:

1. **Browser Prompt:** Click **"Allow"** when asked for camera permissions
2. **Live Preview:** You'll see yourself in a video preview box
3. **Verification:** The system confirms the camera is active

**If you don't see yourself:**
- Check if another app is using the camera
- Try a different browser (Chrome/Edge recommended)
- Ensure your camera is not blocked by privacy settings

### Step 3: Microphone Check

The system will test your microphone with an audio level visualizer:

1. **Browser Prompt:** Click **"Allow"** when asked for microphone permissions
2. **Speak Test Words:** Say something like "Testing, one, two, three"
3. **Watch the Level Bar:** It should move as you speak
4. **Confirmation:** The system confirms the mic is detecting audio

**If the mic isn't working:**
- Check if another app is using the microphone
- Try a different browser (Chrome/Edge recommended)
- Ensure your mic is not muted (physical switch or software)
- Check your operating system's privacy settings

### Step 4: Fullscreen Mode

**The interview requires fullscreen mode** to prevent distractions and ensure focus.

1. Click **"Enter Fullscreen"** or **"Start Interview"**
2. Your browser will prompt: **"Allow fullscreen?"** — Click **Allow**
3. The interview will begin immediately after entering fullscreen

⚠️ **Important:** You cannot exit fullscreen during the interview without ending the session.

---

## The Interview Room

**URL:** `/candidate/interview`

This is the main interview interface where the entire AI-driven conversation takes place.

### Layout

```
┌──────────────────────────────────────────────────────┐
│  [Header] Interview Title | Candidate Name           │
├──────────────────────────┬───────────────────────────┤
│                          │                           │
│   Video Preview          │   Live Transcript Panel   │
│   (Your Camera)          │   (AI & Candidate Text)   │
│                          │                           │
│                          │                           │
├──────────────────────────┴───────────────────────────┤
│  [Controls]                                          │
│  • Submit Answer Button                              │
│  • End Interview Button (if needed)                  │
│  • Microphone Status Indicator                       │
└──────────────────────────────────────────────────────┘
```

### Video Preview

- **Location:** Top-left or centered
- **Purpose:** Shows your camera feed throughout the interview
- **Recording Indicator:** A red dot or "Recording" label confirms video is being captured
- **Note:** You are being recorded from the moment the interview starts

### Live Transcript Panel

- **Location:** Right side or below video
- **Content:** Real-time text display of the conversation
- **Messages:**
  - **AI Messages:** Displayed in a distinct style (e.g., different color or alignment)
  - **Candidate Messages:** Displayed as you speak (interim results shown in real-time)
- **Scrolling:** Auto-scrolls to the latest message
- **Purpose:** Allows you to read along if you miss something spoken

### Controls

#### Submit Answer Button

- **When Active:** Click to submit your answer and move to the next question
- **When Disabled:** The AI is still speaking or processing
- **Shortcut:** Some versions may support keyboard shortcuts (check UI hints)

#### End Interview Button

- **Purpose:** Manually end the interview if needed
- **Use Cases:** Technical issues, emergencies, or early completion
- **Warning:** This action is **irreversible**. Use only when necessary.

#### Microphone Status Indicator

- **🟢 Active (Green):** Mic is on and listening
- **🔴 Inactive (Red):** Mic is off (AI is speaking)
- **⏸️ Processing:** Your answer is being sent to the AI

---

## Answering Questions

### The Conversation Flow

The interview follows a strict sequential pattern:

```
1. AI speaks the question aloud (Text-to-Speech)
       ↓
2. Microphone activates (Speech-to-Text listening)
       ↓
3. You speak your answer (speak naturally and clearly)
       ↓
4. You see your words appear in the transcript in real-time
       ↓
5. You finish speaking and review your answer
       ↓
6. Click "Submit Answer"
       ↓
7. Your answer is processed and sent to AI
       ↓
8. AI analyzes your answer and formulates response
       ↓
9. If your answer was partial/incorrect, AI may ask a follow-up
       ↓
10. AI speaks next question or moves forward
       ↓
11. Repeat until all questions are answered
```

### Speaking Your Answer

**Tips for Best Results:**

1. **Wait for the mic to activate** (green indicator)
2. **Speak clearly** at a normal pace
3. **Don't rush** — there's no time limit per question
4. **Structure your answer:** 
   - Start with a high-level overview
   - Dive into details
   - Provide examples if relevant
5. **Self-correct if needed** — the AI understands natural speech

### Using the Live Transcript

- **Monitor accuracy:** Check if the transcript matches what you said
- **Speech recognition is not perfect:** Minor errors are normal and handled by the AI
- **If recognition is very wrong:** Rephrase and speak again before submitting

### Follow-Up Questions

The AI may ask a **follow-up question** if:
- Your answer was incomplete
- Your answer was partially incorrect
- The AI wants to probe deeper into your understanding

**How to handle follow-ups:**
- Treat them like normal questions
- Provide more detail or clarification
- Only one follow-up per question (designed behavior)

### Skipping Questions

- **Not recommended:** You cannot go back to skipped questions
- **If stuck:** Provide a partial answer rather than skipping
- **Emergency:** Use "End Interview" if you cannot continue

---

## Interview Completion

### How the Interview Ends

The interview concludes when:
1. **All questions answered:** The AI has gone through the entire question bank
2. **AI returns `is_completed = true`:** The AI determines the interview is done
3. **Manual end:** You click "End Interview" (only if necessary)

### What Happens After

Once the interview ends:

1. **Video Recording Stops:** The MediaRecorder finalizes the `.webm` file
2. **Upload to Cloud:** Video is uploaded to Supabase Storage (may take a few seconds)
3. **Transcript Saved:** Full conversation history is stored
4. **AI Evaluation Triggered:** Your transcript is sent to the evaluation engine
5. **Scoring Generated:** AI generates scores across 4 dimensions (0-25 each)
6. **Results Saved:** Everything is stored in Supabase for admin review

### End Screen

You'll see a confirmation message:
- **"Interview Completed"** or similar
- Your video and answers have been recorded
- Results will be reviewed by the hiring team
- Thank you message

You can then close the browser window.

---

## Troubleshooting

### 🎤 Microphone Not Working

**Symptoms:** Mic indicator stays red, no transcript appears as you speak

**Solutions:**
1. Check browser permissions (click the lock icon in the address bar)
2. Ensure no other app is using the mic
3. Try a different browser (Chrome recommended)
4. Check OS privacy settings (Windows: Settings → Privacy → Microphone)
5. Refresh the page and re-do the setup

### 📹 Camera Not Working

**Symptoms:** Video preview is black or shows an error

**Solutions:**
1. Check browser permissions
2. Close other apps using the camera
3. Try a different browser
4. Check if your camera has a physical privacy switch (some laptops do)
5. Refresh the page

### 🔊 Can't Hear the AI

**Symptoms:** AI speaks but no audio comes through

**Solutions:**
1. Check your system volume
2. Check browser volume (some browsers have per-tab volume)
3. Ensure speakers/headphones are connected
4. Try a different browser
5. Read the transcript instead (text is always displayed)

### 📝 Speech Recognition Errors

**Symptoms:** Transcript shows wrong words frequently

**Solutions:**
1. Speak more slowly and clearly
2. Reduce background noise
3. Use a headset microphone (better audio)
4. The AI is designed to handle minor errors — don't worry too much
5. Rephrase if the recognition is severely wrong

### 🌐 Page Freezes or Crashes

**Symptoms:** UI becomes unresponsive

**Solutions:**
1. **Don't panic** — your progress is saved on the server
2. Refresh the page
3. Log in again with the same credentials
4. You may need to restart the interview (contact your recruiter if this happens)

### ⏱️ Interview Taking Too Long

**Causes:**
- Many questions in the bank
- Long follow-up questions
- AI processing time (network latency)

**Solutions:**
1. Take breaks between questions if needed
2. Keep answers concise but thorough
3. Use "End Interview" if you must leave (not recommended)

---

## Best Practices

### Before the Interview

- ✅ **Test your setup early:** Log in a day before to check camera/mic
- ✅ **Use a quiet environment:** Minimize background noise
- ✅ **Use a headset:** Better audio = better speech recognition
- ✅ **Close other apps:** Prevent interruptions and resource conflicts
- ✅ **Stable internet:** Wired connection or strong WiFi recommended
- ✅ **Charge your laptop:** Or keep it plugged in

### During the Interview

- ✅ **Speak naturally:** Don't rush or over-enunciate
- ✅ **Structure your answers:** Overview → Details → Examples
- ✅ **Take brief pauses:** Between thoughts to let the STT catch up
- ✅ **Monitor the transcript:** Ensure it's capturing your words
- ✅ **Stay in fullscreen:** Exiting may end the session
- ✅ **Be professional:** You're being recorded and evaluated

### Answering Technical Questions

- ✅ **Think out loud:** Explain your reasoning process
- ✅ **Admit uncertainty:** It's better than making things up
- ✅ **Use examples:** Concrete scenarios help demonstrate understanding
- ✅ **Relate to experience:** "In my previous project, I..." is a strong answer
- ✅ **Ask for clarification:** If the question is unclear, state that

### What NOT to Do

- ❌ Don't have someone else answer for you (video is recorded)
- ❌ Don't leave the interview running unattended
- ❌ Don't use external resources (the interview tests your knowledge)
- ❌ Don't exit fullscreen mode unnecessarily
- ❌ Don't panic over speech recognition errors — keep going

---

## Next Steps

- 📚 Read [SETUP.md](./SETUP.md) for installation details
- 📚 Read [ADMIN_GUIDE.md](./ADMIN_GUIDE.md) to understand what admins see
- 📚 Read [TECH_DOC.md](./TECH_DOC.md) for technical deep dive
