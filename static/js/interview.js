/**
 * Live Mock Interview Controller
 */

class InterviewSessionManager {
  constructor() {
    this.sessionData = null;
    this.currentIndex = 0;
    this.questions = [];
    this.evaluations = [];
    this.timerInterval = null;
    this.elapsedSeconds = 0;
    this.isEvaluating = false;

    // Sub-controllers
    this.tts = new TextToSpeechController({
      onStart: () => this.setAvatarSpeaking(true),
      onEnd: () => this.setAvatarSpeaking(false),
      onError: (msg) => App.showToast(msg, "info")
    });

    this.visualizer = new AudioWaveformVisualizer("audio-waveform-canvas");

    this.stt = new SpeechToTextController({
      onTranscriptUpdate: (finalText, interimText) => {
        const textarea = document.getElementById("answer-transcript-input");
        if (textarea) {
          // If we have final text, append to existing text
          if (finalText) {
            textarea.value = (textarea.value.trim() + " " + finalText.trim()).trim();
          }
          this.updateCharCount();
        }
      },
      onStateChange: (isRecording) => {
        const startBtn = document.getElementById("btn-start-mic");
        const stopBtn = document.getElementById("btn-stop-mic");
        const micDot = document.getElementById("mic-status-dot");
        const micLabel = document.getElementById("mic-status-text");

        if (isRecording) {
          if (startBtn) startBtn.style.display = "none";
          if (stopBtn) stopBtn.style.display = "inline-flex";
          if (micDot) micDot.classList.add("recording");
          if (micLabel) micLabel.textContent = "Listening... Speak naturally";
          this.visualizer.start();
        } else {
          if (startBtn) startBtn.style.display = "inline-flex";
          if (stopBtn) stopBtn.style.display = "none";
          if (micDot) micDot.classList.remove("recording");
          if (micLabel) micLabel.textContent = "Microphone Idle";
          this.visualizer.stop();
        }
      },
      onError: (msg, code) => {
        App.showToast(msg, "error");
        this.visualizer.stop();
      }
    });

    this.initEventListeners();
  }

  initEventListeners() {
    // Mic Start
    document.getElementById("btn-start-mic")?.addEventListener("click", () => {
      this.stt.start();
    });

    // Mic Stop
    document.getElementById("btn-stop-mic")?.addEventListener("click", () => {
      this.stt.stop();
    });

    // Transcript changes
    document.getElementById("answer-transcript-input")?.addEventListener("input", () => {
      this.updateCharCount();
    });

    // Submit Answer
    document.getElementById("btn-submit-answer")?.addEventListener("click", () => {
      this.submitCurrentAnswer();
    });

    // Next Question
    document.getElementById("btn-next-question")?.addEventListener("click", () => {
      this.goToNextQuestion();
    });

    // Practice This Answer (Retry)
    document.getElementById("btn-practice-again")?.addEventListener("click", () => {
      this.retryCurrentQuestion();
    });

    // End Interview
    document.getElementById("btn-end-interview")?.addEventListener("click", () => {
      if (confirm("Are you sure you want to conclude this mock interview session and view your evaluation report?")) {
        this.finishInterview();
      }
    });

    // TTS Buttons
    document.getElementById("btn-tts-play")?.addEventListener("click", () => {
      const q = this.getCurrentQuestion();
      if (q) this.tts.speak(q.question);
    });

    document.getElementById("btn-tts-pause")?.addEventListener("click", () => {
      this.tts.pause();
    });

    document.getElementById("btn-tts-resume")?.addEventListener("click", () => {
      this.tts.resume();
    });

    document.getElementById("btn-tts-stop")?.addEventListener("click", () => {
      this.tts.stop();
    });

    // TTS Speed pills
    document.querySelectorAll(".speed-pill").forEach(pill => {
      pill.addEventListener("click", (e) => {
        document.querySelectorAll(".speed-pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        const speed = parseFloat(pill.dataset.speed || "1.0");
        this.tts.setSpeed(speed);
      });
    });
  }

  startSession(sessionInitData) {
    this.sessionData = sessionInitData;
    this.questions = sessionInitData.questions || [];
    this.currentIndex = 0;
    this.evaluations = [];
    this.elapsedSeconds = 0;

    this.stt.setLanguage(sessionInitData.language || "English");

    // Populate top bar
    document.getElementById("top-bar-role").textContent = sessionInitData.role || "Software Engineer";
    document.getElementById("top-bar-type").textContent = `${sessionInitData.interview_type} Round`;

    this.startTimer();
    this.renderQuestion(0);

    // Auto-read question if user prefers
    const currentQ = this.getCurrentQuestion();
    if (currentQ) {
      setTimeout(() => {
        this.tts.speak(currentQ.question);
      }, 500);
    }
  }

  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    const timerElem = document.getElementById("interview-timer-display");
    this.timerInterval = setInterval(() => {
      this.elapsedSeconds++;
      const mins = String(Math.floor(this.elapsedSeconds / 60)).padStart(2, "0");
      const secs = String(this.elapsedSeconds % 60).padStart(2, "0");
      if (timerElem) timerElem.textContent = `${mins}:${secs}`;
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  getCurrentQuestion() {
    return this.questions[this.currentIndex] || null;
  }

  renderQuestion(index) {
    this.currentIndex = index;
    const q = this.getCurrentQuestion();
    if (!q) return;

    // Update Progress
    const total = this.questions.length;
    const pct = Math.round(((index + 1) / total) * 100);
    document.getElementById("interview-progress-fill").style.width = `${pct}%`;
    document.getElementById("question-number-display").textContent = `Question ${index + 1} of ${total}`;
    
    // Category & Difficulty
    const catElem = document.getElementById("question-category-display");
    catElem.textContent = `${q.category || 'Interview'} • ${q.difficulty || 'Medium'}`;

    // Question Text
    document.getElementById("question-text-display").textContent = q.question;

    // Clear transcript & reset evaluation card
    const transcriptInput = document.getElementById("answer-transcript-input");
    if (transcriptInput) transcriptInput.value = "";
    this.updateCharCount();

    // Hide evaluation panel
    const evalCard = document.getElementById("answer-evaluation-panel");
    if (evalCard) evalCard.style.display = "none";

    // Re-enable answer submission
    document.getElementById("btn-submit-answer").disabled = false;
    document.getElementById("btn-submit-answer").style.display = "inline-flex";
    document.getElementById("btn-next-question").style.display = "none";
    document.getElementById("btn-practice-again").style.display = "none";
    document.getElementById("follow-up-pill").style.display = "none";
  }

  updateCharCount() {
    const val = document.getElementById("answer-transcript-input")?.value || "";
    const words = val.trim() ? val.trim().split(/\s+/).length : 0;
    const countDisplay = document.getElementById("transcript-word-count");
    if (countDisplay) {
      countDisplay.textContent = `${words} words • ${val.length} characters`;
    }
  }

  setAvatarSpeaking(isSpeaking) {
    const avatar = document.getElementById("ai-avatar-circle");
    const statusDot = document.getElementById("avatar-status-dot");
    const statusText = document.getElementById("avatar-status-text");

    if (avatar) {
      if (isSpeaking) {
        avatar.classList.add("speaking");
        if (statusDot) statusDot.classList.add("active");
        if (statusText) statusText.textContent = "Speaking question...";
      } else {
        avatar.classList.remove("speaking");
        if (statusDot) statusDot.classList.remove("active");
        if (statusText) statusText.textContent = "Listening to candidate";
      }
    }
  }

  async submitCurrentAnswer() {
    const q = this.getCurrentQuestion();
    const transcriptInput = document.getElementById("answer-transcript-input");
    const answer = transcriptInput ? transcriptInput.value.trim() : "";

    if (!answer) {
      App.showToast("Please provide or speak an answer before submitting.", "error");
      return;
    }

    // Stop mic and visualizer if running
    this.stt.stop();
    this.tts.stop();

    const submitBtn = document.getElementById("btn-submit-answer");
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Evaluating Answer...</span>`;

    try {
      const payload = {
        session_id: this.sessionData.session_id,
        question_index: this.currentIndex + 1,
        question: q,
        user_answer: answer,
        role: this.sessionData.role,
        experience: this.sessionData.experience,
        language: this.sessionData.language
      };

      const res = await fetch("/api/sessions/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Evaluation request failed");
      const evaluation = await res.json();
      
      // Store evaluation
      this.evaluations[this.currentIndex] = evaluation;
      this.displayEvaluation(evaluation);

      submitBtn.style.display = "none";
      document.getElementById("btn-next-question").style.display = "inline-flex";
      document.getElementById("btn-practice-again").style.display = "inline-flex";

    } catch (err) {
      console.error(err);
      App.showToast("Evaluation failed: " + err.message, "error");
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>Submit Answer</span>`;
    }
  }

  displayEvaluation(evaluation) {
    const evalCard = document.getElementById("answer-evaluation-panel");
    if (!evalCard) return;

    evalCard.style.display = "block";

    // Score Circle
    const scoreBadge = document.getElementById("eval-score-badge");
    scoreBadge.textContent = `${evaluation.score}/10`;
    if (evaluation.score >= 8) {
      scoreBadge.style.background = "linear-gradient(135deg, #10b981, #059669)";
    } else if (evaluation.score >= 6) {
      scoreBadge.style.background = "linear-gradient(135deg, #f59e0b, #d97706)";
    } else {
      scoreBadge.style.background = "linear-gradient(135deg, #ef4444, #dc2626)";
    }

    // Metrics
    document.getElementById("eval-accuracy").textContent = evaluation.accuracy || "High";
    document.getElementById("eval-relevance").textContent = evaluation.relevance || "High";
    document.getElementById("eval-clarity").textContent = evaluation.clarity || "Good";
    document.getElementById("eval-confidence").textContent = evaluation.confidence || "Solid";

    // Missing Points
    const missingUl = document.getElementById("eval-missing-points-list");
    missingUl.innerHTML = "";
    (evaluation.missing_points || []).forEach(pt => {
      const li = document.createElement("li");
      li.textContent = pt;
      missingUl.appendChild(li);
    });

    // Suggested Improvement
    document.getElementById("eval-improvement-text").textContent = evaluation.suggested_improvement || "Keep answers structured and concise.";

    // Better Sample Answer
    document.getElementById("eval-sample-answer-text").textContent = evaluation.better_sample_answer || "";

    // AI Coach Suggestions
    const coachUl = document.getElementById("coach-suggestions-list");
    coachUl.innerHTML = "";
    (evaluation.coach_tips || []).forEach(tip => {
      const li = document.createElement("li");
      li.textContent = tip;
      coachUl.appendChild(li);
    });

    // Follow-up question badge
    const followUpPill = document.getElementById("follow-up-pill");
    if (evaluation.follow_up_question) {
      followUpPill.style.display = "inline-flex";
      followUpPill.textContent = "⚡ Follow-up incoming";
      // Inject follow up after current question if not already injected
      if (!this.questions[this.currentIndex].hasFollowUp) {
        this.questions.splice(this.currentIndex + 1, 0, {
          id: `fu-${this.currentIndex}`,
          category: "Follow-Up",
          question: evaluation.follow_up_question,
          difficulty: "Deep Dive",
          hasFollowUp: true
        });
      }
    } else {
      followUpPill.style.display = "none";
    }

    evalCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  retryCurrentQuestion() {
    // Practice This Answer again
    const transcriptInput = document.getElementById("answer-transcript-input");
    if (transcriptInput) {
      transcriptInput.value = "";
      transcriptInput.focus();
    }
    this.updateCharCount();

    const evalCard = document.getElementById("answer-evaluation-panel");
    if (evalCard) evalCard.style.display = "none";

    const submitBtn = document.getElementById("btn-submit-answer");
    submitBtn.disabled = false;
    submitBtn.style.display = "inline-flex";
    submitBtn.innerHTML = `<span>Submit Revised Answer</span>`;

    document.getElementById("btn-next-question").style.display = "none";
    document.getElementById("btn-practice-again").style.display = "none";
    App.showToast("Refine your response and speak or type again!", "info");
  }

  goToNextQuestion() {
    this.tts.stop();
    if (this.currentIndex + 1 < this.questions.length) {
      this.renderQuestion(this.currentIndex + 1);
      const nextQ = this.getCurrentQuestion();
      if (nextQ) {
        setTimeout(() => this.tts.speak(nextQ.question), 300);
      }
    } else {
      this.finishInterview();
    }
  }

  async finishInterview() {
    this.stopTimer();
    this.stt.stop();
    this.tts.stop();
    this.visualizer.stop();

    App.showToast("Analyzing overall performance and generating your report...", "info");

    try {
      const payload = {
        session_id: this.sessionData.session_id,
        role: this.sessionData.role,
        company: this.sessionData.company || "",
        interview_type: this.sessionData.interview_type,
        language: this.sessionData.language || "English",
        started_at: new Date().toISOString(),
        duration_seconds: this.elapsedSeconds,
        questions: this.questions,
        evaluations: this.evaluations
      };

      const res = await fetch("/api/sessions/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Could not complete interview session");
      const result = await res.json();

      App.renderInterviewResults(result.report, payload);
    } catch (err) {
      console.error(err);
      App.showToast("Failed to generate final report: " + err.message, "error");
    }
  }
}

window.InterviewSessionManager = InterviewSessionManager;
