# Family Finances Module

Monthly budgeting, expense tracking and savings goals for the Family Organizer.

## Running

```bash
cd family_finances
npm install
node server.js
# → http://0.0.0.0:3001
```

Or just: `./start.sh`

## Data

Stored in `family_finances/data/<familyId>.json`. Each family has:

- **categories** — master list; all expenses and budget entries reference `categoryId`
- **budgets** — keyed by `YYYY-MM`, one entry per category
- **expenses** — flat list of transactions with date, amount, categoryId
- **savingsGoals** — named goals with target/current amounts

## API

### Categories
| Method | Route | Description |
|--------|-------|-------------|
| GET    | `/api/family/:id/finances/categories` | List all categories |
| POST   | `/api/family/:id/finances/categories` | Add a category `{name, color}` |
| PUT    | `/api/family/:id/finances/categories/:cid` | Edit a category |
| DELETE | `/api/family/:id/finances/categories/:cid` | Delete (blocked if in use) |

### Budget
| Method | Route | Description |
|--------|-------|-------------|
| GET    | `/api/family/:id/finances/budget/:month` | Get/init budget for `YYYY-MM` |
| POST   | `/api/family/:id/finances/budget/:month` | Save allocations `{income, categories[]}` |

### Expenses
| Method | Route | Description |
|--------|-------|-------------|
| GET    | `/api/family/:id/finances/expenses` | List expenses (filter: `?month=&category=`) |
| POST   | `/api/family/:id/finances/expenses` | Add expense `{date, categoryId, amount, description, notes}` |
| PUT    | `/api/family/:id/finances/expenses/:eid` | Edit an expense |
| DELETE | `/api/family/:id/finances/expenses/:eid` | Delete an expense |

### Savings Goals
| Method | Route | Description |
|--------|-------|-------------|
| GET    | `/api/family/:id/finances/savings` | List goals |
| POST   | `/api/family/:id/finances/savings` | Create/update goal `{name, target, current, targetDate}` |
| DELETE | `/api/family/:id/finances/savings/:gid` | Delete a goal |

### Summary
| Method | Route | Description |
|--------|-------|-------------|
| GET    | `/api/family/:id/finances/summary/:month` | Budget vs actual breakdown for a month |

## Default Categories

Housing · Food & Groceries · Transport · Health · Education · Entertainment · Clothing · Savings · Utilities · Other

All categories are editable. Deleting a category that has linked expenses or budget entries is blocked — reassign first.
