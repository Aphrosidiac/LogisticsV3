# Supabase Setup Guide

## Prerequisites

- A Supabase account (sign up at https://app.supabase.com)
- LogisticsV3 application with Phase 1-4 implementation completed

---

## Step 1: Create Supabase Project

1. Go to https://app.supabase.com
2. Click "New Project"
3. Fill in project details:
   - **Name**: `logistics-v3` (or your preferred name)
   - **Database Password**: Create a strong password (save this!)
   - **Region**: Choose closest to your location
   - **Pricing Plan**: Free tier is sufficient for testing
4. Click "Create new project"
5. Wait for project to finish setting up (~2 minutes)

---

## Step 2: Get Project Credentials

1. In your Supabase project dashboard, click the **Settings** icon (⚙️)
2. Go to **API** section
3. Copy the following values:
   - **Project URL** (looks like: `https://xxxxxxxxxxxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

---

## Step 3: Configure Environment Variables

1. Open `C:\dev\LogisticsV3\.env.local`
2. Replace the placeholder values:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-actual-anon-key-here
```

3. Save the file
4. Restart your Next.js development server

---

## Step 4: Create Database Tables

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy and paste the complete SQL schema from `src/lib/supabase.ts` (starting from `SUPABASE_SCHEMA_SQL`)
4. Click **Run** or press `Ctrl+Enter`
5. Verify all tables created successfully (no errors)

**Tables to verify**:
- orders
- drivers
- sheets
- distributions
- pending_balances
- schemas
- app_config
- logs
- whatsapp_messages

You can verify by going to **Table Editor** and checking the list of tables.

---

## Step 5: Create Storage Bucket

1. In Supabase dashboard, go to **Storage**
2. Click **New Bucket**
3. Fill in details:
   - **Name**: `order-attachments`
   - **Public bucket**: ✅ Enable (for public file access)
4. Click **Create bucket**

### Configure Bucket Policies (Optional but Recommended)

For better security, you can configure storage policies:

1. Click on the `order-attachments` bucket
2. Go to **Policies** tab
3. Add policy for **INSERT** (uploads):
   ```sql
   CREATE POLICY "Allow uploads for authenticated users"
   ON storage.objects FOR INSERT
   WITH CHECK (bucket_id = 'order-attachments');
   ```

4. Add policy for **SELECT** (public access):
   ```sql
   CREATE POLICY "Allow public access to files"
   ON storage.objects FOR SELECT
   USING (bucket_id = 'order-attachments');
   ```

---

## Step 6: Configure Row Level Security (Optional)

For production deployments, consider enabling RLS:

### For Orders Table
```sql
-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Allow all operations (adjust based on your auth requirements)
CREATE POLICY "Allow all for now" ON orders
  FOR ALL USING (true);
```

### For Other Tables
Repeat similar policies for `drivers`, `sheets`, `distributions`, `pending_balances`, etc.

**Note**: For a simple internal application without authentication, you can skip RLS. The anon key provides basic security.

---

## Step 7: Test Connection

1. Start your Next.js development server:
   ```bash
   npm run dev
   ```

2. Open browser console (F12)
3. Check for any Supabase connection errors
4. The app should load without errors

---

## Step 8: Run Migration (If you have existing IndexedDB data)

### Backup First (CRITICAL!)

Before migrating, create a backup of your existing data:

1. Open the app in your browser
2. Open browser console (F12)
3. Run:
   ```javascript
   import { exportIndexedDBBackup } from './src/lib/migrate';
   await exportIndexedDBBackup();
   ```
4. This will download a JSON backup file - **KEEP THIS SAFE!**

### Run Migration

Option 1: Via Browser Console (Recommended for testing)
```javascript
import { migrateToSupabase } from './src/lib/migrate';
const result = await migrateToSupabase();
console.log(result);
```

Option 2: Create a temporary migration page
```tsx
// src/app/migrate/page.tsx
'use client';

import { useState } from 'react';
import { migrateToSupabase } from '@/lib/migrate';

export default function MigratePage() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleMigrate = async () => {
    setLoading(true);
    const res = await migrateToSupabase();
    setResult(res);
    setLoading(false);
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Migrate to Supabase</h1>
      <button
        onClick={handleMigrate}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        {loading ? 'Migrating...' : 'Start Migration'}
      </button>
      {result && (
        <pre className="mt-4 p-4 bg-gray-100 rounded">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
```

Then visit `http://localhost:3000/migrate` and click the button.

---

## Step 9: Verify Migration

After migration, verify data in Supabase:

1. Go to **Table Editor** in Supabase dashboard
2. Check each table for data:
   - **orders**: Should have all your orders
   - **drivers**: Should have all your drivers
   - **sheets**: Should have all your sheets
   - **distributions**: Should have distribution history
   - **app_config**: Should have your configuration
   - **logs**: Should have activity logs

3. Compare counts with your backup to ensure nothing was lost

---

## Step 10: Update Application Code (Phase 5)

After successful migration, you'll need to update the application to use Supabase instead of IndexedDB. This involves:

1. Creating `src/lib/db-supabase.ts` (wrapper with same API as `db.ts`)
2. Updating `src/context/AppContext.tsx` to use Supabase
3. Updating all pages to use new functions
4. Removing IndexedDB dependencies

**Note**: This is part of Phase 5 implementation.

---

## Troubleshooting

### Connection Issues

**Error**: "Invalid API key"
- Verify you copied the correct **anon public** key (not service role key)
- Check for extra spaces in `.env.local`
- Restart dev server after changing environment variables

**Error**: "Could not connect to Supabase"
- Verify project URL is correct
- Check if project is paused (free tier projects pause after inactivity)
- Ensure you're on the correct network (not blocking Supabase domains)

### Migration Issues

**Error**: "Table already exists"
- You've already run the SQL schema
- Either drop tables and recreate, or skip to migration

**Error**: "Migration failed"
- Check browser console for specific errors
- Verify all tables exist in Supabase
- Ensure connection is working
- Check that you have data in IndexedDB to migrate

### Storage Issues

**Error**: "File upload failed"
- Verify bucket name is exactly `order-attachments`
- Check bucket is set to public
- Ensure file size is under 10MB
- Check storage policies

---

## Production Deployment

For production deployment:

1. **Environment Variables**:
   - Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to your hosting provider
   - Do NOT commit `.env.local` to git

2. **Security**:
   - Enable Row Level Security (RLS) on all tables
   - Create proper authentication policies
   - Consider adding user authentication

3. **Backups**:
   - Enable Supabase automatic backups (paid plans)
   - Schedule regular exports of critical data
   - Test restore procedures

4. **Monitoring**:
   - Monitor Supabase usage in dashboard
   - Set up alerts for errors
   - Monitor API rate limits

---

## Supabase Dashboard Overview

### Key Sections

1. **Table Editor**: View and edit data directly
2. **SQL Editor**: Run custom queries
3. **Storage**: Manage uploaded files
4. **Database**: View schema, relationships, backups
5. **API Docs**: Auto-generated API documentation
6. **Logs**: View real-time logs and errors

### Useful Queries

**Count orders by date**:
```sql
SELECT date, COUNT(*) as count
FROM orders
GROUP BY date
ORDER BY date;
```

**Find pending balances**:
```sql
SELECT * FROM pending_balances
WHERE status IN ('pending', 'scheduled')
ORDER BY scheduled_for_date;
```

**Check distribution summary**:
```sql
SELECT
  target_date,
  COUNT(*) as distributions,
  SUM((summary->>'totalOrders')::int) as total_orders
FROM distributions
GROUP BY target_date
ORDER BY target_date DESC;
```

---

## Support

- **Supabase Docs**: https://supabase.com/docs
- **Supabase Discord**: https://discord.supabase.com
- **LogisticsV3 Issues**: Check project repository

---

## Next Steps

After completing this setup:

1. ✅ Verify all tables created
2. ✅ Test file upload to storage
3. ✅ Run migration (if applicable)
4. ✅ Verify data integrity
5. ⏳ Continue with Phase 5 implementation
6. ⏳ Test distribution algorithm with real data
7. ⏳ Set up production environment

---

## Quick Reference

**Supabase Dashboard**: https://app.supabase.com
**Project Settings**: Settings → API
**SQL Editor**: SQL Editor (left sidebar)
**Storage**: Storage (left sidebar)
**Logs**: Logs → Postgres Logs

**Environment Variables**:
```env
NEXT_PUBLIC_SUPABASE_URL=https://[project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

**Critical Files**:
- `src/lib/supabase.ts` - Supabase configuration
- `src/lib/migrate.ts` - Migration utilities
- `.env.local` - Environment variables (not in git)
