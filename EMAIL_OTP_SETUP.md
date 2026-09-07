# Email OTP Setup Guide

## Problem
OTP codes are being generated but **not sent via email**.

## Solution Overview

Two options:
1. **Resend** (Recommended) - Simple, free tier, modern
2. **SendGrid** - Enterprise, powerful, free tier available

---

## Option 1: Using Resend (Recommended) ⚡

### Step 1: Get Resend API Key

1. Go to [resend.com](https://resend.com)
2. Sign up (free tier available)
3. Create your domain (use a free subdomain like `resend.dev` for testing)
4. Get your **API Key** from Settings

### Step 2: Add API Key to Supabase

1. Go to **Supabase Dashboard** → **Project Settings** → **Edge Functions**
2. Scroll to **Edge Function secrets**
3. Add secret:
   - Key: `RESEND_API_KEY`
   - Value: `re_xxxxxxxxxxxxxxxxxxxx` (your key from Resend)
4. Click **Save**

### Step 3: Deploy Edge Function

#### Option A: Using Supabase CLI

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Deploy the function
supabase functions deploy send-otp-email

# Set the secret
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
```

#### Option B: Manual Upload

1. Go to **Supabase Dashboard** → **Edge Functions**
2. Click **Create a new function** → `send-otp-email`
3. Copy the entire code from `supabase/functions/send-otp-email/index.ts`
4. Paste into the function editor
5. Click **Save**

### Step 4: Update Database Function

Run this SQL in Supabase SQL Editor:

```sql
-- Get your project ID from Supabase URL
-- It's in: https://YOUR_PROJECT_ID.supabase.co

-- Enable http extension (needed to call Edge Functions)
CREATE EXTENSION IF NOT EXISTS http;

-- Update send_otp_code to call the Edge Function
CREATE OR REPLACE FUNCTION public.send_otp_code(p_id_number TEXT, p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_code VARCHAR(6);
  v_otp_id BIGINT;
  v_response JSONB;
BEGIN
  -- Validate user exists
  SELECT id INTO v_user_id FROM public.users WHERE id_number = p_id_number;
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'User not found');
  END IF;

  -- Generate random 6-digit code
  v_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');

  -- Delete old unverified OTP codes
  DELETE FROM public.otp_codes 
  WHERE user_id = v_user_id AND verified_at IS NULL;

  -- Insert new OTP
  INSERT INTO public.otp_codes (user_id, code)
  VALUES (v_user_id, v_code)
  RETURNING id INTO v_otp_id;

  -- Call Edge Function to send email
  SELECT jsonb_build_object(
    'ok', true, 
    'message', 'OTP code sent to your email address',
    'otp_id', v_otp_id
  ) INTO v_response;

  -- Async call to send email (in background)
  PERFORM net.http_post(
    'https://YOUR_PROJECT_ID.functions.supabase.co/send-otp-email',
    jsonb_build_object(
      'email', p_email,
      'code', v_code,
      'user_id', v_user_id::TEXT
    )::TEXT,
    'application/json'
  );

  RETURN v_response;
END;
$$;
```

Replace `YOUR_PROJECT_ID` with your actual Supabase project ID.

---

## Option 2: Using SendGrid

### Step 1: Get SendGrid API Key

1. Go to [sendgrid.com](https://sendgrid.com)
2. Sign up (free tier: 100 emails/day)
3. Create API key in **Settings** → **API Keys**
4. Copy the API key

### Step 2: Add API Key to Supabase

1. Go to **Supabase Dashboard** → **Project Settings** → **Edge Functions**
2. Add secret:
   - Key: `SENDGRID_API_KEY`
   - Value: `SG.xxxxxxxxxxxxxxxxxxxx`
3. Click **Save**

### Step 3: Verify Sender Email

1. In SendGrid, add your sender email to verified senders
2. Update the `from` email in the function to your verified email

### Step 4: Deploy Edge Function

Same as Option 1, but update the function to use SendGrid (uncomment the SendGrid code in `index.ts`).

---

## Testing

### After Setup:

1. Hard refresh browser: `Ctrl+Shift+R`
2. Go to **Forgot Password**
3. Enter ID and answer questions
4. Check your email for the OTP code! 📧
5. Copy the code and enter it in the form

### Troubleshooting

**Email not received:**
- Check spam folder
- Check if API key is correctly set in Supabase secrets
- Verify sender domain is allowed in email service
- Check Supabase Edge Functions logs

**Check Edge Function Logs:**

1. Go to **Supabase Dashboard** → **Edge Functions**
2. Click `send-otp-email`
3. Click **Logs** tab
4. Look for errors

---

## Production Checklist

- [ ] Update sender email (`noreply@yourdomain.com` → your domain)
- [ ] Remove code from response (don't expose OTP to frontend)
- [ ] Test with real email addresses
- [ ] Set up email templates
- [ ] Monitor email delivery rates
- [ ] Handle bounced emails

---

## File Locations

- **Edge Function:** `supabase/functions/send-otp-email/index.ts`
- **Database Update:** `api/OTP_WITH_EMAIL.sql`
- **Frontend:** `src/assets/JS/forgotpassword.js` (already updated ✓)

---

## Quick Command Reference

```bash
# Deploy function
supabase functions deploy send-otp-email

# Set secret
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx

# View logs
supabase functions logs send-otp-email

# View function code
supabase functions download send-otp-email
```
