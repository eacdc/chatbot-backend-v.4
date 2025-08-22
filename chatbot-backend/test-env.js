require('dotenv').config();

console.log('🔍 Environment Variables Check:');
console.log('================================');

// Check required variables
console.log('✅ JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Missing');
console.log('✅ SESSION_SECRET:', process.env.SESSION_SECRET ? 'Set' : 'Missing');
console.log('✅ MONGODB_URI:', process.env.MONGODB_URI ? 'Set' : 'Missing');

// Check OAuth variables
console.log('🔐 GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Missing');
console.log('🔐 GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Missing');
console.log('🔐 FACEBOOK_APP_ID:', process.env.FACEBOOK_APP_ID ? 'Set' : 'Missing');
console.log('🔐 FACEBOOK_APP_SECRET:', process.env.FACEBOOK_APP_SECRET ? 'Set' : 'Missing');

// Check URL variables
console.log('🌐 BACKEND_URL:', process.env.BACKEND_URL || 'Not set (will use localhost:5000)');
console.log('🌐 FRONTEND_URL:', process.env.FRONTEND_URL || 'Not set (will use localhost:3000)');

// Calculate callback URLs
const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
const googleCallbackUrl = `${backendUrl}/api/social-auth/google/callback`;
const facebookCallbackUrl = `${backendUrl}/api/social-auth/facebook/callback`;

console.log('\n🔗 Callback URLs:');
console.log('Google:', googleCallbackUrl);
console.log('Facebook:', facebookCallbackUrl);

console.log('\n📋 Next Steps:');
if (!process.env.BACKEND_URL) {
    console.log('⚠️  Set BACKEND_URL in your Render environment variables');
}
if (!process.env.FRONTEND_URL) {
    console.log('⚠️  Set FRONTEND_URL in your Render environment variables');
}
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    console.log('✅ Google OAuth should work');
} else {
    console.log('❌ Google OAuth credentials missing');
}
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    console.log('✅ Facebook OAuth should work');
} else {
    console.log('❌ Facebook OAuth credentials missing');
}
