const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;
const DATA_DIR = path.join(__dirname, 'data');

app.use(express.json());

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// ───────────── Default Categories ─────────────

const DEFAULT_CATEGORIES = [
  { id: 'housing',       name: 'Housing',          color: '#4A90E2' },
  { id: 'food',          name: 'Food & Groceries',  color: '#7ED321' },
  { id: 'transport',     name: 'Transport',         color: '#F5A623' },
  { id: 'health',        name: 'Health',            color: '#D0021B' },
  { id: 'education',     name: 'Education',         color: '#9B59B6' },
  { id: 'entertainment', name: 'Entertainment',     color: '#1ABC9C' },
  { id: 'clothing',      name: 'Clothing',          color: '#E67E22' },
  { id: 'savings',       name: 'Savings',           color: '#2ECC71' },
  { id: 'utilities',     name: 'Utilities',         color: '#95A5A6' },
  { id: 'other',         name: 'Other',             color: '#BDC3C7' }
];

// ───────────── Helpers ─────────────

function financesPath(familyId) {
  const safe = familyId.replace(/[^a-zA-Z0-9_-]/g, '') || 'default';
  return path.join(DATA_DIR, `${safe}.json`);
}

function readFinances(familyId) {
  const file = financesPath(familyId);
  if (!fs.existsSync(file)) {
    const empty = {
      familyId,
      categories: DEFAULT_CATEGORIES,
      budgets: {},
      expenses: [],
      savingsGoals: []
    };
    fs.writeFileSync(file, JSON.stringify(empty, null, 2));
    return empty;
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeFinances(familyId, data) {
  fs.writeFileSync(financesPath(familyId), JSON.stringify(data, null, 2));
}

// Initialize a budget month from current categories if it doesn't exist
function initMonth(data, month) {
  if (!data.budgets[month]) {
    data.budgets[month] = {
      month,
      income: 0,
      categories: data.categories.map(c => ({
        categoryId: c.id,
        budgeted: 0,
        notes: ''
      }))
    };
  }
  return data.budgets[month];
}

// ───────────── Categories ─────────────

// GET /api/family/:id/finances/categories
app.get('/api/family/:id/finances/categories', (req, res) => {
  const data = readFinances(req.params.id);
  res.json(data.categories);
});

// POST /api/family/:id/finances/categories — add a new category
app.post('/api/family/:id/finances/categories', (req, res) => {
  const data = readFinances(req.params.id);
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
  const cat = { id, name, color: color || '#AAAAAA' };
  data.categories.push(cat);
  writeFinances(req.params.id, data);
  res.json(cat);
});

// PUT /api/family/:id/finances/categories/:cid — edit a category
app.put('/api/family/:id/finances/categories/:cid', (req, res) => {
  const data = readFinances(req.params.id);
  const idx = data.categories.findIndex(c => c.id === req.params.cid);
  if (idx === -1) return res.status(404).json({ error: 'category not found' });
  data.categories[idx] = { ...data.categories[idx], ...req.body, id: req.params.cid };
  writeFinances(req.params.id, data);
  res.json(data.categories[idx]);
});

// DELETE /api/family/:id/finances/categories/:cid
app.delete('/api/family/:id/finances/categories/:cid', (req, res) => {
  const data = readFinances(req.params.id);
  const cid = req.params.cid;

  // Guard: check for linked expenses or budget entries
  const expenseRefs = data.expenses.filter(e => e.categoryId === cid).length;
  const budgetRefs = Object.values(data.budgets).filter(b =>
    b.categories.some(c => c.categoryId === cid && c.budgeted > 0)
  ).length;

  if (expenseRefs > 0 || budgetRefs > 0) {
    return res.status(409).json({
      error: 'Category in use',
      expenseRefs,
      budgetRefs,
      hint: 'Reassign or delete linked entries before removing this category.'
    });
  }

  data.categories = data.categories.filter(c => c.id !== cid);
  // Also remove from any budget months (zero entries)
  Object.values(data.budgets).forEach(b => {
    b.categories = b.categories.filter(c => c.categoryId !== cid);
  });
  writeFinances(req.params.id, data);
  res.json({ ok: true });
});

// ───────────── Budget ─────────────

// GET /api/family/:id/finances/budget/:month  (YYYY-MM)
app.get('/api/family/:id/finances/budget/:month', (req, res) => {
  const data = readFinances(req.params.id);
  const budget = initMonth(data, req.params.month);
  writeFinances(req.params.id, data);

  // Enrich with category metadata and actual spend
  const enriched = {
    ...budget,
    categories: budget.categories.map(entry => {
      const cat = data.categories.find(c => c.id === entry.categoryId) || { name: entry.categoryId, color: '#AAAAAA' };
      const actual = data.expenses
        .filter(e => e.categoryId === entry.categoryId && e.date.startsWith(req.params.month))
        .reduce((sum, e) => sum + e.amount, 0);
      return { ...entry, name: cat.name, color: cat.color, actual: Math.round(actual * 100) / 100 };
    })
  };
  res.json(enriched);
});

// POST /api/family/:id/finances/budget/:month — save allocations
app.post('/api/family/:id/finances/budget/:month', (req, res) => {
  const data = readFinances(req.params.id);
  const existing = initMonth(data, req.params.month);
  const update = req.body;

  // Merge income if provided
  if (update.income !== undefined) existing.income = update.income;

  // Merge category allocations
  if (Array.isArray(update.categories)) {
    update.categories.forEach(entry => {
      if (!data.categories.find(c => c.id === entry.categoryId)) {
        return; // reject unknown categoryId
      }
      const idx = existing.categories.findIndex(c => c.categoryId === entry.categoryId);
      if (idx > -1) {
        existing.categories[idx] = { ...existing.categories[idx], ...entry, categoryId: entry.categoryId };
      } else {
        existing.categories.push({ categoryId: entry.categoryId, budgeted: entry.budgeted || 0, notes: entry.notes || '' });
      }
    });
  }

  data.budgets[req.params.month] = existing;
  writeFinances(req.params.id, data);
  res.json(existing);
});

// ───────────── Expenses ─────────────

// GET /api/family/:id/finances/expenses?month=YYYY-MM&category=id
app.get('/api/family/:id/finances/expenses', (req, res) => {
  const data = readFinances(req.params.id);
  let expenses = data.expenses;

  if (req.query.month) {
    expenses = expenses.filter(e => e.date.startsWith(req.query.month));
  }
  if (req.query.category) {
    expenses = expenses.filter(e => e.categoryId === req.query.category);
  }

  // Enrich with category metadata
  const enriched = expenses.map(e => {
    const cat = data.categories.find(c => c.id === e.categoryId) || { name: e.categoryId, color: '#AAAAAA' };
    return { ...e, categoryName: cat.name, categoryColor: cat.color };
  });

  res.json(enriched);
});

// POST /api/family/:id/finances/expenses — add an expense
app.post('/api/family/:id/finances/expenses', (req, res) => {
  const data = readFinances(req.params.id);
  const { date, categoryId, amount, description, notes } = req.body;

  if (!date || !categoryId || amount === undefined) {
    return res.status(400).json({ error: 'date, categoryId and amount are required' });
  }
  if (!data.categories.find(c => c.id === categoryId)) {
    return res.status(400).json({ error: `Unknown categoryId: ${categoryId}` });
  }

  const expense = {
    id: Date.now(),
    date,
    categoryId,
    amount: Math.round(parseFloat(amount) * 100) / 100,
    description: description || '',
    notes: notes || ''
  };

  data.expenses.push(expense);
  writeFinances(req.params.id, data);
  res.json(expense);
});

// PUT /api/family/:id/finances/expenses/:eid — edit an expense
app.put('/api/family/:id/finances/expenses/:eid', (req, res) => {
  const data = readFinances(req.params.id);
  const idx = data.expenses.findIndex(e => e.id == req.params.eid);
  if (idx === -1) return res.status(404).json({ error: 'expense not found' });

  if (req.body.categoryId && !data.categories.find(c => c.id === req.body.categoryId)) {
    return res.status(400).json({ error: `Unknown categoryId: ${req.body.categoryId}` });
  }

  data.expenses[idx] = { ...data.expenses[idx], ...req.body, id: data.expenses[idx].id };
  if (data.expenses[idx].amount !== undefined) {
    data.expenses[idx].amount = Math.round(parseFloat(data.expenses[idx].amount) * 100) / 100;
  }
  writeFinances(req.params.id, data);
  res.json(data.expenses[idx]);
});

// DELETE /api/family/:id/finances/expenses/:eid
app.delete('/api/family/:id/finances/expenses/:eid', (req, res) => {
  const data = readFinances(req.params.id);
  const before = data.expenses.length;
  data.expenses = data.expenses.filter(e => e.id != req.params.eid);
  if (data.expenses.length === before) return res.status(404).json({ error: 'expense not found' });
  writeFinances(req.params.id, data);
  res.json({ ok: true });
});

// ───────────── Savings Goals ─────────────

// GET /api/family/:id/finances/savings
app.get('/api/family/:id/finances/savings', (req, res) => {
  res.json(readFinances(req.params.id).savingsGoals);
});

// POST /api/family/:id/finances/savings — create or update
app.post('/api/family/:id/finances/savings', (req, res) => {
  const data = readFinances(req.params.id);
  let goal = req.body;
  if (!goal.name) return res.status(400).json({ error: 'name required' });
  if (!goal.id) goal.id = Date.now();

  const idx = data.savingsGoals.findIndex(g => g.id == goal.id);
  if (idx > -1) data.savingsGoals[idx] = { ...data.savingsGoals[idx], ...goal };
  else data.savingsGoals.push(goal);

  writeFinances(req.params.id, data);
  res.json(goal);
});

// DELETE /api/family/:id/finances/savings/:gid
app.delete('/api/family/:id/finances/savings/:gid', (req, res) => {
  const data = readFinances(req.params.id);
  const before = data.savingsGoals.length;
  data.savingsGoals = data.savingsGoals.filter(g => g.id != req.params.gid);
  if (data.savingsGoals.length === before) return res.status(404).json({ error: 'goal not found' });
  writeFinances(req.params.id, data);
  res.json({ ok: true });
});

// ───────────── Summary ─────────────

// GET /api/family/:id/finances/summary/:month — overview of budget vs actual
app.get('/api/family/:id/finances/summary/:month', (req, res) => {
  const data = readFinances(req.params.id);
  const budget = initMonth(data, req.params.month);

  const categoryTotals = {};
  data.expenses
    .filter(e => e.date.startsWith(req.params.month))
    .forEach(e => {
      categoryTotals[e.categoryId] = (categoryTotals[e.categoryId] || 0) + e.amount;
    });

  const totalSpent = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
  const totalBudgeted = budget.categories.reduce((a, c) => a + (c.budgeted || 0), 0);

  const breakdown = data.categories.map(cat => ({
    categoryId: cat.id,
    name: cat.name,
    color: cat.color,
    budgeted: (budget.categories.find(c => c.categoryId === cat.id) || {}).budgeted || 0,
    actual: Math.round((categoryTotals[cat.id] || 0) * 100) / 100
  }));

  res.json({
    month: req.params.month,
    income: budget.income,
    totalBudgeted: Math.round(totalBudgeted * 100) / 100,
    totalSpent: Math.round(totalSpent * 100) / 100,
    remaining: Math.round((budget.income - totalSpent) * 100) / 100,
    breakdown
  });
});

// ───────────── Start ─────────────

app.listen(PORT, '0.0.0.0', () => console.log(`✅ Family Finances running → http://0.0.0.0:${PORT}`));
