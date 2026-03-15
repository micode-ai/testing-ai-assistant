# Web Dashboard

## Overview

The Dashboard is a web application built with Next.js 15 and React 19, providing a complete interface for test management. Access it at: **http://localhost:4200**.

## Authentication

### Registration

1. Open http://localhost:4200
2. Click "Sign Up"
3. Fill in the form: name, email, password
4. Confirm registration

### Login

- **Email and password** — standard login
- **Via OAuth** — GitHub, GitLab, Bitbucket buttons (if configured)

After login, you receive a JWT token that is automatically refreshed via a refresh token.

### Logout

Click on the avatar in the top right corner and select "Sign Out". The token will be revoked and blacklisted.

## Main Sections

### Organizations

- **Organization list** — all organizations you belong to
- **Create organization** — "New Organization" button
- **Organization settings** — edit name, description
- **Member management** — invite, approve, assign roles

### Projects

- **Project list** — projects within the selected organization
- **Create project** — specify name, description, Git repository
- **Connect webhook** — auto-trigger tests on push/PR
- **Project settings** — edit parameters, disconnect webhook

### Pipelines

- **Pipeline list** — all pipelines for a project
- **Create pipeline** — select test types, configure parameters
- **Enable/disable** — pipeline activity toggle
- **Pipeline details** — run history, configuration

### Test Runs

- **Run list** — all test executions for a pipeline
- **Manual trigger** — "Run" button
- **Cancel run** — stop execution
- **Run details** — per-test results, logs, execution time
- **Real-time updates** — SSE for progress tracking

### AI Generation

- **Start generation** — choose type: test generation, bug detection, flaky tests, coverage
- **Generation list** — history of all AI generations
- **Generation details** — generated code, explanations
- **Feedback** — accept or reject with a comment
- **Statistics** — overall AI generation analytics

### AI Chat

- **Chat interface** — conversational AI assistant for each project
- **Tool calling** — the AI can create checklists, trigger pipelines, view results
- **Knowledge base** — answers questions using indexed documentation (RAG)
- **Conversation history** — past chats are saved and accessible from the sidebar
- **Streaming responses** — real-time character-by-character response display

### Code Coverage

- **Coverage snapshots** — coverage percentage per run
- **Trends** — coverage change graphs over time

### Notifications

- **Configurations** — set up notification channels
- **History** — list of sent notifications

## Frontend Technologies

| Technology | Purpose |
|-----------|---------|
| Next.js 15 | Framework with Server Components |
| React 19 | UI library |
| NextAuth v5 | Authentication |
| Tailwind CSS | Styling |
| shadcn/ui | UI components |
| Radix UI | Component primitives |
| Zustand | State management |
| React Query | Server state management and caching |
| React Hook Form | Form management |
| Lucide React | Icons |

## Navigation

The sidebar contains the main sections:

1. **Home** — overview and quick actions
2. **Organizations** — organization management
3. **Projects** — project management
4. **Pipelines** — test pipelines
5. **Checklists** — test checklists
6. **Chat** — AI chat assistant
7. **AI** — AI generation and analysis
8. **Notifications** — notification settings
9. **Settings** — profile and preferences

## Tips

- Use filters and search to navigate large lists
- SSE updates work automatically — no need to manually refresh the page
- For mobile access, use the Expo app (see [Mobile App](./04-mobile.md))
