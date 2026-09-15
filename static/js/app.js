/**
 * Main Application Orchestrator
 */

const App = {
  currentView: "view-dashboard",
  interviewManager: null,

  init() {
    this.initTheme();
    this.initNavigation();
    this.initDashboard();
    this.initSetupForm();
    this.initStudyMaterial();
    this.initResumeProfile();
    this.initHistory();
    this.initSettings();
    this.initPracticeDrills();

    this.interviewManager = new InterviewSessionManager();
    this.checkHealth();
  },

  /* ================= Theme & Navigation ================= */
  initTheme() {
    const savedTheme = localStorage.getItem("theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
    this.updateThemeToggleIcon(savedTheme);

    document.querySelectorAll(".theme-toggle-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const current = document.documentElement.getAttribute("data-theme") || "dark";
        const newTheme = current === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("theme", newTheme);
        this.updateThemeToggleIcon(newTheme);
      });
    });
  },

  updateThemeToggleIcon(theme) {
    const textElem = document.getElementById("theme-btn-text");
    if (textElem) {
      textElem.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";
    }
  },

  initNavigation() {
    document.querySelectorAll(".nav-item").forEach(item => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        const targetView = item.getAttribute("data-view");
        if (targetView) {
          this.switchView(targetView);
        }
      });
    });
  },

  switchView(viewId) {
    document.querySelectorAll(".view-section").forEach(sec => {
      sec.classList.remove("active");
    });
    const target = document.getElementById(viewId);
    if (target) {
      target.classList.add("active");
      this.currentView = viewId;
    }

    document.querySelectorAll(".nav-item").forEach(item => {
      if (item.getAttribute("data-view") === viewId) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });

    // Auto-refresh views if needed
    if (viewId === "view-dashboard") this.loadDashboardStats();
    if (viewId === "view-history") this.loadHistory();
    if (viewId === "view-study-material") this.loadDocuments();
    if (viewId === "view-resume") this.loadResumeProfile();

    window.scrollTo({ top: 0, behavior: "smooth" });
  },

  /* ================= Toast Notification System ================= */
  showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    let icon = type === "success" ? "✓" : type === "error" ? "⚠" : "ℹ";
    toast.innerHTML = `<span>${icon}</span> <div>${message}</div>`;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  },

  /* ================= Health Check ================= */
  async checkHealth() {
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const data = await res.json();
        const badge = document.getElementById("ai-provider-badge");
        if (badge) {
          badge.textContent = `AI Engine: ${data.ai_provider.toUpperCase()}`;
        }
      }
    } catch (e) {
      console.warn("Health check error:", e);
    }
  },

  /* ================= Dashboard ================= */
  initDashboard() {
    document.getElementById("btn-quick-start-mock")?.addEventListener("click", () => {
      this.switchView("view-setup");
    });

    document.querySelectorAll(".quick-mode-trigger").forEach(card => {
      card.addEventListener("click", () => {
        const mode = card.dataset.mode;
        const type = card.dataset.type || "General";
        this.presetSetupAndOpen(mode, type);
      });
    });

    this.loadDashboardStats();
  },

  async loadDashboardStats() {
    try {
      const res = await fetch("/api/history");
      if (!res.ok) return;
      const history = await res.json();

      const totalSessions = history.length;
      document.getElementById("stat-total-sessions").textContent = totalSessions;

      if (totalSessions > 0) {
        const avgScore = Math.round(history.reduce((acc, h) => acc + (h.overall_score || 0), 0) / totalSessions);
        document.getElementById("stat-avg-score").textContent = `${avgScore}/100`;

        const totalQ = history.reduce((acc, h) => acc + (h.question_count || 0), 0);
        document.getElementById("stat-total-questions").textContent = totalQ;

        // Render recent session card in dashboard
        const latest = history[0];
        const recentElem = document.getElementById("dashboard-recent-session");
        if (recentElem) {
          recentElem.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong>${latest.role}</strong> • ${latest.interview_type}
                <div style="font-size:0.85rem; color:var(--text-secondary); margin-top:2px;">${latest.date}</div>
              </div>
              <div style="font-size:1.4rem; font-weight:800; color:var(--accent-secondary);">${latest.overall_score}%</div>
            </div>
          `;
        }
      }
    } catch (e) {
      console.error(e);
    }
  },

  presetSetupAndOpen(mode, type) {
    this.switchView("view-setup");
    const modeInput = document.querySelector(`input[name="setup-mode"][value="${mode}"]`);
    if (modeInput) modeInput.checked = true;
    const typeInput = document.querySelector(`input[name="setup-type"][value="${type}"]`);
    if (typeInput) typeInput.checked = true;
  },

  /* ================= Interview Setup ================= */
  initSetupForm() {
    const form = document.getElementById("interview-setup-form");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const role = document.getElementById("setup-role").value.trim();
      const company = document.getElementById("setup-company").value.trim();
      const experience = document.getElementById("setup-experience").value;
      const interviewType = document.querySelector('input[name="setup-type"]:checked')?.value || "General";
      const language = document.querySelector('input[name="setup-language"]:checked')?.value || "English";
      const mode = document.querySelector('input[name="setup-mode"]:checked')?.value || "quick";
      const customCount = parseInt(document.getElementById("setup-custom-count")?.value || "10", 10);
      const includeResume = document.getElementById("setup-include-resume").checked;
      const includeDocs = document.getElementById("setup-include-docs").checked;

      if (!role) {
        App.showToast("Please enter a Target Job Role", "error");
        return;
      }

      const submitBtn = document.getElementById("btn-start-interview-session");
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Configuring AI Interviewer & Questions...</span>`;

      try {
        const payload = {
          role,
          company,
          experience,
          interview_type: interviewType,
          language,
          mode,
          custom_count: customCount,
          include_resume: includeResume,
          include_docs: includeDocs
        };

        const res = await fetch("/api/sessions/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Failed to initialize session");
        const sessionData = await res.json();

        // Switch to Live Interview View
        App.switchView("view-interview");
        App.interviewManager.startSession(sessionData);

      } catch (err) {
        App.showToast("Error starting interview: " + err.message, "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Start Mock Interview</span>`;
      }
    });

    // Custom question count toggle
    document.querySelectorAll('input[name="setup-mode"]').forEach(radio => {
      radio.addEventListener("change", (e) => {
        const customWrapper = document.getElementById("custom-count-wrapper");
        if (customWrapper) {
          customWrapper.style.display = e.target.value === "custom" ? "block" : "none";
        }
      });
    });
  },

  /* ================= Study Material ================= */
  initStudyMaterial() {
    const dropzone = document.getElementById("study-dropzone");
    const fileInput = document.getElementById("study-file-input");

    if (dropzone && fileInput) {
      dropzone.addEventListener("click", () => fileInput.click());

      dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.style.borderColor = "var(--accent-primary)";
      });

      dropzone.addEventListener("dragleave", () => {
        dropzone.style.borderColor = "var(--border-accent)";
      });

      dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.style.borderColor = "var(--border-accent)";
        if (e.dataTransfer.files.length) {
          this.uploadStudyFile(e.dataTransfer.files[0]);
        }
      });

      fileInput.addEventListener("change", (e) => {
        if (e.target.files.length) {
          this.uploadStudyFile(e.target.files[0]);
        }
      });
    }

    this.loadDocuments();
  },

  async uploadStudyFile(file) {
    const statusText = document.getElementById("upload-status-indicator");
    if (statusText) statusText.textContent = `Uploading & parsing ${file.name}...`;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Upload failed");
      }

      const doc = await res.json();
      App.showToast(`Indexed ${doc.filename} (${doc.chunk_count} chunks)`, "success");
      this.loadDocuments();
    } catch (err) {
      App.showToast(err.message, "error");
    } finally {
      if (statusText) statusText.textContent = "";
      const fileInput = document.getElementById("study-file-input");
      if (fileInput) fileInput.value = "";
    }
  },

  async loadDocuments() {
    try {
      const res = await fetch("/api/documents");
      if (!res.ok) return;
      const docs = await res.json();
      const listContainer = document.getElementById("documents-list-container");
      if (!listContainer) return;

      if (docs.length === 0) {
        listContainer.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-secondary);">No study material uploaded yet. Upload PDFs, TXT, or DOCX documents to give your AI coach company or topic knowledge.</div>`;
        return;
      }

      listContainer.innerHTML = "";
      docs.forEach(doc => {
        const item = document.createElement("div");
        item.className = "doc-item-row";
        const icon = doc.extension === ".pdf" ? "📄" : doc.extension === ".docx" ? "📝" : "📋";
        item.innerHTML = `
          <div class="doc-info">
            <span class="doc-icon">${icon}</span>
            <div>
              <strong>${doc.filename}</strong>
              <div style="font-size:0.8rem; color:var(--text-secondary);">
                ${(doc.file_size / 1024).toFixed(1)} KB • ${doc.chunk_count} Knowledge Chunks
              </div>
            </div>
          </div>
          <button class="btn btn-sm btn-danger" onclick="App.deleteDocument('${doc.id}')">Remove</button>
        `;
        listContainer.appendChild(item);
      });
    } catch (e) {
      console.error(e);
    }
  },

  async deleteDocument(docId) {
    if (!confirm("Remove this document from study material?")) return;
    try {
      const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
      if (res.ok) {
        App.showToast("Document deleted", "info");
        this.loadDocuments();
      }
    } catch (e) {
      App.showToast("Delete failed", "error");
    }
  },

  /* ================= Resume & Projects ================= */
  initResumeProfile() {
    document.getElementById("btn-add-project")?.addEventListener("click", () => {
      this.addProjectCard();
    });

    document.getElementById("resume-profile-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      this.saveResumeProfile();
    });

    this.loadResumeProfile();
  },

  async loadResumeProfile() {
    try {
      const res = await fetch("/api/profile");
      if (!res.ok) return;
      const profile = await res.json();

      document.getElementById("resume-name").value = profile.name || "";
      document.getElementById("resume-education").value = profile.education || "";
      document.getElementById("resume-skills").value = profile.skills || "";
      document.getElementById("resume-experience").value = profile.experience || "";
      document.getElementById("resume-certifications").value = profile.certifications || "";

      const projectsContainer = document.getElementById("projects-list-container");
      projectsContainer.innerHTML = "";
      if (profile.projects && profile.projects.length) {
        profile.projects.forEach(p => this.addProjectCard(p.name, p.tech, p.description));
      } else {
        this.addProjectCard("Bank Management System in Python", "Python, SQLite, Tkinter", "Engineered transactional banking prototype.");
      }
    } catch (e) {
      console.error(e);
    }
  },

  addProjectCard(name = "", tech = "", desc = "") {
    const container = document.getElementById("projects-list-container");
    const card = document.createElement("div");
    card.className = "project-card-item";
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
        <strong style="font-size:0.95rem;">Project Details</strong>
        <button type="button" class="btn btn-sm btn-danger" onclick="this.closest('.project-card-item').remove()">Remove</button>
      </div>
      <div class="form-group" style="margin-bottom:8px;">
        <input type="text" class="proj-name-input" placeholder="Project Name (e.g. Bank Management System in Python)" value="${name}">
      </div>
      <div class="form-group" style="margin-bottom:8px;">
        <input type="text" class="proj-tech-input" placeholder="Technologies (e.g. Python, SQLite, Tkinter)" value="${tech}">
      </div>
      <div class="form-group" style="margin-bottom:0;">
        <textarea class="proj-desc-input" rows="2" placeholder="Key implementation details and achievements...">${desc}</textarea>
      </div>
    `;
    container.appendChild(card);
  },

  async saveResumeProfile() {
    const projects = [];
    document.querySelectorAll(".project-card-item").forEach(card => {
      const name = card.querySelector(".proj-name-input")?.value.trim();
      const tech = card.querySelector(".proj-tech-input")?.value.trim();
      const desc = card.querySelector(".proj-desc-input")?.value.trim();
      if (name) projects.push({ name, tech, description: desc });
    });

    const payload = {
      name: document.getElementById("resume-name").value.trim(),
      education: document.getElementById("resume-education").value.trim(),
      skills: document.getElementById("resume-skills").value.trim(),
      projects: projects,
      certifications: document.getElementById("resume-certifications").value.trim(),
      experience: document.getElementById("resume-experience").value.trim()
    };

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        App.showToast("Resume & project profile saved! AI will now personalize questions around your projects.", "success");
      }
    } catch (e) {
      App.showToast("Failed to save profile", "error");
    }
  },

  /* ================= Practice Drills ================= */
  initPracticeDrills() {
    document.querySelectorAll(".drill-start-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const drillRole = btn.dataset.drillRole || "Software Engineer";
        const drillType = btn.dataset.drillType || "Technical";

        // Setup session for drill
        document.getElementById("setup-role").value = drillRole;
        const typeInput = document.querySelector(`input[name="setup-type"][value="${drillType}"]`);
        if (typeInput) typeInput.checked = true;
        const modeInput = document.querySelector('input[name="setup-mode"][value="quick"]');
        if (modeInput) modeInput.checked = true;

        App.switchView("view-setup");
      });
    });
  },

  /* ================= History ================= */
  initHistory() {
    this.loadHistory();
  },

  async loadHistory() {
    try {
      const res = await fetch("/api/history");
      if (!res.ok) return;
      const history = await res.json();

      const tbody = document.getElementById("history-table-body");
      if (!tbody) return;

      if (history.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-secondary);">No mock interview sessions recorded yet. Complete a session to see your progress here.</td></tr>`;
        return;
      }

      tbody.innerHTML = "";
      history.forEach(session => {
        const tr = document.createElement("tr");
        const mins = Math.floor((session.duration_seconds || 0) / 60);
        const secs = (session.duration_seconds || 0) % 60;
        const timeStr = `${mins}m ${secs}s`;

        tr.innerHTML = `
          <td>${session.date}</td>
          <td><strong>${session.role}</strong> ${session.company ? `(${session.company})` : ''}</td>
          <td><span class="type-pill">${session.interview_type}</span></td>
          <td>
            <strong style="color:${session.overall_score >= 70 ? 'var(--success)' : 'var(--warning)'};">
              ${session.overall_score}/100
            </strong>
          </td>
          <td>${session.question_count} Qs (${timeStr})</td>
          <td>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-sm btn-secondary" onclick="App.viewSessionDetails('${session.id}')">View</button>
              <button class="btn btn-sm btn-primary" onclick="App.retrySession('${session.id}')">Retry</button>
              <button class="btn btn-sm btn-danger" onclick="App.deleteSession('${session.id}')">Delete</button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    } catch (e) {
      console.error(e);
    }
  },

  async viewSessionDetails(sessionId) {
    try {
      const res = await fetch(`/api/history/${sessionId}`);
      if (!res.ok) throw new Error("Could not retrieve session details");
      const data = await res.json();

      this.renderInterviewResults(data.details.report, data.details);
      this.switchView("view-result");
    } catch (e) {
      App.showToast("Failed to load details: " + e.message, "error");
    }
  },

  async retrySession(sessionId) {
    try {
      const res = await fetch(`/api/history/${sessionId}`);
      if (!res.ok) return;
      const data = await res.json();
      
      document.getElementById("setup-role").value = data.role;
      if (data.company) document.getElementById("setup-company").value = data.company;
      const typeInput = document.querySelector(`input[name="setup-type"][value="${data.interview_type}"]`);
      if (typeInput) typeInput.checked = true;

      this.switchView("view-setup");
      App.showToast(`Loaded settings for ${data.role}. Click Start to retry!`, "info");
    } catch (e) {
      console.error(e);
    }
  },

  async deleteSession(sessionId) {
    if (!confirm("Are you sure you want to delete this recorded session?")) return;
    try {
      const res = await fetch(`/api/history/${sessionId}`, { method: "DELETE" });
      if (res.ok) {
        App.showToast("Session deleted", "info");
        this.loadHistory();
      }
    } catch (e) {
      App.showToast("Failed to delete", "error");
    }
  },

  /* ================= Settings ================= */
  initSettings() {
    document.getElementById("btn-clear-all-history")?.addEventListener("click", async () => {
      if (confirm("Clear all recorded interview history?")) {
        // Clear history
        try {
          const res = await fetch("/api/history");
          const items = await res.json();
          for (let item of items) {
            await fetch(`/api/history/${item.id}`, { method: "DELETE" });
          }
          App.showToast("All interview history cleared", "info");
          this.loadHistory();
        } catch (e) {}
      }
    });
  },

  /* ================= Render Final Result Screen ================= */
  renderInterviewResults(report, sessionInfo) {
    this.switchView("view-result");

    // Overall Score
    const radialScore = document.getElementById("final-score-value");
    if (radialScore) radialScore.textContent = report.overall_score;

    // Dimension Bars
    const dimContainer = document.getElementById("dimensions-bars-container");
    if (dimContainer) {
      dimContainer.innerHTML = "";
      for (const [dim, val] of Object.entries(report.dimensions || {})) {
        const card = document.createElement("div");
        card.className = "dimension-bar-card";
        card.innerHTML = `
          <div class="dim-header">
            <span>${dim}</span>
            <span>${val}%</span>
          </div>
          <div class="dim-track">
            <div class="dim-fill" style="width: ${val}%;"></div>
          </div>
        `;
        dimContainer.appendChild(card);
      }
    }

    // Strong Areas
    const strongCloud = document.getElementById("strong-areas-cloud");
    if (strongCloud) {
      strongCloud.innerHTML = "";
      (report.strong_areas || []).forEach(area => {
        const pill = document.createElement("span");
        pill.className = "area-pill strong-pill";
        pill.textContent = `✓ ${area}`;
        strongCloud.appendChild(pill);
      });
    }

    // Weak Areas
    const weakCloud = document.getElementById("weak-areas-cloud");
    if (weakCloud) {
      weakCloud.innerHTML = "";
      (report.weak_areas || []).forEach(area => {
        const pill = document.createElement("span");
        pill.className = "area-pill weak-pill";
        pill.textContent = `⚠ ${area}`;
        weakCloud.appendChild(pill);
      });
    }

    // Questions Needing Practice
    const practiceList = document.getElementById("questions-needing-practice-list");
    if (practiceList) {
      practiceList.innerHTML = "";
      const questionsToReview = report.questions_needing_practice || [];
      if (questionsToReview.length === 0) {
        practiceList.innerHTML = `<div style="color:var(--success); font-size:0.95rem;">🎉 Outstanding work! All answers scored above the improvement threshold.</div>`;
      } else {
        questionsToReview.forEach(q => {
          const item = document.createElement("div");
          item.className = "glass-card";
          item.style.marginBottom = "14px";
          item.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
              <strong>Question ${q.question_number}: ${q.question}</strong>
              <span class="type-pill" style="color:var(--warning);">Score: ${q.user_score}/10</span>
            </div>
            <p style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:8px;"><strong>Coach Advice:</strong> ${q.key_advice}</p>
            <div style="background:var(--bg-surface); padding:10px; border-radius:var(--radius-sm); font-size:0.88rem;">
              <span style="color:var(--accent-secondary); font-weight:600;">Model Answer:</span> ${q.sample_answer}
            </div>
          `;
          practiceList.appendChild(item);
        });
      }
    }

    // Recommended Topics
    const topicsUl = document.getElementById("recommended-topics-list");
    if (topicsUl) {
      topicsUl.innerHTML = "";
      (report.recommended_topics || []).forEach(topic => {
        const li = document.createElement("li");
        li.textContent = topic;
        topicsUl.appendChild(li);
      });
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  App.init();
});
