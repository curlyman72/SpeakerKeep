// Background Service Worker - handles audio generation and scheduling

let isRunning = false;
let config = {
  frequency: 20000,
  duration: 200,
  interval: 4
};

let lastPingTime = 0;
let heartbeatInterval = null;

// Keep-alive heartbeat to prevent service worker from dying
function startHeartbeat() {
  if (heartbeatInterval) return;
  
  heartbeatInterval = setInterval(() => {
    // Ping storage to keep service worker alive
    chrome.storage.local.set({ 'last-heartbeat': Date.now() });
    
    // Also verify our alarm is still scheduled
    if (isRunning) {
      chrome.alarms.get('keepAlive', (alarm) => {
        if (!alarm) {
          console.log('Alarm lost, recreating...');
          chrome.alarms.create('keepAlive', {
            periodInMinutes: config.interval
          });
        }
      });
    }
  }, 20000); // Every 20 seconds
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// Initialize offscreen document for audio playback
async function setupOffscreenDocument(path) {
  if (await hasOffscreenDocument()) return;
  
  await chrome.offscreen.createDocument({
    url: path,
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Playing keep-alive tones to prevent speaker standby'
  });
}

async function hasOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL('offscreen.html')]
  });
  return existingContexts.length > 0;
}

async function closeOffscreenDocument() {
  if (await hasOffscreenDocument()) {
    await chrome.offscreen.closeDocument();
  }
}

// Play tone via offscreen document
async function playTone() {
  await setupOffscreenDocument('offscreen.html');
  
  lastPingTime = Date.now();
  
  chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'PLAY_TONE',
    data: {
      frequency: config.frequency,
      duration: config.duration
    }
  }).catch(() => {
    setTimeout(() => {
      chrome.runtime.sendMessage({
        target: 'offscreen',
        type: 'PLAY_TONE',
        data: {
          frequency: config.frequency,
          duration: config.duration
        }
      });
    }, 100);
  });
  
  updateBadge();
  notifyPopup({ type: 'TONE_PLAYED', lastPingTime });

  // Store last ping time
  chrome.storage.local.set({ sk_lastPing: lastPingTime });
}

// Update extension badge
function updateBadge() {
  const text = isRunning ? 'ON' : '';
  const color = isRunning ? '#2ed573' : '#ff4757';
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

// Calculate next ping time based on last ping + interval
function calculateNextPingTime() {
  if (!isRunning) return null;
  const intervalMs = config.interval * 60 * 1000;
  return lastPingTime + intervalMs;
}

// Start keep-alive routine
async function startKeepAlive() {
  if (isRunning) return;
  
  isRunning = true;
  await chrome.storage.local.set({ sk_running: true });
  
  // Start heartbeat to keep service worker alive
  startHeartbeat();
  
  // Load config from storage
  const stored = await chrome.storage.local.get(['sk_config']);
  if (stored.sk_config) {
    config = stored.sk_config;
  }
  
  // Immediate first ping
  await playTone();
  
  // Schedule periodic pings
  await chrome.alarms.create('keepAlive', {
    periodInMinutes: config.interval
  });
  
  updateBadge();
  notifyPopup({ type: 'STATUS_CHANGED', isRunning: true, nextPingTime: calculateNextPingTime() });
}

// Stop keep-alive routine
async function stopKeepAlive() {
  isRunning = false;
  stopHeartbeat();
  await chrome.storage.local.set({ sk_running: false });
  await chrome.alarms.clear('keepAlive');
  await closeOffscreenDocument();
  lastPingTime = 0;
  updateBadge();
  notifyPopup({ type: 'STATUS_CHANGED', isRunning: false });
}

// Notify popup of status changes
function notifyPopup(message) {
  chrome.runtime.sendMessage(message).catch(() => {
    // Popup not open, ignore error
  });
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target === 'background') {
    switch (message.type) {
      case 'START':
        config = message.config;
        chrome.storage.local.set({ sk_config: config });
        startKeepAlive();
        sendResponse({ success: true });
        break;
        
      case 'STOP':
        stopKeepAlive();
        sendResponse({ success: true });
        break;
        
      case 'GET_STATUS':
        // Calculate actual next ping time
        const nextPing = calculateNextPingTime();
        sendResponse({ 
          isRunning, 
          config,
          nextPing,
          lastPing: lastPingTime
        });
        break;
        
      case 'UPDATE_CONFIG':
        config = message.config;
        chrome.storage.local.set({ sk_config: config });
        if (isRunning) {
          // Restart alarm with new interval
          chrome.alarms.clear('keepAlive').then(() => {
            chrome.alarms.create('keepAlive', {
              periodInMinutes: config.interval
            });
            // Recalculate next ping from now
            lastPingTime = Date.now();
          });
        }
        sendResponse({ success: true, nextPingTime: calculateNextPingTime() });
        break;
        
      case 'PLAY_TEST':
        config = message.config;
        playTestTone();
        sendResponse({ success: true });
        break;
    }
  }
  return true;
});

// Play test tone (audible)
async function playTestTone() {
  await setupOffscreenDocument('offscreen.html');
  chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'PLAY_TONE',
    data: {
      frequency: 1000,
      duration: 1000
    }
  });
}

// Handle alarm trigger
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive' && isRunning) {
    playTone();
  }
});

// Restore state on startup - this runs when service worker restarts
async function restoreState() {
  const stored = await chrome.storage.local.get(['sk_config', 'sk_running', 'sk_lastPing']);
  
  if (stored.sk_running) {
    config = stored.sk_config || config;
    lastPingTime = stored.sk_lastPing || 0;
    isRunning = true;
    
    // Restart heartbeat
    startHeartbeat();
    
    updateBadge();
    
    // Check if alarm exists, recreate if needed
    const alarm = await chrome.alarms.get('keepAlive');
    if (!alarm) {
      console.log('Restoring alarm after service worker restart');
      chrome.alarms.create('keepAlive', {
        periodInMinutes: config.interval
      });
      
      // Check if we missed a ping while service worker was dead
      const nextPing = calculateNextPingTime();
      if (!nextPing || nextPing < Date.now()) {
        console.log('Missed ping during downtime, pinging now');
        playTone();
      }
    }
  }
}

// Run restore on startup
chrome.runtime.onStartup.addListener(restoreState);

// Also run immediately in case service worker was killed and restarted
restoreState();