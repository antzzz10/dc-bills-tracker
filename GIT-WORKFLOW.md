# Git Workflow Guide - Avoiding Common Conflicts

## The Problem

This project has **automated daily commits** from GitHub Actions (monitoring script runs at 9 AM EST). This creates a common pattern of git conflicts:

1. You make local changes
2. Try to commit and push
3. Push fails because remote has new automated commits
4. Try to pull --rebase
5. Fails because you have uncommitted changes
6. Must stash → pull → push → unstash

## Solutions

### Option 1: Use the Safe Commit Script (Recommended)

We've created a helper script that handles the entire workflow automatically:

```bash
./scripts/git-safe-commit.sh "Your commit message"
```

What it does:
1. Stashes your uncommitted changes
2. Pulls latest changes from remote
3. Restores your changes
4. Shows you what will be committed
5. Commits and pushes everything

**Usage:**
```bash
cd ~/Projects/dc-bills-tracker
./scripts/git-safe-commit.sh "Add new feature"
```

### Option 2: Manual Workflow (When You Need More Control)

Before starting work each day:
```bash
cd ~/Projects/dc-bills-tracker
git pull --rebase origin main
```

Before committing:
```bash
# Sync with remote first
git stash
git pull --rebase origin main
git stash pop

# Then commit normally
git add .
git commit -m "Your message"
git push origin main
```

### Option 3: Set Up Git Aliases (One-time setup)

Add these to your `~/.gitconfig`:

```ini
[alias]
    # Safe pull that handles uncommitted changes
    sync = "!f() { \
        git stash && \
        git pull --rebase origin main && \
        git stash pop; \
    }; f"

    # Safe commit-and-push
    safe-commit = "!f() { \
        git stash && \
        git pull --rebase origin main && \
        git stash pop && \
        git add -A && \
        git commit -m \"$1\" && \
        git push origin main; \
    }; f"
```

Then use:
```bash
cd ~/Projects/dc-bills-tracker
git sync                          # Pull latest changes
git safe-commit "Your message"    # Commit and push safely
```

## Current Uncommitted Changes

You currently have uncommitted changes to:
- `src/App.jsx` - Feedback form link in footer
- `src/App.css` - Styling for feedback link

**Decision needed:**
- **Keep changes**: Commit them with `./scripts/git-safe-commit.sh "Add feedback form to footer"`
- **Discard changes**: Run `git restore src/App.jsx src/App.css`

## Understanding the Automated Commits

The monitoring workflow (`monitor-bills-FIXED.yml`) runs daily at 9 AM EST and updates:
- `bill-status-history.json` - Historical tracking data
- `src/data/bills.json` - Current bill statuses

**These commits happen automatically**, so your local repo can be behind at any time.

## Best Practices

1. **Pull before you start working** - Run `git pull --rebase` at the beginning of each session
2. **Commit frequently** - Don't let changes pile up
3. **Use the safe commit script** - Let it handle the sync dance for you
4. **Check git status** - Know what state you're in before committing

## Handling "Push Rejected" Errors

If you see:
```
! [rejected]        main -> main (fetch first)
```

**Quick fix:**
```bash
git stash                    # Save your changes
git pull --rebase origin main # Get latest commits
git stash pop               # Restore your changes
git push origin main        # Try push again
```

**Or use the script:**
```bash
./scripts/git-safe-commit.sh "Your commit message"
```

## Preventing Future Issues

### Daily Routine
1. **Morning (before 9 AM EST)**: Pull latest changes
2. **After 9 AM EST**: Pull again to get monitoring updates
3. **Before committing**: Pull one more time

### Claude Code Integration

When working with Claude Code, it will handle git operations for you. If you see stash/rebase errors:
- Claude will automatically stash, pull, and restore your changes
- This is normal and expected with this project
- The workflow is designed to handle it

## Troubleshooting

**"Cannot pull with rebase: You have unstaged changes"**
```bash
git stash
git pull --rebase origin main
git stash pop
```

**Merge conflicts after stash pop**
```bash
# Edit conflicting files manually, then:
git add <resolved-files>
git stash drop
```

**Want to see what's on remote**
```bash
git fetch origin
git log HEAD..origin/main --oneline  # See commits you don't have
```

**Nuclear option (lose uncommitted changes)**
```bash
git reset --hard origin/main  # ⚠️ DESTRUCTIVE - loses uncommitted work
```

## Summary

The key to smooth git operations with this project:
- **Pull before you work**
- **Use the safe commit script** when possible
- **Understand that automated commits happen daily at 9 AM EST**
- **Don't fight git** - embrace the stash/pull/pop workflow

---

**Pro tip**: Bookmark this file for quick reference when you encounter git issues!
