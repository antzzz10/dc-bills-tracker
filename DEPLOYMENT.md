# Deploying to GitHub Pages

This guide will walk you through deploying your DC Bills Tracker to GitHub Pages.

## Prerequisites

1. A GitHub account (create one at https://github.com if you don't have one)
2. Git installed on your computer (you already have this set up!)

## Step-by-Step Deployment Instructions

### Step 1: Create a GitHub Repository

1. Go to https://github.com and log in
2. Click the "+" icon in the top right corner
3. Select "New repository"
4. Repository settings:
   - **Repository name:** `dc-bills-tracker` (must match exactly)
   - **Description:** Anti-DC Bills Tracker - Bills pending in Congress
   - **Public** (select this option)
   - **DO NOT** check "Initialize with README" (we already have files)
5. Click "Create repository"

### Step 2: Connect Your Local Project to GitHub

After creating the repository, GitHub will show you some commands. Open Terminal and run these commands in your project directory:

```bash
# Make sure you're in the project directory
cd /Users/andriathomas/Projects/dc-bills-tracker

# Add all files to git
git add .

# Create your first commit
git commit -m "Initial commit - DC Bills Tracker"

# Add the GitHub repository as remote (replace YOUR_USERNAME with your actual GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/dc-bills-tracker.git

# Rename the default branch to main (if needed)
git branch -M main

# Push your code to GitHub
git push -u origin main
```

**Important:** Replace `YOUR_USERNAME` with your actual GitHub username in the commands above!

### Step 3: Deploy to GitHub Pages

Once your code is pushed to GitHub, deploy the site:

```bash
npm run deploy
```

This command will:
- Build your project
- Create a `gh-pages` branch
- Deploy the built files to that branch

### Step 4: Enable GitHub Pages (if needed)

1. Go to your repository on GitHub
2. Click "Settings" (in the top menu)
3. Click "Pages" (in the left sidebar)
4. Under "Source", make sure it says:
   - Branch: `gh-pages`
   - Folder: `/ (root)`
5. Click "Save" if needed

### Step 5: Access Your Published Site

After a few minutes, your site will be live at:

```
https://YOUR_USERNAME.github.io/dc-bills-tracker/
```

Replace `YOUR_USERNAME` with your GitHub username.

## Updating Your Site

Whenever you make changes to the site:

```bash
# Save your changes
git add .
git commit -m "Description of your changes"
git push origin main

# Deploy the updates
npm run deploy
```

The site will update automatically within a few minutes!

## Troubleshooting

### Site shows a blank page
- Make sure the `base` in `vite.config.js` matches your repository name
- Check that your repository name is exactly `dc-bills-tracker`

### 404 errors
- Wait a few minutes after deploying
- Clear your browser cache
- Check that GitHub Pages is enabled in repository settings

### Need to change the repository name?
If you named your repository something different than `dc-bills-tracker`, update the `base` in `vite.config.js`:

```javascript
base: '/YOUR-REPO-NAME/',
```

## Using a Custom Domain (Optional)

If you want to use your own domain (like `dcbillstracker.com`):

1. Buy a domain from a registrar (GoDaddy, Namecheap, etc.)
2. In your repository settings → Pages → Custom domain, enter your domain
3. Follow GitHub's instructions to configure DNS

## Questions?

- GitHub Pages documentation: https://docs.github.com/en/pages
- Git basics: https://docs.github.com/en/get-started/using-git
