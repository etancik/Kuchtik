# Recipe Cache Logging Reference

## Overview

The Recipe Management System provides comprehensive logging for all cache operations. This document shows you exactly what// 4. Delete operation (optimistic update)
🗑️ Deleting recipe: old-recipe.json
✅ Recipe deleted successfully
⚡ Performing optimistic delete update for: old-recipe.json
🗑️ Cleared cache for: old-recipe.json (was 45s old, 1 remaining)
⚡ Filtered out deleted recipe. Recipes: 2 → 1
⚡ UI updated optimistically - deleted recipe removed from display
⚡ Delete operation: optimistic update already performed, skipping immediate refresh

// 5. Delayed delete verification (background)
🔄 Executing delayed refresh attempt 1 for: old-recipe.json
✅ Recipe "old-recipe.json" delete confirmed, refreshing displayto expect and when they appear.

## 📋 **Complete Cache Logging Scenarios**

### 1. **Cache Hit (Using Cached Recipe)**
```javascript
💾 Using cached recipe: gulas.json (age: 45s, cache size: 3)
```
- **When**: Recipe exists in cache and is not expired
- **Info**: Shows recipe name, age in seconds, total cache size

### 2. **Cache Miss (Loading Fresh Recipe)**
```javascript
🌐 Loading recipe attempt 1 for: gulas.json
🔄 Loading with cache busting: https://raw.githubusercontent.com/.../gulas.json?t=1757774376636
✅ Recipe loaded successfully (strategy 1): gulas.json
💾 Cached recipe: gulas.json (cache size: 4)
```
- **When**: Recipe not in cache or cache expired
- **Strategy 1**: Cache busting with timestamp parameter
- **Info**: Shows loading strategy, URL with cache busting, success, and caching

## 📋 **Loading Strategies Explained**

When a recipe needs to be loaded fresh (cache miss), the system tries 3 strategies in order:

### **Strategy 1: Cache Busting** ⚡
```javascript
🔄 Loading with cache busting: https://raw.githubusercontent.com/.../gulas.json?t=1757774376636
```
- **URL**: `https://raw.githubusercontent.com/.../recipes/filename.json?t=TIMESTAMP`
- **Purpose**: Forces GitHub CDN to serve fresh content by adding timestamp
- **Timeout**: 8 seconds
- **Most Common**: Usually succeeds, bypasses CDN cache

### **Strategy 2: GitHub API** 🔗  
```javascript
🔗 Loading via GitHub API: https://api.github.com/repos/etancik/Kuchtik/contents/recipes/gulas.json
```
- **URL**: `https://api.github.com/repos/owner/repo/contents/recipes/filename.json`
- **Purpose**: Uses official GitHub API (more reliable than raw URLs)
- **Timeout**: 10 seconds
- **Content**: Base64 encoded, automatically decoded
- **Fallback**: When cache busting fails

### **Strategy 3: Standard Raw URL** 🌐
```javascript
🌐 Loading standard: https://raw.githubusercontent.com/etancik/Kuchtik/main/recipes/gulas.json
```
- **URL**: `https://raw.githubusercontent.com/.../recipes/filename.json` (no timestamp)
- **Purpose**: Original raw GitHub URL approach
- **Timeout**: 15 seconds (longest timeout for this fallback)
- **Last Resort**: When both other strategies fail

### 3. **Cache Expiration (Automatic Cleanup)**
```javascript
⏰ Cache expired for: gulas.json (age: 325s, removing)
🗑️ Removed expired cache entry: palacinky.json (expired 15s ago)
🧹 Cache cleanup: removed 2/5 entries (3 remaining)
```
- **When**: Recipe cache entry is older than 5 minutes
- **Info**: Shows what expired, when it expired, and cleanup summary

### 4. **Force Refresh (Bypassing Cache)**
```javascript
🔄 Force refresh requested, bypassing cache for: gulas.json
🌐 Loading recipe attempt 1 for: gulas.json
✅ Recipe loaded successfully (strategy 1): gulas.json
💾 Cached recipe: gulas.json (cache size: 3)
```
- **When**: `forceRefresh` parameter is true
- **Info**: Shows cache bypass, fresh loading, and re-caching

### 5. **Manual Cache Clearing (Single Recipe)**
```javascript
🗑️ Cleared cache for: gulas.json (was 125s old, 2 remaining)
```
- **When**: `clearRecipeCache('gulas.json')` is called
- **Info**: Shows what was cleared, how old it was, remaining count

### 6. **Manual Cache Clearing (All Recipes)**
```javascript
🗑️ Clearing all recipe cache (3 entries): gulas.json (45s old), palacinky.json (120s old), chleb.json (78s old)
🧹 Cache cleared completely
```
- **When**: `clearRecipeCache()` is called with no parameters
- **Info**: Lists all cached recipes with ages before clearing

### 7. **Operation-Triggered Cache Clear**
```javascript
🗑️ Cleared recipe cache due to operation: create
🔄 Refreshing recipes display...
🌐 Loading recipe attempt 1 for: new-recipe.json
```
- **When**: After create/update operations (deletes use optimistic updates)
- **Info**: Shows which operation triggered the clear

### 8. **Optimistic Delete Update**
```javascript
⚡ Performing optimistic delete update for: old-recipe.json
🗑️ Cleared cache for: old-recipe.json (was 125s old, 2 remaining)
⚡ Filtered out deleted recipe. Recipes: 3 → 2
⚡ UI updated optimistically - deleted recipe removed from display
⚡ Delete operation: optimistic update already performed, skipping immediate refresh
```
- **When**: Immediately after delete operations
- **Info**: Shows immediate UI update without waiting for GitHub confirmation

### 8. **Cache Miss (Recipe Not Cached)**
```javascript
🤷 Cache miss: unknown-recipe.json was not cached
```
- **When**: Trying to clear a specific recipe that wasn't cached
- **Info**: Confirms the recipe wasn't in cache

### 9. **Empty Cache Clear Attempt**
```javascript
🤷 Cache already empty
```
- **When**: Trying to clear all cache when it's already empty
- **Info**: Confirms cache state

## 🛠️ **Cache Status Debugging**

### Manual Cache Status Check
```javascript
// In browser console:
recipeUI.showCacheStatus();

// Output:
📊 Cache Status: {
  totalEntries: 3,
  validEntries: 3,
  expiredEntries: 0,
  cacheDurationMinutes: 5,
  entries: [
    { filename: 'gulas.json', ageSeconds: 45, remainingTime: 255, expired: false },
    { filename: 'palacinky.json', ageSeconds: 120, remainingTime: 180, expired: false },
    { filename: 'chleb.json', ageSeconds: 78, remainingTime: 222, expired: false }
  ]
}
```

## 🕐 **Cache Timeline Example**

Here's what you'd see during a typical usage session with strategy details:

```javascript
// 1. First load (cache miss) - Strategy 1 succeeds
🌐 Loading recipe attempt 1 for: gulas.json
🔄 Loading with cache busting: https://raw.githubusercontent.com/.../gulas.json?t=1757774376636
✅ Recipe loaded successfully (strategy 1): gulas.json
💾 Cached recipe: gulas.json (cache size: 1)

// 2. Second load within 5 minutes (cache hit)
💾 Using cached recipe: gulas.json (age: 30s, cache size: 1)

// 3. Load another recipe - Strategy 2 fallback example
🌐 Loading recipe attempt 1 for: palacinky.json
⚠️ Strategy 1 failed for palacinky.json: Cache-busted fetch failed
🌐 Loading recipe attempt 2 for: palacinky.json  
� Loading via GitHub API: https://api.github.com/repos/etancik/Kuchtik/contents/recipes/palacinky.json
✅ Recipe loaded successfully (strategy 2): palacinky.json
�💾 Cached recipe: palacinky.json (cache size: 2)

// 4. Edit operation (triggers cache clear)
🗑️ Cleared recipe cache due to operation: update
🔄 Force refresh requested, bypassing cache for: gulas.json
🌐 Loading recipe attempt 1 for: gulas.json
✅ Recipe loaded successfully (strategy 1): gulas.json
� Cached recipe: gulas.json (cache size: 1)
```

## 🔍 **Key Cache Settings**

```javascript
// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000; // 300,000ms

// Cleanup triggers:
- Automatic: Every time loadRecipe() is called
- Manual: clearRecipeCache() calls
- Operations: After create/update/delete
```

## 💡 **Debugging Tips**

### View Current Cache Status
```javascript
// In browser console:
recipeUI.showCacheStatus()
```

### Force Refresh Everything
```javascript
// In browser console:
recipeUI.forceRefresh()
```

### Monitor Cache in Real-Time
1. Open browser DevTools (F12)
2. Go to Console tab  
3. Look for emoji-prefixed cache messages:
   - 💾 = Cache operations
   - 🗑️ = Cache clearing
   - 🧹 = Cache cleanup
   - ⏰ = Cache expiration
   - 🔄 = Cache bypass/refresh

## 📊 **Cache Performance Indicators**

Good cache performance logs:
```javascript
💾 Using cached recipe: gulas.json (age: 30s, cache size: 3)  ← Cache hit!
```

Cache working hard:
```javascript
🌐 Loading recipe attempt 1 for: gulas.json                   ← Cache miss
🗑️ Removed expired cache entry: old-recipe.json              ← Cleanup
```

System optimization:
```javascript
🧹 Cache cleanup: removed 0/3 entries (3 remaining)          ← No expired entries
```

The logs provide complete visibility into when the cache is used, invalidated, and replaced! 🎯
