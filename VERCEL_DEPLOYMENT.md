# 🚀 Vercel Deployment Guide

## Environment Variables for Vercel

When deploying to Vercel, you need to add these environment variables in your Vercel project settings.

### Required Environment Variables

Go to your Vercel project → **Settings** → **Environment Variables** and add:

#### 1. `VITE_SUPABASE_URL`
- **Value:** `https://gxysshnekorxhjgfiofb.supabase.co`
- **Environment:** Production, Preview, Development (all)
- **Description:** Your Supabase project URL

#### 2. `VITE_SUPABASE_ANON_KEY`
- **Value:** `sb_publishable_OuVHz3pdtyijYQeU8MvNtg_80VIRddw`
- **Environment:** Production, Preview, Development (all)
- **Description:** Your Supabase publishable/anon key (safe for client-side)

## Step-by-Step Instructions

### 1. Go to Vercel Dashboard
1. Visit https://vercel.com
2. Select your project (or create a new one)

### 2. Add Environment Variables
1. Click **Settings** tab
2. Click **Environment Variables** in the sidebar
3. Add each variable:
   - **Key:** `VITE_SUPABASE_URL`
   - **Value:** `https://gxysshnekorxhjgfiofb.supabase.co`
   - **Environment:** Select all (Production, Preview, Development)
   - Click **Save**
4. Repeat for `VITE_SUPABASE_ANON_KEY`

### 3. Redeploy
After adding environment variables:
- Go to **Deployments** tab
- Click **Redeploy** on the latest deployment
- Or push a new commit to trigger automatic deployment

## Important Notes

### ✅ Use Production Supabase
- Use your **production** Supabase credentials (not local)
- The `.env` file has the production values

### ✅ VITE_ Prefix Required
- Vite only exposes variables that start with `VITE_`
- Make sure both variables start with `VITE_`

### ✅ Apply to All Environments
- Set variables for **Production**, **Preview**, and **Development**
- This ensures they work in all deployment environments

### ❌ Don't Use Secret Keys
- Only use the **publishable/anon key**
- Never use the secret key in Vercel environment variables
- Secret keys are for server-side only

## Verify Deployment

After deployment:
1. Visit your Vercel URL
2. Open browser console (F12)
3. Check for any Supabase connection errors
4. Test the app - it should connect to your Supabase database

## Troubleshooting

### "Missing Supabase environment variables"
- Verify variables are set in Vercel
- Check variable names start with `VITE_`
- Redeploy after adding variables

### "Failed to load tournament state"
- Check Supabase project is active (not paused)
- Verify RLS policies allow public access
- Check browser console for specific errors

### Data not syncing
- Ensure you're using production Supabase (not local)
- Check Supabase dashboard to verify data exists
- Verify environment variables are correct

## Quick Reference

**Production Supabase:**
- URL: `https://gxysshnekorxhjgfiofb.supabase.co`
- Anon Key: `sb_publishable_OuVHz3pdtyijYQeU8MvNtg_80VIRddw`

**Vercel Environment Variables:**
```
VITE_SUPABASE_URL=https://gxysshnekorxhjgfiofb.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_OuVHz3pdtyijYQeU8MvNtg_80VIRddw
```
