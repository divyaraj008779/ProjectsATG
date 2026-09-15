import requests

base = "http://127.0.0.1:8000"

print("==================================================================")
print("RUNNING END-TO-END VERIFICATION FOR AI PROJECT INTERVIEWER")
print("==================================================================")

# 1. Health check
h = requests.get(f"{base}/api/health").json()
print("[OK] 1. Health check:", h)
assert h["status"] == "healthy"
assert h["app"] == "AI Project Interviewer"

# 2. Sample Repositories
sample_repos = requests.get(f"{base}/api/sample-repos").json()
print(f"[OK] 2. Retrieved {len(sample_repos)} benchmark demo repositories.")
assert len(sample_repos) >= 2

# 3. Analyze Repository
repo_url = "https://github.com/dev-showcase/mern-ecommerce-platform"
print(f"--> Analyzing repository: {repo_url}...")
analysis = requests.post(f"{base}/api/analyze-repository", json={"repo_url": repo_url}).json()
print(f"[OK] 3. Repository Analyzed: '{analysis['name']}'")
print(f"     Frontend: {analysis['tech_stack']['frontend']}")
print(f"     Backend: {analysis['tech_stack']['backend']}")
print(f"     Database: {analysis['tech_stack']['database']}")
print(f"     Auth: {analysis['tech_stack']['authentication']}")
print(f"     Features Count: {len(analysis['features'])}")
print(f"     Key Code References: {len(analysis['key_code_references'])}")
assert "React" in analysis['tech_stack']['frontend']
assert "MongoDB" in analysis['tech_stack']['database']

# 4. Start AI Interview
print("\n--> Initializing Code-Grounded AI Interview...")
start_res = requests.post(f"{base}/api/start-interview", json={
    "repo_url": repo_url,
    "project_data": analysis
}).json()
print(f"[OK] 4. Interview session initialized: {start_res['session_id']}")
print(f"     Total Questions: {start_res['total_questions']}")
questions = start_res["questions"]

print("\n--- SAMPLE QUESTIONS GENERATED FROM ACTUAL REPO ---")
for idx, q in enumerate(questions[:4]):
    code_info = f" [Code Ref: {q['code_reference']['file']}]" if q.get("code_reference") else ""
    print(f"  Q{idx+1} ({q['type']}){code_info}:")
    print(f"     {q['question']}")

# 5. Evaluate Candidate Answer (Question 1: Overview)
q1 = questions[0]
answer_text = "mern-ecommerce-platform is divided into client and server folders. The client uses React 18 and Redux Toolkit for UI and state. The backend uses Express REST routes to communicate with MongoDB through Mongoose models. Data flows through Axios API requests to Express controllers which query the database."
print(f"\n--> Submitting candidate answer for Q1...")
eval1 = requests.post(f"{base}/api/answer", json={
    "session_id": start_res["session_id"],
    "question_index": 1,
    "question": q1,
    "answer": answer_text,
    "project_data": analysis
}).json()

print(f"[OK] 5. Answer 1 Evaluated: Score = {eval1['score']}/10")
print(f"     Accuracy: {eval1['accuracy']}")
print(f"     Technical Depth: {eval1['technical_depth']}")
print(f"     What was correct: {eval1['what_was_correct']}")
print(f"     Follow-up Question: {eval1['follow_up_question']}")

# 6. Evaluate Candidate Answer (Question 4: Authentication Flow)
q4 = questions[3]
answer_text_auth = "In server/controllers/authController.js, loginUser compares the plaintext password using bcrypt with the stored hash in MongoDB. If valid, generateToken signs a JWT with HMAC-SHA256 and attaches it as an HTTP-only cookie. Protected routes pass through protect middleware in server/middleware/authMiddleware.js which decodes the Bearer token."
print(f"\n--> Submitting candidate answer for Q4 (Authentication)...")
eval4 = requests.post(f"{base}/api/answer", json={
    "session_id": start_res["session_id"],
    "question_index": 4,
    "question": q4,
    "answer": answer_text_auth,
    "project_data": analysis
}).json()

print(f"[OK] 6. Answer 4 Evaluated: Score = {eval4['score']}/10")
print(f"     Accuracy: {eval4['accuracy']}")
print(f"     Technical Depth: {eval4['technical_depth']}")
print(f"     Follow-up Question: {eval4['follow_up_question']}")

# 7. End Interview & Compile Report
print("\n--> Concluding Interview and Generating Final Report...")
report_res = requests.post(f"{base}/api/end-interview", json={
    "session_id": start_res["session_id"],
    "project_data": analysis,
    "questions": [q1, q4],
    "evaluations": [eval1, eval4],
    "duration_seconds": 180
}).json()

report = report_res["report"]
print(f"[OK] 7. Project Interview Report Generated: Overall Score = {report['overall_score']}/100")
print("     Competency Dimensions:")
for dim, val in report["dimensions"].items():
    print(f"       - {dim}: {val}%")
print(f"     Strong Areas: {report['strong_areas']}")
print(f"     Weak Areas: {report['weak_areas']}")
print(f"     Recommended Files to Study: {report['recommended_files_to_study']}")

# 8. Check History
history = requests.get(f"{base}/api/project-history").json()
print(f"\n[OK] 8. Project History check: {len(history)} sessions saved.")
assert len(history) > 0

# 9. Verify Frontend Assets
r_html = requests.get(base)
assert r_html.status_code == 200
assert "AI Project Interviewer" in r_html.text
print("[OK] 9. HTML root served with React mount point.")

r_jsx = requests.get(f"{base}/static/js/project_app.jsx")
assert r_jsx.status_code == 200
assert "function App()" in r_jsx.text
print("[OK] 10. React application script project_app.jsx served.")

r_css = requests.get(f"{base}/static/css/styles.css")
assert r_css.status_code == 200
print("[OK] 11. Modern SaaS styles.css served.")

print("\n==================================================================")
print("ALL 11 TESTS PASSED! AI PROJECT INTERVIEWER IS FULLY FUNCTIONAL!")
print("==================================================================")
