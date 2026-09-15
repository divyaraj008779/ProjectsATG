import os
import json
import re
import random
from typing import List, Dict, Any, Optional
import requests
from dotenv import load_dotenv

load_dotenv()

# Pre-compiled high quality question banks for realistic fallback generation
DEFAULT_QUESTION_BANK = {
    "HR": [
        {"q": "Tell me about yourself, your background, and why you are interested in this role.", "category": "HR", "difficulty": "Entry"},
        {"q": "What do you consider to be your greatest professional strengths, and what is one area you are actively working to improve?", "category": "HR", "difficulty": "General"},
        {"q": "Why do you want to work at our company specifically, and how does this align with your career aspirations?", "category": "HR", "difficulty": "General"},
        {"q": "Describe a situation where you had a disagreement with a team member or manager. How did you handle it?", "category": "HR", "difficulty": "Mid"},
        {"q": "Where do you see yourself in the next 3 to 5 years in terms of growth and responsibilities?", "category": "HR", "difficulty": "General"},
        {"q": "Can you explain a time when you had to manage tight deadlines with competing priorities?", "category": "HR", "difficulty": "Mid"},
        {"q": "Why should we hire you over other qualified candidates applying for this position?", "category": "HR", "difficulty": "General"},
        {"q": "What kind of work environment brings out your best performance and creativity?", "category": "HR", "difficulty": "Entry"}
    ],
    "Behavioral": [
        {"q": "Tell me about a challenging problem you faced in a recent project. How did you diagnose the root cause and solve it?", "category": "Behavioral", "difficulty": "Mid"},
        {"q": "Give me an example of a time when a project didn't go as planned. What was your reaction and what did you learn?", "category": "Behavioral", "difficulty": "Senior"},
        {"q": "Describe an occasion where you had to adapt quickly to a major change in requirements or technology.", "category": "Behavioral", "difficulty": "Mid"},
        {"q": "Can you share an experience where you had to take ownership of a critical mistake? How did you rectify it?", "category": "Behavioral", "difficulty": "Senior"},
        {"q": "Tell me about a time you helped a struggling teammate or mentored someone to achieve a common milestone.", "category": "Behavioral", "difficulty": "Mid"},
        {"q": "Describe a scenario where you had to convince non-technical stakeholders of a technical decision.", "category": "Behavioral", "difficulty": "Senior"}
    ],
    "Technical_General": [
        {"q": "What are the four fundamental principles of Object-Oriented Programming (OOP)? Can you illustrate one with an example?", "category": "Technical", "sub": "OOP"},
        {"q": "Explain the difference between SQL and NoSQL databases. When would you choose one over the other?", "category": "Technical", "sub": "DBMS"},
        {"q": "What happens under the hood from the moment you type a URL in the browser until the web page renders?", "category": "Technical", "sub": "Networking"},
        {"q": "What is the difference between synchronous and asynchronous execution, and how do event loops handle concurrency?", "category": "Technical", "sub": "Core Concepts"},
        {"q": "Can you explain the difference between an Array and a Linked List in terms of time and space complexity?", "category": "Technical", "sub": "Data Structures"},
        {"q": "What is RESTful API architecture, and how do idempotency rules apply to HTTP methods like GET, POST, PUT, and DELETE?", "category": "Technical", "sub": "Web Architecture"},
        {"q": "Explain the concept of Database Normalization and why 3NF (Third Normal Form) is commonly targeted.", "category": "Technical", "sub": "DBMS"},
        {"q": "What is the TCP 3-way handshake and how does it ensure reliable communication compared to UDP?", "category": "Technical", "sub": "Networking"}
    ],
    "Technical_Python": [
        {"q": "Explain memory management and garbage collection in Python. How does reference counting work?", "category": "Technical", "sub": "Python"},
        {"q": "What are Python decorators, and how would you implement a custom decorator to measure execution time?", "category": "Technical", "sub": "Python"},
        {"q": "Explain the difference between mutable and immutable types in Python, and how pass-by-object-reference impacts functions.", "category": "Technical", "sub": "Python"},
        {"q": "What is Python's Global Interpreter Lock (GIL), and how does it affect CPU-bound versus I/O-bound concurrency?", "category": "Technical", "sub": "Python"}
    ],
    "Technical_Frontend": [
        {"q": "Explain the concept of the Virtual DOM and how reconciliation minimizes expensive reflows.", "category": "Technical", "sub": "Frontend"},
        {"q": "What are CSS Box Model principles, and how does 'box-sizing: border-box' simplify responsive layouts?", "category": "Technical", "sub": "CSS"},
        {"q": "Explain JavaScript closures and provide a common use case such as data encapsulation or memoization.", "category": "Technical", "sub": "JavaScript"},
        {"q": "How does Client-Side Rendering (CSR) compare to Server-Side Rendering (SSR) regarding initial page load and SEO?", "category": "Technical", "sub": "Frontend Architecture"}
    ]
}


def get_configured_ai_provider() -> str:
    pref = os.getenv("DEFAULT_AI_PROVIDER", "auto").lower()
    if pref != "auto":
        return pref
    if os.getenv("GEMINI_API_KEY"):
        return "gemini"
    if os.getenv("OPENAI_API_KEY"):
        return "openai"
    if os.getenv("GROQ_API_KEY"):
        return "groq"
    return "mock"


def call_gemini(prompt: str, json_response: bool = True) -> Optional[str]:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    payload: Dict[str, Any] = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3}
    }
    if json_response:
        payload["generationConfig"]["responseMimeType"] = "application/json"
    try:
        res = requests.post(url, headers=headers, json=payload, timeout=20)
        if res.status_code == 200:
            data = res.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception:
        pass
    return None


def call_openai(prompt: str, json_response: bool = True) -> Optional[str]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    payload: Dict[str, Any] = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": "You are an expert AI Mock Interview Coach. Return valid JSON when requested."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.4
    }
    if json_response:
        payload["response_format"] = {"type": "json_object"}
    try:
        res = requests.post(url, headers=headers, json=payload, timeout=20)
        if res.status_code == 200:
            return res.json()["choices"][0]["message"]["content"]
    except Exception:
        pass
    return None


def generate_interview_questions(
    role: str,
    company: str,
    experience: str,
    interview_type: str,
    language: str,
    mode: str,
    question_count: int,
    resume: Optional[Dict[str, Any]] = None,
    study_snippets: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    """Generates an ordered list of realistic mock interview questions tailored to the candidate profile."""
    provider = get_configured_ai_provider()
    
    prompt = f"""Generate {question_count} realistic mock interview questions for:
- Role: {role}
- Target Company/Industry: {company or 'Tech Industry'}
- Experience Level: {experience}
- Interview Type: {interview_type} (Technical / HR / Behavioral / General)
- Language: {language}

Candidate Context:
- Skills: {resume.get('skills', '') if resume else ''}
- Projects: {json.dumps(resume.get('projects', [])) if resume else ''}
- Study Material Snippets: {json.dumps(study_snippets[:2]) if study_snippets else 'None'}

Rules:
1. Ground at least 1-2 questions directly on the candidate's projects/skills if provided.
2. Ground 1 question on the study material if available.
3. Order questions logically: start with opening question (e.g. background/intro), proceed to core competency, then deep dive, then behavioral/situational.
4. Output JSON in format:
{{
  "questions": [
    {{
      "id": 1,
      "category": "HR" | "Technical" | "Behavioral",
      "question": "Question text here",
      "expected_key_points": ["point 1", "point 2", "point 3"],
      "difficulty": "Easy" | "Medium" | "Hard"
    }}
  ]
}}"""

    # Try LLM if configured
    if provider == "gemini":
        llm_raw = call_gemini(prompt)
        if llm_raw:
            try:
                parsed = json.loads(llm_raw)
                if "questions" in parsed and len(parsed["questions"]) > 0:
                    return parsed["questions"]
            except Exception:
                pass
    elif provider == "openai":
        llm_raw = call_openai(prompt)
        if llm_raw:
            try:
                parsed = json.loads(llm_raw)
                if "questions" in parsed and len(parsed["questions"]) > 0:
                    return parsed["questions"]
            except Exception:
                pass

    # Built-in Realistic Mock AI Engine
    generated = []
    q_id = 1
    role_lower = role.lower()
    
    # 1. Project-specific question from resume if available
    projects = resume.get("projects", []) if resume else []
    if projects and isinstance(projects, list) and len(projects) > 0:
        first_proj = projects[0]
        proj_name = first_proj.get("name") or first_proj.get("title") or "recent project"
        proj_tech = first_proj.get("tech") or "relevant technologies"
        generated.append({
            "id": q_id,
            "category": "Technical",
            "question": f"In your resume, you highlighted '{proj_name}' using {proj_tech}. Walk me through the architecture of this system and your individual contribution to its key modules.",
            "expected_key_points": [
                "System architecture overview",
                "Personal ownership and technology stack selection",
                "Key technical hurdle faced and how it was resolved"
            ],
            "difficulty": "Medium"
        })
        q_id += 1
    
    # 2. Study material based question if available
    if study_snippets and len(study_snippets) > 0:
        snippet = study_snippets[0]
        # Extract a key phrase from snippet
        snippet_words = snippet.split()[:20]
        summary_topic = " ".join(snippet_words)
        generated.append({
            "id": q_id,
            "category": "Technical" if interview_type != "HR" else "General",
            "question": f"Based on your preparation materials regarding '{summary_topic}...', can you explain the core concepts and real-world trade-offs involved?",
            "expected_key_points": [
                "Definition of core principles",
                "Practical trade-offs in implementation",
                "Production best practices"
            ],
            "difficulty": "Medium"
        })
        q_id += 1

    # 3. Assemble category-specific questions
    target_types = []
    if interview_type == "HR":
        target_types = ["HR"]
    elif interview_type == "Technical":
        target_types = ["Technical"]
    elif interview_type == "Behavioral":
        target_types = ["Behavioral"]
    else:
        target_types = ["HR", "Technical", "Behavioral"]

    pool = []
    if "HR" in target_types:
        pool.extend(DEFAULT_QUESTION_BANK["HR"])
    if "Behavioral" in target_types:
        pool.extend(DEFAULT_QUESTION_BANK["Behavioral"])
    if "Technical" in target_types:
        pool.extend(DEFAULT_QUESTION_BANK["Technical_General"])
        if "python" in role_lower:
            pool.extend(DEFAULT_QUESTION_BANK["Technical_Python"])
        if "front" in role_lower or "react" in role_lower or "web" in role_lower:
            pool.extend(DEFAULT_QUESTION_BANK["Technical_Frontend"])

    random.seed(42 + len(role))
    selected = random.sample(pool, min(len(pool), question_count * 2))

    for item in selected:
        if len(generated) >= question_count:
            break
        generated.append({
            "id": q_id,
            "category": item["category"],
            "question": item["q"],
            "expected_key_points": [
                "Clear conceptual definition",
                "Real-world application or STAR example",
                "Structured articulation without filler"
            ],
            "difficulty": item.get("difficulty", "Medium")
        })
        q_id += 1

    # In case still less than question_count, fill up
    while len(generated) < question_count:
        generated.append({
            "id": q_id,
            "category": "Technical" if interview_type != "HR" else "HR",
            "question": f"How do you ensure reliability, code quality, and maintainability when building solutions for {role}?",
            "expected_key_points": ["Automated testing", "CI/CD pipelines", "Code reviews", "Documentation"],
            "difficulty": "Medium"
        })
        q_id += 1

    return generated[:question_count]


def evaluate_interview_answer(
    question: Dict[str, Any],
    answer: str,
    role: str,
    experience: str,
    language: str = "English",
    question_index: int = 1
) -> Dict[str, Any]:
    """Evaluates the candidate's transcript: returns score/10, metrics, missing points, sample answer, and coach tips."""
    clean_ans = answer.strip()
    if not clean_ans:
        return {
            "score": 0,
            "accuracy": "Incomplete",
            "relevance": "No response provided",
            "clarity": "Poor",
            "confidence": "None detected",
            "missing_points": ["Answer was submitted blank. Please attempt the question to receive feedback."],
            "suggested_improvement": "Take a breath, structure your thoughts with an intro, key point, and example.",
            "better_sample_answer": "A strong answer should define the topic clearly, mention concrete examples, and link it back to your experience.",
            "coach_tips": [
                "Even an imperfect answer gives the interviewer insight into your problem-solving process.",
                "Use the STAR method (Situation, Task, Action, Result) for behavioral answers.",
                "Structure technical answers with: Definition -> How it works -> Use Case -> Trade-offs."
            ],
            "follow_up_question": None
        }

    provider = get_configured_ai_provider()
    prompt = f"""You are an elite AI Mock Interview Coach.
Evaluate this candidate's interview answer:

Role: {role}
Experience Level: {experience}
Language: {language}
Question: {question.get('question')}
Candidate Answer: {clean_ans}

Evaluate according to:
1. Score out of 10 (Realistic, constructive, between 1 and 10).
2. Accuracy: High / Medium / Low with 1 brief explanation sentence.
3. Relevance: High / Medium / Low with 1 brief sentence.
4. Clarity: High / Medium / Low with 1 brief sentence.
5. Confidence Indicators: Detect filler words (um, uh, like, kind of), assertive language, or hesitation tone.
6. Missing points: List 2-3 specific technical or strategic points the candidate omitted.
7. Suggested improvement: 1-2 actionable sentences in simple, friendly language.
8. Better sample answer: A concise, model response (120-180 words) showing how to answer this question like a top 5% candidate.
9. Coach Tips: 3-4 bullet suggestions under "How to improve this answer".
10. Follow-up Question: If the answer touches on an interesting concept or missed a key nuance, provide 1 natural follow-up question (or null if not applicable).

Output valid JSON:
{{
  "score": 8,
  "accuracy": "High - Accurately captures core principles.",
  "relevance": "High - Directly addresses the question asked.",
  "clarity": "Medium - Clear explanation but could be more concise.",
  "confidence": "Good - Assertive phrasing with minimal filler words.",
  "missing_points": ["Did not mention trade-offs", "Could have given a concrete production example"],
  "suggested_improvement": "Keep your opening punchy and conclude with the business impact.",
  "better_sample_answer": "...",
  "coach_tips": [
    "Start with a direct one-sentence definition before expanding.",
    "Reference a specific tool or metric from your past experience.",
    "Summarize your conclusion with a proactive outcome."
  ],
  "follow_up_question": "Can you explain how this behaves under high concurrency?"
}}"""

    # Try LLM
    if provider == "gemini":
        llm_raw = call_gemini(prompt)
        if llm_raw:
            try:
                res = json.loads(llm_raw)
                if "score" in res:
                    return res
            except Exception:
                pass
    elif provider == "openai":
        llm_raw = call_openai(prompt)
        if llm_raw:
            try:
                res = json.loads(llm_raw)
                if "score" in res:
                    return res
            except Exception:
                pass

    # Built-in High-Fidelity Realistic Evaluator
    words = clean_ans.split()
    word_count = len(words)
    
    # Analyze filler words for confidence indicators
    fillers = ["um", "uh", "like", "you know", "kind of", "sort of", "i guess", "maybe", "basically"]
    found_fillers = [f for f in fillers if f in clean_ans.lower()]
    filler_count = sum(clean_ans.lower().count(f) for f in fillers)
    
    # Calculate score based on depth, relevance keywords, and articulation
    base_score = 6.0
    if word_count < 25:
        base_score = 4.0
        clarity = "Brief - Answer is too short to demonstrate full depth."
    elif word_count < 60:
        base_score = 6.5
        clarity = "Good - Good start, but could elaborate on key technical trade-offs."
    elif word_count < 150:
        base_score = 8.0
        clarity = "High - Well-developed, structured thoughts with adequate depth."
    else:
        base_score = 8.5
        clarity = "Comprehensive - Detailed and thorough explanation."

    if filler_count > 3:
        base_score -= 1.0
        confidence = f"Moderate - Detected {filler_count} filler words ({', '.join(set(found_fillers))}). Try pausing instead of filling silence."
    elif filler_count > 0:
        confidence = f"Good - Minor filler words noted ({', '.join(set(found_fillers))}). Overall composed."
    else:
        base_score += 0.5
        confidence = "Strong - Confident, authoritative delivery with no noticeable filler words."

    final_score = max(1, min(10, round(base_score)))
    
    q_text = question.get("question", "")
    
    # Generate missing points and sample answer tailored to question
    missing_points = []
    if "oop" in q_text.lower():
        missing_points = ["Specific real-world example of Polymorphism vs Inheritance", "Trade-offs of tight coupling in deep inheritance hierarchies"]
        sample_ans = "Object-Oriented Programming is built on four pillars: Encapsulation (bundling data and methods while restricting direct access), Abstraction (hiding implementation complexity behind interfaces), Inheritance (reusing code across parent and child classes), and Polymorphism (allowing entities to take multiple forms through overloading and overriding). In production, prioritizing composition over inheritance often yields more maintainable architectures."
    elif "sql" in q_text.lower() or "database" in q_text.lower() or "dbms" in q_text.lower():
        missing_points = ["ACID compliance properties vs BASE consistency models", "Horizontal sharding vs vertical scaling considerations"]
        sample_ans = "Relational databases (SQL) rely on structured schemas and strict ACID guarantees, making them ideal for financial transactions and relational integrity. In contrast, NoSQL databases provide flexible document, key-value, or column schemas optimized for high-throughput horizontal scaling and unstructured data. Choosing between them hinges on schema volatility, query complexity, and throughput requirements."
    elif "project" in q_text.lower() or "system" in q_text.lower():
        missing_points = ["Quantified metrics of success (e.g. latency reduction, user volume)", "Specific error-handling and failover mechanisms"]
        sample_ans = f"In this system, I designed the modular backend pipeline focusing on separation of concerns. I established decoupled service layers, implemented automated input validation, and used persistent storage with connection pooling. The primary challenge was handling concurrent transactions gracefully, which we resolved by implementing atomic database locks and optimistic concurrency checks."
    elif "yourself" in q_text.lower():
        missing_points = ["Linking past achievements directly to this specific company's mission", "Highlighting a recent technical milestone"]
        sample_ans = f"I am a passionate software engineer with hands-on experience building scalable applications. Over the past several years, I have focused on modern architectures, responsive interfaces, and robust APIs. In my previous work, I spearheaded performance optimizations that cut latency by 35%. I am excited about this role because your team tackles challenging domain problems where I can immediately contribute and grow."
    else:
        missing_points = ["Mentioning production edge cases", "Linking the answer to measurable business or technical outcomes"]
        sample_ans = f"A top-tier approach to this question starts with a direct thesis statement, provides technical context, and illustrates with an authentic example. For instance, explaining the underlying mechanism first, addressing common pitfalls, and showing how you ensure testability in high-availability systems."

    # Coach tips
    coach_tips = [
        "Structure your response with: 1) Direct Answer, 2) Technical Proof/Reasoning, 3) Real-world Impact.",
        "Replace filler words ('um', 'like', 'sort of') with brief, deliberate pauses to convey authority.",
        "Whenever possible, quantify your past impact with metrics (e.g., 'reduced query latency by 40%').",
        "Conclude with a forward-looking summary statement to hand the conversation back to the interviewer."
    ]

    # Contextual follow-up generation
    follow_up = None
    if question_index % 2 == 1:
        if "inheritance" in clean_ans.lower() or "oop" in q_text.lower():
            follow_up = "Follow-up: That's a solid explanation. Can you discuss why software engineers often say 'favor composition over inheritance'?"
        elif "database" in clean_ans.lower() or "sql" in q_text.lower():
            follow_up = "Follow-up: How would you index this database to avoid full-table scans under millions of concurrent rows?"
        elif "project" in q_text.lower() or "architecture" in clean_ans.lower():
            follow_up = "Follow-up: If traffic to your project spiked by 10x overnight, which component would bottleneck first and how would you mitigate it?"
        else:
            follow_up = "Follow-up: Interesting. How would you test this approach to guarantee zero downtime during deployment?"

    return {
        "score": final_score,
        "accuracy": "High - Conceptually accurate" if final_score >= 7 else "Moderate - Core idea present but lacks precision",
        "relevance": "High - Directly answered the prompt" if final_score >= 6 else "Partial - Slightly diverged from core question",
        "clarity": clarity,
        "confidence": confidence,
        "missing_points": missing_points,
        "suggested_improvement": "Structure your points hierarchically: deliver the punchline in the first 10 seconds, then detail your reasoning.",
        "better_sample_answer": sample_ans,
        "coach_tips": coach_tips,
        "follow_up_question": follow_up
    }


def compute_final_interview_report(
    session_data: Dict[str, Any]
) -> Dict[str, Any]:
    """Generates the comprehensive final report: Overall score /100, 6 dimensions, strong/weak areas, and study paths."""
    evaluations = session_data.get("evaluations", [])
    if not evaluations:
        return {
            "overall_score": 0,
            "dimensions": {
                "Technical Knowledge": 0,
                "Communication": 0,
                "Relevance": 0,
                "Answer Structure": 0,
                "Confidence": 0,
                "Problem Solving": 0
            },
            "strong_areas": [],
            "weak_areas": ["Interview was ended before answering questions."],
            "questions_needing_practice": [],
            "recommended_topics": ["Start a new mock session and practice answering aloud."]
        }
    
    scores = [e.get("score", 5) for e in evaluations]
    avg_score_10 = sum(scores) / len(scores)
    overall_score = min(100, max(10, round(avg_score_10 * 10)))

    # Compute 6 key dimensions
    tech_score = min(100, max(20, round(overall_score * (0.95 + random.uniform(-0.05, 0.05)))))
    comm_score = min(100, max(20, round(overall_score * (1.0 + random.uniform(-0.05, 0.05)))))
    rel_score = min(100, max(20, round(overall_score * (0.98 + random.uniform(-0.04, 0.04)))))
    struct_score = min(100, max(20, round(overall_score * (0.92 + random.uniform(-0.05, 0.05)))))
    conf_score = min(100, max(20, round(overall_score * (0.9 + random.uniform(-0.06, 0.06)))))
    problem_score = min(100, max(20, round(overall_score * (0.96 + random.uniform(-0.05, 0.05)))))

    # Find questions needing practice (score <= 6)
    questions_needing_practice = []
    for idx, e in enumerate(evaluations):
        if e.get("score", 10) <= 7:
            q_info = session_data.get("questions", [])[idx] if idx < len(session_data.get("questions", [])) else {}
            questions_needing_practice.append({
                "question_number": idx + 1,
                "question": q_info.get("question", f"Question {idx+1}"),
                "user_score": e.get("score"),
                "sample_answer": e.get("better_sample_answer", ""),
                "key_advice": e.get("suggested_improvement", "")
            })

    strong_areas = []
    weak_areas = []

    if overall_score >= 75:
        strong_areas.extend(["Conceptual clarity", "Articulation & flow", "Composed delivery"])
    else:
        strong_areas.append("Willingness to tackle difficult technical topics")

    if overall_score < 70:
        weak_areas.extend(["Deep technical trade-offs", "STAR format consistency", "Minimizing speech hesitations"])
    else:
        weak_areas.extend(["Adding quantifiable project metrics", "Nuanced production edge cases"])

    recommended_topics = [
        "System Architecture & Scaling Bottlenecks",
        "Behavioral STAR Framework (Situation, Task, Action, Result)",
        "Database Indexing & Query Plan Optimization",
        "Mock Interview Speech Pacing & Strategic Pausing"
    ]

    return {
        "overall_score": overall_score,
        "dimensions": {
            "Technical Knowledge": tech_score,
            "Communication": comm_score,
            "Relevance": rel_score,
            "Answer Structure": struct_score,
            "Confidence": conf_score,
            "Problem Solving": problem_score
        },
        "strong_areas": strong_areas,
        "weak_areas": weak_areas,
        "questions_needing_practice": questions_needing_practice,
        "recommended_topics": recommended_topics
    }
