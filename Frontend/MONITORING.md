# Monitoring & Analytics Setup

## 🎯 Overview

Sistema completo de monitoreo y analytics usando:
- **Sentry** — Error tracking + Performance monitoring
- **Web Vitals** — Core Web Vitals (CLS, FID, FCP, LCP, TTFB)
- **Custom Events** — User actions, features, API calls
- **Real-time Dashboard** — Dev-only metrics overlay

## 📊 Sentry Configuration

### Required Environment Variables

```env
VITE_SENTRY_DSN=https://your-key@o123456.ingest.sentry.io/789012
VITE_ENABLE_SENTRY=true
VITE_NODE_ENV=production
```

### Features Enabled

1. **Error Tracking** — Automatic capture of uncaught errors
2. **Performance Tracing** — API calls, page loads, transactions
3. **Breadcrumbs** — User actions leading up to errors
4. **Release Tracking** — Source maps uploaded via CI/CD
5. **User Context** — Associated with operador ID

### Sample Rate

- **Production**: 10% of transactions (cost optimization)
- **Development**: 100% of transactions (full visibility)

## 🚀 Usage Examples

### Track Custom Events

```typescript
import { trackEvent, trackAction, trackFeatureUsage } from '@/utils/monitoring';

// Generic event
trackEvent({
  name: 'button_clicked',
  properties: {
    button_id: 'send_message',
    location: 'chat_window',
  },
});

// User action
trackAction('send_message', {
  message_length: 150,
  has_attachment: false,
});

// Feature usage
trackFeatureUsage('emoji_picker', {
  emoji_count: 1,
});
```

### Track API Performance

```typescript
import { trackApiCall } from '@/utils/monitoring';

const start = performance.now();
const response = await fetch('/api/messages');
const duration = performance.now() - start;

trackApiCall('/api/messages', duration, response.status);
```

### Track Page Views

```typescript
import { usePageTracking } from '@/hooks/usePageTracking';

function App() {
  usePageTracking(); // Auto-tracks on route change
  return <Routes>...</Routes>;
}
```

### Track Component Performance

```typescript
import { usePerformance } from '@/hooks/usePerformance';

function HeavyComponent() {
  usePerformance({ 
    componentName: 'HeavyComponent', 
    threshold: 100 // Warn if render >100ms
  });
  
  return <div>...</div>;
}
```

### Set User Context

```typescript
import { setUserContext, clearUserContext } from '@/utils/monitoring';

// On login
setUserContext(operador.id, operador);

// On logout
clearUserContext();
```

### Track WebSocket Events

```typescript
import { trackSocketEvent } from '@/utils/monitoring';

socket.on('message', (data) => {
  trackSocketEvent('message_received', {
    message_id: data.id,
    from_user: data.from,
  });
});
```

## 📈 Web Vitals

Automatically tracked metrics:

| Metric | What it measures | Good | Needs Improvement | Poor |
|--------|------------------|------|-------------------|------|
| **CLS** | Cumulative Layout Shift | <0.1 | 0.1-0.25 | >0.25 |
| **FID** | First Input Delay | <100ms | 100-300ms | >300ms |
| **FCP** | First Contentful Paint | <1.8s | 1.8-3s | >3s |
| **LCP** | Largest Contentful Paint | <2.5s | 2.5-4s | >4s |
| **TTFB** | Time to First Byte | <800ms | 800-1800ms | >1800ms |

### Viewing Web Vitals in Sentry

1. Go to **Performance** tab in Sentry dashboard
2. Select **Web Vitals** view
3. Filter by page, device, browser
4. Set up alerts for poor ratings

## 🛠️ Dev Tools

### Metrics Dashboard (Dev Only)

Press **Ctrl+Shift+M** to toggle real-time metrics overlay:

```
⚡ Web Vitals
🟢 CLS   0.045
🟢 FID   12ms
🟢 FCP   850ms
🟡 LCP   2.8s
🟢 TTFB  150ms
```

Color coding:
- 🟢 Green = Good
- 🟡 Yellow = Needs Improvement
- 🔴 Red = Poor

### Browser DevTools

Open React DevTools Profiler to see:
- Component render times
- Re-render causes
- Commit flamegraph

## 🔔 Alerting

### Sentry Alerts Setup

1. Go to **Alerts** → **Create Alert**
2. Choose alert type:
   - **Error rate** — >10 errors/min
   - **Performance** — P95 response time >2s
   - **Web Vitals** — LCP >4s
3. Configure notification channels:
   - Email
   - Slack webhook
   - PagerDuty
   - Discord webhook

### Example Alert Rules

```yaml
# High Error Rate
Condition: error count > 50 in 5 minutes
Action: Notify #alerts channel on Slack

# Slow API Response
Condition: p95 duration > 2000ms for endpoint /api/messages
Action: Email devops@example.com

# Poor Web Vitals
Condition: LCP > 4s for >20% of users
Action: Create GitHub issue
```

### Slack Webhook Integration

```bash
# Add to GitHub Secrets
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

Update `.github/workflows/deploy-production.yml`:

```yaml
- name: Notify Slack on deployment
  run: |
    curl -X POST ${{ secrets.SLACK_WEBHOOK_URL }} \
    -H 'Content-Type: application/json' \
    -d '{
      "text": "🚀 Frontend deployed to production",
      "blocks": [{
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "*Deployment Successful*\nVersion: ${{ github.sha }}\nEnvironment: production"
        }
      }]
    }'
```

## 📊 Custom Dashboards

### Sentry Dashboard Widgets

Create custom dashboard with:

1. **Error Trends** — Errors over time by release
2. **Performance by Endpoint** — P50/P75/P95 response times
3. **Web Vitals** — CLS, FID, LCP trends
4. **User Flows** — Common paths through app
5. **Release Health** — Crash-free sessions %

### Grafana Integration (Optional)

Export Sentry metrics to Grafana:

```yaml
# docker-compose.yml
grafana:
  image: grafana/grafana:latest
  environment:
    - GF_INSTALL_PLUGINS=grafana-sentry-datasource
  ports:
    - 3001:3000
```

## 🧪 Testing Monitoring

### Test Error Tracking

```typescript
// test-monitoring.ts
import { captureException, captureMessage } from '@/utils/logger';

// Test error capture
try {
  throw new Error('Test error from monitoring');
} catch (err) {
  captureException(err, { test: true });
}

// Test message capture
captureMessage('Test monitoring message', 'warning');
```

### Test Performance Tracking

```typescript
import { trackApiCall, trackComponentRender } from '@/utils/monitoring';

// Simulate slow API
trackApiCall('/api/test', 2500, 200); // Should alert if >2s

// Simulate slow render
trackComponentRender('TestComponent', 150); // Should warn if >100ms
```

## 📚 Best Practices

### Do's ✅

- Track user flows and funnels
- Set context before errors occur
- Use breadcrumbs for debugging
- Monitor API response times
- Track feature adoption
- Set up alerts for critical metrics
- Review Sentry weekly
- Clean up old releases

### Don'ts ❌

- Don't track PII (emails, passwords)
- Don't log sensitive data
- Don't track every single event (noise)
- Don't ignore performance warnings
- Don't disable Sentry in production
- Don't forget to upload source maps
- Don't set sample rate to 100% in prod

## 🔍 Debugging with Sentry

### Issue Investigation Workflow

1. **Open Issue in Sentry** — Click on error in dashboard
2. **Check Stack Trace** — Source maps show original code
3. **Review Breadcrumbs** — User actions leading to error
4. **Check User Context** — Browser, OS, user ID
5. **Find Related Issues** — Similar errors in same release
6. **Check Performance** — Was the app slow?
7. **Reproduce Locally** — Use breadcrumbs to recreate

### Example Sentry Issue

```
Error: Cannot read property 'id' of undefined
  at ChatWindow.tsx:45:20
  at updateMessage (api.ts:120:15)

Breadcrumbs:
  1. User clicked "Send Message"
  2. API call to /api/messages (200 OK, 150ms)
  3. Socket event: message_received
  4. Error: Cannot read property 'id' of undefined

User Context:
  ID: user-12345
  Browser: Chrome 120.0
  OS: Windows 11
  Release: main-a1b2c3d
```

## 🚨 Performance Budget

Target metrics to maintain:

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Bundle Size (gzipped) | <200KB | >250KB |
| Time to Interactive | <3s | >5s |
| First Contentful Paint | <1.5s | >2.5s |
| Largest Contentful Paint | <2.5s | >4s |
| API Response (P95) | <1s | >2s |
| Error Rate | <0.1% | >1% |
| Crash-Free Sessions | >99.9% | <99% |

## 📖 Additional Resources

- [Sentry Documentation](https://docs.sentry.io/)
- [Web Vitals Guide](https://web.dev/vitals/)
- [Performance Monitoring](https://docs.sentry.io/product/performance/)
- [Alerts Documentation](https://docs.sentry.io/product/alerts/)
- [React Profiler](https://react.dev/reference/react/Profiler)
