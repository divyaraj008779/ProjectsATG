const { useState, useEffect, useRef } = React;

function App() {
  // Navigation & View State: 'landing' | 'analyzing' | 'dashboard' | 'interview' | 'report' | 'history'
  const [view, setView] = useState("landing");
  const [repoUrl, setRepoUrl] = useState("");
  const [sampleRepos, setSampleRepos] = useState([]);
  
  // Analysis State
  const [analysisStep, setAnalysisStep] = useState(0);
  const [projectData, setProjectData] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  
  // Interview Switch & Session State
  const [interviewSwitch, setInterviewSwitch] = useState(false);
  const [sessionData, setSessionData] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answerText, setAnswerText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentEvaluation, setCurrentEvaluation] = useState(null);
  const [evaluationsHistory, setEvaluationsHistory] = useState([]);
  
  // Timer & Speech Recognition State
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  
  // Final Report & History
  const [finalReport, setFinalReport] = useState(null);
  const [savedHistory, setSavedHistory] = useState([]);
  const [githubStatus, setGithubStatus] = useState(null);

  const checkGithubConnection = () => {
    fetch("/api/github/test")
      .then(res => res.json())
      .then(data => setGithubStatus(data))
      .catch(err => setGithubStatus({ success: false, error: err.message }));
  };

  // Fetch sample repos and check github connectivity on mount
  useEffect(() => {
    fetch("/api/sample-repos")
      .then(res => res.json())
      .then(data => setSampleRepos(data))
      .catch(err => console.warn(err));

    fetchHistory();
    checkGithubConnection();
  }, []);

  // Timer lifecycle for interview
  useEffect(() => {
    if (view === "interview") {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [view]);

  // Speech Recognition setup
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recog = new SpeechRecognition();
      recog.continuous = true;
      recog.interimResults = true;
      recog.lang = "en-US";

      recog.onresult = (event) => {
        let finalTrans = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTrans += event.results[i][0].transcript + " ";
          }
        }
        if (finalTrans) {
          setAnswerText(prev => (prev.trim() + " " + finalTrans.trim()).trim());
        }
      };

      recog.onerror = (e) => {
        console.warn("Speech recognition error:", e);
        setIsRecording(false);
      };

      recog.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recog;
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. You can type your answer directly!");
      return;
    }
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        console.warn(err);
      }
    }
  };

  const fetchHistory = () => {
    fetch("/api/project-history")
      .then(res => res.json())
      .then(data => setSavedHistory(data))
      .catch(e => console.warn(e));
  };

  // 1. Analyze Repository Action
  const handleAnalyze = async (urlToAnalyze) => {
    const targetUrl = urlToAnalyze || repoUrl;
    if (!targetUrl || !targetUrl.trim()) {
      setErrorMessage("Please enter a valid GitHub repository URL.");
      return;
    }
    setErrorMessage("");
    setView("analyzing");
    setAnalysisStep(0);

    // Simulate animated step progression
    const stepsInterval = setInterval(() => {
      setAnalysisStep(prev => {
        if (prev < 5) return prev + 1;
        clearInterval(stepsInterval);
        return prev;
      });
    }, 700);

    try {
      const res = await fetch("/api/analyze-repository", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_url: targetUrl.trim() })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Analysis failed");
      }

      const data = await res.json();
      clearInterval(stepsInterval);
      setAnalysisStep(6);
      setTimeout(() => {
        setProjectData(data);
        setView("dashboard");
        setInterviewSwitch(false);
      }, 500);

    } catch (err) {
      clearInterval(stepsInterval);
      setErrorMessage(err.message);
      setView("landing");
    }
  };

  // 2. Start Interview Session Action
  const handleStartInterview = async () => {
    if (!projectData) return;
    try {
      const res = await fetch("/api/start-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo_url: projectData.url,
          project_data: projectData
        })
      });

      if (!res.ok) throw new Error("Could not initialize interview");
      const session = await res.json();

      setSessionData(session);
      setCurrentIndex(0);
      setCurrentQuestion(session.questions[0]);
      setAnswerText("");
      setCurrentEvaluation(null);
      setEvaluationsHistory([]);
      setElapsedSeconds(0);
      setInterviewSwitch(true);
      setView("interview");

      // TTS read question aloud
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(session.questions[0].question);
        window.speechSynthesis.speak(u);
      }
    } catch (err) {
      alert("Error starting interview: " + err.message);
    }
  };

  // 3. Submit Answer Action
  const handleSubmitAnswer = async () => {
    if (!answerText.trim()) {
      alert("Please provide or speak an answer before submitting.");
      return;
    }
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionData.session_id,
          question_index: currentIndex + 1,
          question: currentQuestion,
          answer: answerText,
          project_data: projectData
        })
      });

      if (!res.ok) throw new Error("Evaluation request failed");
      const evalResult = await res.json();
      
      setCurrentEvaluation(evalResult);
      setEvaluationsHistory(prev => [...prev, evalResult]);

    } catch (err) {
      alert("Evaluation failed: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Next Question Action
  const handleNextQuestion = () => {
    if (currentIndex + 1 < sessionData.questions.length) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setCurrentQuestion(sessionData.questions[nextIdx]);
      setAnswerText("");
      setCurrentEvaluation(null);

      // TTS next question
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(sessionData.questions[nextIdx].question);
        window.speechSynthesis.speak(u);
      }
    } else {
      handleEndInterview();
    }
  };

  // 5. End Interview Action & Final Report
  const handleEndInterview = async () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (isRecording && recognitionRef.current) recognitionRef.current.stop();

    try {
      const res = await fetch("/api/end-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionData ? sessionData.session_id : "adhoc",
          project_data: projectData,
          questions: sessionData ? sessionData.questions : [],
          evaluations: evaluationsHistory,
          duration_seconds: elapsedSeconds
        })
      });

      if (!res.ok) throw new Error("Failed to compile final report");
      const rep = await res.json();

      setFinalReport(rep.report);
      setView("report");
      fetchHistory();
    } catch (err) {
      alert("Error generating report: " + err.message);
    }
  };

  // Format timer
  const formatTime = (secs) => {
    const m = String(Math.floor(secs / 60)).padStart(2, "0");
    const s = String(secs % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div>
      {/* TOP NAVIGATION BAR */}
      <nav className="top-nav">
        <div className="nav-brand" onClick={() => setView("landing")}>
          <div className="nav-brand-icon">⚡</div>
          <div className="nav-brand-title">
            AI Project <span>Interviewer</span>
          </div>
        </div>

        <div className="nav-links">
          <button 
            className={`nav-link-btn ${view === "landing" ? "active" : ""}`}
            onClick={() => setView("landing")}>
            New Analysis
          </button>
          {projectData && (
            <button 
              className={`nav-link-btn ${view === "dashboard" ? "active" : ""}`}
              onClick={() => setView("dashboard")}>
              Project Dashboard
            </button>
          )}
          {sessionData && (
            <button 
              className={`nav-link-btn ${view === "interview" ? "active" : ""}`}
              onClick={() => setView("interview")}>
              Active Interview
            </button>
          )}
          <button 
            className={`nav-link-btn ${view === "history" ? "active" : ""}`}
            onClick={() => { fetchHistory(); setView("history"); }}>
            History
          </button>
          <span className="practice-badge">PRACTICE VIVA MODE</span>
        </div>
      </nav>

      {/* MAIN CONTAINER */}
      <main className="main-content">

        {/* ========================================================
            VIEW 1: LANDING PAGE
           ======================================================== */}
        {view === "landing" && (
          <div>
            <div className="landing-hero">
              <div className="landing-tagline">
                <span>🔍</span> Codebase-Grounded Technical Viva
              </div>
              <h1>
                Let AI Understand Your <span>GitHub Project</span><br />
                And Interview You About It
              </h1>
              <p>
                Provide the GitHub URL of your software project. The AI analyzes your actual repository—detecting frontend components, backend routes, database models, and authentication logic—and conducts an in-depth technical interview based strictly on YOUR code.
              </p>

              {errorMessage && (
                <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", color: "#fca5a5", padding: "12px 20px", borderRadius: "12px", maxWidth: "780px", margin: "0 auto 20px" }}>
                  {errorMessage}
                </div>
              )}

              <div className="repo-input-card">
                <div className="repo-input-wrapper">
                  <span className="repo-input-icon">🔗</span>
                  <input
                    type="text"
                    className="repo-input-field"
                    placeholder="https://github.com/username/project"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                  />
                </div>
                <button 
                  className="btn btn-primary btn-lg" 
                  onClick={() => handleAnalyze()}
                  id="btn-analyze-project">
                  Analyze Project →
                </button>
              </div>

              {/* 1-Click Benchmark Demo Repositories */}
              <div className="sample-repos-section">
                <div style={{ fontSize: "0.88rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                  Or click a benchmark project for an instant demo:
                </div>
                <div className="sample-repo-chips">
                  {sampleRepos.map(repo => (
                    <div 
                      key={repo.id} 
                      className="sample-repo-card"
                      onClick={() => {
                        setRepoUrl(repo.url);
                        handleAnalyze(repo.url);
                      }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <strong style={{ fontSize: "1rem" }}>{repo.name}</strong>
                        <span className="practice-badge">{repo.badge}</span>
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "8px" }}>
                        {repo.description}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--accent-secondary)" }}>
                        Click to test interview →
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            VIEW 2: ANALYSIS PROGRESS SCREEN
           ======================================================== */}
        {view === "analyzing" && (
          <div className="glass-card analysis-screen">
            <div className="analysis-spinner-wrap"></div>
            <h2>Analyzing Your Project...</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
              Inspecting file hierarchy, dependencies, API controllers, and architectural patterns.
            </p>

            <div className="analysis-steps-list">
              {[
                "Reading repository",
                "Analyzing project structure",
                "Detecting technologies",
                "Understanding frontend",
                "Understanding backend",
                "Preparing interview"
              ].map((stepLabel, idx) => {
                const isDone = analysisStep > idx;
                const isCurrent = analysisStep === idx;
                return (
                  <div 
                    key={idx} 
                    className={`analysis-step-item ${isDone ? "completed" : isCurrent ? "active" : ""}`}>
                    <div className="step-icon">
                      {isDone ? "✓" : isCurrent ? "⚡" : "○"}
                    </div>
                    <span>{stepLabel}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================
            VIEW 3: PROJECT DASHBOARD
           ======================================================== */}
        {view === "dashboard" && projectData && (
          <div className="dashboard-grid">
            <div className="glass-card project-hero-card">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                  <h2>{projectData.name}</h2>
                  <span className="practice-badge">{projectData.language}</span>
                </div>
                <a href={projectData.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.9rem" }}>
                  {projectData.url} ↗
                </a>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", marginTop: "8px", maxWidth: "680px" }}>
                  {projectData.description}
                </p>
              </div>

              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <button className="btn btn-primary btn-lg" onClick={handleStartInterview}>
                  Start AI Interview →
                </button>
              </div>
            </div>

            {/* Step 4 Requirement: Prominent AI Interview Switch */}
            <div className="switch-card">
              <div>
                <strong style={{ fontSize: "1.1rem", display: "block", marginBottom: "4px" }}>
                  AI INTERVIEW MODE
                </strong>
                <span style={{ fontSize: "0.88rem", color: "#c7d2fe" }}>
                  {interviewSwitch ? "✓ AI Interviewer is active and ready" : "Toggle ON to launch the interactive viva"}
                </span>
              </div>
              <div className="switch-toggle-wrap">
                <span style={{ fontSize: "0.9rem", fontWeight: 700, color: interviewSwitch ? "var(--accent-emerald)" : "var(--text-muted)" }}>
                  {interviewSwitch ? "ON" : "OFF"}
                </span>
                <label className="toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={interviewSwitch} 
                    onChange={(e) => {
                      setInterviewSwitch(e.target.checked);
                      if (e.target.checked) handleStartInterview();
                    }} 
                  />
                  <span className="slider"></span>
                </label>
              </div>
            </div>

            {/* Tech Stack Grid */}
            <div className="tech-stack-grid">
              <div className="tech-badge-card">
                <div className="title">Frontend</div>
                <div className="value">{projectData.tech_stack.frontend}</div>
              </div>
              <div className="tech-badge-card">
                <div className="title">Backend</div>
                <div className="value">{projectData.tech_stack.backend}</div>
              </div>
              <div className="tech-badge-card">
                <div className="title">Database</div>
                <div className="value">{projectData.tech_stack.database}</div>
              </div>
              <div className="tech-badge-card">
                <div className="title">Authentication</div>
                <div className="value">{projectData.tech_stack.authentication}</div>
              </div>
              <div className="tech-badge-card">
                <div className="title">APIs</div>
                <div className="value">{projectData.tech_stack.apis}</div>
              </div>
            </div>

            {/* Structure & Details */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div className="glass-card">
                <h3 style={{ fontSize: "1.1rem", marginBottom: "12px" }}>Project Structure</h3>
                <div className="tree-box">{projectData.structure}</div>
              </div>

              <div className="glass-card">
                <h3 style={{ fontSize: "1.1rem", marginBottom: "12px" }}>Important Features Detected</h3>
                <ul style={{ paddingLeft: "20px", lineHeight: "1.7", color: "var(--text-secondary)", fontSize: "0.92rem" }}>
                  {projectData.features.map((feat, i) => (
                    <li key={i}><span style={{ color: "var(--text-primary)" }}>{feat}</span></li>
                  ))}
                </ul>

                <h3 style={{ fontSize: "1.1rem", margin: "16px 0 10px" }}>Key APIs Identified</h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {projectData.apis_detected.map((api, i) => (
                    <span key={i} className="practice-badge" style={{ background: "rgba(6, 182, 212, 0.15)", color: "var(--accent-secondary)" }}>
                      {api}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            VIEW 4: LIVE AI PROJECT INTERVIEW SCREEN
           ======================================================== */}
        {view === "interview" && currentQuestion && (
          <div className="interview-container">
            {/* Top Status Banner */}
            <div className="interview-status-banner">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span className="mic-active-dot" style={{ background: "var(--accent-emerald)" }}></span>
                <span>AI Interviewer is active • Grounded on <strong>{projectData.name}</strong></span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <span style={{ fontFamily: "monospace", fontSize: "1.1rem", color: "var(--accent-secondary)" }}>
                  ⏱ {formatTime(elapsedSeconds)}
                </span>
                <button className="btn btn-danger btn-sm" onClick={handleEndInterview}>
                  End Interview
                </button>
              </div>
            </div>

            {/* Question Card */}
            <div className="glass-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span className="practice-badge" style={{ background: "rgba(139, 92, 246, 0.2)", color: "var(--accent-purple)" }}>
                  {currentQuestion.type}
                </span>
                <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                  Question {currentIndex + 1} of {sessionData.questions.length}
                </span>
              </div>

              <h2 style={{ fontSize: "1.45rem", lineHeight: "1.4", margin: "12px 0 20px" }}>
                {currentQuestion.question}
              </h2>

              {/* Code References Card (Step 9 Requirement) */}
              {currentQuestion.code_reference && (
                <div className="code-ref-card">
                  <div className="code-ref-header">
                    <span>
                      📁 File: <span className="file-path">{currentQuestion.code_reference.file}</span>
                    </span>
                    <span>
                      ⚙️ Function: <strong>{currentQuestion.code_reference.function_name}</strong>
                    </span>
                  </div>
                  <div className="code-snippet-box">
                    {currentQuestion.code_reference.snippet}
                  </div>
                  <div className="code-context-note">
                    💡 Why this code is relevant: {currentQuestion.code_reference.context}
                  </div>
                </div>
              )}
            </div>

            {/* Answer Section */}
            <div className="glass-card">
              <div className="voice-answer-bar">
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className={`mic-active-dot ${isRecording ? "recording" : ""}`}></span>
                  <span style={{ fontSize: "0.92rem", fontWeight: 600 }}>
                    {isRecording ? "Listening to your voice... Speak clearly" : "Voice Input Ready"}
                  </span>
                </div>

                <button 
                  className={`btn btn-sm ${isRecording ? "btn-danger" : "btn-secondary"}`}
                  onClick={toggleRecording}>
                  {isRecording ? "⏹ Stop Recording" : "🎤 Answer with Voice"}
                </button>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <textarea
                  rows="4"
                  placeholder="Speak with microphone or type your technical response here..."
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button 
                  className="btn btn-primary"
                  onClick={handleSubmitAnswer}
                  disabled={isSubmitting}>
                  {isSubmitting ? "Evaluating against repository..." : "Submit Answer"}
                </button>
              </div>
            </div>

            {/* Evaluation Card (After Answer Submission) */}
            {currentEvaluation && (
              <div className="glass-card eval-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <div>
                    <h3 style={{ fontSize: "1.25rem", marginBottom: "4px" }}>AI Evaluation</h3>
                    <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)" }}>
                      Evaluation verified against your actual repository implementation.
                    </p>
                  </div>
                  <div className="eval-score-ring">
                    {currentEvaluation.score}/10
                  </div>
                </div>

                <div className="eval-grid-4">
                  <div className="tech-badge-card">
                    <div className="title">Accuracy</div>
                    <div className="value" style={{ fontSize: "0.9rem" }}>{currentEvaluation.accuracy}</div>
                  </div>
                  <div className="tech-badge-card">
                    <div className="title">Project Understanding</div>
                    <div className="value" style={{ fontSize: "0.9rem" }}>{currentEvaluation.project_understanding}</div>
                  </div>
                  <div className="tech-badge-card">
                    <div className="title">Technical Depth</div>
                    <div className="value" style={{ fontSize: "0.9rem" }}>{currentEvaluation.technical_depth}</div>
                  </div>
                  <div className="tech-badge-card">
                    <div className="title">Clarity</div>
                    <div className="value" style={{ fontSize: "0.9rem" }}>{currentEvaluation.clarity}</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", margin: "16px 0" }}>
                  <div style={{ background: "var(--success-bg)", border: "1px solid rgba(16,185,129,0.3)", padding: "14px", borderRadius: "8px" }}>
                    <strong style={{ color: "var(--success)", fontSize: "0.9rem" }}>✓ What was correct:</strong>
                    <p style={{ fontSize: "0.9rem", marginTop: "4px", color: "var(--text-primary)" }}>
                      {currentEvaluation.what_was_correct}
                    </p>
                  </div>

                  <div style={{ background: "var(--warning-bg)", border: "1px solid rgba(245,158,11,0.3)", padding: "14px", borderRadius: "8px" }}>
                    <strong style={{ color: "var(--warning)", fontSize: "0.9rem" }}>⚠ What was missing:</strong>
                    <p style={{ fontSize: "0.9rem", marginTop: "4px", color: "var(--text-primary)" }}>
                      {currentEvaluation.what_was_missing}
                    </p>
                  </div>
                </div>

                <div style={{ background: "var(--bg-surface)", padding: "14px", borderRadius: "8px", border: "1px solid var(--border-glass)", marginBottom: "16px" }}>
                  <strong style={{ color: "var(--accent-secondary)", fontSize: "0.85rem", textTransform: "uppercase" }}>
                    Suggested Model Answer:
                  </strong>
                  <p style={{ fontSize: "0.92rem", marginTop: "4px", lineHeight: "1.6" }}>
                    {currentEvaluation.suggested_answer}
                  </p>
                </div>

                {/* Follow-up question banner */}
                {currentEvaluation.follow_up_question && (
                  <div className="followup-box">
                    <span style={{ fontSize: "1.3rem" }}>⚡</span>
                    <div>
                      <strong style={{ color: "var(--warning)", fontSize: "0.9rem" }}>Natural Follow-up Question:</strong>
                      <div style={{ fontSize: "0.95rem", marginTop: "2px" }}>
                        {currentEvaluation.follow_up_question}
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
                  <button className="btn btn-primary" onClick={handleNextQuestion}>
                    Next Question →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            VIEW 5: FINAL INTERVIEW REPORT SCREEN
           ======================================================== */}
        {view === "report" && finalReport && (
          <div>
            <div className="glass-card" style={{ textAlign: "center", padding: "36px 20px", marginBottom: "24px" }}>
              <div className="report-radial">
                <div className="report-radial-num">{finalReport.overall_score}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>OVERALL / 100</div>
              </div>
              <h2 style={{ fontSize: "1.8rem", marginBottom: "6px" }}>Project Interview Report</h2>
              <p style={{ color: "var(--text-secondary)", maxWidth: "600px", margin: "0 auto" }}>
                Assessment of code ownership and architectural competency for <strong>{projectData.name}</strong>.
              </p>
            </div>

            {/* 7 Competency Radar Bars */}
            <div className="radar-bars-grid">
              {Object.entries(finalReport.dimensions).map(([dim, val]) => (
                <div key={dim} className="radar-item">
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem", fontWeight: 600 }}>
                    <span>{dim}</span>
                    <span>{val}%</span>
                  </div>
                  <div className="radar-track">
                    <div className="radar-fill" style={{ width: `${val}%` }}></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Strong & Weak Areas */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px" }}>
              <div className="glass-card" style={{ borderLeft: "4px solid var(--success)" }}>
                <h4 style={{ color: "var(--success)", marginBottom: "10px" }}>✨ Strong Areas</h4>
                <ul style={{ paddingLeft: "20px", fontSize: "0.92rem", lineHeight: "1.7" }}>
                  {finalReport.strong_areas.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>

              <div className="glass-card" style={{ borderLeft: "4px solid var(--danger)" }}>
                <h4 style={{ color: "var(--danger)", marginBottom: "10px" }}>🎯 Areas Needing Practice</h4>
                <ul style={{ paddingLeft: "20px", fontSize: "0.92rem", lineHeight: "1.7" }}>
                  {finalReport.weak_areas.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            </div>

            {/* Questions Struggled With */}
            {finalReport.questions_struggled_with.length > 0 && (
              <div className="glass-card" style={{ marginBottom: "24px" }}>
                <h3 style={{ fontSize: "1.15rem", marginBottom: "14px" }}>Questions You Struggled With</h3>
                {finalReport.questions_struggled_with.map((item, i) => (
                  <div key={i} style={{ background: "var(--bg-surface)", padding: "14px", borderRadius: "8px", marginBottom: "10px", border: "1px solid var(--border-glass)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <strong>Question {item.question_number}: {item.question}</strong>
                      <span className="practice-badge" style={{ color: "var(--warning)" }}>Score: {item.user_score}/10</span>
                    </div>
                    <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", margin: "4px 0" }}>
                      <strong>Missing:</strong> {item.what_was_missing}
                    </p>
                    <div style={{ fontSize: "0.85rem", color: "var(--accent-secondary)" }}>
                      <strong>Key Review:</strong> {item.suggested_answer}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Recommended Files to Study from Repo */}
            <div className="glass-card" style={{ marginBottom: "24px" }}>
              <h3 style={{ fontSize: "1.15rem", marginBottom: "10px" }}>📁 Recommended Files to Study in Your Repository</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {finalReport.recommended_files_to_study.map((file, i) => (
                  <span key={i} className="practice-badge" style={{ padding: "6px 14px", fontSize: "0.88rem", fontFamily: "monospace" }}>
                    📄 {file}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "center", gap: "14px" }}>
              <button className="btn btn-primary btn-lg" onClick={() => setView("landing")}>
                Analyze Another Repository
              </button>
              <button className="btn btn-secondary btn-lg" onClick={() => { fetchHistory(); setView("history"); }}>
                View Saved History
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            VIEW 6: HISTORY
           ======================================================== */}
        {view === "history" && (
          <div className="glass-card">
            <h2 style={{ fontSize: "1.4rem", marginBottom: "6px" }}>Project Interview History</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.92rem", marginBottom: "20px" }}>
              Saved project viva sessions and performance evaluations.
            </p>

            {savedHistory.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
                No project interview sessions saved yet. Start your first analysis above!
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-glass)", textAlign: "left", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                    <th style={{ padding: "12px" }}>Date</th>
                    <th style={{ padding: "12px" }}>Project Name</th>
                    <th style={{ padding: "12px" }}>Repository</th>
                    <th style={{ padding: "12px" }}>Score</th>
                    <th style={{ padding: "12px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {savedHistory.map(item => (
                    <tr key={item.id} style={{ borderBottom: "1px solid var(--border-glass)" }}>
                      <td style={{ padding: "12px", fontSize: "0.9rem" }}>{item.date}</td>
                      <td style={{ padding: "12px" }}><strong>{item.project_name}</strong></td>
                      <td style={{ padding: "12px", fontSize: "0.88rem", color: "var(--text-secondary)" }}>
                        <a href={item.repo_url} target="_blank" rel="noopener noreferrer">{item.repo_url}</a>
                      </td>
                      <td style={{ padding: "12px" }}>
                        <span className="practice-badge" style={{ color: item.overall_score >= 70 ? "var(--success)" : "var(--warning)" }}>
                          {item.overall_score}/100
                        </span>
                      </td>
                      <td style={{ padding: "12px" }}>
                        <button 
                          className="btn btn-sm btn-danger"
                          onClick={async () => {
                            if (confirm("Delete this session record?")) {
                              await fetch(`/api/project-history/${item.id}`, { method: "DELETE" });
                              fetchHistory();
                            }
                          }}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
