# Vercel Deployment Guide

## Prerequisites
- GitHub account
- Vercel account (sign up at vercel.com)
- Push your code to GitHub repository

## Step-by-Step Deployment

### 1. Push Code to GitHub

```bash
cd /home/dhruv/Documents/1.Projects/grievance-detection/grievance-detection/frontend

# Initialize git if not already done
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Frontend ready for deployment"

# Add your GitHub repository as remote
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Push to GitHub
git push -u origin main
```

### 2. Deploy to Vercel

**Option A: Using Vercel CLI (Recommended)**

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Deploy (run from frontend directory)
cd /home/dhruv/Documents/1.Projects/grievance-detection/grievance-detection/frontend
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? (Select your account)
# - Link to existing project? No
# - Project name? grievance-detection-frontend
# - Directory? ./
# - Override settings? No

# Deploy to production
vercel --prod
```

**Option B: Using Vercel Dashboard**

1. Go to https://vercel.com/dashboard
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend` (if monorepo) or `./` (if separate repo)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
5. Add Environment Variable:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://grievance-detection-api.dhruvsen24.workers.dev/api`
6. Click "Deploy"

### 3. Post-Deployment Configuration

After deployment, Vercel will give you a URL like:
```
https://grievance-detection-frontend.vercel.app
```

**Important: Update CORS in Backend**

Your backend needs to allow the Vercel URL. Update your backend CORS settings:

```javascript
// In backend/src/index.js
const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://grievance-detection-frontend.vercel.app',
    // Or use '*' for all origins (less secure)
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
```

Then redeploy backend:
```bash
cd /home/dhruv/Documents/1.Projects/grievance-detection/grievance-detection/backend
npx wrangler deploy
```

### 4. Custom Domain (Optional)

1. Go to your Vercel project settings
2. Navigate to "Domains"
3. Add your custom domain
4. Follow Vercel's DNS configuration instructions

### 5. Environment Variables on Vercel

If you need to update environment variables:

1. Go to Vercel Dashboard → Your Project
2. Navigate to "Settings" → "Environment Variables"
3. Add/Edit:
   - `VITE_API_URL`: Your backend API URL
4. Redeploy the project

### 6. Automatic Deployments

Vercel automatically deploys when you push to GitHub:
- **Push to `main` branch** → Production deployment
- **Push to other branches** → Preview deployment

### 7. Testing Deployment

After deployment:

1. Visit your Vercel URL
2. Test registration: Create a new user
3. Test login: Login with created credentials
4. Test grievance submission: Submit text grievances
5. Test PDF upload: Upload a PDF file
6. Verify data in Cloudflare Dashboard

### 8. Monitoring & Logs

- **View deployment logs**: Vercel Dashboard → Deployments → Select deployment
- **View runtime logs**: Vercel Dashboard → Your Project → Logs
- **Analytics**: Vercel Dashboard → Your Project → Analytics

## Troubleshooting

### Build Fails
```bash
# Test build locally first
npm run build

# Check for errors
# Fix any import errors or missing dependencies
```

### API Calls Failing
- Verify `VITE_API_URL` environment variable is set correctly
- Check browser console for CORS errors
- Verify backend is deployed and accessible

### 404 on Refresh
- Ensure `vercel.json` has the rewrites configuration
- All routes should redirect to `/index.html` for SPA routing

### Environment Variables Not Working
- Environment variable names must start with `VITE_`
- After changing env vars, redeploy the project
- Check if `.env` is in `.gitignore` (it should be)

## Useful Commands

```bash
# Check deployment status
vercel ls

# View logs
vercel logs

# Open project in browser
vercel open

# Remove deployment
vercel remove [deployment-url]

# Link local project to Vercel project
vercel link
```

## Production Checklist

- [ ] Code pushed to GitHub
- [ ] `.env` is in `.gitignore`
- [ ] Environment variables set in Vercel
- [ ] Backend CORS updated with Vercel URL
- [ ] Build succeeds locally (`npm run build`)
- [ ] All routes tested on deployed site
- [ ] Error handling tested
- [ ] Mobile responsiveness checked

## Support

- Vercel Documentation: https://vercel.com/docs
- Vercel Community: https://github.com/vercel/vercel/discussions
- Your Backend API: https://grievance-detection-api.dhruvsen24.workers.dev
