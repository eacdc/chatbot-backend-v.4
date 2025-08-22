# Flutter Integration Guide - Privacy Policy & FAQ Endpoints

## Overview
This guide provides information about the new privacy policy and FAQ endpoints that have been added to the chatbot backend API. These endpoints are designed to provide static content that can be displayed in your Flutter application.

## Base URL
```
https://your-backend-url.com/api/static
```

## Available Endpoints

### 1. Privacy Policy
**Endpoint:** `GET /api/static/privacy-policy`

**Description:** Retrieves the complete privacy policy content in a structured JSON format.

**Response Format:**
```json
{
  "success": true,
  "data": {
    "title": "Privacy Policy",
    "lastUpdated": "2024-01-15",
    "content": {
      "introduction": "This Privacy Policy describes how we collect, use, and protect your information...",
      "informationWeCollect": {
        "title": "Information We Collect",
        "items": [
          "Personal information (name, email address) when you create an account",
          "Usage data including chat interactions and learning progress",
          // ... more items
        ]
      },
      // ... more sections
    }
  }
}
```

**Flutter Implementation Example:**
```dart
Future<Map<String, dynamic>> getPrivacyPolicy() async {
  try {
    final response = await http.get(
      Uri.parse('$baseUrl/api/static/privacy-policy'),
      headers: {'Content-Type': 'application/json'},
    );
    
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return data['data'];
    } else {
      throw Exception('Failed to load privacy policy');
    }
  } catch (e) {
    throw Exception('Error: $e');
  }
}
```

### 2. FAQ
**Endpoint:** `GET /api/static/faq`

**Description:** Retrieves frequently asked questions organized by categories.

**Response Format:**
```json
{
  "success": true,
  "data": {
    "title": "Frequently Asked Questions",
    "lastUpdated": "2024-01-15",
    "categories": {
      "general": {
        "title": "General Questions",
        "questions": [
          {
            "question": "What is this application?",
            "answer": "This is an educational chatbot application..."
          }
          // ... more questions
        ]
      },
      "account": {
        "title": "Account & Registration",
        "questions": [
          // ... questions
        ]
      }
      // ... more categories
    }
  }
}
```

**Flutter Implementation Example:**
```dart
Future<Map<String, dynamic>> getFAQ() async {
  try {
    final response = await http.get(
      Uri.parse('$baseUrl/api/static/faq'),
      headers: {'Content-Type': 'application/json'},
    );
    
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return data['data'];
    } else {
      throw Exception('Failed to load FAQ');
    }
  } catch (e) {
    throw Exception('Error: $e');
  }
}
```

### 3. Terms of Service
**Endpoint:** `GET /api/static/terms-of-service`

**Description:** Retrieves the terms of service content.

**Response Format:**
```json
{
  "success": true,
  "data": {
    "title": "Terms of Service",
    "lastUpdated": "2024-01-15",
    "content": {
      "acceptance": "By using our educational chatbot application...",
      "serviceDescription": {
        "title": "Service Description",
        "content": "We provide an AI-powered educational platform..."
      }
      // ... more sections
    }
  }
}
```

### 4. API Documentation
**Endpoint:** `GET /api/static/api-docs`

**Description:** Provides comprehensive API documentation for Flutter integration.

**Response Format:**
```json
{
  "success": true,
  "data": {
    "title": "API Documentation for Flutter Integration",
    "version": "1.0.0",
    "baseUrl": "https://your-backend-url.com",
    "endpoints": {
      "authentication": {
        "login": {
          "method": "POST",
          "path": "/api/users/login",
          "description": "Authenticate user and get access token",
          "body": {
            "email": "string",
            "password": "string"
          },
          "response": {
            "success": "boolean",
            "token": "string",
            "user": "object"
          }
        }
        // ... more endpoints
      }
    }
  }
}
```

## Flutter UI Implementation Suggestions

### Privacy Policy Screen
```dart
class PrivacyPolicyScreen extends StatefulWidget {
  @override
  _PrivacyPolicyScreenState createState() => _PrivacyPolicyScreenState();
}

class _PrivacyPolicyScreenState extends State<PrivacyPolicyScreen> {
  Map<String, dynamic>? privacyData;
  bool isLoading = true;

  @override
  void initState() {
    super.initState();
    loadPrivacyPolicy();
  }

  Future<void> loadPrivacyPolicy() async {
    try {
      final data = await getPrivacyPolicy();
      setState(() {
        privacyData = data;
        isLoading = false;
      });
    } catch (e) {
      setState(() {
        isLoading = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error loading privacy policy: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return Scaffold(
        appBar: AppBar(title: Text('Privacy Policy')),
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (privacyData == null) {
      return Scaffold(
        appBar: AppBar(title: Text('Privacy Policy')),
        body: Center(child: Text('Failed to load privacy policy')),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(privacyData!['title']),
        actions: [
          TextButton(
            onPressed: () {
              // Share functionality
            },
            child: Icon(Icons.share, color: Colors.white),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Last Updated: ${privacyData!['lastUpdated']}',
              style: TextStyle(
                fontSize: 12,
                color: Colors.grey[600],
                fontStyle: FontStyle.italic,
              ),
            ),
            SizedBox(height: 16),
            Text(
              privacyData!['content']['introduction'],
              style: TextStyle(fontSize: 16),
            ),
            SizedBox(height: 24),
            // Render each section
            ...privacyData!['content'].entries
                .where((entry) => entry.key != 'introduction')
                .map((entry) => _buildSection(entry.key, entry.value)),
          ],
        ),
      ),
    );
  }

  Widget _buildSection(String key, dynamic section) {
    if (section is Map<String, dynamic>) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(height: 24),
          Text(
            section['title'],
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: 12),
          if (section['content'] != null)
            Text(
              section['content'],
              style: TextStyle(fontSize: 16),
            ),
          if (section['items'] != null)
            ...section['items'].map<Widget>((item) => Padding(
              padding: EdgeInsets.only(left: 16, top: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('• ', style: TextStyle(fontSize: 16)),
                  Expanded(
                    child: Text(
                      item,
                      style: TextStyle(fontSize: 16),
                    ),
                  ),
                ],
              ),
            )),
        ],
      );
    }
    return SizedBox.shrink();
  }
}
```

### FAQ Screen
```dart
class FAQScreen extends StatefulWidget {
  @override
  _FAQScreenState createState() => _FAQScreenState();
}

class _FAQScreenState extends State<FAQScreen> {
  Map<String, dynamic>? faqData;
  bool isLoading = true;
  String? selectedCategory;

  @override
  void initState() {
    super.initState();
    loadFAQ();
  }

  Future<void> loadFAQ() async {
    try {
      final data = await getFAQ();
      setState(() {
        faqData = data;
        isLoading = false;
        selectedCategory = data['categories'].keys.first;
      });
    } catch (e) {
      setState(() {
        isLoading = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error loading FAQ: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return Scaffold(
        appBar: AppBar(title: Text('FAQ')),
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (faqData == null) {
      return Scaffold(
        appBar: AppBar(title: Text('FAQ')),
        body: Center(child: Text('Failed to load FAQ')),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(faqData!['title'])),
      body: Column(
        children: [
          // Category selector
          Container(
            height: 60,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: EdgeInsets.symmetric(horizontal: 16),
              itemCount: faqData!['categories'].length,
              itemBuilder: (context, index) {
                final categoryKey = faqData!['categories'].keys.elementAt(index);
                final category = faqData!['categories'][categoryKey];
                final isSelected = selectedCategory == categoryKey;
                
                return Padding(
                  padding: EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(category['title']),
                    selected: isSelected,
                    onSelected: (selected) {
                      setState(() {
                        selectedCategory = categoryKey;
                      });
                    },
                  ),
                );
              },
            ),
          ),
          // Questions list
          Expanded(
            child: ListView.builder(
              padding: EdgeInsets.all(16),
              itemCount: faqData!['categories'][selectedCategory]['questions'].length,
              itemBuilder: (context, index) {
                final question = faqData!['categories'][selectedCategory]['questions'][index];
                return ExpansionTile(
                  title: Text(
                    question['question'],
                    style: TextStyle(fontWeight: FontWeight.w500),
                  ),
                  children: [
                    Padding(
                      padding: EdgeInsets.all(16),
                      child: Text(
                        question['answer'],
                        style: TextStyle(fontSize: 16),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
```

## Error Handling

### Network Error Handling
```dart
class ApiException implements Exception {
  final String message;
  final int? statusCode;

  ApiException(this.message, [this.statusCode]);

  @override
  String toString() => 'ApiException: $message (Status: $statusCode)';
}

Future<Map<String, dynamic>> handleApiCall(Future<http.Response> Function() apiCall) async {
  try {
    final response = await apiCall();
    
    if (response.statusCode >= 200 && response.statusCode < 300) {
      final data = json.decode(response.body);
      if (data['success'] == true) {
        return data['data'];
      } else {
        throw ApiException(data['message'] ?? 'Unknown error');
      }
    } else {
      throw ApiException('HTTP ${response.statusCode}', response.statusCode);
    }
  } on SocketException {
    throw ApiException('No internet connection');
  } on TimeoutException {
    throw ApiException('Request timeout');
  } on FormatException {
    throw ApiException('Invalid response format');
  } catch (e) {
    throw ApiException('Unexpected error: $e');
  }
}
```

### Retry Logic
```dart
Future<T> retryApiCall<T>(Future<T> Function() apiCall, {int maxRetries = 3}) async {
  int attempts = 0;
  while (attempts < maxRetries) {
    try {
      return await apiCall();
    } catch (e) {
      attempts++;
      if (attempts >= maxRetries) {
        rethrow;
      }
      // Wait before retrying (exponential backoff)
      await Future.delayed(Duration(seconds: attempts * 2));
    }
  }
  throw Exception('Max retries exceeded');
}
```

## Caching Strategy

### Local Caching
```dart
class ContentCache {
  static const String _privacyKey = 'privacy_policy';
  static const String _faqKey = 'faq';
  static const String _termsKey = 'terms_of_service';
  
  static Future<void> cacheContent(String key, Map<String, dynamic> content) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(key, json.encode(content));
  }
  
  static Future<Map<String, dynamic>?> getCachedContent(String key) async {
    final prefs = await SharedPreferences.getInstance();
    final cached = prefs.getString(key);
    if (cached != null) {
      return json.decode(cached);
    }
    return null;
  }
  
  static Future<void> clearCache() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_privacyKey);
    await prefs.remove(_faqKey);
    await prefs.remove(_termsKey);
  }
}
```

## Testing

### Unit Tests
```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mockito/mockito.dart';

class MockHttpClient extends Mock implements http.Client {}

void main() {
  group('Static Content API Tests', () {
    late MockHttpClient mockClient;

    setUp(() {
      mockClient = MockHttpClient();
    });

    test('getPrivacyPolicy returns data on success', () async {
      when(mockClient.get(
        Uri.parse('$baseUrl/api/static/privacy-policy'),
        headers: anyNamed('headers'),
      )).thenAnswer((_) async => http.Response(
        '{"success": true, "data": {"title": "Privacy Policy"}}',
        200,
      ));

      final result = await getPrivacyPolicy();
      expect(result['title'], 'Privacy Policy');
    });

    test('getFAQ returns data on success', () async {
      when(mockClient.get(
        Uri.parse('$baseUrl/api/static/faq'),
        headers: anyNamed('headers'),
      )).thenAnswer((_) async => http.Response(
        '{"success": true, "data": {"title": "FAQ"}}',
        200,
      ));

      final result = await getFAQ();
      expect(result['title'], 'FAQ');
    });
  });
}
```

## Integration Checklist

- [ ] Add the new endpoints to your API service class
- [ ] Implement error handling for network requests
- [ ] Create UI screens for Privacy Policy and FAQ
- [ ] Add navigation to these screens from your app's settings or help menu
- [ ] Implement caching for offline access
- [ ] Add loading states and error messages
- [ ] Test the integration with your backend
- [ ] Add analytics tracking for content views
- [ ] Implement share functionality for content
- [ ] Add accessibility features (screen reader support)

## Support

If you encounter any issues with the integration, please contact:
- Technical Support: support@testyourlearning.com
- API Documentation: Available at `/api/static/api-docs`

## Version History

- **v1.0.0** (2024-01-15): Initial release with Privacy Policy, FAQ, and Terms of Service endpoints
