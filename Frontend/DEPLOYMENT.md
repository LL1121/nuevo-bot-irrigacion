# Deployment Runbook

## 🚀 Quick Deploy

```bash
# Production deployment (automated via GitHub Actions)
git checkout main
git pull origin main
git push origin main  # Triggers CI/CD pipeline

# Manual deployment (emergency only)
npm run build
rsync -avz --delete dist/ user@server:/var/www/irrigacion/
```

## 📋 Pre-Deployment Checklist

### Code Quality
- [ ] All tests pass: `npm run test -- --run`
- [ ] Linter passes: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] Bundle size <200KB (check CI logs)
- [ ] Coverage ≥80% (check `npm run test:coverage`)

### Security
- [ ] No secrets in code
- [ ] `.env.local` not committed
- [ ] Auth tokens validated
- [ ] CORS configured correctly
- [ ] Rate limiting enabled on API

### Configuration
- [ ] GitHub Secrets configured:
  - `VITE_API_URL`
  - `VITE_SOCKET_URL`
  - `VITE_SENTRY_DSN`
  - `SENTRY_AUTH_TOKEN`
  - `SENTRY_ORG`
  - `SENTRY_PROJECT`
- [ ] Environment variables match target (prod/staging)
- [ ] Sentry project exists and DSN valid

### Monitoring
- [ ] Sentry alerts configured
- [ ] Health check endpoint working
- [ ] Error tracking enabled

## 🔄 Deployment Workflows

### 1. Feature Development → Production

```mermaid
graph LR
    A[Feature Branch] --> B[PR to develop]
    B --> C[CI: Lint + Test]
    C --> D[Merge to develop]
    D --> E[PR to main]
    E --> F[CI: Lint + Test + Build]
    F --> G[Merge to main]
    G --> H[CD: Deploy to Production]
    H --> I[Health Check]
    I --> J[Sentry Release]
```

**Steps:**
1. Create feature branch: `git checkout -b feature/new-thing`
2. Develop + commit changes
3. Open PR to `develop` → CI runs
4. Merge to `develop` after approval
5. Test on staging environment
6. Open PR to `main` → CI runs + Lighthouse
7. Merge to `main` → CD deploys automatically
8. Monitor Sentry for errors

### 2. Hotfix (Emergency)

```bash
# 1. Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-bug

# 2. Fix the bug + commit
git commit -m "fix: critical issue with auth"

# 3. Push and open PR to main
git push origin hotfix/critical-bug
# Open PR → CI runs

# 4. After merge, deployment triggers automatically
# 5. Monitor Sentry dashboard for 10 minutes
```

## 🏥 Health Monitoring

### After Deployment

Check these metrics within 5 minutes:

```bash
# 1. Site is accessible
curl -I https://irrigacion.com.ar
# Expected: HTTP/2 200

# 2. Assets load
curl -I https://irrigacion.com.ar/assets/index-*.js
# Expected: HTTP/2 200

# 3. Check Sentry dashboard
# https://sentry.io/organizations/<org>/issues/
# Look for new errors in last 5 minutes
```

### Key Metrics
- **Response Time**: <2 seconds
- **Error Rate**: <1% of requests
- **Uptime**: 99.9%
- **FCP** (First Contentful Paint): <2s
- **LCP** (Largest Contentful Paint): <2.5s

## 🔙 Rollback Procedures

### Scenario 1: Build Fails
**Symptom**: CI/CD pipeline fails during build step
**Action**: Fix build error and push again
```bash
# Check CI logs for error
# Fix locally and test
npm run build
git commit -m "fix: build error"
git push origin main  # Re-triggers CI/CD
```

### Scenario 2: Tests Fail in Production
**Symptom**: Deployment succeeds but critical feature broken
**Action**: Revert to previous commit
```bash
# Option A: Revert last commit
git revert HEAD
git push origin main  # Deploys previous version

# Option B: Revert specific commit
git revert <commit-sha>
git push origin main
```

### Scenario 3: Errors Spike in Sentry
**Symptom**: Error rate >5% in Sentry dashboard
**Action**: Immediate rollback
```bash
# 1. Find last stable release
git tag
# Example: v1.2.3

# 2. Create rollback branch
git checkout v1.2.3
git checkout -b rollback/to-v1.2.3

# 3. Force push to main (emergency only!)
# OR open PR for rollback (safer)

# 4. Investigate issue offline
git checkout main
git log --oneline -10  # Find problematic commit
```

### Scenario 4: Performance Degradation
**Symptom**: Lighthouse score drops, site slow
**Action**: Check recent changes
```bash
# 1. Compare bundle sizes
git show main~1:package-lock.json > old.json
git show main:package-lock.json > new.json
diff old.json new.json | grep "resolved"

# 2. If new dependency caused it, remove
npm uninstall <heavy-package>
git commit -m "perf: remove heavy dependency"
git push origin main

# 3. If code change, profile and optimize
npm run build -- --mode=profile
# Check dist/assets/*.js sizes
```

## 📊 Monitoring Dashboards

### Sentry
- **URL**: https://sentry.io/organizations/<org>/projects/<project>/
- **What to watch**: Error rate, new issues, release health
- **Alert threshold**: >10 errors/min

### Lighthouse CI
- **URL**: GitHub Actions → Lighthouse CI workflow
- **What to watch**: Performance score, accessibility, FCP/LCP
- **Alert threshold**: Performance <90

### Server Logs
```bash
# SSH to server
ssh user@server

# Check nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# Check application logs (if using PM2)
pm2 logs irrigacion-frontend
```

## 🐛 Debugging Production Issues

### Step 1: Check Sentry
- Go to Sentry dashboard
- Filter by release: `main-<commit-sha>`
- Look at error stack traces (source maps uploaded)
- Check user context (browser, OS, user agent)

### Step 2: Reproduce Locally
```bash
# Use production build locally
npm run build
npm run preview

# Check browser console for errors
# Test with different browsers
```

### Step 3: Check Build Artifacts
```bash
# Download artifacts from GitHub Actions
# Go to Actions → Deploy to Production → Artifacts

# Inspect bundle contents
npx vite-bundle-visualizer dist/stats.html
```

### Step 4: Hotfix or Rollback?
- **Hotfix**: Issue affects <10% users, clear fix
- **Rollback**: Issue affects >10% users, unclear fix

## 🔐 Secrets Management

### Adding New Secret

```bash
# 1. Go to GitHub repo → Settings → Secrets and variables → Actions
# 2. Click "New repository secret"
# 3. Name: VITE_NEW_SECRET
# 4. Value: <secret-value>
# 5. Click "Add secret"

# 6. Update workflow file to use it
# .github/workflows/deploy-production.yml
env:
  VITE_NEW_SECRET: ${{ secrets.VITE_NEW_SECRET }}
```

### Rotating Secrets

```bash
# 1. Generate new secret (e.g., new Sentry DSN)
# 2. Update GitHub Secret
# 3. Trigger deployment (don't need code change)
# 4. Verify new secret works in production
# 5. Revoke old secret
```

## 📞 Emergency Contacts

| Role | Contact | When to Call |
|------|---------|-------------|
| **DevOps Lead** | @lautaro | Site down, deployment failed |
| **Backend Team** | #backend-channel | API errors, auth issues |
| **Frontend Team** | #frontend-channel | UI bugs, performance |
| **On-Call** | PagerDuty | After hours, critical outage |

## 📚 Additional Resources

- [CI/CD Workflows](.github/workflows/)
- [Environment Variables](README.md#environment-variables)
- [Testing Guide](README.md#testing)
- [Performance Guide](README.md#performance-optimization)
- [Sentry Documentation](https://docs.sentry.io/)
