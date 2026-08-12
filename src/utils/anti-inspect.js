/**
 * Anti-Inspect Protection
 * Prevents right-click, keyboard shortcuts, and other inspection methods
 * 
 * WARNING: This is NOT real security! Users can easily bypass this by:
 * - Disabling JavaScript
 * - Opening DevTools before loading the page
 * - Using browser menu to access DevTools
 * - Using browser extensions
 * 
 * This is only a basic deterrent for casual users.
 */

export function enableAntiInspect() {
  // Only enable in production (optional - remove this if to enable always)
  // if (import.meta.env.DEV) {
  //   console.log('Anti-inspect disabled in development mode');
  //   return;
  // }

  // Disable right-click context menu
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showWarning();
    return false;
  });

  // Disable common DevTools keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // F12 - DevTools
    if (e.key === 'F12') {
      e.preventDefault();
      showWarning();
      return false;
    }
    
    // Ctrl+Shift+I - DevTools (Chrome, Edge, Firefox)
    if (e.ctrlKey && e.shiftKey && e.key === 'I') {
      e.preventDefault();
      showWarning();
      return false;
    }
    
    // Ctrl+Shift+J - Console (Chrome, Edge)
    if (e.ctrlKey && e.shiftKey && e.key === 'J') {
      e.preventDefault();
      showWarning();
      return false;
    }
    
    // Ctrl+Shift+C - Inspect Element
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      showWarning();
      return false;
    }
    
    // Ctrl+U - View Source
    if (e.ctrlKey && e.key === 'u') {
      e.preventDefault();
      showWarning();
      return false;
    }
    
    // Ctrl+S - Save Page
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      showWarning();
      return false;
    }

    // Ctrl+Shift+K - Firefox Console
    if (e.ctrlKey && e.shiftKey && e.key === 'K') {
      e.preventDefault();
      showWarning();
      return false;
    }

    // Ctrl+Shift+E - Firefox Network Monitor
    if (e.ctrlKey && e.shiftKey && e.key === 'E') {
      e.preventDefault();
      showWarning();
      return false;
    }
  });

  // Detect DevTools opening (basic detection)
  detectDevTools();

  console.log('Anti-inspect protection enabled');
}

// Show warning message when user tries to inspect
let warningTimeout;
function showWarning() {
  // Clear existing timeout
  if (warningTimeout) {
    clearTimeout(warningTimeout);
  }

  // Create or update warning message
  let warning = document.getElementById('anti-inspect-warning');
  
  if (!warning) {
    warning = document.createElement('div');
    warning.id = 'anti-inspect-warning';
    warning.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ff4444;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 999999;
      font-family: Arial, sans-serif;
      font-size: 14px;
      max-width: 300px;
      animation: slideIn 0.3s ease-out;
    `;
    warning.innerHTML = `
      <strong>⚠️ Action Not Allowed</strong><br>
      <small>Right-click and inspect are disabled on this site.</small>
    `;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(400px);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(warning);
  }

  // Auto-hide after 3 seconds
  warningTimeout = setTimeout(() => {
    if (warning) {
      warning.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => {
        if (warning.parentNode) {
          warning.parentNode.removeChild(warning);
        }
      }, 300);
    }
  }, 3000);
}

// Basic DevTools detection
function detectDevTools() {
  const threshold = 160;
  
  setInterval(() => {
    // Check window size difference (DevTools makes viewport smaller)
    const widthThreshold = window.outerWidth - window.innerWidth > threshold;
    const heightThreshold = window.outerHeight - window.innerHeight > threshold;
    
    if (widthThreshold || heightThreshold) {
      // DevTools might be open
      // You can add custom behavior here, like:
      // - Redirect user
      // - Blur content
      // - Show warning
      // console.warn('DevTools detected');
    }
  }, 1000);
}

// Optional: Disable text selection
export function disableTextSelection() {
  document.addEventListener('selectstart', (e) => {
    e.preventDefault();
    return false;
  });
  
  // Add CSS to prevent selection
  const style = document.createElement('style');
  style.textContent = `
    * {
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
    }
    input, textarea {
      -webkit-user-select: text;
      -moz-user-select: text;
      -ms-user-select: text;
      user-select: text;
    }
  `;
  document.head.appendChild(style);
}

// Optional: Disable copy/paste
export function disableCopyPaste() {
  document.addEventListener('copy', (e) => {
    e.preventDefault();
    return false;
  });
  
  document.addEventListener('cut', (e) => {
    e.preventDefault();
    return false;
  });
  
  document.addEventListener('paste', (e) => {
    // Allow paste in input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return true;
    }
    e.preventDefault();
    return false;
  });
}

// Optional: Clear console periodically (annoying but effective)
export function clearConsole() {
  if (import.meta.env.PROD) {
    setInterval(() => {
      console.clear();
    }, 1000);
  }
}

// Optional: Detect and handle printing
export function disablePrint() {
  window.addEventListener('beforeprint', (e) => {
    e.preventDefault();
    alert('Printing is disabled on this site.');
  });
  
  // Disable Ctrl+P
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'p') {
      e.preventDefault();
      alert('Printing is disabled on this site.');
      return false;
    }
  });
}
