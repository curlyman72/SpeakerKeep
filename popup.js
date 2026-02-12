// Popup script - communicates with background service worker

let isRunning = false;
let config = {
  frequency: 20000,
  duration: 200,
  interval: 4
};

let countdownInterval = null;
let nextPingTime = null;

// Frequency descriptions
const freqDescriptions = {
  20000: "<strong>20 kHz (Recommended):</strong> Above human hearing range. Most effective for bypassing filters while remaining inaudible. Works with most soundbars and Bluetooth speakers.",
  19000: "<strong>19 kHz (Safe):</strong> Slightly lower ultrasonic frequency. Use if 20kHz is filtered by your audio chain or if you have hearing sensitivity to high frequencies.",
  1000: "<strong>1 kHz (Test):</strong> Audible tone for testing. You'll hear a beep - use this to verify your speaker is receiving the signal before switching to ultrasonic.",
  100: "<strong>100 Hz (Sub-bass):</strong> Low frequency rumble. May be filtered by some speakers but often effective for subwoofers and larger speakers.",
  30: "<strong>30 Hz (Low-end):</strong> Deep sub-bass. Good for subwoofers but may be filtered by small speakers or soundbars without subwoofer.",
  50: "<strong>50 Hz (Mid-bass):</strong> Low bass frequency. Balance between effectiveness and potential audibility. Try this if ultrasonic doesn't work."
};

// DOM Elements
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const statusCard = document.getElementById('statusCard');
const countdown = document.getElementById('countdown');
const visualizer = document.getElementById('visualizer');
const toggleBtn = document.getElementById('toggleBtn');
const testBtn = document.getElementById('testBtn');
const closeBtn = document.getElementById('closeBtn');
const durationSlider = document.getElementById('durationSlider');
const intervalSlider = document.getElementById('intervalSlider');
const durationValue = document.getElementById('durationValue');
const intervalValue = document.getElementById('intervalValue');
const freqInfo = document.getElementById('freqInfo');
const statFreq = document.getElementById('statFreq');
const statDuration = document.getElementById('statDuration');
const statInterval = document.getElementById('statInterval');

// Initialize - get status from background
document.addEventListener('DOMContentLoaded', () => {
  loadStatus();
  setupEventListeners();
  setupCloseHandler();
  
  // Listen for messages from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'STATUS_CHANGED') {
      isRunning = message.isRunning;
      if (!isRunning) {
        stopCountdown();
        nextPingTime = null;
      } else if (message.nextPingTime) {
        nextPingTime = message.nextPingTime;
        startCountdown();
      }
      updateUI();
    } else if (message.type === 'TONE_PLAYED') {
      triggerVisualizer();
      // Update next ping time based on last ping + interval
      if (isRunning && message.lastPingTime) {
        nextPingTime = message.lastPingTime + (config.interval * 60 * 1000);
      }
    }
  });
});

// Setup close button and window close handlers
function setupCloseHandler() {
  // Close button click
  closeBtn.addEventListener('click', () => {
    window.close();
  });
  
  // Also handle Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.close();
    }
  });
  
  // Cleanup when window unloads (popup closes)
  window.addEventListener('beforeunload', () => {
    stopCountdown();
  });
}

function loadStatus() {
  chrome.runtime.sendMessage({ target: 'background', type: 'GET_STATUS' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error getting status:', chrome.runtime.lastError);
      return;
    }
    
    if (response) {
      isRunning = response.isRunning;
      if (response.config) {
        config = response.config;
        updateControlsFromConfig();
      }
      
      // Handle nextPingTime properly - use the calculated time from background
      if (response.nextPing && response.nextPing > Date.now()) {
        nextPingTime = response.nextPing;
        startCountdown();
      } else if (isRunning && response.lastPing) {
        // Calculate next ping based on last ping + interval
        nextPingTime = response.lastPing + (config.interval * 60 * 1000);
        if (nextPingTime > Date.now()) {
          startCountdown();
        } else {
          // Missed a ping, should happen soon
          nextPingTime = Date.now() + 5000; // Estimate 5 seconds
          startCountdown();
        }
      } else if (isRunning) {
        // No last ping info, estimate from now
        nextPingTime = Date.now() + (config.interval * 60 * 1000);
        startCountdown();
      }
      
      updateUI();
    }
  });
}

function updateControlsFromConfig() {
  // Update frequency buttons
  document.querySelectorAll('.freq-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.freq) === config.frequency);
  });
  
  // Update sliders
  durationSlider.value = config.duration;
  intervalSlider.value = config.interval;
  
  // Update displays
  updateValueDisplays();
  updateStats();
  freqInfo.innerHTML = freqDescriptions[config.frequency] || freqDescriptions[20000];
}

function setupEventListeners() {
  // Frequency selection
  document.querySelectorAll('.freq-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.freq-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      config.frequency = parseInt(btn.dataset.freq);
      freqInfo.innerHTML = freqDescriptions[config.frequency];
      updateStats();
      
      // Update background if running
      if (isRunning) {
        chrome.runtime.sendMessage({ 
          target: 'background', 
          type: 'UPDATE_CONFIG', 
          config 
        }, (response) => {
          if (response && response.nextPingTime) {
            nextPingTime = response.nextPingTime;
            startCountdown();
          }
        });
      }
    });
  });

  // Duration slider
  durationSlider.addEventListener('input', (e) => {
    config.duration = parseInt(e.target.value);
    updateValueDisplays();
    updateStats();
    
    if (isRunning) {
      chrome.runtime.sendMessage({ 
        target: 'background', 
        type: 'UPDATE_CONFIG', 
        config 
      });
    }
  });

  // Interval slider
  intervalSlider.addEventListener('input', (e) => {
    config.interval = parseInt(e.target.value);
    updateValueDisplays();
    updateStats();
    
    if (isRunning) {
      chrome.runtime.sendMessage({ 
        target: 'background', 
        type: 'UPDATE_CONFIG', 
        config 
      }, (response) => {
        if (response && response.nextPingTime) {
          nextPingTime = response.nextPingTime;
          startCountdown();
        }
      });
    }
  });

  // Main toggle
  toggleBtn.addEventListener('click', toggleKeepAlive);
  
  // Test button
  testBtn.addEventListener('click', playTest);
}

function toggleKeepAlive() {
  if (isRunning) {
    // Stop
    chrome.runtime.sendMessage({ target: 'background', type: 'STOP' }, () => {
      isRunning = false;
      stopCountdown();
      nextPingTime = null;
      updateUI();
    });
  } else {
    // Start
    chrome.runtime.sendMessage({ 
      target: 'background', 
      type: 'START', 
      config 
    }, (response) => {
      isRunning = true;
      // Calculate next ping based on just-started timer
      nextPingTime = Date.now() + (config.interval * 60 * 1000);
      startCountdown();
      updateUI();
    });
  }
}

function playTest() {
  if (testBtn.classList.contains('playing')) return;
  
  testBtn.classList.add('playing');
  testBtn.innerHTML = '<span>🔊</span><span>Playing Test Tone...</span>';
  
  chrome.runtime.sendMessage({ 
    target: 'background', 
    type: 'PLAY_TEST',
    config
  });
  
  // Visual feedback
  triggerVisualizer();
  
  setTimeout(() => {
    testBtn.classList.remove('playing');
    testBtn.innerHTML = '<span>🔊</span><span>Test Signal (Audible Preview)</span>';
  }, 1000);
}

function updateUI() {
  if (isRunning) {
    statusDot.classList.add('active');
    statusCard.classList.add('active');
    statusText.textContent = 'Active';
    toggleBtn.textContent = 'Stop Keep-Alive';
    toggleBtn.classList.remove('start');
    toggleBtn.classList.add('stop');
  } else {
    statusDot.classList.remove('active');
    statusCard.classList.remove('active');
    statusText.textContent = 'Inactive';
    countdown.textContent = 'Not running';
    toggleBtn.textContent = 'Start Keep-Alive';
    toggleBtn.classList.remove('stop');
    toggleBtn.classList.add('start');
  }
}

function updateValueDisplays() {
  durationValue.textContent = config.duration + ' ms';
  intervalValue.textContent = config.interval + ' min';
}

function updateStats() {
  statFreq.textContent = config.frequency >= 1000 ? (config.frequency / 1000) + ' kHz' : config.frequency + ' Hz';
  statDuration.textContent = config.duration + ' ms';
  statInterval.textContent = config.interval + ' min';
}

function startCountdown() {
  stopCountdown();
  
  // Update immediately
  updateCountdownDisplay();
  
  countdownInterval = setInterval(() => {
    if (!isRunning) {
      stopCountdown();
      return;
    }
    
    updateCountdownDisplay();
  }, 1000);
}

function updateCountdownDisplay() {
  if (!isRunning || !nextPingTime) {
    countdown.textContent = 'Not running';
    return;
  }
  
  const remaining = nextPingTime - Date.now();
  
  if (remaining <= 0) {
    countdown.textContent = 'Pinging now...';
    triggerVisualizer();
    // Reset for next interval after ping
    nextPingTime = Date.now() + (config.interval * 60 * 1000);
  } else {
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    // Format with leading zeros
    const minStr = minutes.toString();
    const secStr = seconds.toString().padStart(2, '0');
    
    countdown.textContent = minStr + 'm ' + secStr + 's';
  }
}

function stopCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

function triggerVisualizer() {
  visualizer.classList.add('active');
  
  // Animate bars randomly
  const bars = visualizer.querySelectorAll('.bar');
  const interval = setInterval(() => {
    bars.forEach(bar => {
      const height = Math.random() * 80 + 20;
      bar.style.height = height + '%';
    });
  }, 100);
  
  setTimeout(() => {
    clearInterval(interval);
    visualizer.classList.remove('active');
    // Reset heights
    bars.forEach((bar, i) => {
      const heights = [20, 40, 60, 80, 100, 80, 60, 40, 20];
      bar.style.height = heights[i] + '%';
    });
  }, config.duration);
}