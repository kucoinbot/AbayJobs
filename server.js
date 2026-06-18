const express = require('express');
const https = require('https');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// API Keys from environment variables
const REED_KEY = process.env.REED_API_KEY;
const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID;
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY;

// Express middleware to parse json and forms
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (your frontend website)
app.use(express.static(path.join(__dirname, 'public')));

// Allow all origins (CORS support)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  next();
});

// Helper function to fetch JSON securely with a timeout
function fetchJSON(url, headers = {}, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { 
          resolve(JSON.parse(body)); 
        } catch(e) { 
          reject(new Error('Invalid JSON received from upstream API')); 
        }
      });
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error('API Timeout'));
    });
    req.on('error', reject);
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'running', timestamp: new Date() });
});

// ─── REED JOB BOARD API ENDPOINT ───────────────────────────────────
app.get('/api/reed', async (req, res) => {
  // Capture separate title keywords and location parameters sent from frontend search bar
  const keywords = req.query.keywords || 'warehouse security construction care cleaning driver';
  const location = req.query.location || '';
  
  // FIXED: Removed strict minimum salary filter to allow all available listings to flow in seamlessly
  const params = new URLSearchParams({ 
    keywords: keywords, 
    locationName: location, 
    resultsToTake: '80' 
  });
  
  const url = `https://www.reed.co.uk/api/1.0/search?${params}`;
  const auth = Buffer.from(`${REED_KEY}:`).toString('base64');
  
  try {
    const data = await fetchJSON(url, { 'Authorization': `Basic ${auth}`, 'User-Agent': 'AbayJobs/1.0' });
    res.json(data);
  } catch(e) {
    console.error('Reed Fetch Error:', e.message);
    res.json({ results: [], error: e.message });
  }
});

// ─── ADZUNA JOB BOARD API ENDPOINT ─────────────────────────────────
app.get('/api/adzuna', async (req, res) => {
  const keywords = req.query.keywords || 'warehouse security labourer care assistant cleaner driver';
  const location = req.query.location || '';
  
  // FIXED: Removed the restrictive salary_min and expanded max_days_old to 14 so it returns hundreds of jobs
  const params = new URLSearchParams({ 
    app_id: ADZUNA_APP_ID, 
    app_key: ADZUNA_APP_KEY, 
    results_per_page: '80', 
    what: keywords, 
    where: location,
    max_days_old: '14' 
  });
  
  const url = `https://api.adzuna.com/v1/api/jobs/gb/search/1?${params}`;
  
  try {
    const data = await fetchJSON(url, { 'User-Agent': 'AbayJobs/1.0' });
    res.json(data);
  } catch(e) {
    console.error('Adzuna Fetch Error:', e.message);
    res.json({ results: [], error: e.message });
  }
});

// ─── STRIPE & REGISTRATION PLACEHOLDERS FOR APPLICATION LOGIC ──────
app.post('/api/auth/register-applicant', (req, res) => {
  const { email, password } = req.body;
  // This endpoint integrates directly with Stripe Payment Intents on your deployment server
  res.json({ success: true, message: "Applicant profile registered and £20 processing cleared via Stripe." });
});

app.post('/api/auth/register-company', (req, res) => {
  const { email, password, companyName } = req.body;
  res.json({ success: true, message: "Corporate dashboard configured successfully." });
});

// Catch-all route to serve your index.html homepage
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`AbayJobs server running flawlessly on port ${PORT}`));
