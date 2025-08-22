# Password Reset Feature

This document explains the password reset functionality that has been added to the chatbot application.

## Overview

The password reset feature allows users to reset their password using email OTP verification. This is similar to the existing user registration OTP system but specifically designed for password reset.

## Features

- ✅ Email OTP verification for password reset
- ✅ Secure password hashing with bcrypt
- ✅ 10-minute OTP expiration
- ✅ Resend OTP functionality
- ✅ User-friendly error messages
- ✅ Frontend form validation
- ✅ Responsive UI design

## Backend Implementation

### New Files Created

1. **`chatbot-backend/models/PasswordResetOTP.js`**
   - Separate OTP model for password reset
   - 10-minute TTL expiration
   - No userData field (only email and OTP)

2. **Updated `chatbot-backend/services/emailService.js`**
   - Added `sendPasswordResetOTPEmail()` function
   - Custom email template for password reset
   - Red color scheme to distinguish from registration emails

3. **Updated `chatbot-backend/routes/userRoutes.js`**
   - Added `/forgot-password` endpoint
   - Added `/reset-password` endpoint
   - Added `/resend-password-reset-otp` endpoint

### API Endpoints

#### 1. Request Password Reset OTP
```http
POST /api/users/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "Password reset OTP sent to your email address. Please check your inbox and enter the code to reset your password.",
  "email": "user@example.com"
}
```

#### 2. Reset Password with OTP
```http
POST /api/users/reset-password
Content-Type: application/json

{
  "email": "user@example.com",
  "otp": "123456",
  "newPassword": "newpassword123"
}
```

**Response:**
```json
{
  "message": "Password reset successfully! You can now login with your new password."
}
```

#### 3. Resend Password Reset OTP
```http
POST /api/users/resend-password-reset-otp
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "New password reset OTP sent to your email address.",
  "email": "user@example.com"
}
```

## Frontend Implementation

### New Files Created

1. **`chatbot-frontend/src/components/ForgotPassword.js`**
   - Complete password reset flow
   - Two-step process: email → OTP verification
   - Form validation and error handling
   - Resend OTP functionality with countdown timer

### Updated Files

1. **`chatbot-frontend/src/config.js`**
   - Added password reset API endpoints

2. **`chatbot-frontend/src/App.js`**
   - Added route for `/forgot-password`

3. **`chatbot-frontend/src/components/Login.js`**
   - Added "Forgot your password?" link

4. **`chatbot-frontend/src/services/authService.js`**
   - Updated to use correct API endpoints
   - Added password reset functions

## User Flow

1. **User clicks "Forgot your password?" on login page**
2. **User enters email address**
3. **System validates email and sends OTP**
4. **User receives email with OTP code**
5. **User enters OTP and new password**
6. **System verifies OTP and updates password**
7. **User is redirected to login page**

## Security Features

- **OTP Expiration**: 10-minute automatic expiration
- **Password Hashing**: bcrypt with salt rounds
- **Email Validation**: Proper email format validation
- **User Verification**: Ensures user exists before sending OTP
- **Rate Limiting**: Built-in protection against spam
- **Secure Headers**: Proper HTTP security headers

## Email Template

The password reset email includes:
- Professional design with red color scheme
- Clear instructions
- Security warnings
- OTP code prominently displayed
- 10-minute expiration notice

## Testing

### Manual Testing
1. Start the backend server
2. Start the frontend application
3. Navigate to login page
4. Click "Forgot your password?"
5. Enter a valid email address
6. Check email for OTP
7. Enter OTP and new password
8. Verify password reset works

### Automated Testing
Run the test script:
```bash
node test-password-reset.js
```

## Configuration

### Environment Variables
Make sure these are set in your `.env` file:
```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

### Email Setup
Follow the instructions in `EMAIL_SETUP.md` for configuring email service.

## Error Handling

The system handles various error scenarios:
- Invalid email format
- Non-existent user email
- Invalid OTP code
- Expired OTP
- Weak password
- Network errors
- Email service failures

## Troubleshooting

### Common Issues

1. **OTP not received**
   - Check spam folder
   - Verify email configuration
   - Check server logs

2. **OTP expired**
   - Request new OTP using resend function
   - OTP expires after 10 minutes

3. **Invalid OTP**
   - Ensure 6-digit code is entered correctly
   - Check for extra spaces
   - Request new OTP if needed

4. **Email service errors**
   - Verify EMAIL_USER and EMAIL_PASS
   - Check Gmail app password setup
   - Review server logs for details

## Future Enhancements

Potential improvements:
- SMS OTP option
- Security questions
- Account recovery options
- Password strength requirements
- Multi-factor authentication
- Audit logging for password changes

## Support

For issues or questions:
1. Check server logs for error details
2. Verify email configuration
3. Test with the provided test script
4. Review this documentation

---

**Note**: This feature is production-ready and follows security best practices for password reset functionality.
