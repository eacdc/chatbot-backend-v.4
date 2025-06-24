# Email Service Setup for OTP Verification

## 🚀 **Quick Start - Development Mode (Dummy OTP)**

For testing and development, you can use dummy OTP mode:

```env
USE_DUMMY_OTP=true
```

When enabled:
- **No email setup required**
- **Always uses OTP: 123456**
- **Perfect for testing the OTP flow**
- **Skips actual email sending**

## 📧 **Production Mode (Real Email)**

Remove or set `USE_DUMMY_OTP=false` and configure email:

```env
USE_DUMMY_OTP=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

## Required Environment Variables

Add these variables to your `.env` file in the backend root directory:

```env
# For Development/Testing (Dummy OTP)
USE_DUMMY_OTP=true

# OR For Production (Real Email)
USE_DUMMY_OTP=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

## Gmail Setup (For Production Only)

1. **Enable 2-Factor Authentication** on your Google account
2. **Generate an App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
   - Use this 16-character password as `EMAIL_PASS`

3. **Example production configuration:**
```env
USE_DUMMY_OTP=false
EMAIL_USER=yourapp@gmail.com
EMAIL_PASS=abcd efgh ijkl mnop
```

## Alternative Email Providers

### Outlook/Hotmail
```env
USE_DUMMY_OTP=false
EMAIL_USER=your-email@outlook.com
EMAIL_PASS=your-password
```

### Custom SMTP (modify emailService.js)
```javascript
const transporter = nodemailer.createTransport({
    host: 'smtp.your-provider.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});
```

## Testing

### Development Mode Testing
```bash
POST /api/users/send-otp
{
  "username": "testuser",
  "fullname": "Test User",
  "email": "test@example.com",
  "phone": "1234567890",
  "role": "student",
  "grade": "10",
  "password": "testpass123"
}

# Response will include: "developmentMode": true, "dummyOTP": "123456"
# Use OTP 123456 to verify
```

### Production Mode Testing
Same request, but with real email credentials configured.

## Switching Between Modes

### 🔧 Development → Production
1. Set `USE_DUMMY_OTP=false`
2. Add `EMAIL_USER` and `EMAIL_PASS`
3. Restart your backend

### 🚀 Production → Development  
1. Set `USE_DUMMY_OTP=true`
2. Restart your backend
3. Use OTP: 123456 for all verifications

## Troubleshooting

- **"Invalid login"**: Check if 2FA is enabled and you're using app password
- **"Connection timeout"**: Check firewall/network settings
- **"Authentication failed"**: Verify email and password are correct
- **"Service not recognized"**: Check service name in transporter config
- **Dummy OTP not working**: Ensure `USE_DUMMY_OTP=true` is set correctly 