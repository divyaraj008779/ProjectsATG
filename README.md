# AI Project Interviewer

> **Hackathon Edition**: Codebase-Grounded Technical Viva System.  
> **Core Purpose**: NOT a generic interview question generator. A user provides the GitHub URL of their software project; the AI analyzes the actual repository (tree, README, dependencies, frontend, backend, database, APIs, authentication, and key functions), and conducts an in-depth, code-grounded technical viva.

---

## 🚀 Key Differentiator: Repository-Grounded Viva

| Generic Interview Bots | AI Project Interviewer |
| :--- | :--- |
| Asks random trivia (*"What is OOP?"*) | Asks why **you** chose React 18 & Redux for your client |
| Ignorant of your actual codebase | Inspects `server/controllers/authController.js` and asks how your `loginUser()` validates credentials |
| Cannot verify candidate ownership | Detects whether the candidate actually understands their architecture, routes, and data flows |
| Hallucinates imaginary features | Grounded strictly in files, functions, and packages found in the repository |

---

## 🎯 10-Step Core Flow

1. **Landing Page**:
   - Clean dark modern SaaS interface with GitHub URL input (`https://github.com/username/project`).
   - 1-Click Benchmark Projects (`mern-ecommerce-platform`, `fintech-payment-engine`) for instant hackathon evaluation without waiting for GitHub API limits.
2. **Repository Analysis Screen**:
   - Real-time 6-stage visual pipeline:
     1. Reading repository
     2. Analyzing project structure
     3. Detecting technologies
     4. Understanding frontend
     5. Understanding backend
     6. Preparing interview
3. **Project Dashboard**:
   - Displays Project Name, Repository URL, Stars, Forks, and Primary Language.
   - Tech Stack Badges: **Frontend**, **Backend**, **Database**, **Authentication**, and **APIs**.
   - Interactive Project Structure file tree.
   - Key features, APIs detected, and main files.
4. **Interview Mode Switch**:
   - Prominent toggle switch: `AI INTERVIEW [ OFF / ON ]`.
   - UI status confirmation: *"AI Interviewer is active • Grounded on your codebase"*.
5. **Live AI Project Interview**:
   - Asks ONE question at a time across 12+ categories: *Project Overview, Architecture, Frontend, Backend, Database, API, Authentication, Code Understanding, Design Decisions, Concurrency & Bugs, Security, Deployment, and Follow-ups*.
6. **Code References Panel**:
   - Shows relevant file path (e.g. `server/routes/auth.js`), function name (e.g. `loginUser()`), code snippet, and context explanation for why it matters.
7. **Dual Answer Mode (Voice + Text)**:
   - Type answers directly OR click **"🎤 Answer with Voice"** using the browser Speech Recognition API with a live, editable transcript.
8. **Real-Time Evaluation**:
   - Score out of **/10**.
   - 4 Pillars: **Accuracy**, **Project Understanding**, **Technical Depth**, and **Clarity**.
   - Displays: *What was correct*, *What was missing*, *What should be improved*, and a *Suggested Model Answer*.
9. **Natural Follow-Up Questions**:
   - Dynamically generated after key answers (e.g. *"If a user's JWT is stolen, how does your backend invalidate that session before it expires?"*).
10. **Project Interview Report**:
    - Overall Score **/100** with circular score dial.
    - 7 Competency Dimensions: *Project Understanding, Frontend, Backend, Database, API, Architecture, Communication*.
    - Strong Areas & Areas Needing Practice.
    - Questions Struggled With breakdown.
    - Recommended study topics & **specific files in your repository to study**.

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: React 18 + Vanilla CSS (Dark Modern SaaS design system with glassmorphism, responsive cards, neon glowing accents, Google Fonts *Inter* & *Outfit*, *Fira Code*).
- **Backend**:
  - **Python FastAPI** (Default runtime, active on `http://127.0.0.1:8000`).
  - **Node.js + Express** (`server.js` & `package.json` included for Node-first environments).
- **GitHub Intelligence**: GitHub REST API (`/repos`, `/git/trees`, `/contents`) with automatic AST/dependency extraction and resilient demo fallbacks.
- **Audio**: Web Speech API (`SpeechRecognition` & `SpeechSynthesis`).

---

## 💻 Quick Start Guide

### Prerequisites
- Python 3.10+ (Tested on Python 3.13)
- Modern browser (Google Chrome, Microsoft Edge, Brave)

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure Environment (Optional)
Copy or review `.env`:
```ini
HOST=127.0.0.1
PORT=8000

# Optional: Set GitHub token for higher API rate limits on large public repos
GITHUB_TOKEN=

# Optional: Add LLM API keys (falls back to built-in Code-Grounded engine if blank)
GEMINI_API_KEY=
OPENAI_API_KEY=
```

### 3. Run Application
```bash
python server.py
```
Open your browser to:
```
http://127.0.0.1:8000
```

---

## 📡 REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service health and active mode |
| `GET` | `/api/sample-repos` | Curated benchmark demo repositories |
| `POST` | `/api/analyze-repository` | Clones/analyzes tree, dependencies, routes, and auth |
| `POST` | `/api/start-interview` | Initializes question queue grounded in the repository |
| `POST` | `/api/answer` | Evaluates answer against codebase facts, returns score `/10` & follow-up |
| `POST` | `/api/next-question` | Advances to the next question |
| `POST` | `/api/end-interview` | Compiles `/100` report, radar dimensions, and saves session |
| `GET` | `/api/project-history` | Lists saved project interview reports |
| `DELETE` | `/api/project-history/{id}` | Deletes a saved interview session |

---

## 🧪 Verification & Testing

Run the automated test suite:
```bash
python verify_project_interviewer.py
```
All 11 end-to-end tests validate repository parsing, question generation, answer evaluation, follow-up injection, report compilation, and static asset delivery.
