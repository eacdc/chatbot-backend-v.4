# Email Service Setup for OTP Verification

## Required Environment Variables

Add these variables to your `.env` file in the backend root directory:

```env
# Email Service Configuration (for OTP verification)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

## Gmail Setup (Recommended)

1. **Enable 2-Factor Authentication** on your Google account
2. **Generate an App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
   - Use this 16-character password as `EMAIL_PASS`

3. **Example configuration:**
```env
EMAIL_USER=yourapp@gmail.com
EMAIL_PASS=abcd efgh ijkl mnop
```

## Alternative Email Providers

### Outlook/Hotmail
```env
EMAIL_USER=your-email@outlook.com
EMAIL_PASS=your-password
```

### Custom SMTP (modify emailService.js)
```javascript
const transporter = nodemailer.createTransporter({
    host: 'smtp.your-provider.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});
```

## Testing Email Service

You can test the email service by sending a test OTP through the API endpoint:
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
```

## Troubleshooting

- **"Invalid login"**: Check if 2FA is enabled and you're using app password
- **"Connection timeout"**: Check firewall/network settings
- **"Authentication failed"**: Verify email and password are correct
- **"Service not recognized"**: Check service name in transporter config 