# Custom OTP Implementation - Forgot Password Flow

## What Changed

Your forgot password flow now sends **6-digit OTP codes** instead of magic links.

### Flow:
1. User enters ID number
2. System verifies security questions (2 of 3 must match)
3. **Generates 6-digit OTP code** ✨
4. User enters OTP code
5. User sets new password

---

## Setup Steps

### Step 1: Create OTP Database Structure

1. Go to **Supabase SQL Editor** → **New query**
2. Copy entire content from: **`api/CUSTOM_OTP_SETUP.sql`**
3. Click **Run**
4. Verify you see: "send_otp_code CREATED ✓", "verify_otp_code CREATED ✓", "cleanup_expired_otps CREATED ✓"

### Step 2: Update Frontend (Already Done ✓)

The following files have been updated:
- **`src/assets/JS/forgotpassword.js`** - Uses custom OTP system instead of magic links

---

## How It Works

### Database Functions Created

1. **`send_otp_code(id_number, email)`**
   - Generates random 6-digit code
   - Stores in database with 10-minute expiration
   - Returns the OTP (currently for testing; remove in production)

2. **`verify_otp_code(id_number, code)`**
   - Validates OTP against stored code
   - Checks expiration (10 minutes)
   - Limits attempts to 3
   - Marks OTP as verified

3. **`cleanup_expired_otps()`**
   - Removes expired and old OTP records
   - Can be run periodically via cron job

---

## Forgot Password Flow (Updated)

```
Step 1: Enter ID
   ↓
Step 2: Answer Security Questions (2/3 must match)
   ↓
Step 3: System generates OTP → Sends to email
        User enters 6-digit code
   ↓
Step 4: User enters new password
   ↓
Step 5: Password updated successfully
```

---

## Testing the OTP System

1. Apply `CUSTOM_OTP_SETUP.sql` in Supabase
2. Hard refresh browser: `Ctrl+Shift+R`
3. Test Forgot Password flow:
   - Enter ID number (e.g., 1234-5678)
   - Answer security questions
   - You'll see a 6-digit code
   - Enter the code
   - Set new password

---

## Email Configuration (Next Step)

Currently, the OTP code is returned in the response (for testing). To send via email:

1. Set up **Supabase Functions** or integrate with **SendGrid/Resend**
2. In `send_otp_code()` function, replace the test return with actual email sending
3. Remove the `'code'` from the return JSON (don't expose codes to client)

Example (using Supabase Edge Function):
```javascript
// Call your email service
await fetch('https://your-function.supabase.co/email/send-otp', {
  method: 'POST',
  body: JSON.stringify({ email, code })
});
```

---

## Security Notes

✅ **OTP expires in 10 minutes**  
✅ **Limited to 3 wrong attempts**  
✅ **Each user can have only one active OTP**  
✅ **OTP marked as verified prevents reuse**  
✅ **Automatic cleanup of expired codes**  

---

## Troubleshooting

### OTP not appearing
- Check Supabase SQL Editor shows all 3 functions created
- Check browser console for errors
- Verify user exists in system

### "Invalid or expired OTP"
- OTP expires after 10 minutes
- Reset by going back to Step 2
- Limited to 3 attempts per OTP

### OTP stuck as pending
- Clear browser cache
- Hard refresh: `Ctrl+Shift+R`
- Manually delete old OTP records:
  ```sql
  DELETE FROM public.otp_codes WHERE expires_at < now();
  ```

---

## Files Modified/Created

| File | Change |
|------|--------|
| `api/CUSTOM_OTP_SETUP.sql` | ✨ NEW - OTP database setup |
| `src/assets/JS/forgotpassword.js` | Updated - Uses OTP system |
| `src/components/ForgotPassword.vue` | No changes (already supports OTP input) |
| `src/components/ChangePassword.vue` | No changes |
