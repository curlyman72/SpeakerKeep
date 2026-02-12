// Offscreen document - handles actual audio playback
// Required because service workers cannot use Web Audio API

let audioContext = null;

function initAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
}

function playTone(frequency, duration, volume = 0.5) {
  initAudioContext();
  
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.value = frequency;
  oscillator.type = 'sine';
  
  // Smooth fade in/out to avoid clicks
  const now = audioContext.currentTime;
  const durationSec = duration / 1000;
  
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(volume, now + 0.01);
  gainNode.gain.setValueAtTime(volume, now + durationSec - 0.01);
  gainNode.gain.linearRampToValueAtTime(0, now + durationSec);
  
  oscillator.start(now);
  oscillator.stop(now + durationSec);
  
  // Notify background that tone played
  chrome.runtime.sendMessage({
    target: 'background',
    type: 'TONE_COMPLETE'
  });
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.target === 'offscreen') {
    if (message.type === 'PLAY_TONE') {
      playTone(message.data.frequency, message.data.duration);
    }
  }
});