# How to Test Email-Based Password Reset

## Current Setup Status

Your email-based password reset is configured in **DEVELOPMENT MODE**, which means:
- ✅ No email API key needed for testing
- ✅ OTP codes are logged to the **terminal/console**
- ✅ No actual emails are sent (free testing!)

## How to Test

### Step 1: Start Dev Server
```powershell
npm run dev
```

### Step 2: Request Password Reset
1. Go to: http://localhost:3000/auth/request-reset
2. Enter an email address that exists in your database
3. Click "Send OTP Code"

### Step 3: Find Your OTP Code
**Look at the terminal where `npm run dev` is running**. You'll see:
```
============================================================
📧 EMAIL NOTIFICATION (Development Mode)
============================================================
To: user@example.com
User: johndoe
OTP Code: 123456
Valid for: 10 minutes
============================================================
```

### Step 4: Complete Password Reset
1. Copy the 6-digit OTP code from the terminal
2. Go to: http://localhost:3000/auth/reset-password
3. Enter:
   - Your email address
   - The OTP code
   - Your new password
4. Click "Reset Password"

## Troubleshooting

### Problem: No OTP in terminal
**Check:**
- Is dev server running? (`npm run dev`)
- Did you use an email that exists in the database?
- Look for the boxed output with `📧 EMAIL NOTIFICATION`

### Problem: 500 Error
**Solution:**
```powershell
# Stop dev server (Ctrl+C)
npx prisma generate
npx prisma migrate dev
npm run dev
```

### Problem: User has no email
**Solution:** Add email to existing users:
```sql
-- Run in your database console (Neon)
UPDATE users 
SET email = 'test@example.com' 
WHERE username = 'yourusername';
```

## For Production (Real Emails)

When ready to send actual emails:

1. **Get Resend API Key:**
   - Sign up at https://resend.com (free tier: 3,000 emails/month)
   - Get your API key from dashboard

2. **Add to .env.local:**
   ```bash
   RESEND_API_KEY=re_your_api_key_here
   EMAIL_FROM=Basey Fare Guide <noreply@yourdomain.com>
   ```

3. **Restart dev server** - Emails will now be sent for real!

## Quick Test Commands

### Check if user has email:
```sql
SELECT username, email, "firstName", "lastName" 
FROM users 
WHERE username = 'yourusername';
```

### Add email to user:
```sql
UPDATE users 
SET email = 'your@email.com' 
WHERE username = 'yourusername';
```

### Test with curl:
```powershell
curl -X POST http://localhost:3000/api/auth/request-reset `
  -H "Content-Type: application/json" `
  -d '{\"email\":\"test@example.com\"}'
```

## What You Should See

### Success Response:
```json
{
  "message": "A 6-digit OTP code has been sent to your email address. The code is valid for 10 minutes.",
  "email": "t***t@example.com"
}
```

### Terminal Output:
```
============================================================
📧 EMAIL NOTIFICATION (Development Mode)
============================================================
To: test@example.com
User: testuser
OTP Code: 456789
Valid for: 10 minutes
============================================================
```

---

**Note:** In development mode, the OTP is ALWAYS logged to console, even if you don't have RESEND_API_KEY configured. This is intentional for easy testing!
