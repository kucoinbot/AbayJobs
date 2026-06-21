const express = require('express');
const https = require('https');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const REED_KEY = process.env.REED_API_KEY;
const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID;
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY;
const MIN_SALARY = '25396';

// Serve static files (your website)
app.use(express.static(path.join(__dirname, 'public')));

// Allow all origins
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// Fetch with timeout
function fetchJSON(url, headers = {}, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch(e) { reject(new Error('Invalid JSON')); }
      });
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    req.on('error', reject);
  });
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'running' });
});

// Reed API
app.get('/api/reed', async (req, res) => {
  const keywords = req.query.keywords || 'warehouse security construction care cleaning driver';
  const location = req.query.location || '';
  const params = new URLSearchParams({ keywords, locationName: location, resultsToTake: '50', minimumSalary: MIN_SALARY });
  const url = `https://www.reed.co.uk/api/1.0/search?${params}`;
  const auth = Buffer.from(`${REED_KEY}:`).toString('base64');
  try {
    const data = await fetchJSON(url, { 'Authorization': `Basic ${auth}`, 'User-Agent': 'HaqqJobs/1.0' });
    res.json(data);
  } catch(e) {
    res.json({ results: [], error: e.message });
  }
});

// Adzuna API
app.get('/api/adzuna', async (req, res) => {
  const keywords = req.query.keywords || 'warehouse security labourer care assistant cleaner driver';
  const location = req.query.location || '';
  const params = new URLSearchParams({ app_id: ADZUNA_APP_ID, app_key: ADZUNA_APP_KEY, results_per_page: '50', what: keywords, where: location, salary_min: MIN_SALARY, max_days_old: '2' });
  const url = `https://api.adzuna.com/v1/api/jobs/gb/search/1?${params}`;
  try {
    const data = await fetchJSON(url, { 'User-Agent': 'HaqqJobs/1.0' });
    res.json(data);
  } catch(e) {
    res.json({ results: [], error: e.message });
  }
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`HaqqJobs running on port ${PORT}`));
