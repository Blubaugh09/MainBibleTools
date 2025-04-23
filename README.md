# Bible Tools React Application

A React application with authentication using Firebase and a ChatGPT integration using OpenAI API.

## Features

- Welcome page with login/signup options and a ChatGPT integration
- User authentication (login/signup) using Firebase Authentication
- Protected dashboard page for authenticated users
- Responsive design with Tailwind CSS
- ChatGPT integration using OpenAI API (gpt-3.5-turbo)

## Prerequisites

Before you can run this application, you need to:

1. Have Node.js and npm installed
2. Set up a Firebase project with Authentication enabled
3. Have an OpenAI API key

## Setup

1. Clone this repository
2. Create a `.env` file in the root directory with the following configuration:

```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_DATABASE_URL=your_database_url
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id

# OpenAI API key for ChatGPT integration
VITE_OPENAI_API_KEY=your_openai_api_key
VITE_ESV_API_KEY=your_esv_api_key
```

3. Install dependencies:

```bash
npm install
```

4. Start the development server and backend API:

```bash
npm run start
```

This will start both the Vite development server and the Express backend for the OpenAI API.

## Running Individual Components

- To run just the frontend:
```bash
npm run dev
```

- To run just the backend API server:
```bash
npm run server
```

## Build for Production

To build the app for production:

```bash
npm run build
```

## Project Structure

- `src/pages/` - Page components (Welcome, Login, Signup, Dashboard)
- `src/components/` - Reusable UI components including Chat
- `src/firebase/` - Firebase configuration and authentication context
- `server.js` - Express server for handling OpenAI API requests securely
