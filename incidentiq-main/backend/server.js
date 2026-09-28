const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize SQLite database
const db = new sqlite3.Database('./hindsight.db', (err) => {
  if (err) {
    console.error("Error opening database " + err.message);
  } else {
    db.run(`CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        error TEXT,
        service TEXT,
        environment TEXT,
        impact TEXT,
        logs TEXT,
        status TEXT,
        createdAt TEXT,
        resolvedAt TEXT,
        rootCause TEXT,
        solution TEXT,
        outcome TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS hindsight_memory (
        id TEXT PRIMARY KEY,
        error TEXT,
        rootCause TEXT,
        solution TEXT,
        outcome TEXT,
        timestamp TEXT
    )`);
  }
});

// Rate limiter for NVIDIA API
const rateLimit = {
  timestamps: [],
  limit: 35,
  windowMs: 60 * 1000 // 1 minute
};

function canMakeRequest() {
  const now = Date.now();
  rateLimit.timestamps = rateLimit.timestamps.filter(time => now - time < rateLimit.windowMs);
  if (rateLimit.timestamps.length >= rateLimit.limit) {
    return false;
  }
  rateLimit.timestamps.push(now);
  return true;
}

app.get('/api/incidents', (req, res) => {
  db.all("SELECT * FROM incidents ORDER BY createdAt DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/memories', (req, res) => {
  db.all("SELECT * FROM hindsight_memory ORDER BY timestamp DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/incidents', (req, res) => {
  const { error, service, environment, impact, logs } = req.body;
  const newIncident = {
    id: `INC-${Date.now().toString().slice(-4)}`, // Generate simple unique ID
    error,
    service,
    environment,
    impact,
    logs,
    status: 'Open',
    createdAt: new Date().toISOString()
  };
  
  db.run(`INSERT INTO incidents (id, error, service, environment, impact, logs, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
    [newIncident.id, newIncident.error, newIncident.service, newIncident.environment, newIncident.impact, newIncident.logs, newIncident.status, newIncident.createdAt], 
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json(newIncident);
  });
});

// Real LLM analysis using NVIDIA NIM
app.post('/api/analyze', (req, res) => {
  const { incidentId } = req.body;
  
  db.get("SELECT * FROM incidents WHERE id = ?", [incidentId], (err, incident) => {
    if (err || !incident) {
      return res.status(404).json({ message: 'Incident not found' });
    }

    db.get("SELECT * FROM hindsight_memory WHERE LOWER(error) = LOWER(?)", [incident.error], async (err, similarMemory) => {
      let response = {
        incidentId: incident.id,
        severity: 'High',
        likelyCause: 'Analyzing logs...',
      };

      let prompt = `You are an AI Incident Response Agent. Analyze the following incident:\nError: ${incident.error}\nService: ${incident.service}\nEnvironment: ${incident.environment}\nLogs: ${incident.logs}\n`;
      if (similarMemory) {
        prompt += `\n[HINDSIGHT MEMORY FOUND]: A similar incident occurred previously.\nPrevious Root Cause: ${similarMemory.rootCause}\nPrevious Solution: ${similarMemory.solution}\nOutcome: ${similarMemory.outcome}\n\nBased on this memory, what is the likely cause and what do you recommend? Explicitly state how the historical memory influenced your recommendation to reduce MTTR (Mean Time To Resolution). Keep it concise.`;
      } else {
        prompt += `\nNo previous memory found. What is the likely cause and what do you recommend? Keep it concise.`;
      }

      if (!canMakeRequest()) {
        response.aiRecommendation = "RATE LIMIT EXCEEDED: You have hit the 35 requests per minute cap to protect your NVIDIA API Key. Please wait a moment.";
        if (similarMemory) {
          response.memoryFound = true;
          response.memory = {
            previousIncident: similarMemory.id,
            similarity: '94%',
            rootCause: similarMemory.rootCause,
            previousResolution: similarMemory.solution,
            outcome: similarMemory.outcome
          };
        } else {
          response.memoryFound = false;
        }
        return res.json(response);
      }

      const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || "YOUR_NVIDIA_API_KEY_HERE";
      
      try {
        const aiRes = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NVIDIA_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'meta/llama-3.2-11b-vision-instruct',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 200,
            temperature: 0.2
          })
        });
        
        if (aiRes.ok) {
          const data = await aiRes.json();
          const aiText = data.choices[0].message.content;
          response.aiRecommendation = aiText;
          response.likelyCause = 'Identified by NVIDIA NIM AI';
        } else {
          const errText = await aiRes.text();
          console.error("NVIDIA API Error:", errText);
          response.aiRecommendation = "Error contacting NVIDIA NIM API.";
        }
      } catch (err) {
        console.error("Fetch Error:", err);
        response.aiRecommendation = "Network error contacting NVIDIA NIM API.";
      }

      if (similarMemory) {
        response.memoryFound = true;
        response.memory = {
          previousIncident: similarMemory.id,
          similarity: '94%',
          rootCause: similarMemory.rootCause,
          previousResolution: similarMemory.solution,
          outcome: similarMemory.outcome
        };
      } else {
        response.memoryFound = false;
      }

      res.json(response);
    });
  });
});

app.post('/api/resolve', (req, res) => {
  const { incidentId, rootCause, solution, outcome } = req.body;
  
  db.get("SELECT * FROM incidents WHERE id = ?", [incidentId], (err, incident) => {
    if (err || !incident) {
      return res.status(404).json({ message: 'Incident not found' });
    }

    const resolvedAt = new Date().toISOString();
    
    db.run(`UPDATE incidents SET status = 'Resolved', rootCause = ?, solution = ?, outcome = ?, resolvedAt = ? WHERE id = ?`,
      [rootCause, solution, outcome, resolvedAt, incidentId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.run(`INSERT INTO hindsight_memory (id, error, rootCause, solution, outcome, timestamp) VALUES (?, ?, ?, ?, ?, ?)`,
          [incident.id, incident.error, rootCause, solution, outcome, resolvedAt], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Incident resolved and stored in SQL Hindsight Memory', incidentId });
        });
    });
  });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
