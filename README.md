# Kamoola

A full-stack manga reading platform built with React and NestJS.

## Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS
- **Backend**: NestJS, TypeScript, Mongoose
- **Database**: MongoDB 7
- **Deployment**: Docker, Vercel (frontend), Railway (backend)

## Prerequisites

- Node.js 20+
- npm 9+
- Docker and Docker Compose (for containerized setup)
- MongoDB 7 (for local development without Docker)

## Quick Start with Docker

The fastest way to get the entire stack running:

```bash
git clone https://github.com/your-username/kamoola.git
cd kamoola
docker compose up --build
```

The app will be available at:

- **Frontend**: http://localhost
- **Backend API**: http://localhost:3001/api
- **Swagger Docs**: http://localhost:3001/api/docs
- **MongoDB**: localhost:27017

To stop all services:

```bash
docker compose down
```

To stop and remove all data:

```bash
docker compose down -v
```

## Local Development Setup

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run start:dev
```

The backend runs at http://localhost:3001. Make sure MongoDB is running locally or update `MONGODB_URI` in `.env`.

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

The frontend runs at http://localhost:5173.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment | `development` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/kamoola` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:5173` |
| `JWT_SECRET` | Secret key for JWT tokens | - |
| `JWT_EXPIRATION` | JWT token expiration | `7d` |
| `MAX_FILE_SIZE` | Max upload file size in bytes | `10485760` |
| `UPLOAD_DIR` | Directory for file uploads | `./uploads` |

### Frontend (`frontend/.env`)

| Variable | Description | Default |
|---|---|---|
| `VITE_API_URL` | Backend API URL | `http://localhost:3001/api` |

## API Documentation

Swagger documentation is available at `/api/docs` when the backend is running.

## Deployment

### Frontend on Vercel

1. Push your code to GitHub.
2. Go to [vercel.com](https://vercel.com) and import the repository.
3. Set the **Root Directory** to `frontend`.
4. Set the **Framework Preset** to `Vite`.
5. Add the environment variable:
   - `VITE_API_URL` = your Railway backend URL (e.g., `https://kamoola-backend.up.railway.app/api`)
6. Click **Deploy**.
7. After deployment, update `frontend/vercel.json` to replace `your-railway-backend.up.railway.app` with your actual Railway URL, then redeploy.

### Backend + MongoDB on Railway

1. Go to [railway.app](https://railway.app) and create a new project.
2. Add a **MongoDB** service from the Railway marketplace.
3. Add a new service and connect your GitHub repository.
4. Set the **Root Directory** to `backend`.
5. Add environment variables:
   - `MONGODB_URI` = the connection string from the Railway MongoDB service (use the `MONGO_URL` variable reference: `${{MongoDB.MONGO_URL}}`)
   - `PORT` = `3001`
   - `CORS_ORIGIN` = your Vercel frontend URL (e.g., `https://kamoola.vercel.app`)
   - `NODE_ENV` = `production`
   - `JWT_SECRET` = a strong random string
   - `JWT_EXPIRATION` = `7d`
6. Railway will auto-detect the `railway.toml` config and deploy.
7. Copy the generated backend URL and update your Vercel environment variables and `vercel.json`.

## Project Structure

```
kamoola/
├── .github/
│   └── workflows/
│       └── ci.yml              # GitHub Actions CI pipeline
├── backend/
│   ├── src/
│   │   ├── modules/            # Feature modules (manga, auth, users, etc.)
│   │   ├── common/             # Shared guards, filters, pipes, decorators
│   │   ├── config/             # Configuration files
│   │   ├── app.module.ts       # Root module
│   │   └── main.ts             # Entry point
│   ├── test/                   # E2E tests
│   ├── .env.example            # Environment template
│   ├── Dockerfile              # Backend container config
│   ├── railway.toml            # Railway deployment config
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── pages/              # Page components
│   │   ├── hooks/              # Custom React hooks
│   │   ├── services/           # API service layer
│   │   ├── store/              # State management
│   │   ├── types/              # TypeScript type definitions
│   │   ├── App.tsx             # Root component
│   │   └── main.tsx            # Entry point
│   ├── public/                 # Static assets
│   ├── .env.example            # Environment template
│   ├── Dockerfile              # Frontend container config
│   ├── nginx.conf              # Nginx configuration
│   ├── vercel.json             # Vercel deployment config
│   └── package.json
├── docker-compose.yml          # Multi-container orchestration
├── .gitignore
└── README.md
```

## Available Scripts

### Backend

| Script | Description |
|---|---|
| `npm run start:dev` | Start in development mode with hot reload |
| `npm run start:prod` | Start in production mode |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run end-to-end tests |

### Frontend

| Script | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |

## License

MIT
