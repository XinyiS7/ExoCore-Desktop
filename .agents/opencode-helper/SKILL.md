---
name: opencode-helper
description: OpenCode CLI agent workflow and conventions for ExoCore project
compatibility: opencode
metadata:
  scope: exocore-backend
  platform: opencode-cli
---

# OpenCode Helper Skill

## 1. Purpose
Provide OpenCode CLI agents with ExoCore-specific workflow guidance, Python interpreter conventions, and anti-hallucination rules.

## 2. Python Interpreter (Critical)
**Always use `python.exe`** — the conda env `exocore_project` is pre-activated via `~/.bash_profile`. Never use absolute paths like `E:\Conda\envs\exocore_project\python.exe` unless troubleshooting.

### Django Imports (CRITICAL)
NEVER run `python.exe -c "from agents..."` or `python.exe -c "from memory..."` — Django apps won't be configured and will raise `ImproperlyConfigured`.

**Correct patterns:**
```bash
# Django operations: use manage.py shell
python.exe manage.py shell -c "from agents.models import AgentPreset; print(AgentPreset.objects.count())"

# Non-Django Python snippets (stdlib only): bare python.exe is fine
python.exe -c "import sys; print(sys.version)"
```

## 3. DB Operations (Prefer UPDATE over DELETE)
- Modify rows in-place whenever possible; avoid `delete()` that leaves auto-increment gaps
- If you touch bad data, `UPDATE` the offending columns — don't wipe the row
- For large-scale data fixes requiring full rebuild, ask first

## 4. Quote Style
- Prefer double quotes `"` as the outermost string delimiter in Python and JS/TS
- Always verify quotes are ASCII `"` (U+0022), not Chinese curly quotes `"` / `"` (U+201C / U+201D)

## 5. Frontmatter Write-Back (Obsidian Files)
Use `frontmatter.load()` → modify `post.metadata` → `frontmatter.dump(post, f)` in binary `'wb'` mode:
```python
import frontmatter
with open(path, 'r') as f:
    post = frontmatter.load(f)
post.metadata['sync'] = True
with open(path, 'wb') as f:
    frontmatter.dump(post, f)
```

## 6. Anti-Hallucination (CRITICAL)
**NO INVENTION**: NEVER assume a class, method, property, API data structure, or database field exists. MUST empirically verify exact name and signature by reading source code or using `grep` before writing code that interacts with it.

**Verification pattern:**
```python
# BEFORE writing code that uses X:
grep -r "class X" agents/  # verify class exists
grep -r "def method_name" agents/  # verify method signature
```

## 7. LLM Model Routing
All LLM calls route through `engines/LLMGateway`. Platform inference and capability checks delegate to `engines/model_registry.py`. Adding a new provider = only change `model_registry.py`, never scatter `if 'gemini' in model` checks.

## 8. Architecture Layers (Strict Enforcement)
- **Views**: Routing, thin request/response parsing. ZERO business logic.
- **Services**: Heavy lifting, business logic, ORM queries, third-party API calls.
- NO spaghetti logic crossing layer boundaries.

## 9. Testing
No pytest framework. Tests are standalone scripts run directly:
```bash
python test_g045.py      # Interactive G045 chat
python test_api.py       # API endpoint smoke tests
python test_rag.py       # RAG retrieval pipeline
python test_embedding.py # Embedding model
python test_env.py       # Validate environment variables
```

## 10. Documentation References
- **AGENTS.md**: Agent workflow, architecture, commands (read before any task)
- **ReactSheet.txt**: Full API response shapes (refer for frontend-facing endpoints)
- **Plan/**: Construction plans (always plan first, work later)

## 11. Key Commands Reference
```bash
# Backend
python manage.py runserver

# Migrations
python manage.py migrate

# Knowledge Base Pipeline (run in order)
python manage.py refine_obsidian <vault_path> [--generate-abstract] [--write-back]
python manage.py ingest_obsidian <vault_path>
python manage.py maintain_obsidian [--check-paths] [--update] [--delete-orphans] [--re-vectorize]

# Memory Compaction
python manage.py compact_conversations
python manage.py compact_conversations --prune --yes

# G045 Maintenance
python manage.py run_maintenance
python manage.py import_private_logs
```

## 12. Environment Variables
Check `.env` for required keys (GEMINI_API_KEY, DEEPSEEK_API_KEY, DATABASE_URL, etc.). Never commit `.env` content or print secrets.

## 13. Git Workflow
- NEVER commit unless explicitly requested
- Before committing: `git status`, `git diff`, `git log --oneline -10`
- Stage only intended files, never secrets

## 14. Commit Message Style
Write concise commit messages matching repo style. Per-file checkpointing recommended for multi-step plans.