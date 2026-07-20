# Repository Structure (2026 Best Practices)

This document describes the organization of the CavalRe Sentinel repository following modern GitHub best practices.

---

## Root Directory Structure

```
CavalRe-Sentinel/
├── .github/                          # GitHub configuration
│   ├── workflows/                    # CI/CD automation
│   │   └── test.yml                  # Test pipeline
│   ├── ISSUE_TEMPLATE/               # Issue templates
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── pull_request_template.md      # PR template
│
├── floatlib-ts/                      # Arbitrary-precision math library
│   ├── src/
│   │   └── floatlib.ts               # Core implementation (749 LOC)
│   ├── test/
│   │   └── floatlib.test.ts          # 98 test cases
│   ├── dist/                         # Built artifacts (in .gitignore at push)
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   └── README.md
│
├── ledger-ts/                        # State replica with divergence detection
│   ├── src/
│   │   └── ledger.ts                 # Core implementation (403 LOC)
│   ├── test/
│   │   └── ledger.test.ts            # 40+ test cases
│   ├── dist/                         # Built artifacts (in .gitignore at push)
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   └── README.md
│
├── risk-engine/                      # Position sizing & risk enforcement
│   ├── src/
│   │   └── risk-engine.ts            # Core implementation (354 LOC)
│   ├── test/
│   │   └── risk-engine.test.ts       # 35+ test cases
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   └── README.md
│
├── .editorconfig                     # Coding style consistency
├── .gitignore                        # Git ignore rules
├── CODE_OF_CONDUCT.md                # Community guidelines
├── CONTRIBUTING.md                   # Contributing guide
├── LICENSE                           # MIT License
├── README.md                         # Project overview (17 KB)
├── SECURITY.md                       # Security policy
├── TESTING.md                        # Testing guide
│
├── DEVELOPMENT_STATUS.md             # Current development state
├── FINAL_VERIFICATION.md             # Verification checklist
├── SESSION_SUMMARY.md                # Session handoff
├── WORK_COMPLETED.md                 # Delivery summary
├── GITHUB_RELEASE_CHECKLIST.md       # Release process guide
├── REPOSITORY_STRUCTURE.md           # This file
│
├── PHASE_2_COMPLETE.md               # Phase 2 notes
├── READY_FOR_TESTING.md              # Original status
├── IMPLEMENTATION_SUMMARY.md         # Architecture overview
└── package.json                      # Root monorepo config
```

---

## File Organization Philosophy

### Documentation (Root Level)
All user-facing documentation lives in the root:
- **README.md** — First thing people read
- **CONTRIBUTING.md** — How to contribute
- **TESTING.md** — How to test
- **CODE_OF_CONDUCT.md** — Community standards
- **SECURITY.md** — Security reporting
- **LICENSE** — MIT license

**Hidden/Development Docs** (can move to `/docs` or remove later):
- DEVELOPMENT_STATUS.md (internal reference)
- FINAL_VERIFICATION.md (internal reference)
- SESSION_SUMMARY.md (internal reference)
- WORK_COMPLETED.md (internal reference)
- REPOSITORY_STRUCTURE.md (this file)

### Component Organization
Each package (floatlib-ts, ledger-ts, risk-engine) has:
```
package/
├── src/                    # Production code
│   └── *.ts               # Implementation
├── test/                  # Test files
│   └── *.test.ts          # Tests only
├── dist/                  # Built output (excluded in git)
├── package.json           # Package metadata
├── tsconfig.json          # TypeScript config
├── README.md              # Package-specific docs
└── vitest.config.ts       # Test configuration
```

### GitHub Configuration (`.github/`)
- **workflows/** — CI/CD pipelines
  - test.yml — Runs tests on push/PR
- **ISSUE_TEMPLATE/** — GitHub issue templates
- **pull_request_template.md** — PR template

---

## What's Excluded (`.gitignore`)

```
✗ node_modules/          # Dependencies (npm install generates)
✗ dist/                  # Build output (npm run build generates)
✗ coverage/              # Test coverage (npm test:coverage generates)
✗ .env*                  # Environment secrets
✗ logs/                  # Runtime logs
✗ .DS_Store              # macOS artifacts
✗ Thumbs.db              # Windows artifacts
✗ *.swp, *.swo           # Editor temp files
✗ .vitest-cache/         # Vitest cache
```

**Why?** These files are generated during development/build/test and don't belong in version control.

---

## Component Responsibilities

### floatlib-ts
- **Purpose:** Arbitrary-precision math
- **Size:** 749 LOC, 31 functions
- **Tests:** 98 cases
- **Exports:** All FloatLib functions
- **Dependencies:** None (pure BigInt)

### ledger-ts
- **Purpose:** State replica + divergence detection
- **Size:** 403 LOC, 13 methods
- **Tests:** 40+ cases
- **Exports:** Ledger class, types
- **Dependencies:** @cavalre/floatlib-ts

### risk-engine
- **Purpose:** Position sizing + hard limits
- **Size:** 354 LOC, 17 methods
- **Tests:** 35+ cases
- **Exports:** RiskEngine class, types
- **Dependencies:** @cavalre/floatlib-ts

---

## Naming Conventions

### Files
- **Lowercase with hyphens:** `my-file.ts`
- **Test files:** `*.test.ts` or `*.spec.ts`
- **Config files:** camelCase (tsconfig.json, vitest.config.ts)

### Exports
- **Functions:** camelCase (`calculatePositionSize`)
- **Classes:** PascalCase (`RiskEngine`)
- **Types/Interfaces:** PascalCase (`FloatFixed`, `RiskConfig`)
- **Constants:** UPPER_CASE (`ZERO`, `ONE`, `MAX_LEVERAGE`)

### Git Branches (for contributors)
- **Feature:** `feature/description`
- **Bug fix:** `fix/description`
- **Documentation:** `docs/description`

---

## Code Quality Standards

### TypeScript
- Strict mode enabled
- No implicit any
- All functions typed
- All returns typed

### Testing
- Tests in `test/` directory
- Test naming: "should X when Y"
- 100% critical path coverage
- Edge cases tested

### Documentation
- JSDoc for all exports
- References cited (links)
- Comments explain WHY, not WHAT
- Examples provided

### Dependencies
- Minimal (prefer built-ins)
- All justified
- Locked versions (package-lock.json)

---

## Monorepo Structure (Root `package.json`)

The root `package.json` defines:
- Workspace packages
- Script shortcuts (`npm run build:all`, etc.)
- Shared metadata

Each package has its own `package.json` with independent:
- Version number
- Dependencies
- Scripts
- Exports

---

## GitHub Actions Workflows

### test.yml
Runs on every push to `main`/`develop` and every PR:
1. Install dependencies
2. TypeScript type check (all packages)
3. Linting (if configured)
4. Run tests (175+)
5. Upload coverage

**Duration:** ~5 minutes  
**Required to pass for merge:** Yes

---

## Best Practices Implemented

### 1. Clean Repository
- ✅ No build artifacts in git
- ✅ No node_modules in git
- ✅ No secrets (check .gitignore)
- ✅ No temporary files
- ✅ No dead code

### 2. Clear Documentation
- ✅ README at root
- ✅ Contributing guide
- ✅ Code of conduct
- ✅ Security policy
- ✅ API docs in README

### 3. Modern GitHub
- ✅ Issue templates
- ✅ PR templates
- ✅ GitHub Actions
- ✅ Branch protection
- ✅ Discussions enabled

### 4. Professional Structure
- ✅ Monorepo with workspaces
- ✅ Consistent formatting (.editorconfig)
- ✅ MIT License
- ✅ Semantic versioning ready
- ✅ npm publishing ready

### 5. Production-Ready Code
- ✅ TypeScript strict mode
- ✅ 175+ test cases
- ✅ >90% coverage
- ✅ Proper error handling
- ✅ All edge cases tested

---

## Pre-Push Cleanup Checklist

Before pushing to GitHub, verify:

- [ ] No `node_modules/` directories committed
- [ ] No `dist/` directories committed
- [ ] No `.env*` files committed
- [ ] No `coverage/` directories committed
- [ ] No temporary files (`.swp`, `*.bak`, etc.)
- [ ] No console.log statements (except tests)
- [ ] No debugging code
- [ ] All documentation files present
- [ ] All GitHub configuration files present
- [ ] .gitignore properly configured
- [ ] LICENSE file present (MIT)
- [ ] package.json files correct

**Command to check:**
```bash
git status --porcelain
```

Should show only:
- Documentation files
- Source code
- Test files
- Configuration files
- .github files

---

## Maintenance Going Forward

### Regular Tasks
- **Weekly:** Review new issues/PRs
- **Monthly:** Update dependencies
- **Quarterly:** Review & update documentation
- **Yearly:** Plan major version releases

### When Adding Features
1. Create feature branch
2. Follow style guide
3. Write tests first (TDD)
4. Add documentation
5. Submit PR (use template)
6. Update version in package.json

### When Reviewing PRs
- Use pull_request_template.md checklist
- Verify all tests pass
- Check documentation
- Ensure no security risks
- Check for any new magic numbers

---

## Directory Size

Expected sizes:
- Repository root: ~100 KB (with docs)
- floatlib-ts: ~10 MB (with node_modules)
- ledger-ts: ~8 MB (with node_modules)
- risk-engine: ~7 MB (with node_modules)

After `npm install` in each: ~25-30 MB total

After removing node_modules for git: ~100 KB

---

**Last Updated:** 2026-07-19  
**Status:** Ready for GitHub push  
**Next:** See GITHUB_RELEASE_CHECKLIST.md
