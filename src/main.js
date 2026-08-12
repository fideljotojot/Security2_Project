import './assets/main.css'

import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { 
  enableAntiInspect,
  // disableTextSelection,  // Uncomment to prevent text selection
  // disableCopyPaste,      // Uncomment to prevent copy/paste
  // clearConsole,          // Uncomment to clear console every second (annoying but effective)
  // disablePrint           // Uncomment to disable printing
} from './utils/anti-inspect';

// Enable anti-inspect protection
enableAntiInspect();

// Optional: Uncomment any of these for additional protection
// disableTextSelection();
// disableCopyPaste();
// clearConsole();
// disablePrint();

createApp(App).use(router).mount('#app')
