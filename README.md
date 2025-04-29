# Chatbot Project

A full-stack chatbot application built with the MERN stack (MongoDB, Express.js, React.js, Node.js).

## Project Structure

```
chatbot-project/
├── chatbot-frontend/     # React frontend application
├── chatbot-backend/      # Node.js/Express backend server
├── scripts/             # Utility scripts for deployment and maintenance
└── render.yaml          # Render deployment configuration
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repository-url>
cd chatbot-project
```

2. Install backend dependencies:
```bash
cd chatbot-backend
npm install
```

3. Install frontend dependencies:
```bash
cd ../chatbot-frontend
npm install
```

4. Set up environment variables:
   - Create `.env` files in both frontend and backend directories
   - Copy the example environment variables from `.env.example` files

### Development

1. Start the backend server:
```bash
cd chatbot-backend
npm run dev
```

2. Start the frontend development server:
```bash
cd chatbot-frontend
npm start
```

### Deployment

The application is configured for deployment on Render. The `render.yaml` file contains the deployment configuration.

## Features

- User authentication and authorization
- Real-time chat functionality
- File upload support
- Responsive design
- MongoDB database integration
- Question Mode for interactive learning
  - Configurable through the admin panel
  - Supports structured question formats
  - Includes migration script for converting existing content

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 