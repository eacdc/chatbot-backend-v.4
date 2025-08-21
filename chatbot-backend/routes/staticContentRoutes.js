const express = require('express');
const router = express.Router();
const companyConfig = require('../config/companyConfig');

// Privacy Policy endpoint
router.get('/privacy-policy', (req, res) => {
  res.json({
    success: true,
    data: {
      title: "Privacy Policy",
      lastUpdated: companyConfig.legal.privacyPolicyLastUpdated,
      content: {
        introduction: "This Privacy Policy describes how we collect, use, and protect your information when you use our educational chatbot application.",
        
        informationWeCollect: {
          title: "Information We Collect",
          items: [
            "Personal information (name, email address) when you create an account",
            "Usage data including chat interactions and learning progress",
            "Device information and IP address for security purposes",
            "Book preferences and reading history",
            "Quiz scores and learning analytics"
          ]
        },
        
        howWeUseInformation: {
          title: "How We Use Your Information",
          items: [
            "To provide personalized learning experiences",
            "To improve our chatbot's responses and accuracy",
            "To track your learning progress and provide insights",
            "To send important updates about your account",
            "To ensure the security and integrity of our service"
          ]
        },
        
        dataSharing: {
          title: "Data Sharing and Disclosure",
          items: [
            "We do not sell, trade, or rent your personal information to third parties",
            "We may share data with trusted service providers who assist in operating our platform",
            "We may disclose information if required by law or to protect our rights",
            "Aggregated, anonymized data may be used for research and improvement purposes"
          ]
        },
        
        dataSecurity: {
          title: "Data Security",
          items: [
            "We implement industry-standard security measures to protect your data",
            "All data is encrypted in transit and at rest",
            "Regular security audits and updates are performed",
            "Access to personal data is restricted to authorized personnel only"
          ]
        },
        
        yourRights: {
          title: "Your Rights",
          items: [
            "Access and review your personal data",
            "Request correction of inaccurate information",
            "Request deletion of your account and associated data",
            "Opt-out of certain data collection practices",
            "Export your data in a portable format"
          ]
        },
        
        cookies: {
          title: "Cookies and Tracking",
          items: [
            "We use cookies to enhance your user experience",
            "Session cookies help maintain your login status",
            "Analytics cookies help us understand usage patterns",
            "You can control cookie settings through your browser"
          ]
        },
        
        childrenPrivacy: {
          title: "Children's Privacy",
          items: [
            "Our service is not intended for children under 13",
            "We do not knowingly collect personal information from children under 13",
            "If we become aware of such collection, we will take steps to delete it",
            "Parents can contact us to review or delete their child's information"
          ]
        },
        
        changesToPolicy: {
          title: "Changes to This Privacy Policy",
          items: [
            "We may update this policy from time to time",
            "Significant changes will be communicated via email or app notification",
            "Continued use of the service constitutes acceptance of updated policy",
            "Previous versions will be archived and available upon request"
          ]
        },
        
        contactInformation: {
          title: "Contact Information",
          items: [
            `For privacy-related questions: ${companyConfig.contact.privacy}`,
            `For general inquiries: ${companyConfig.contact.support}`,
            `Mailing address: ${companyConfig.contact.address.street}, ${companyConfig.contact.address.city}, ${companyConfig.contact.address.state} ${companyConfig.contact.address.zipCode}, ${companyConfig.contact.address.country}`,
            `Response time: ${companyConfig.contact.privacyResponseTime} for urgent matters`
          ]
        }
      }
    }
  });
});

// FAQ endpoint
router.get('/faq', (req, res) => {
  res.json({
    success: true,
    data: {
      title: "Frequently Asked Questions",
      lastUpdated: companyConfig.legal.privacyPolicyLastUpdated,
      categories: {
        general: {
          title: "General Questions",
          questions: [
            {
              question: "What is this application?",
              answer: "This is an educational chatbot application that helps users learn through interactive conversations, book discussions, and personalized quizzes based on their reading materials."
            },
            {
              question: "How do I get started?",
              answer: "Simply create an account, browse available books, and start chatting with our AI to enhance your learning experience. You can also take quizzes to test your knowledge."
            },
            {
              question: "Is the application free to use?",
              answer: "We offer both free and premium subscription options. Basic features are available for free, while premium features require a subscription."
            }
          ]
        },
        
        account: {
          title: "Account & Registration",
          questions: [
            {
              question: "How do I create an account?",
              answer: "Click on the 'Sign Up' button and provide your email address, name, and create a password. You'll receive a verification email to activate your account."
            },
            {
              question: "I forgot my password. How do I reset it?",
              answer: "Click on 'Forgot Password' on the login page, enter your email address, and follow the instructions sent to your email to reset your password."
            },
            {
              question: "Can I change my email address?",
              answer: "Yes, you can update your email address in your profile settings. You'll need to verify the new email address before the change takes effect."
            },
            {
              question: "How do I delete my account?",
              answer: "Go to your profile settings and select 'Delete Account'. Please note that this action is irreversible and will permanently remove all your data."
            }
          ]
        },
        
        features: {
          title: "Features & Functionality",
          questions: [
            {
              question: "How does the chatbot work?",
              answer: "Our AI chatbot uses advanced natural language processing to understand your questions and provide relevant, educational responses based on the books you're reading."
            },
            {
              question: "Can I upload my own books?",
              answer: "Currently, we support a curated selection of books. However, we're working on features to allow users to upload and discuss their own reading materials."
            },
            {
              question: "How are quiz questions generated?",
              answer: "Quiz questions are automatically generated based on the content of the books you're reading, ensuring they're relevant to your current learning material."
            },
            {
              question: "Can I track my learning progress?",
              answer: "Yes! The application tracks your quiz scores, reading progress, and chat interactions to provide insights into your learning journey."
            }
          ]
        },
        
        technical: {
          title: "Technical Support",
          questions: [
            {
              question: "What devices are supported?",
              answer: "Our application works on web browsers, iOS, and Android devices. We recommend using the latest versions of Chrome, Safari, Firefox, or Edge."
            },
            {
              question: "Why is the app running slowly?",
              answer: "Slow performance can be due to poor internet connection, outdated browser, or high server load. Try refreshing the page or checking your internet connection."
            },
            {
              question: "The chatbot isn't responding. What should I do?",
              answer: "First, check your internet connection. If the problem persists, try refreshing the page or logging out and back in. Contact support if the issue continues."
            },
            {
              question: "How do I report a bug?",
              answer: `You can report bugs through the 'Contact Support' option in the app or by emailing us at ${companyConfig.contact.support} with details about the issue.`
            }
          ]
        },
        
        privacy: {
          title: "Privacy & Security",
          questions: [
            {
              question: "Is my data secure?",
              answer: "Yes, we implement industry-standard security measures including encryption, secure servers, and regular security audits to protect your personal information."
            },
            {
              question: "Who can see my chat conversations?",
              answer: "Your chat conversations are private and only accessible to you. Our team may review anonymized data for service improvement purposes."
            },
            {
              question: "Can I export my data?",
              answer: "Yes, you can request an export of your personal data including chat history, quiz scores, and account information through your profile settings."
            },
            {
              question: "How long do you keep my data?",
              answer: "We retain your data as long as your account is active. You can request deletion of your data at any time, and it will be permanently removed within 30 days."
            }
          ]
        },
        
        subscription: {
          title: "Subscription & Billing",
          questions: [
            {
              question: "What's included in the free version?",
              answer: "The free version includes basic chat functionality, access to a limited selection of books, and basic quiz features."
            },
            {
              question: "What premium features are available?",
              answer: "Premium features include unlimited book access, advanced analytics, priority support, and exclusive learning materials."
            },
            {
              question: "How do I cancel my subscription?",
              answer: "You can cancel your subscription at any time through your account settings. Your premium access will continue until the end of your current billing period."
            },
            {
              question: "Do you offer refunds?",
              answer: `We offer a ${companyConfig.subscription.refundPolicy} for new subscriptions. Contact our support team at ${companyConfig.contact.support} if you're not satisfied with your purchase.`
            }
          ]
        }
      }
    }
  });
});

// Terms of Service endpoint
router.get('/terms-of-service', (req, res) => {
  res.json({
    success: true,
    data: {
      title: "Terms of Service",
      lastUpdated: companyConfig.legal.termsOfServiceLastUpdated,
      content: {
        acceptance: "By using our educational chatbot application, you agree to these Terms of Service.",
        
        serviceDescription: {
          title: "Service Description",
          content: "We provide an AI-powered educational platform that offers interactive learning through chatbot conversations, book discussions, and personalized quizzes."
        },
        
        userAccounts: {
          title: "User Accounts",
          items: [
            "You must provide accurate and complete information when creating an account",
            "You are responsible for maintaining the security of your account credentials",
            "You must be at least 13 years old to use our service",
            "You may not share your account with others or create multiple accounts"
          ]
        },
        
        acceptableUse: {
          title: "Acceptable Use",
          items: [
            "Use the service for educational purposes only",
            "Respect intellectual property rights",
            "Do not attempt to hack or disrupt the service",
            "Do not use the service for illegal activities",
            "Do not harass or abuse other users"
          ]
        },
        
        intellectualProperty: {
          title: "Intellectual Property",
          items: [
            "Our platform and content are protected by copyright and other laws",
            "You retain ownership of content you create",
            "You grant us license to use your content for service improvement",
            "You may not copy or distribute our content without permission"
          ]
        },
        
        subscriptionTerms: {
          title: "Subscription Terms",
          items: [
            "Premium subscriptions are billed on a recurring basis",
            "Prices may change with 30 days notice",
            "Subscriptions automatically renew unless cancelled",
            "Refunds are provided according to our refund policy"
          ]
        },
        
        disclaimers: {
          title: "Disclaimers",
          items: [
            "The service is provided 'as is' without warranties",
            "We do not guarantee uninterrupted service",
            "Educational content is for informational purposes only",
            "We are not responsible for learning outcomes"
          ]
        },
        
        liability: {
          title: "Limitation of Liability",
          content: "Our liability is limited to the amount you paid for the service in the 12 months preceding the claim."
        },
        
        termination: {
          title: "Termination",
          items: [
            "We may terminate accounts for violations of these terms",
            "You may cancel your account at any time",
            "Upon termination, your access to the service will end",
            "Some data may be retained as required by law"
          ]
        },
        
        changes: {
          title: "Changes to Terms",
          content: "We may update these terms from time to time. Significant changes will be communicated via email or app notification."
        },
        
        contact: {
          title: "Contact Information",
          content: `For questions about these terms, contact us at ${companyConfig.contact.legal}`
        }
      }
    }
  });
});

// API Documentation endpoint
router.get('/api-docs', (req, res) => {
  res.json({
    success: true,
    data: {
      title: "API Documentation for Flutter Integration",
      version: "1.0.0",
      baseUrl: process.env.BASE_URL || companyConfig.website,
      endpoints: {
        authentication: {
          login: {
            method: "POST",
            path: "/api/users/login",
            description: "Authenticate user and get access token",
            body: {
              email: "string",
              password: "string"
            },
            response: {
              success: "boolean",
              token: "string",
              user: "object"
            }
          },
          signup: {
            method: "POST",
            path: "/api/users/signup",
            description: "Register new user account",
            body: {
              name: "string",
              email: "string",
              password: "string"
            },
            response: {
              success: "boolean",
              message: "string",
              user: "object"
            }
          }
        },
        staticContent: {
          privacyPolicy: {
            method: "GET",
            path: "/api/static/privacy-policy",
            description: "Get privacy policy content",
            response: {
              success: "boolean",
              data: "object"
            }
          },
          faq: {
            method: "GET",
            path: "/api/static/faq",
            description: "Get FAQ content",
            response: {
              success: "boolean",
              data: "object"
            }
          },
          termsOfService: {
            method: "GET",
            path: "/api/static/terms-of-service",
            description: "Get terms of service content",
            response: {
              success: "boolean",
              data: "object"
            }
          }
        },
        books: {
          getAllBooks: {
            method: "GET",
            path: "/api/books",
            description: "Get all available books",
            headers: {
              "Authorization": "Bearer {token}"
            },
            response: {
              success: "boolean",
              books: "array"
            }
          },
          getBookById: {
            method: "GET",
            path: "/api/books/{bookId}",
            description: "Get specific book details",
            headers: {
              "Authorization": "Bearer {token}"
            },
            response: {
              success: "boolean",
              book: "object"
            }
          }
        },
        chat: {
          sendMessage: {
            method: "POST",
            path: "/api/chat/send",
            description: "Send message to chatbot",
            headers: {
              "Authorization": "Bearer {token}"
            },
            body: {
              message: "string",
              bookId: "string (optional)",
              chapterId: "string (optional)"
            },
            response: {
              success: "boolean",
              response: "string",
              timestamp: "string"
            }
          },
          getChatHistory: {
            method: "GET",
            path: "/api/chat/history",
            description: "Get user's chat history",
            headers: {
              "Authorization": "Bearer {token}"
            },
            response: {
              success: "boolean",
              messages: "array"
            }
          }
        }
      },
      authentication: {
        description: "Most endpoints require authentication using Bearer token in Authorization header",
        example: "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
      },
      errorResponses: {
        "400": "Bad Request - Invalid input data",
        "401": "Unauthorized - Invalid or missing token",
        "403": "Forbidden - Insufficient permissions",
        "404": "Not Found - Resource not found",
        "500": "Internal Server Error - Server error"
      }
    }
  });
});

module.exports = router;
