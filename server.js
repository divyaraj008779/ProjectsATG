/**
 * AI Project Interviewer - Express.js Node Server
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());
app.use('/static', express.static(path.join(__dirname, 'static')));

// Demo repos
const DEMO_REPOS = {
  "mern-ecommerce": {
    name: "mern-ecommerce-platform",
    url: "https://github.com/dev-showcase/mern-ecommerce-platform",
    tech_stack: {
      frontend: "React 18, Redux Toolkit, TailwindCSS",
      backend: "Node.js, Express.js",
      database: "MongoDB (Mongoose)",
      authentication: "JWT, HTTP-only Cookies",
      apis: "RESTful JSON API, Stripe API"
    }
  }
};

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', app: 'AI Project Interviewer', runtime: 'Node.js' });
});

app.post('/api/analyze-repository', async (req, res) => {
  const { repo_url } = req.body;
  if (!repo_url) return res.status(400).json({ error: 'GitHub repository URL is required.' });
  // In Node environment, can proxy or use GitHub API
  res.json(DEMO_REPOS["mern-ecommerce"]);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`>> Node AI Project Interviewer running on http://localhost:${PORT}`);
});
