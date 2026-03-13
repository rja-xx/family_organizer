const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');

app.use(express.json());

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// Helper functions
function familyPath(id) {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, '') || 'default';
  return path.join(DATA_DIR, `${safe}.json`);
}

function readFamily(id) {
  const file = familyPath(id);
  if (!fs.existsSync(file)) {
    const empty = { familyId: id, name: id, projects: [] };
    fs.writeFileSync(file, JSON.stringify(empty, null, 2));
    return empty;
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeFamily(id, data) {
  fs.writeFileSync(familyPath(id), JSON.stringify(data, null, 2));
}

// ───────────── API Routes ─────────────

// List all families
app.get('/api/families', (req, res) => {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  const families = files.map(f => {
    const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
    return { id: d.familyId, name: d.name || d.familyId };
  });
  res.json(families);
});

// Get family
app.get('/api/family/:id', (req, res) => {
  res.json(readFamily(req.params.id));
});

// Create family
app.post('/api/family', (req, res) => {
  const { id, name } = req.body;
  if (!id) return res.status(400).json({ error: 'id required' });
  const family = { familyId: id, name: name || id, projects: [] };
  writeFamily(id, family);
  res.json(family);
});

// Get projects
app.get('/api/family/:id/projects', (req, res) => {
  res.json(readFamily(req.params.id).projects);
});

// Save project (create or update)
app.post('/api/family/:id/projects', (req, res) => {
  const fam = readFamily(req.params.id);
  let proj = req.body;
  if (!proj.id) proj.id = Date.now();
  const idx = fam.projects.findIndex(p => p.id == proj.id);
  if (idx > -1) fam.projects[idx] = proj;
  else fam.projects.push(proj);
  writeFamily(req.params.id, fam);
  res.json(proj);
});

// Delete project
app.delete('/api/family/:id/projects/:pid', (req, res) => {
  const fam = readFamily(req.params.id);
  fam.projects = fam.projects.filter(p => p.id != req.params.pid);
  writeFamily(req.params.id, fam);
  res.json({ ok: true });
});

// Save members
app.post('/api/family/:id/members', (req, res) => {
  const fam = readFamily(req.params.id);
  fam.members = req.body;
  writeFamily(req.params.id, fam);
  res.json(fam.members);
});

// ───────────── Serve the App ─────────────

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => console.log(`✅ Tracker running → http://0.0.0.0:${PORT}`));