import os
import json
import uuid
import time
from pathlib import Path
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

import document_service
import ai_service
import github_service
import project_ai_interviewer

app = FastAPI(title="AI Project Interviewer API", version="2.0.0")

# Enable CORS for flexibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
STATIC_DIR = BASE_DIR / "static"
DATA_DIR.mkdir(parents=True, exist_ok=True)
STATIC_DIR.mkdir(parents=True, exist_ok=True)

PROFILE_FILE = DATA_DIR / "profile.json"
HISTORY_FILE = DATA_DIR / "history.json"
PROJECT_HISTORY_FILE = DATA_DIR / "project_history.json"


def _load_json(file_path: Path, default_val: Any) -> Any:
    if not file_path.exists():
        return default_val
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default_val


def _save_json(file_path: Path, data: Any) -> None:
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# Pydantic Schemas - AI Project Interviewer
class AnalyzeRepoRequest(BaseModel):
    repo_url: str


class StartProjectInterviewRequest(BaseModel):
    repo_url: str
    project_data: Dict[str, Any]


class ProjectAnswerRequest(BaseModel):
    session_id: str
    question_index: int
    question: Dict[str, Any]
    answer: str
    project_data: Dict[str, Any]


class NextQuestionRequest(BaseModel):
    session_id: str
    next_index: int


class EndProjectInterviewRequest(BaseModel):
    session_id: str
    project_data: Dict[str, Any]
    questions: List[Dict[str, Any]]
    evaluations: List[Dict[str, Any]]
    duration_seconds: int = 0


# Pydantic Schemas - General Prep (Preserved)
class StartSessionRequest(BaseModel):
    role: str
    company: Optional[str] = ""
    experience: str = "Mid"
    interview_type: str = "General"
    language: str = "English"
    mode: str = "quick"
    custom_count: Optional[int] = 10
    include_resume: Optional[bool] = True
    include_docs: Optional[bool] = True


class EvaluateAnswerRequest(BaseModel):
    session_id: str
    question_index: int
    question: Dict[str, Any]
    user_answer: str
    role: str
    experience: str
    language: Optional[str] = "English"


class CompleteSessionRequest(BaseModel):
    session_id: str
    role: str
    company: Optional[str] = ""
    interview_type: str
    language: Optional[str] = "English"
    started_at: str
    duration_seconds: int
    questions: List[Dict[str, Any]]
    evaluations: List[Dict[str, Any]]


class ProfileData(BaseModel):
    name: str = ""
    education: str = ""
    skills: str = ""
    projects: List[Dict[str, str]] = []
    certifications: str = ""
    experience: str = ""


# =========================================================================
# 1. AI PROJECT INTERVIEWER ENDPOINTS (Core Hackathon Feature)
# =========================================================================

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "app": "AI Project Interviewer",
        "version": "2.0.0",
        "mode": "Practice / Mock Interview Mode"
    }


@app.get("/api/github/test")
async def github_connectivity_test():
    """Tests whether the backend can reach https://api.github.com."""
    return github_service.test_github_connectivity()


@app.get("/api/github/test-repository")
async def github_repository_test(owner: str, repo: str):
    """Tests accessibility of a specific repository on api.github.com."""
    if not owner or not repo:
        raise HTTPException(status_code=400, detail="Both 'owner' and 'repo' query parameters are required.")
    return github_service.test_github_repository(owner, repo)


@app.get("/api/sample-repos")
async def get_sample_repositories():
    """Returns curated demo repositories for 1-click hackathon evaluation."""
    return [
        {
            "id": "mern-ecommerce",
            "name": "mern-ecommerce-platform",
            "url": "https://github.com/dev-showcase/mern-ecommerce-platform",
            "badge": "MERN Stack",
            "description": "React 18, Node/Express, MongoDB, Redux, JWT Auth, Stripe Payments API",
            "language": "JavaScript"
        },
        {
            "id": "fastapi-microservice",
            "name": "fintech-payment-engine",
            "url": "https://github.com/cloud-architects/fintech-payment-engine",
            "badge": "Python FastAPI",
            "description": "FastAPI, PostgreSQL async, SQLAlchemy 2.0, Redis, OAuth2 JWT, Docker",
            "language": "Python"
        }
    ]


@app.post("/api/analyze-repository")
async def analyze_repository(req: AnalyzeRepoRequest):
    """Parses, validates, and analyzes an actual GitHub repository."""
    if not req.repo_url or not req.repo_url.strip():
        raise HTTPException(status_code=400, detail="GitHub repository URL is required.")
    try:
        analysis = github_service.analyze_github_repository(req.repo_url)
        return analysis
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze repository: {str(e)}")


@app.post("/api/start-interview")
async def start_project_interview(req: StartProjectInterviewRequest):
    """Initializes a project-specific viva with code references from the analyzed repository."""
    session_id = str(uuid.uuid4())
    questions = project_ai_interviewer.generate_project_interview_questions(req.project_data)

    return {
        "session_id": session_id,
        "repo_url": req.repo_url,
        "project_name": req.project_data.get("name", "Software Project"),
        "total_questions": len(questions),
        "questions": questions,
        "current_question": questions[0] if questions else None,
        "current_index": 0
    }


@app.post("/api/answer")
async def submit_project_answer(req: ProjectAnswerRequest):
    """Evaluates the candidate's answer against the actual codebase context."""
    evaluation = project_ai_interviewer.evaluate_project_answer(
        question=req.question,
        answer=req.answer,
        project_data=req.project_data,
        question_index=req.question_index
    )
    return evaluation


@app.post("/api/next-question")
async def get_next_question(req: NextQuestionRequest):
    """Advances session to the next question."""
    return {"status": "advanced", "current_index": req.next_index}


@app.post("/api/end-interview")
async def end_project_interview(req: EndProjectInterviewRequest):
    """Generates the comprehensive Project Interview Report and saves to history."""
    session_summary = {
        "session_id": req.session_id,
        "project_data": req.project_data,
        "questions": req.questions,
        "evaluations": req.evaluations,
        "duration_seconds": req.duration_seconds
    }

    report = project_ai_interviewer.compute_project_interview_report(session_summary)

    # Save to history
    history = _load_json(PROJECT_HISTORY_FILE, [])
    history_record = {
        "id": req.session_id,
        "project_name": req.project_data.get("name", "Project"),
        "repo_url": req.project_data.get("url", ""),
        "date": time.strftime("%b %d, %Y - %I:%M %p"),
        "overall_score": report["overall_score"],
        "question_count": len(req.questions),
        "duration_seconds": req.duration_seconds,
        "tech_stack": req.project_data.get("tech_stack", {}),
        "report": report
    }
    history.insert(0, history_record)
    _save_json(PROJECT_HISTORY_FILE, history[:50])

    return {"session_id": req.session_id, "report": report}


@app.get("/api/project-history")
async def get_project_history():
    history = _load_json(PROJECT_HISTORY_FILE, [])
    return [{
        "id": h["id"],
        "project_name": h["project_name"],
        "repo_url": h.get("repo_url", ""),
        "date": h["date"],
        "overall_score": h["overall_score"],
        "question_count": h["question_count"],
        "duration_seconds": h.get("duration_seconds", 0),
        "tech_stack": h.get("tech_stack", {})
    } for h in history]


@app.get("/api/project-history/{session_id}")
async def get_project_history_detail(session_id: str):
    history = _load_json(PROJECT_HISTORY_FILE, [])
    for h in history:
        if h["id"] == session_id:
            return h
    raise HTTPException(status_code=404, detail="Project interview record not found")


@app.delete("/api/project-history/{session_id}")
async def delete_project_history(session_id: str):
    history = _load_json(PROJECT_HISTORY_FILE, [])
    new_h = [h for h in history if h["id"] != session_id]
    if len(new_h) == len(history):
        raise HTTPException(status_code=404, detail="Session not found")
    _save_json(PROJECT_HISTORY_FILE, new_h)
    return {"message": "Project session deleted"}


# =========================================================================
# 2. GENERAL STUDY & PROFILE ENDPOINTS (Preserved)
# =========================================================================

@app.get("/api/profile")
async def get_profile():
    default_profile = {
        "name": "Alex Johnson",
        "education": "B.S. in Computer Science",
        "skills": "Python, React, FastAPI, SQL, Docker, System Design",
        "projects": [
            {
                "name": "Bank Management System in Python",
                "tech": "Python, SQLite, Tkinter, Pytest",
                "description": "Engineered an ACID-compliant core banking prototype supporting automated account ledgers and transaction concurrency."
            }
        ],
        "certifications": "AWS Certified Developer Associate",
        "experience": "2 years of software engineering experience"
    }
    return _load_json(PROFILE_FILE, default_profile)


@app.post("/api/profile")
async def update_profile(profile: ProfileData):
    _save_json(PROFILE_FILE, profile.dict())
    return {"message": "Profile updated successfully", "profile": profile.dict()}


@app.post("/api/upload")
async def upload_document(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        res = document_service.process_uploaded_document(file.filename, contents)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/documents")
async def get_documents():
    return document_service.list_documents()


@app.delete("/api/documents/{doc_id}")
async def remove_document(doc_id: str):
    success = document_service.delete_document(doc_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": "Document removed"}


@app.post("/api/sessions/start")
async def start_session(req: StartSessionRequest):
    count = 10
    if req.mode == "full": count = 20
    elif req.mode == "custom" and req.custom_count: count = max(3, min(25, req.custom_count))
    elif req.mode == "technical": count = 10; req.interview_type = "Technical"
    elif req.mode == "hr": count = 8; req.interview_type = "HR"

    resume_context = _load_json(PROFILE_FILE, None) if req.include_resume else None
    study_snippets = document_service.retrieve_relevant_chunks(f"{req.role} {req.interview_type}", top_k=3) if req.include_docs else []

    questions = ai_service.generate_interview_questions(
        role=req.role,
        company=req.company or "Industry Benchmark",
        experience=req.experience,
        interview_type=req.interview_type,
        language=req.language,
        mode=req.mode,
        question_count=count,
        resume=resume_context,
        study_snippets=study_snippets
    )

    session_id = str(uuid.uuid4())
    return {
        "session_id": session_id,
        "role": req.role,
        "company": req.company,
        "experience": req.experience,
        "interview_type": req.interview_type,
        "language": req.language,
        "mode": req.mode,
        "total_questions": len(questions),
        "questions": questions
    }


@app.post("/api/sessions/evaluate")
async def evaluate_answer(req: EvaluateAnswerRequest):
    return ai_service.evaluate_interview_answer(
        question=req.question,
        answer=req.user_answer,
        role=req.role,
        experience=req.experience,
        language=req.language or "English",
        question_index=req.question_index
    )


@app.post("/api/sessions/complete")
async def complete_session(req: CompleteSessionRequest):
    session_data = {
        "session_id": req.session_id,
        "role": req.role,
        "company": req.company,
        "interview_type": req.interview_type,
        "language": req.language,
        "started_at": req.started_at,
        "completed_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "duration_seconds": req.duration_seconds,
        "questions": req.questions,
        "evaluations": req.evaluations
    }
    report = ai_service.compute_final_interview_report(session_data)
    session_data["report"] = report

    history = _load_json(HISTORY_FILE, [])
    history.insert(0, {
        "id": req.session_id,
        "role": req.role,
        "company": req.company,
        "interview_type": req.interview_type,
        "date": time.strftime("%b %d, %Y - %I:%M %p"),
        "overall_score": report["overall_score"],
        "question_count": len(req.questions),
        "duration_seconds": req.duration_seconds,
        "details": session_data
    })
    _save_json(HISTORY_FILE, history[:50])
    return {"session_id": req.session_id, "report": report}


@app.get("/api/history")
async def get_history():
    history = _load_json(HISTORY_FILE, [])
    return [{
        "id": h["id"],
        "role": h["role"],
        "company": h.get("company", ""),
        "interview_type": h["interview_type"],
        "date": h["date"],
        "overall_score": h["overall_score"],
        "question_count": h["question_count"],
        "duration_seconds": h.get("duration_seconds", 0)
    } for h in history]


@app.get("/api/history/{session_id}")
async def get_session_details(session_id: str):
    history = _load_json(HISTORY_FILE, [])
    for h in history:
        if h["id"] == session_id:
            return h
    raise HTTPException(status_code=404, detail="Session not found")


@app.delete("/api/history/{session_id}")
async def delete_history_session(session_id: str):
    history = _load_json(HISTORY_FILE, [])
    new_hist = [h for h in history if h["id"] != session_id]
    if len(new_hist) == len(history):
        raise HTTPException(status_code=404, detail="Session not found")
    _save_json(HISTORY_FILE, new_hist)
    return {"message": "Session deleted"}


# Serve frontend static assets
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/")
async def serve_index():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return JSONResponse({"status": "UI building in progress"})


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", 8000))
    print(f">> AI Project Interviewer running on http://{host}:{port}")
    uvicorn.run("server:app", host=host, port=port, reload=False)
