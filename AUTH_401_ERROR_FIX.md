# 🔐 401 Unauthorized Error - Fix Guide

## 🐛 Problem

```
GET /api/shops/me 401
GET /api/shops/me/bookings 401
```

**Error 401 = Missing or Invalid Authentication Token**

---

## 🔍 Root Cause

These endpoints require authentication:
```
requireAuth middleware
    ↓
Reads Authorization header
    ↓
Looks for Bearer token
    ↓
If missing → 401 error
```

---

## ✅ Solution

### Option 1: Add Bearer Token in Postman (Recommended)

**Step 1: Login to get token**
```bash
POST /api/auth/login
Body: {
  "email": "shop@example.com",
  "password": "password123"
}

Response:
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Step 2: Copy the token**

**Step 3: Add to Postman Collection**

**In Postman:**
1. Select your collection
2. Go to **Authorization** tab
3. Select **Bearer Token**
4. Paste your token
5. All requests in collection will now include it

**Alternative - Per Request:**
1. Select request
2. Go to **Headers**
3. Add:
   ```
   Authorization: Bearer YOUR_TOKEN_HERE
   ```

---

### Option 2: Get Token from Login Response

If using POSTMAN_COLLECTION_QUANTITY_SLOTS.json:

**Add login request FIRST:**
```json
{
  "name": "0. Login (GET TOKEN)",
  "request": {
    "method": "POST",
    "url": "http://localhost:5050/api/auth/login",
    "body": {
      "mode": "raw",
      "raw": "{\n  \"email\": \"shop@example.com\",\n  \"password\": \"password123\"\n}"
    }
  }
}
```

Then use response token for other requests.

---

## 🧪 Test: Verify Token Works

**With Token ✅**
```bash
curl -X GET http://localhost:5050/api/shops/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

Response: 200 OK ✅
{
  "success": true,
  "data": { ... }
}
```

**Without Token ❌**
```bash
curl -X GET http://localhost:5050/api/shops/me

Response: 401 Unauthorized ❌
{
  "message": "No token provided"
}
```

---

## 🛠️ Fix for Postman Collection

### Method 1: Add Token to All Requests

1. Open collection
2. **Collection → Authorization**
3. Select **Bearer Token**
4. Enter token
5. Save

✅ All requests inherit this token!

### Method 2: Use Pre-request Script

**Collection → Pre-request Script:**
```javascript
// Automatically add token if available
if (pm.environment.get("token")) {
  pm.request.headers.add({
    key: "Authorization",
    value: "Bearer " + pm.environment.get("token")
  });
}
```

---

## 📝 Environment Variables (Optional)

**Step 1: Create Environment**
1. Postman → Environments → Create
2. Name: `Local Dev`

**Step 2: Add Variables**
```
token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
baseUrl: http://localhost:5050
shopId: 2
fieldCode: 68
```

**Step 3: Use in Requests**
```
{{baseUrl}}/api/shops/me
Authorization: Bearer {{token}}
```

---

## 🔑 Where to Get Token

### From Backend Logs

When you login, backend logs show:
```
[AUTH] Token generated for user: UserID
```

Check your backend terminal for the token.

### From Browser Local Storage

If logged in via web:
```javascript
// Open browser console
localStorage.getItem('token')
// Copy the value
```

### From Test User

Use a test account:
```
Email: shop@example.com
Password: password123
```

Login endpoint will return token.

---

## 🚨 Common Issues

### Issue: "Invalid Token"

**Cause:** Token expired or malformed

**Solution:**
1. Get new token from login
2. Replace old token
3. Try again

### Issue: "Token not provided"

**Cause:** Authorization header missing

**Solution:**
1. Add header: `Authorization: Bearer TOKEN`
2. Check for typos
3. Verify token format

### Issue: Different token for different users

**Cause:** Each user has different token

**Solution:**
1. Login as shop user
2. Use that token for shop endpoints
3. Login as customer if testing customer endpoints

---

## ✅ Step-by-Step: Fix 401 Errors

1. **Get Token:**
   ```bash
   POST /api/auth/login
   Email: shop@example.com
   Password: password123
   ```

2. **Copy Token from Response:**
   ```json
   {
     "data": {
       "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
     }
   }
   ```

3. **Add to Postman:**
   - Authorization tab → Bearer Token
   - Paste token
   - Save

4. **Retry Request:**
   ```bash
   GET /api/shops/me
   ```

5. **Verify 200 OK ✅**

---

## 🎯 Test After Fix

### Should Now Work ✅

```
GET /api/shops/me → 200 OK
GET /api/shops/me/bookings → 200 OK
POST /api/bookings/create → 201 Created
```

### Verify Token in Headers

**Postman → Postman Console (Ctrl+Alt+C)**
```
Request Headers:
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Should show your token ✅

---

## 🔗 Related Endpoints (All Need Token)

```
GET /api/shops/me                           (requireAuth)
GET /api/shops/me/bookings                  (requireAuth)
POST /api/bookings/create                   (requireAuth)
POST /api/field/:id/confirm                 (requireAuth)
PATCH /api/bookings/:id/cancel              (requireAuth)
```

All require `Authorization: Bearer TOKEN` header!

---

## 📖 Summary

**Problem:** 401 Unauthorized
**Cause:** Missing Bearer token in Authorization header
**Solution:** 
1. Login to get token
2. Add to Postman Authorization
3. Retry request
4. Should work ✅

---

**Backend is working correctly - just need to authenticate first!** 🎉

