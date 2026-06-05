# Firebase Setup Guide

Complete guide to set up Firebase Firestore for the Claude Chat Backend.

## Prerequisites

- Google Cloud account
- Firebase CLI installed: `npm install -g firebase-tools`
- `gcloud` CLI installed

## Step 1: Create Firebase Project

### Option A: Firebase Console UI

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create a project" or "Add project"
3. Enter project name: `claude-chat-backend`
4. Accept analytics terms (optional)
5. Create project

### Option B: Firebase CLI

```bash
firebase login
firebase init
```

Select "Firestore Database" during init.

## Step 2: Enable Firestore Database

1. In Firebase Console, go to Build → Firestore Database
2. Click "Create Database"
3. Select region (e.g., `us-central1`)
4. Start in **Production Mode** for security
5. Click "Enable"

## Step 3: Create Database Collections

### Option A: Firebase Console

1. Click "Start Collection"
2. Create collection `users`
3. Add first document:
   - Document ID: `user-id-1`
   - Fields:
     - `deviceId` (string): `device-123`
     - `createdAt` (timestamp): `current time`

4. Create collection `conversations`
5. Add first document:
   - Document ID: `conv-id-1`
   - Fields:
     - `userId` (string): `user-id-1`
     - `title` (string): `Sample Conversation`
     - `createdAt` (timestamp): `current time`
     - `updatedAt` (timestamp): `current time`
     - `messageCount` (number): `0`

6. Create subcollection `messages` under `conversations/conv-id-1`
7. Add first message document

### Option B: Firestore Rules (Recommended)

Use the provided security rules below to auto-create collections.

## Step 4: Set Up Firestore Security Rules

Replace default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check user ID from header
    function isUserRequest(userId) {
      return request.headers['x-user-id'] == userId;
    }
    
    // Users collection
    match /users/{userId} {
      // Allow create during device pairing (no auth required)
      allow create: if request.auth == null;
      
      // Allow read/write if matching device
      allow read, write: if isUserRequest(userId) || 
        resource.data.deviceId == request.headers['x-device-id'];
      
      // Deny all other access
      allow read, write: if false;
    }
    
    // Conversations collection
    match /conversations/{conversationId} {
      // Allow create if userId matches header
      allow create: if isUserRequest(resource.data.userId);
      
      // Allow read/write if user owns conversation
      allow read, write: if isUserRequest(resource.data.userId);
      
      // Messages subcollection
      match /messages/{messageId} {
        // Allow read/write if user owns parent conversation
        allow read, write: if isUserRequest(
          get(/databases/$(database)/documents/conversations/$(conversationId)).data.userId
        );
      }
    }
    
    // Deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**To apply rules:**

1. In Firebase Console: Build → Firestore Database → Rules tab
2. Replace with above rules
3. Click "Publish"

Or via CLI:

```bash
firebase deploy --only firestore:rules
```

## Step 5: Create Service Account

### Generate Private Key

1. Go to Firebase Console → Settings (gear icon) → Project Settings
2. Click "Service Accounts" tab
3. Click "Generate New Private Key"
4. Save the JSON file securely

### Extract Credentials

From the downloaded JSON file, extract:

```json
{
  "type": "service_account",
  "project_id": "YOUR_PROJECT_ID",
  "private_key_id": "YOUR_KEY_ID",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "YOUR_CLIENT_EMAIL",
  "client_id": "YOUR_CLIENT_ID",
  ...
}
```

Set in `.env.local` or Vercel:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-email@appspot.gserviceaccount.com
```

**⚠️ IMPORTANT**: Keep private key secure. Never commit to Git or expose in public.

## Step 6: Enable Firestore API

```bash
gcloud services enable firestore.googleapis.com \
  --project=your-project-id
```

## Step 7: Create Firestore Indexes (Optional)

For complex queries, create composite indexes:

```bash
firebase deploy --only firestore:indexes
```

Or manually in Firebase Console:
1. Go to Firestore Database → Indexes
2. Create index for:
   - Collection: `conversations`
   - Fields: `userId` (Ascending), `updatedAt` (Descending)

## Step 8: Set Up Firestore Backups (Production)

1. In Firestore Console → Backups
2. Click "Schedule backup"
3. Set frequency (daily/weekly)
4. Set retention (30 days)

## Step 9: Monitor Firestore

### View Statistics

In Firebase Console:
- Build → Firestore Database → Stats
- View read/write operations
- Monitor storage usage

### Set Up Alerts

1. Google Cloud Console → Monitoring → Alerts
2. Create alert policy
3. Condition: Firestore read/write operations exceed threshold
4. Notification channels

### Enable Audit Logs

1. Google Cloud Console → Audit Logs
2. Filter by "Cloud Firestore"
3. Review admin activity

## Step 10: Test Connection

```bash
# Build and run backend
npm run build
npm start

# In another terminal, test
curl http://localhost:3000/health

# Create conversation
curl -X POST http://localhost:3000/conversations \
  -H "x-user-id: test-user-id" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test"}'
```

## Firebase Firestore Limits

Be aware of Firestore's quotas:

| Limit | Value |
|-------|-------|
| Document size | 1 MB |
| Collection size | Unlimited |
| Read operations/day | 50,000 (free tier) |
| Write operations/day | 20,000 (free tier) |
| Delete operations/day | 20,000 (free tier) |
| Stored data | 1 GB (free tier) |
| Max concurrent connections | 25,000 |

## Monitoring Costs

### Free Tier Limits

- **Read ops**: 50,000/day
- **Write ops**: 20,000/day
- **Delete ops**: 20,000/day
- **Storage**: 1 GB
- **Network**: No charge for uploads

### Paid Plan

After exceeding free tier:
- **Read ops**: $0.06/100K
- **Write ops**: $0.18/100K
- **Delete ops**: $0.02/100K
- **Storage**: $0.18/GB/month

### Cost Optimization

1. Use TTL to auto-delete old messages
2. Batch write operations
3. Use query limits
4. Archive old conversations separately
5. Monitor operations dashboard

## Troubleshooting

### Connection Issues

```bash
# Check Firebase config
firebase projects:list

# Test authentication
gcloud auth application-default print-access-token

# Verify Firestore access
firebase firestore:shell
> db.collection('users').get()
```

### Permission Denied

- Check security rules
- Verify service account has Firestore permissions
- Check x-user-id header matches document userId

### Quota Exceeded

- Check read/write counts in Stats dashboard
- Reduce query frequency
- Use caching
- Implement request batching

### Data Not Syncing

1. Verify Firestore Database is enabled
2. Check network connectivity
3. Confirm security rules allow access
4. Check browser console for errors

## Migrating Data

### Export Data

```bash
gcloud firestore export gs://backup-bucket/export-2024
```

### Import Data

```bash
gcloud firestore import gs://backup-bucket/export-2024
```

## Backing Up Data

### Manual Backup

```bash
# Export to Cloud Storage
gcloud firestore export gs://your-bucket/backup-$(date +%s)

# Download locally
gsutil cp -r gs://your-bucket/backup-xxx ./backups/
```

### Automated Backups

Create Cloud Function (or schedule via Cloud Tasks):

```javascript
// Scheduled every day
exports.backupFirestore = functions.pubsub
  .schedule('every day 02:00')
  .onRun(async (context) => {
    const client = new admin.firestore.v1.FirestoreAdminClient();
    
    await client.exportDocuments({
      name: client.databasePath(
        process.env.GCLOUD_PROJECT,
        '(default)'
      ),
      outputUriPrefix: `gs://my-bucket/backup-${Date.now()}`,
      collectionIds: []
    });
  });
```

## Next Steps

1. ✅ Create Firebase project
2. ✅ Enable Firestore
3. ✅ Set up security rules
4. ✅ Create service account
5. ✅ Test connection
6. ✅ Deploy backend
7. ✅ Monitor usage
8. ✅ Set up backups

For more info: [Firebase Firestore Documentation](https://firebase.google.com/docs/firestore)
