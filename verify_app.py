import requests

base = "http://127.0.0.1:8000"

print("--- 1. Testing Static Assets Delivery ---")
r_html = requests.get(base)
assert r_html.status_code == 200, f"HTML status: {r_html.status_code}"
assert "PrepCoach AI" in r_html.text, "Brand missing in HTML"
print("[OK] Root HTML served successfully.")

r_css = requests.get(f"{base}/static/css/styles.css")
assert r_css.status_code == 200, f"CSS status: {r_css.status_code}"
print("[OK] CSS styles.css served successfully.")

r_js1 = requests.get(f"{base}/static/js/speech.js")
assert r_js1.status_code == 200 and "SpeechToTextController" in r_js1.text
print("[OK] speech.js served successfully.")

r_js2 = requests.get(f"{base}/static/js/interview.js")
assert r_js2.status_code == 200 and "InterviewSessionManager" in r_js2.text
print("[OK] interview.js served successfully.")

r_js3 = requests.get(f"{base}/static/js/app.js")
assert r_js3.status_code == 200 and "App =" in r_js3.text
print("[OK] app.js served successfully.")

print("\n--- 2. Testing API Lifecycle ---")
# Profile
prof = requests.get(f"{base}/api/profile").json()
print(f"[OK] Profile retrieved: Name={prof.get('name')}, Projects={len(prof.get('projects', []))}")

# Start Session with project & docs context
sess_res = requests.post(f"{base}/api/sessions/start", json={
    "role": "Senior Python & Cloud Architect",
    "company": "Apex FinTech",
    "experience": "Senior",
    "interview_type": "Technical",
    "language": "English",
    "mode": "quick",
    "include_resume": True,
    "include_docs": True
}).json()
print(f"[OK] Session started with {sess_res['total_questions']} tailored questions.")
for idx, q in enumerate(sess_res["questions"][:3]):
    cat = q.get("category", "Technical")
    q_txt = q.get("question", "")[:75]
    print(f"   Q{idx+1} [{cat}]: {q_txt}...")

# Evaluate an answer
eval_res = requests.post(f"{base}/api/sessions/evaluate", json={
    "session_id": sess_res["session_id"],
    "question_index": 1,
    "question": sess_res["questions"][0],
    "user_answer": "In distributed systems, I prioritize idempotent API design, decoupling via event-driven messaging queues like Kafka, and automated database sharding to handle horizontal throughput.",
    "role": sess_res["role"],
    "experience": sess_res["experience"],
    "language": "English"
}).json()
print(f"[OK] Answer evaluated: Score={eval_res['score']}/10, Accuracy={eval_res['accuracy']}")
print(f"   Coach Tip: {eval_res['coach_tips'][0]}")
if eval_res.get("follow_up_question"):
    print(f"   Contextual Follow-up: {eval_res['follow_up_question']}")

# Complete session
comp_res = requests.post(f"{base}/api/sessions/complete", json={
    "session_id": sess_res["session_id"],
    "role": sess_res["role"],
    "company": sess_res["company"],
    "interview_type": sess_res["interview_type"],
    "language": "English",
    "started_at": "2026-09-15 11:58:00",
    "duration_seconds": 145,
    "questions": sess_res["questions"][:2],
    "evaluations": [eval_res]
}).json()
report = comp_res["report"]
print(f"[OK] Session report generated: Overall Score={report['overall_score']}/100")
print(f"   Dimensions: {report['dimensions']}")
print(f"   Strong Areas: {report['strong_areas']}")
print(f"   Weak Areas: {report['weak_areas']}")

# History check
history = requests.get(f"{base}/api/history").json()
print(f"[OK] History records retrieved. Total saved sessions: {len(history)}")

print("\n==============================================")
print("SUCCESS: ALL SYSTEM TESTS VERIFIED SUCCESSFULLY!")
print("==============================================")
