
# Backend API Guide
 
## 1. Setup & Run
```bash
cd backend
npm install
npm run start:dev
```
Server will start at: `http://localhost:8000`
Swagger Docs: `http://localhost:8000/api`

## 2. Workflow Testing

### Step 1: Register Agents (One time setup)
Use Swagger or Postman to `POST /agents` to create agents:

**Design Agent:**
```json
{
  "name": "Design Agent 01",
  "role": "design",
  "description": "Expert in UI/UX and System Design",
  "status": "active"
}
```

**Backend Agent:**
```json
{
  "name": "Backend Agent 01",
  "role": "backend",
  "description": "Expert in NestJS and MongoDB",
  "status": "active"
}
```

**UI Agent:**
```json
{
  "name": "UI Agent 01",
  "role": "ui",
  "description": "Expert in React and TailwindCSS",
  "status": "active"
}
```

### Step 2: Orchestrate a Request
Send a request to the Orchestrator to start the workflow.

`POST /orchestrator/execute`
```json
{
  "request": "Create a user login page with Google Auth"
}
```

### Step 3: Check Tasks
The Orchestrator will automatically create tasks for the registered agents.
You can view them via:
`GET /tasks`

## 3. Architecture Note
- **Orchestrator**: Acts as the manager, breaking down user requests.
- **Agents**: Worker units (stored in DB).
- **Tasks**: Units of work assigned to agents.
