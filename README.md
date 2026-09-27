<div align="center">

# DevPrep

### Comprehensive Tech Interview & Coding Platform

A modern, full-stack platform designed to help developers prepare for technical interviews. Features include a LeetCode-style coding environment with isolated code execution, AI-powered mock interviews, resume analysis, and detailed public profiles with progress analytics.

**Developed by Vatsal Ghaghda**

[![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20Tailwind-blue?style=flat-square&logo=react)](https://react.dev)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-green?style=flat-square&logo=nodedotjs)](https://expressjs.com)
[![Database](https://img.shields.io/badge/Database-MongoDB-47A248?style=flat-square&logo=mongodb)](https://mongodb.com)
[![Execution](https://img.shields.io/badge/Code%20Execution-Docker-2496ED?style=flat-square&logo=docker)](https://docker.com)
[![Auth](https://img.shields.io/badge/Auth-Clerk-6C47FF?style=flat-square&logo=clerk)](https://clerk.dev)

</div>

---

## Table of Contents

1. [Features](#features)
2. [Project Structure](#project-structure)
3. [Tech Stack](#tech-stack)
4. [Local Development Setup](#local-development-setup)
5. [Environment Variables](#environment-variables)
6. [Uploading to GitHub](#uploading-to-github)
7. [Deploying the Frontend](#deploying-the-frontend)
8. [Deploying the Backend](#deploying-the-backend)
9. [Post-Deployment Configuration](#post-deployment-configuration)
10. [API Reference (Overview)](#api-reference-overview)

---

## Features

### 💻 Coding Practice Environment
- **LeetCode-Style IDE**: Full-fledged code editor to solve algorithmic challenges.
- **Secure Code Execution**: User code is executed in an isolated, secure Docker container backend to prevent malicious behavior.
- **Multiple Languages**: Support for multiple programming languages including C++, Python, and Java.

### 🤖 AI Mock Interviews
- **AI-Powered Sessions**: Conduct realistic technical mock interviews powered by advanced LLMs (Groq / HuggingFace).
- **Real-time Feedback**: Get instant feedback on your answers, communication skills, and technical accuracy.
- **Session Tracking**: Review past interview sessions and track your improvement over time.

### 📄 Resume Tools
- **Resume Analysis**: Upload your PDF resume for AI-driven analysis to see how well it matches your target role.
- **Improvement Suggestions**: Receive actionable insights on skills to add and formatting improvements.

### 📊 Public & Private Profiles
- **Detailed Analytics**: Track your progress with LeetCode-style difficulty rings (Easy, Medium, Hard).
- **Submission Heatmap**: A GitHub-style 365-day submission activity heatmap.
- **Public Portfolio**: Share your public profile (`/profile/:username`) to showcase your coding stats, streak, and skills.

### 🔒 Authentication & Security
- **Clerk Authentication**: Secure, seamless social and email login powered by Clerk.
- **Protected Routes**: Secure API endpoints ensuring user data privacy.

---

## Project Structure

```text
DevPrep/
├── frontend/                       # React SPA
│   ├── src/
│   │   ├── components/             # Reusable UI components (Analytics, Heatmaps, etc.)
│   │   ├── context/                # React context providers
│   │   ├── hooks/                  # Custom React hooks (e.g., useReadyAuth)
│   │   ├── pages/                  # Route pages (CodingPractice, Profile, PublicProfile, etc.)
│   │   ├── services/               # API service integration (api.js)
│   │   └── App.js                  # Main app routing
│   └── package.json
│
├── backend/                        # Node.js + Express API
│   ├── executor/                   # Dockerized code execution engine
│   │   ├── .work/                  # Temporary execution sandbox
│   │   ├── runCode.js              # Code execution logic
│   │   └── Dockerfile              # Dockerfile for the isolated execution environment
│   ├── src/
│   │   ├── controllers/            # Route controllers (userController, etc.)
│   │   ├── middleware/             # Custom Express middleware (auth, rate limiting)
│   │   ├── models/                 # Mongoose schemas (User, MockInterviewSession, etc.)
│   │   ├── routes/                 # API route definitions
│   │   ├── utils/                  # Helper utilities (runInDocker, etc.)
│   │   └── server.js               # Express server entry point
│   └── package.json
│
└── README.md                       # Project documentation
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Tailwind CSS |
| **Icons & Charts** | Lucide React, Recharts |
| **Authentication** | Clerk Auth |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB + Mongoose |
| **Code Execution** | Docker (Isolated Sandbox) |
| **AI Integration** | Groq / HuggingFace LLM APIs |
| **File Parsing** | `pdf-parse`, Multer |

---

## Local Development Setup

### Prerequisites

Make sure you have the following installed:
- **Node.js** 18+ — https://nodejs.org
- **MongoDB** — Local instance or MongoDB Atlas URI
- **Docker** — Required for the code execution engine

### Step 1 — Clone the repository

```bash
git clone https://github.com/VatsalGhaghda/DevPrep.git
cd DevPrep
```

### Step 2 — Set up the Frontend

```bash
cd frontend
npm install
npm start
```
Frontend runs at: **http://localhost:3000**

Create `frontend/.env`:
```env
REACT_APP_API_BASE=http://localhost:5000/api
REACT_APP_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
```

### Step 3 — Set up the Backend

Open a new terminal:

```bash
cd backend
npm install
```

Create a `.env` file inside `backend/`:
```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
CLERK_SECRET_KEY=your_clerk_secret_key
GROQ_API_KEY=your_groq_api_key
```

Then start the backend:
```bash
npm run dev
```
Backend API runs at: **http://localhost:5000**

### Step 4 — Set up Docker Executor (Important)

For the coding practice environment to work, you must build the executor Docker image:

```bash
cd backend/executor
docker build -t devprep-executor .
```

---

## Environment Variables

### Frontend (`frontend/.env`)

| Variable | Description | Example |
|---|---|---|
| `REACT_APP_API_BASE` | Backend API base URL | `http://localhost:5000/api` |
| `REACT_APP_CLERK_PUBLISHABLE_KEY` | Clerk Auth Publishable Key | `pk_test_...` |

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `PORT` | Port for the Express server (default: `5000`) |
| `MONGO_URI` | MongoDB Connection String |
| `CLERK_SECRET_KEY` | Clerk Auth Secret Key |
| `GROQ_API_KEY` | API Key for AI Mock Interviews |
| `HUGGINGFACE_API_KEY` | Fallback API Key for AI Models |

---

## Uploading to GitHub

### Step 1 — Create a new GitHub repository

1. Go to https://github.com/new
2. Set the repository name to `DevPrep`.
3. Click **Create repository** (Do NOT initialize with a README).

### Step 2 — Initialize Git and push

Open a terminal in the `DevPrep` root folder and run:

```bash
git init
git add .
git commit -m "Initial commit — DevPrep"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/DevPrep.git
git push -u origin main
```

---

## Deploying the Frontend

Vercel is recommended for deploying the React frontend.

1. Push your code to GitHub.
2. Go to **Vercel** and import your `DevPrep` repository.
3. Set the **Root Directory** to `frontend`.
4. Add your Environment Variables (`REACT_APP_API_BASE`, `REACT_APP_CLERK_PUBLISHABLE_KEY`).
5. Click **Deploy**.

---

## Deploying the Backend

Render or Railway is recommended since the backend requires Docker for the code execution environment.

### Using Render

1. Go to **Render** and create a new **Web Service**.
2. Connect your GitHub repository.
3. Set the **Root Directory** to `backend`.
4. Set the **Environment** to `Docker` (Render will use your `backend/Dockerfile` if you configure one, or you can run Node natively, but note that **Code Execution requires Docker to be accessible**). 
   *Note: If deploying on a platform that does not support Docker-in-Docker, you may need a dedicated execution microservice.*
5. Add your Environment Variables (`MONGO_URI`, `CLERK_SECRET_KEY`, etc.).
6. Click **Deploy**.

---

## Post-Deployment Configuration

1. **Update Frontend API URL**: Once the backend is deployed, update `REACT_APP_API_BASE` in your frontend deployment settings to point to the live backend URL.
2. **Update Clerk Settings**: Ensure your live frontend URL is added to your Clerk dashboard's allowed redirect URIs.
3. **CORS Settings**: Update the backend CORS configuration in `server.js` to allow requests exclusively from your deployed frontend domain.

---

## API Reference (Overview)

### Users & Profiles
- `GET /api/users/public/:username` — Fetch public profile and stats.
- `GET /api/analytics/coding-stats` — Fetch logged-in user's coding statistics.
- `GET /api/analytics/submission-activity` — Fetch user's heatmap activity data.

### Code Execution
- `POST /api/execute/run` — Run code without saving.
- `POST /api/execute/submit` — Submit code, test against test cases, and save submission.

### AI Mock Interviews
- `POST /api/interviews/start` — Initialize an AI mock interview session.
- `POST /api/interviews/:id/message` — Send an answer and receive AI feedback.

---

<div align="center">

Built with ❤️ by **Vatsal Ghaghda and Harsh Jethava**

[GitHub](https://github.com/VatsalGhaghda) · [LinkedIn](https://linkedin.com/in/vatsal-ghaghda)

</div>