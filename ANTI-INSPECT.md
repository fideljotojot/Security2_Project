# 🚫 Anti-Inspect Protection

## ⚠️ IMPORTANT WARNING

**This is NOT real security!** Right-click and keyboard shortcut blocking can be easily bypassed by:

- Disabling JavaScript in browser settings
- Opening DevTools BEFORE loading the page (F12 → then visit site)
- Using browser menu: `More Tools` → `Developer Tools`
- Using browser extensions
- Viewing cached source code
- Using proxy tools (Burp Suite, Charles, etc.)

**This only deters casual, non-technical users.** It does NOT protect your code.

---

## What It Does

The anti-inspect protection blocks:

### ✅ Right-Click Context Menu
- Users cannot right-click to access "Inspect Element" or "View Page Source"
- Shows a warning message when attempted

### ✅ DevTools Keyboard Shortcuts
- **F12** - Open DevTools
- **Ctrl+Shift+I** - Open DevTools
- **Ctrl+Shift+J** - Open Console (Chrome/Edge)
- **Ctrl+Shift+K** - Open Console (Firefox)
- **Ctrl+Shift+C** - Inspect Element mode
- **Ctrl+U** - View Page Source
- **Ctrl+S** - Save page
- **Ctrl+Shift+E** - Network Monitor (Firefox)

### ✅ Shows Warning Message
When users try blocked actions, they see:
```
⚠️ Action Not Allowed
Right-click and inspect are disabled on this site.
```

---

## Optional Features (Currently Disabled)

You can enable these by uncommenting in `main.js`:

### 1. Disable Text Selection
```javascript
disableTextSelection();
```
- Users cannot select/highlight text on the page
- **Warning**: This hurts UX - users expect to be able to select text

### 2. Disable Copy/Paste
```javascript
disableCopyPaste();
```
- Prevents copying text from the page
- Still allows paste in input fields
- **Warning**: Very annoying for legitimate users

### 3. Clear Console
```javascript
clearConsole();
```
- Clears browser console every second
- Makes debugging harder for users with DevTools open
- **Warning**: Extremely annoying, use sparingly

### 4. Disable Printing
```javascript
disablePrint();
```
- Blocks Ctrl+P and print dialog
- **Warning**: Users may legitimately want to print

---

## How to Enable/Disable

### Enable (Already Active)

Currently enabled in `src/main.js`:
```javascript
import { enableAntiInspect } from './utils/anti-inspect';
enableAntiInspect();
```

### Disable

Comment out the function call in `src/main.js`:
```javascript
// enableAntiInspect();
```

### Production Only

To only enable in production builds, edit `src/utils/anti-inspect.js`:
```javascript
export function enableAntiInspect() {
  // Only enable in production
  if (import.meta.env.DEV) {
    console.log('Anti-inspect disabled in development mode');
    return;
  }
  // ... rest of code
}
```

---

## How It Works

### 1. Event Listeners
Attaches listeners to:
- `contextmenu` - Right-click events
- `keydown` - Keyboard shortcuts

### 2. preventDefault()
Stops default browser behavior:
```javascript
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  showWarning();
  return false;
});
```

### 3. Warning Display
Creates a styled div that slides in from the right and auto-hides after 3 seconds.

### 4. DevTools Detection (Basic)
Monitors window size differences to detect if DevTools is open:
```javascript
const widthThreshold = window.outerWidth - window.innerWidth > 160;
```
*Note: This is unreliable and can have false positives.*

---

## Testing

### 1. Development
```bash
npm run dev
```
Visit http://localhost:5173 and try:
- Right-clicking → Should be blocked
- Pressing F12 → Should be blocked
- Shows warning message

### 2. Production
```bash
npm run build:prod
npm run preview
```
Same behavior but in production build.

---

## Easy Bypasses (Why This Isn't Security)

### Method 1: Disable JavaScript
1. Browser Settings → Disable JavaScript
2. Reload page
3. Right-click works, all shortcuts work

### Method 2: Open DevTools First
1. Press F12 on a different site
2. Keep DevTools open
3. Navigate to your site
4. DevTools stays open

### Method 3: Browser Menu
1. Click browser menu (⋮)
2. `More Tools` → `Developer Tools`
3. DevTools opens regardless of JavaScript

### Method 4: View Cache
1. Browser already cached the source
2. View from cache or history
3. All code visible

### Method 5: cURL / wget
```bash
curl https://yoursite.com
```
Downloads entire HTML with all code.

### Method 6: Browser Extensions
Many extensions can bypass these restrictions with one click.

---

## What Actually Protects Your Code

Instead of relying on anti-inspect:

### 1. ✅ JavaScript Obfuscation (Already Configured)
- Makes code unreadable
- Actually works even if DevTools is open

### 2. ✅ Minification (Already Configured)
- Removes whitespace and comments
- Harder to read

### 3. ✅ Server-Side Logic
- Keep secrets and business logic on the server
- Only expose necessary APIs

### 4. ✅ .htaccess Protection (Already Configured)
- Blocks source files and maps
- Prevents directory browsing

---

## User Experience Impact

### 😊 Minimal Impact (Current Setup)
- Right-click blocked
- Keyboard shortcuts blocked
- Warning message shows
- **Most users won't notice** (unless they try to inspect)

### 😐 Moderate Impact (If You Enable Optional Features)
- Cannot select text
- Cannot copy/paste
- **Some users will be annoyed**

### 😠 High Impact (If You Enable All)
- Console clears every second
- Cannot print
- Cannot select/copy
- **Many users will leave your site**

---

## Recommendations

### ✅ DO USE
- For casual deterrence
- On public-facing marketing pages
- To slow down script kiddies
- Combined with obfuscation

### ❌ DON'T USE
- As your only protection
- On sites where users need to copy text
- If you have legitimate security concerns (use server-side instead)
- On admin panels (use proper authentication)

### 🎯 BEST APPROACH
```
Anti-Inspect (Casual Deterrent)
     +
JS Obfuscation (Makes code unreadable)
     +
Server-Side Security (Real protection)
     +
.htaccess (Blocks sensitive files)
     =
Layered Protection
```

---

## Customization

### Change Warning Message

Edit `src/utils/anti-inspect.js`:
```javascript
warning.innerHTML = `
  <strong>🔒 Your Custom Title</strong><br>
  <small>Your custom message here.</small>
`;
```

### Change Warning Position

Modify CSS in `showWarning()`:
```javascript
// Top-right (current)
top: 20px;
right: 20px;

// Top-center
top: 20px;
left: 50%;
transform: translateX(-50%);

// Bottom-right
bottom: 20px;
right: 20px;
```

### Change Warning Duration

Default is 3 seconds:
```javascript
setTimeout(() => {
  // Hide warning
}, 3000); // Change this number (in milliseconds)
```

### Add Custom Actions When DevTools Detected

Edit `detectDevTools()` in `src/utils/anti-inspect.js`:
```javascript
if (widthThreshold || heightThreshold) {
  // Your custom action here:
  
  // Option 1: Blur the page
  document.body.style.filter = 'blur(10px)';
  
  // Option 2: Show overlay
  showOverlay('Please close DevTools');
  
  // Option 3: Redirect
  window.location.href = '/access-denied';
  
  // Option 4: Just log
  console.warn('DevTools detected');
}
```

---

## Files Modified

- ✅ `src/main.js` - Imports and enables anti-inspect
- ✅ `src/utils/anti-inspect.js` - Contains all protection logic
- ✅ `ANTI-INSPECT.md` - This documentation

---

## Uninstalling

To remove anti-inspect protection:

### 1. Remove from main.js
```javascript
// Delete or comment out these lines:
import { enableAntiInspect } from './utils/anti-inspect';
enableAntiInspect();
```

### 2. Delete the utility file (optional)
```bash
rm src/utils/anti-inspect.js
```

---

## Summary

✅ **Right-click disabled**  
✅ **Keyboard shortcuts blocked**  
✅ **Warning message shows**  
✅ **Easy to enable/disable**  
⚠️ **NOT real security** - just a deterrent  
⚠️ **Easily bypassed** by anyone technical  

**Use this as ONE layer** combined with obfuscation, server-side security, and .htaccess protection!
