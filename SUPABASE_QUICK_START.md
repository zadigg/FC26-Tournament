# Supabase Integration - Quick Start

## ✅ What's Been Set Up

1. ✅ Supabase client installed (`@supabase/supabase-js`)
2. ✅ Environment variables configured (`.env` file created)
3. ✅ Database service layer created (`src/lib/supabaseService.ts`)
4. ✅ TournamentContext updated to use Supabase
5. ✅ Migration logic from localStorage to Supabase

## 🚀 Next Steps

### 1. Run the SQL Script in Supabase

1. Go to your Supabase dashboard: https://app.supabase.com
2. Select your project: **yemami's Project**
3. Click **SQL Editor** in the left sidebar
4. Click **New query**
5. Copy the entire contents of `supabase-setup.sql`
6. Paste it into the SQL Editor
7. Click **Run** (or press Cmd/Ctrl + Enter)
8. You should see: "Success. No rows returned"

### 2. Verify Tables Were Created

1. In Supabase dashboard, click **Table Editor**
2. You should see three tables:
   - `players`
   - `tournaments`
   - `matches`

### 3. Test the App

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Open the app in your browser
3. The app will automatically:
   - Migrate any existing localStorage data to Supabase
   - Load data from Supabase
   - Save all changes to Supabase

## 📋 What Changed

### Before (localStorage)
- Data stored in browser's localStorage
- Lost when clearing browser cache
- Not synced across devices

### After (Supabase)
- Data stored in cloud database
- Persists across sessions
- Can sync across devices (future enhancement)
- Automatic migration from localStorage

## 🔍 Troubleshooting

### Error: "Missing Supabase environment variables"
- Check that `.env` file exists in project root
- Verify variables start with `VITE_`
- Restart dev server after creating/updating `.env`

### Error: "relation does not exist"
- Make sure you ran `supabase-setup.sql` in SQL Editor
- Check that all 3 tables exist in Table Editor

### Data not saving
- Check browser console for errors
- Verify Supabase project is active (not paused)
- Check RLS policies allow operations (they should be set to allow all)

### Migration not working
- Check browser console for migration messages
- Verify localStorage has data: `localStorage.getItem('fc26-tournament')`
- Migration runs automatically on first load

## 🎯 Current Status

- ✅ Environment configured
- ✅ Code integrated
- ⏳ **Waiting for**: SQL script to be run in Supabase
- ⏳ **Then**: Test the app!

## 📝 Notes

- The app will automatically migrate localStorage data on first load
- All future changes save to Supabase automatically
- The old localStorage key (`fc26-tournament`) is preserved for migration
- Tournament ID is stored in localStorage as `fc26-active-tournament-id`
