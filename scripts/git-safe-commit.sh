#!/bin/bash
# Safe commit script that handles automated remote commits gracefully
# Usage: ./scripts/git-safe-commit.sh "Your commit message"

set -e  # Exit on error

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

COMMIT_MSG="$1"

if [ -z "$COMMIT_MSG" ]; then
    echo "Error: Commit message required"
    echo "Usage: ./scripts/git-safe-commit.sh \"Your commit message\""
    exit 1
fi

echo "🔄 Starting safe commit process..."

# Step 1: Check for uncommitted changes
if git diff --quiet && git diff --staged --quiet; then
    echo "✅ No changes to commit"
    exit 0
fi

# Step 2: Stash any uncommitted changes temporarily
echo "📦 Stashing uncommitted changes..."
git stash push -u -m "temp-stash-for-safe-commit"
STASHED=$?

# Step 3: Pull latest changes from remote
echo "⬇️  Pulling latest changes from remote..."
git pull --rebase origin main

# Step 4: Restore stashed changes
if [ $STASHED -eq 0 ]; then
    echo "📤 Restoring your changes..."
    git stash pop
fi

# Step 5: Show what's changed
echo ""
echo "📝 Changes to be committed:"
git status --short

# Step 6: Add all changes
echo ""
read -p "Add all changes and commit? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git add -A

    # Step 7: Create commit
    git commit -m "$(cat <<EOF
$COMMIT_MSG

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"

    # Step 8: Push to remote
    echo "⬆️  Pushing to remote..."
    git push origin main

    echo "✅ Successfully committed and pushed!"
else
    echo "❌ Commit cancelled"
    exit 1
fi
