const express = require('express');
const https = require('https');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Grab your keys from environment variables
const REED_KEY = process.env.REED_API_KEY;
const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID;
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY;

// Serve static files first
app.use(express.static(path.join(__dirname, 'public')));

// Global CORS handling for all endpoints
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Fetch with a robust timeout mechanism
function fetchJSON(url, headers = {}, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { 
          resolve(JSON.parse(body)); 
        } catch(e) { 
          reject(new Error(`Invalid JSON received from upstream API. Status: ${res.statusCode}`)); 
        }
      });
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error('API request timed out'));
    });
    req.on('error', reject);
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'running', environment: { reed: !!REED_KEY, adzuna: !!ADZUNA_APP_ID } });
});

// Reed API Route
app.get('/api/reed', async (req, res) => {
  const keywords = req.query.keywords || 'warehouse'; // Fallback to a single broad term
  const location = req.query.location || 'UK';
  
  const params = new URLSearchParams({ 
    keywords, 
    locationName: location, 
    resultsToTake: '40' 
  });
  
  const url = `https://www.reed.co.uk/api/1.0/search?${params}`;
  const auth = Buffer.from(`${REED_KEY}:`).toString('base64');
  
  try {
    if (!REED_KEY) throw new Error("REED_API_KEY is missing in server environment");
    const data = await fetchJSON(url, { 'Authorization': `Basic ${auth}`, 'User-Agent': 'HaqqJobs/1.0' });
    res.json(data);
  } catch(e) {
    console.error("Reed Error:", e.message);
    res.status(500).json({ results: [], error: e.message });
  }
});

// Adzuna API Route
app.get('/api/adzuna', async (req, res) => {
  const keywords = req.query.keywords || 'warehouse';
  const location = req.query.location || 'UK';
  
  const params = new URLSearchParams({ 
    app_id: ADZUNA_APP_ID, 
    app_key: ADZUNA_APP_KEY, 
    results_per_page: '40', 
    what: keywords, 
    where: location,
    max_days_old: '7' // Extended to 7 days to guarantee fresh results
  });
  
  const url = `https://api.api.adzuna.com/v1/api/jobs/gb/search/1?${params}`;
  
  try {
    if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) throw new Error("Adzuna credentials missing in server environment");
    const data = await fetchJSON(url, { 'User-Agent': 'HaqqJobs/1.0' });
    res.json(data);
  } catch(e) {
    console.error("Adzuna Error:", e.message);
    res.status(500).json({ results: [], error: e.message });
  }
});

// Wildcard fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`HaqqJobs running smoothly on port ${PORT}`));
