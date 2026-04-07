# API Versioning & Documentation

Complete API client with versioning, typed endpoints, and breaking change tracking.

## 📋 Overview

- **v1**: Deprecated, will be removed June 2026
- **v2**: Current version with new features and breaking changes
- **Types**: Shared types across all versions in `src/api/types/`

## 🏗️ Structure

```
src/api/
├── types/
│   ├── common.ts          # Shared types (User, Chat, Message, etc)
│   └── index.ts
├── v1/
│   └── index.ts           # Deprecated endpoints
├── v2/
│   └── index.ts           # Current endpoints
└── client/
    └── index.ts           # Version manager and breaking changes
```

## 📚 Type System

### Shared Types

All versions share base types from `src/api/types/`:

```typescript
import { User, Chat, Message, AuthToken, ApiResponse } from '@/api/types';

// Use in any version
const response: ApiResponse<User> = await v2.getCurrentUser(token);
```

### Response Wrapper

Every API response follows this structure:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: {
    timestamp: string;
    version: string;
    requestId: string;
  };
}
```

### Paginated Responses

```typescript
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
```

## 🔄 API Versions

### v1 (DEPRECATED)

**Status**: ⚠️ End of life June 1, 2026

Endpoints:
- `login(email, password)` - ⚠️ Use v2 instead
- `refreshToken(token)` - ⚠️ Use v2 instead
- `getCurrentUser(token)`
- `getPaginatedChats(token, page, pageSize)` - ⚠️ Different in v2
- `getChat(chatId, token)`
- `createChat(token, data)`
- `getChatMessages(chatId, token, page)`
- `sendMessage(chatId, token, content)`

```typescript
import { v1 } from '@/api/client';

// ⚠️ Don't use - migrate to v2
const result = await v1.login(email, password);
```

### v2 (CURRENT)

**Status**: ✅ Active and recommended

**New in v2**:
- `getPaginatedChats()` - Added sorting parameters
- `deleteChat(chatId, token)` - New endpoint
- `getControlActions(deviceId, token)` - New for irrigation controls
- `executeSensorRead(deviceId, token)` - New for sensor readings

**Performance improvements**:
- API calls tracked with monitoring
- Request times measured automatically
- Error tracking integrated with Sentry

#### Auth Endpoints

```typescript
import * as api from '@/api/client'; // or import { v2 } from '@/api/client'

// Login
const { data: { accessToken, refreshToken } } = await api.login(email, password);

// Refresh token (BREAKING CHANGE from v1)
const { data: newToken } = await api.refreshToken(refreshToken);
// v1 used POST /v1/auth/refresh with token in header
// v2 uses POST /v2/auth/token with refreshToken in body

// Get current user
const { data: user } = await api.getCurrentUser(accessToken);
```

#### Chat Endpoints

```typescript
// Get paginated chats (with new sorting in v2)
const { data } = await api.getPaginatedChats(
  token,
  1,           // page
  10,          // pageSize
  'updatedAt', // sortBy (NEW in v2)
  'desc',      // order (NEW in v2)
);

// Get single chat
const { data: chat } = await api.getChat(chatId, token);

// Create chat
const { data: newChat } = await api.createChat(token, {
  title: 'My Chat',
  description: 'Optional description',
});

// Delete chat (NEW in v2)
await api.deleteChat(chatId, token);

// Get messages
const { data: messages } = await api.getChatMessages(chatId, token, 1);

// Send message
const { data: message } = await api.sendMessage(chatId, token, 'Hello!');
```

#### Control Endpoints (NEW in v2)

```typescript
// Get device control actions
const { data: actions } = await api.getControlActions(deviceId, token, 1);

// Execute sensor read
const { data: reading } = await api.executeSensorRead(deviceId, token);
```

## 🔀 Migration Guide: v1 → v2

### ⚠️ Breaking Changes

#### 1. Chat Object Structure

**Before (v1)**:
```typescript
const chat: Chat = {
  id: '123',
  title: 'My Chat',
  messageCount: 42, // ← Direct property
};
```

**After (v2)**:
```typescript
const chat: Chat = {
  id: '123',
  title: 'My Chat',
  stats: {
    messageCount: 42, // ← Inside stats object
  }
};
```

**Migration**:
```typescript
// OLD CODE
console.log(chat.messageCount); // 42

// NEW CODE
console.log(chat.stats?.messageCount); // 42
```

#### 2. Token Refresh Endpoint

**Before (v1)**:
```typescript
const response = await fetch(`${API_URL}/v1/auth/refresh`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});
```

**After (v2)**:
```typescript
const response = await fetch(`${API_URL}/v2/auth/token`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    refreshToken: refreshToken, // ← Different payload
  }),
});
```

**Migration**:
```typescript
// OLD CODE
import { v1 } from '@/api/client';
const { data: token } = await v1.refreshToken(accessToken);

// NEW CODE
import * as api from '@/api/client';
const { data: token } = await api.refreshToken(refreshToken);
```

#### 3. Chat Sorting Parameters

**Before (v1)**:
```typescript
// No sorting options
const { data } = await v1.getPaginatedChats(token, 1, 10);
```

**After (v2)**:
```typescript
// New optional sorting parameters
const { data } = await api.getPaginatedChats(
  token,
  1,
  10,
  'createdAt', // NEW: 'createdAt' | 'updatedAt' | 'title'
  'desc',      // NEW: 'asc' | 'desc'
);
```

## 📊 Usage Examples

### Example: Login Flow

```typescript
import * as api from '@/api/client';

async function handleLogin(email: string, password: string) {
  try {
    // 1. Login
    const { data, error } = await api.login(email, password);
    
    if (error) {
      console.error('Login failed:', error.message);
      return;
    }
    
    // 2. Store tokens
    localStorage.setItem('accessToken', data!.accessToken);
    localStorage.setItem('refreshToken', data!.refreshToken);
    
    // 3. Get user profile
    const { data: user } = await api.getCurrentUser(data!.accessToken);
    
    return user;
  } catch (err) {
    console.error('Login error:', err);
  }
}
```

### Example: Fetch Chats with Sorting

```typescript
import * as api from '@/api/client';

async function loadChats(token: string, sortBy: 'createdAt' | 'updatedAt' = 'updatedAt') {
  const { data, error } = await api.getPaginatedChats(
    token,
    1,       // page
    15,      // pageSize
    sortBy,  // Sort by created, updated, or title
    'desc',  // Descending order
  );
  
  if (error) {
    console.error('Failed to load chats:', error.message);
    return [];
  }
  
  return data!.items;
}
```

### Example: Monitor API Performance

```typescript
import * as api from '@/api/client';
import { trackApiCall } from '@/utils/monitoring';

// API v2 already tracks calls automatically!
const { data } = await api.getPaginatedChats(token, 1, 10);
// Automatically logged:
// - Endpoint: GET /v2/chats
// - Duration: XXms
// - Status: success or error
```

## 🔍 Version Detection

Check API version info at runtime:

```typescript
import { API_VERSIONS, BREAKING_CHANGES } from '@/api/client';

// Get version info
console.log(API_VERSIONS.v2.status); // "CURRENT"
console.log(API_VERSIONS.v1.supportedUntil); // "2026-06-01"

// Get breaking changes for migration
const changes = BREAKING_CHANGES.v1_to_v2;
changes.forEach(change => {
  console.log(`${change.endpoint}: ${change.impact}`);
  console.log(`Migration: ${change.migration}`);
});
```

## 📈 Error Handling

All API functions throw errors with context:

```typescript
import * as api from '@/api/client';

try {
  const { data } = await api.getChat(chatId, token);
} catch (error) {
  if (error instanceof Error) {
    console.error('API Error:', error.message);
    // "API v2 Error: HTTP 404"
  }
}
```

## 🧪 Testing

Mock API responses:

```typescript
import { describe, it, expect, vi } from 'vitest';
import * as api from '@/api/client';

describe('API v2', () => {
  it('should login successfully', async () => {
    // Mock fetch
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            accessToken: 'token123',
            refreshToken: 'refresh123',
            expiresIn: 3600,
            tokenType: 'Bearer',
          },
        }),
      } as Response),
    );

    const { data } = await api.login('user@example.com', 'password');
    expect(data?.accessToken).toBe('token123');
  });
});
```

## 📝 Changelog

### v2.0.0 (2026-01-15) - Current

**Breaking Changes**:
- Chat object structure changed (messageCount → stats.messageCount)
- Token refresh endpoint changed (v1/auth/refresh → v2/auth/token)
- Different payload for refresh token (header → body)

**New Features**:
- Chat sorting with `sortBy` and `order` parameters
- Delete chat endpoint
- Control actions API
- Sensor reading API
- Automatic API performance tracking
- Error codes and details

**Improvements**:
- Better error messages with request IDs
- API version in response metadata
- Consistent response structure

### v1.0.0 (2025-06-01) - DEPRECATED ⚠️

Initial release. Support ends June 1, 2026.

## 🚀 Best Practices

1. **Always import from `/api/client`** instead of individual version folders
2. **Use v2** for new features
3. **Update v1 calls** when you encounter them during development
4. **Handle errors** with try-catch or check response.error
5. **Log breaking change impacts** when migrating code
6. **Test API calls** with mock responses before deploying

## 🔗 Related Documentation

- [MONITORING.md](../MONITORING.md) - Track API performance
- [src/config/auth.ts](../../config/auth.ts) - Authentication setup
- [src/api/types/](./types/) - Complete type definitions
