const express = require('express');
const https = require('https');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const REED_KEY = process.env.REED_API_KEY;
const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID;
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY;

app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

function fetchJSON(url, headers = {}, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { 
          resolve(JSON.parse(body)); 
        } catch(e) { 
          reject(new Error(`Invalid JSON. Status: ${res.statusCode}`)); 
        }
      });
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    req.on('error', reject);
  });
}

app.get('/health', (req, res) => {
  res.json({ status: 'running', keys_present: { reed: !!REED_KEY, adzuna_id: !!ADZUNA_APP_ID, adzuna_key: !!ADZUNA_APP_KEY } });
});

app.get('/api/reed', async (req, res) => {
  const keywords = req.query.keywords || '';
  const location = req.query.location || '';
  const params = new URLSearchParams({ keywords, locationName: location, resultsToTake: '100' });
  const url = `https://www.reed.co.uk/api/1.0/search?${params}`;
  const auth = Buffer.from(`${REED_KEY}:`).toString('base64');
  
  try {
    const data = await fetchJSON(url, { 'Authorization': `Basic ${auth}`, 'User-Agent': 'AbayJobs/1.0' });
    res.json(data);
  } catch(e) {
    res.status(500).json({ results: [], error: e.message });
  }
});

app.get('/api/adzuna', async (req, res) => {
  const keywords = req.query.keywords || '';
  const location = req.query.location || '';
  const params = new URLSearchParams({ 
    app_id: ADZUNA_APP_ID, 
    app_key: ADZUNA_APP_KEY, 
    results_per_page: '100', 
    what: keywords, 
    where: location,
    max_days_old: '30'
  });
  const url = `https://api.adzuna.com/v1/api/jobs/gb/search/1?${params}`;
  
  try {
    const data = await fetchJSON(url, { 'User-Agent': 'AbayJobs/1.0' });
    res.json(data);
  } catch(e) {
    res.status(500).json({ results: [], error: e.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`AbayJobs Server live on port ${PORT}`));
