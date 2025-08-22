# Company Information Update Guide

## 📍 Where to Update Contact Emails and Company Details

All company information is now centralized in one file for easy management:

### **File Location:** `chatbot-backend/config/companyConfig.js`

## 🔧 What You Need to Update

### 1. **Company Information**
```javascript
company: {
  name: "Your Company Name",           // ← Update this
  website: "https://yourcompany.com",  // ← Update this
  domain: "yourcompany.com",           // ← Update this
  legalName: "Your Company Legal Name", // ← Update this
  founded: "2024",                     // ← Update this
  industry: "Educational Technology"   // ← Update this
}
```

### 2. **Contact Email Addresses**
```javascript
contact: {
  support: "support@yourcompany.com",     // ← Update this
  privacy: "privacy@yourcompany.com",     // ← Update this
  legal: "legal@yourcompany.com",         // ← Update this
  billing: "billing@yourcompany.com",     // ← Update this
  general: "hello@yourcompany.com",       // ← Update this
}
```

### 3. **Physical Address**
```javascript
address: {
  street: "123 Main Street",    // ← Update this
  city: "Your City",           // ← Update this
  state: "Your State",         // ← Update this
  zipCode: "12345",            // ← Update this
  country: "Your Country"      // ← Update this
}
```

### 4. **Phone Numbers (Optional)**
```javascript
supportPhone: "+1-555-123-4567",  // ← Update this
salesPhone: "+1-555-987-6543",    // ← Update this
```

### 5. **App Information**
```javascript
app: {
  name: "Your Learning App",                    // ← Update this
  description: "AI-powered educational chatbot application", // ← Update this
  version: "1.0.0",                             // ← Update this
  platform: "Web, iOS, Android"                 // ← Update this
}
```

### 6. **Legal Information**
```javascript
legal: {
  privacyPolicyLastUpdated: "2024-01-15",  // ← Update this
  termsOfServiceLastUpdated: "2024-01-15", // ← Update this
  jurisdiction: "Your Country",             // ← Update this
  governingLaw: "Laws of Your Country"      // ← Update this
}
```

## 🎯 What Gets Updated Automatically

Once you update the `companyConfig.js` file, these will be automatically updated in:

### **Privacy Policy Endpoint** (`/api/static/privacy-policy`)
- ✅ Contact email addresses
- ✅ Physical address
- ✅ Response times
- ✅ Last updated date

### **FAQ Endpoint** (`/api/static/faq`)
- ✅ Support email in bug reporting
- ✅ Support email in refund policy
- ✅ Last updated date

### **Terms of Service Endpoint** (`/api/static/terms-of-service`)
- ✅ Legal contact email
- ✅ Last updated date

### **API Documentation Endpoint** (`/api/static/api-docs`)
- ✅ Base URL (website)

## 📝 Example Update

**Before:**
```javascript
company: {
  name: "Your Company Name",
  website: "https://yourcompany.com",
}
contact: {
  support: "support@yourcompany.com",
  privacy: "privacy@yourcompany.com",
}
```

**After:**
```javascript
company: {
  name: "Acme Learning Solutions",
  website: "https://acmelearning.com",
}
contact: {
  support: "support@acmelearning.com",
  privacy: "privacy@acmelearning.com",
}
```

## 🔄 How to Apply Changes

1. **Edit the file:** `chatbot-backend/config/companyConfig.js`
2. **Save the file**
3. **Restart your server** (if running)
4. **Test the endpoints** to verify changes

## 🧪 Testing Your Changes

After updating, test these endpoints:
- `GET /api/static/privacy-policy`
- `GET /api/static/faq`
- `GET /api/static/terms-of-service`

## ⚠️ Important Notes

- **No code changes needed** - Just update the config file
- **All endpoints update automatically** - No need to modify individual route files
- **Environment variables** - You can still override with environment variables if needed
- **Backup** - Keep a backup of your original config before making changes

## 🆘 Need Help?

If you need to add more custom fields or have questions about the configuration, check:
- `chatbot-backend/routes/staticContentRoutes.js` - See how the config is used
- `FLUTTER_INTEGRATION_GUIDE.md` - For Flutter integration details
