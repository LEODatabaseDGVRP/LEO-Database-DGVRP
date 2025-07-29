# Signup Debug Guide

## Common Issues and Solutions

### 1. Discord OAuth Not Working
**Symptoms**: Getting "Discord verification failed" or OAuth redirect errors
**Solution**: 
- Ensure DISCORD_REDIRECT_URI in your Render environment matches your actual domain
- Should be: `https://your-app-name.onrender.com/api/auth/discord/callback`
- Check Discord Developer Console that the redirect URI is whitelisted

### 2. Schema Validation Errors
**Symptoms**: "Invalid input data" with long error descriptions
**Solution**: 
- Frontend sends: `badgeNumber`, `rpName`, `rank`, `password`, `username`
- Backend expects: `badgeNumber`, `rpName`, `rank`, `password`, `username` (optional)
- This has been fixed in the latest update

### 3. Discord Role Verification
**Symptoms**: "User does not have required role" error
**Solution**:
- Check DISCORD_REQUIRED_ROLE environment variable
- Ensure user has the "LEO" role (or whatever role is configured)
- Check user is in the correct Discord server

### 4. Session Issues
**Symptoms**: "Discord verification required" even after Discord auth
**Solution**:
- Sessions should persist across requests
- Check if cookies are being sent properly
- Verify session storage is working

## Testing Steps

1. **Check Environment Variables**:
   - DISCORD_CLIENT_ID
   - DISCORD_CLIENT_SECRET  
   - DISCORD_REDIRECT_URI
   - DISCORD_GUILD_ID
   - DISCORD_REQUIRED_ROLE
   - DISCORD_BOT_TOKEN

2. **Test Discord OAuth Flow**:
   - Visit `/signup` page
   - Click "Verify with Discord"
   - Should redirect to Discord
   - After authorization, should redirect back with verification

3. **Test Form Submission**:
   - Fill out badge number, RP name, rank, password
   - Submit form
   - Should create account successfully

## Debug Mode

The server now includes enhanced logging. Check your Render logs for:
- "=== SIGNUP REQUEST DEBUG ===" 
- "=== SIGNUP ERROR DEBUG ==="
- Discord callback logs with 🔍 and ✅ emojis

## Quick Fix

If you're still getting errors, try these steps:
1. Clear browser cookies/cache
2. Try the signup flow again
3. Check the exact error message
4. Share the error message for specific debugging