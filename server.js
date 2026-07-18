const express = require('express');
const https = require('https');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const REED_KEY = process.env.REED_API_KEY;
const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID;
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY;

const PAGE_SIZE = 20;

app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

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
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Timeout')); });
    req.on('error', reject);
  });
}

app.get('/health', (req, res) => res.json({ status: 'running' }));

// REED — no native sort-by-date, so we sort server-side after receiving
app.get('/api/reed', async (req, res) => {
  const keywords = req.query.keywords || '';
  const location = req.query.location || '';
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const params = new URLSearchParams({ resultsToTake: String(PAGE_SIZE), resultsToSkip: String(skip) });
  if (keywords) params.set('keywords', keywords);
  if (location) { params.set('locationName', location); params.set('distanceFromLocation', '0'); }

  const url = `https://www.reed.co.uk/api/1.0/search?${params}`;
  const auth = Buffer.from(`${REED_KEY}:`).toString('base64');

  try {
    const data = await fetchJSON(url, { 'Authorization': `Basic ${auth}`, 'User-Agent': 'AbayJobs/1.0' });
    if (data.results) {
      data.results.sort((a, b) => {
        const parse = (s) => { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s||''); return m ? new Date(+m[3],+m[2]-1,+m[1]).getTime() : 0; };
        return parse(b.date) - parse(a.date);
      });
    }
    res.json(data);
  } catch(e) { res.json({ results: [], error: e.message }); }
});

// ADZUNA — sort_by date, max 30 days old
app.get('/api/adzuna', async (req, res) => {
  const keywords = req.query.keywords || '';
  const location = req.query.location || '';
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);

  const params = new URLSearchParams({
    app_id: ADZUNA_APP_ID, app_key: ADZUNA_APP_KEY,
    results_per_page: String(PAGE_SIZE),
    sort_by: 'date', max_days_old: '30'
  });
  if (keywords) params.set('what', keywords);
  if (location) params.set('where', location);

  const url = `https://api.adzuna.com/v1/api/jobs/gb/search/${page}?${params}`;
  try {
    const data = await fetchJSON(url, { 'User-Agent': 'AbayJobs/1.0' });
    if (location && data.results) {
      const locLower = location.toLowerCase().trim();
      data.results = data.results.filter(j => {
        const jobLoc = ((j.location && j.location.display_name) || '').toLowerCase();
        return jobLoc.indexOf(locLower) !== -1;
      });
    }
    res.json(data);
  } catch(e) { res.json({ results: [], error: e.message }); }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`AbayJobs running on port ${PORT}`));
