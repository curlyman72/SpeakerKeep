```markdown
# 🔊 SpeakerKeep

Prevent your soundbar, Bluetooth speakers, and audio devices from auto-standby with ultrasonic keep-alive signals.

## ☕ Support Development

**If this extension helps you, consider buying me a coffee:**

[![PayPal](https://img.shields.io/badge/PayPal-Buy%20Me%20A%20Coffee-blue.svg)](https://www.paypal.com/paypalme/curlyman72)

---

## 📖 Table of Contents

- [Problem](#-problem)
- [Solution](#-solution)
- [Features](#-features)
- [Installation](#-installation)
- [Usage](#-usage)
- [Configuration](#-configuration)
- [Troubleshooting](#-troubleshooting)
- [Technical Details](#-technical-details)
- [Privacy](#-privacy)
- [License](#-license)

---

## 🎯 Problem

Modern soundbars and Bluetooth speakers include aggressive power-saving features that automatically put the device into standby mode after 15-20 minutes of "silence." This is problematic when:

- Watching movies with quiet dialogue scenes
- Listening to ambient music or white noise
- Using your computer for work with intermittent audio
- Playing games with silent exploration segments

The result: Your audio cuts out unexpectedly, requiring you to manually wake your speaker with a remote or button press.

---

## 💡 Solution

SpeakerKeep Alive generates inaudible ultrasonic tones (default: 20 kHz) at regular intervals to trick your speakers into thinking audio is constantly playing. This prevents the auto-standby timer from ever reaching its threshold.

### Why 20 kHz?

- **Above human hearing range** (adult hearing typically tops out at 15-17 kHz)
- **Passes through most audio chains** including Bluetooth, optical, and HDMI
- **Inaudible to pets** (dogs hear up to ~45 kHz, but 20 kHz is typically inaudible to them at normal volumes)
- **Energy efficient** - short bursts every few minutes use minimal CPU/battery

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **6 Frequency Options** | 20 kHz (recommended), 19 kHz, 1 kHz, 100 Hz, 50 Hz, 30 Hz |
| **Adjustable Interval** | 1-15 minutes between keep-alive signals |
| **Burst Duration** | 50ms - 1000ms tone length |
| **Test Mode** | Audible 1 kHz tone to verify speaker connectivity |
| **Background Operation** | Runs even when popup is closed |
| **Persistent State** | Survives browser restarts |
| **Visual Countdown** | Real-time timer showing next ping |
| **Heartbeat Keep-Alive** | Prevents Chrome from killing the service worker |
| **Zero Dependencies** | Self-contained, no external audio files |

---

## 🚀 Installation

### From Source (Developer Mode)

1. **Download or clone this repository**
   ```bash
   git clone https://github.com/yourusername/speakerkeep-alive.git
   ```

2. **Open Chrome Extensions page**
   - Navigate to `chrome://extensions/`
   - Enable **Developer mode** (toggle in top-right)

3. **Load unpacked extension**
   - Click **"Load unpacked"**
   - Select the `speakerkeep-extension` folder

4. **Pin the extension** (optional)
   - Click the puzzle icon in Chrome toolbar
   - Click the pin next to "SpeakerKeep Alive"

### From Chrome Web Store

*Coming soon*

---

## 🎮 Usage

### Quick Start

1. Click the **SpeakerKeep** icon in your Chrome toolbar
2. Select your preferred **frequency** (20 kHz recommended)
3. Adjust **interval** and **duration** if needed
4. Click **"Start Keep-Alive"**
5. Close the popup - it runs in the background!

### Test Your Setup

Before relying on the keep-alive:

1. Select **1 kHz (Test)** frequency
2. Click **"Test Signal"** - you should hear a beep
3. If you hear it, your speaker is receiving the signal
4. Switch back to **20 kHz (Stealth)** and start

### Understanding the Interface

| Element | Description |
|---------|-------------|
| **Status Dot** | Green pulsing = active, Red = inactive |
| **Countdown** | Time until next keep-alive signal |
| **Visualizer** | Animated bars when tone is playing |
| **Stats** | Current frequency, duration, and interval |

---

## ⚙️ Configuration

### Frequency Strategy

| Frequency | Use Case |
|-----------|----------|
| **20 kHz** | Default. Truly inaudible to humans. Best for most speakers. |
| **19 kHz** | If 20 kHz is filtered by your audio chain. |
| **1 kHz** | **Test only.** Audible beep for verification. |
| **100 Hz** | Sub-bass. Good for subwoofers. |
| **50 Hz** | Mid-bass. May be audible on large speakers. |
| **30 Hz** | Deep low-end. Often filtered by small speakers. |

### Recommended Settings

| Scenario | Frequency | Interval | Duration |
|----------|-----------|----------|----------|
| **General use** | 20 kHz | 4 min | 200 ms |
| **Aggressive standby** | 20 kHz | 2 min | 300 ms |
| **Bluetooth speakers** | 20 kHz | 3 min | 200 ms |
| **Soundbars (optical)** | 20 kHz | 4 min | 200 ms |
| **Testing** | 1 kHz | 1 min | 500 ms |

---

## 🔧 Troubleshooting

### Extension stops working after a while

**Cause:** Chrome may kill the service worker despite our heartbeat.

**Fix:** 
- Ensure Chrome is updated to latest version
- Don't clear browser data excessively
- Check that extension has permission to run in background

### Timer shows "NaN" or resets

**Cause:** Communication issue between popup and background.

**Fix:** 
- Close and reopen the popup
- Restart the extension (toggle off/on)
- Check browser console for errors

### No sound during test

**Cause:** Speaker not connected or volume too low.

**Fix:**
- Verify speaker is connected and powered on
- Check system volume
- Try different frequency (some speakers filter high frequencies)

### 20 kHz doesn't prevent standby

**Cause:** Your speaker has aggressive high-frequency filtering.

**Fix:**
- Try **19 kHz** instead
- Try **100 Hz** (may be audible as faint thump)
- Increase duration to 500-1000ms

### Chrome says "This extension may have been corrupted"

**Cause:** Developer mode extension signature check.

**Fix:**
- Go to `chrome://extensions/`
- Click **"Repair"** on the extension card
- Or reload the extension

---

## 🔬 Technical Details

### Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Popup     │────▶│   Service    │────▶│  Offscreen  │
│   (UI)      │◄────│   Worker     │◄────│  Document   │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Chrome API  │
                    │   - Alarms   │
                    │   - Storage  │
                    │   - Audio    │
                    └──────────────┘
```

### How It Works

1. **Service Worker** maintains state and schedules alarms using `chrome.alarms`
2. **Heartbeat** every 20 seconds prevents Chrome from killing the service worker
3. **Offscreen Document** handles Web Audio API playback (required in Manifest V3)
4. **OscillatorNode** generates pure sine wave tones - no external audio files
5. **State Persistence** via `chrome.storage` survives browser restarts

### Browser Compatibility

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome 109+ | ✅ Full | Manifest V3 required |
| Edge 109+ | ✅ Full | Chromium-based |
| Opera 95+ | ✅ Full | Chromium-based |
| Brave 1.47+ | ✅ Full | Chromium-based |
| Firefox | ❌ None | Uses different extension API |
| Safari | ❌ None | Uses different extension API |

### Resource Usage

- **CPU:** ~0.1% during idle (heartbeat only)
- **Memory:** ~15-20 MB (service worker + offscreen document)
- **Battery:** Minimal - tones are short and infrequent
- **Storage:** < 1 MB

---

## 🔒 Privacy

SpeakerKeep Alive:

- ✅ **Does NOT collect any data**
- ✅ **Does NOT connect to external servers**
- ✅ **Does NOT track your browsing**
- ✅ **Does NOT modify web pages**
- ✅ All processing happens locally in your browser
- ✅ No analytics, no telemetry, no ads

The only network permission is for the offscreen document to play audio, which is a Chrome requirement.

---

## 🤝 Contributing

Contributions welcome! Areas for improvement:

- [ ] Add support for custom frequencies
- [ ] Visual graph of speaker response
- [ ] Auto-detect best frequency for user's speaker
- [ ] Schedule (only active during certain hours)
- [ ] Multiple speaker profiles

### Development Setup

```bash
# Clone repo
git clone https://github.com/curlyman72/SpeakerKeep

# Load in Chrome
# 1. Go to chrome://extensions/
# 2. Enable Developer Mode
# 3. Click "Load unpacked"
# 4. Select the extension folder

# Make changes, then click refresh icon on extension card
```

---

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details.

```
Copyright (c) 2026 [Jerry Lee]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

---

## 🙏 Acknowledgments

- Chrome Extensions team for Manifest V3 and Offscreen API
- Web Audio API specification authors
- Contributors and testers

---

## 📧 Contact

- **Issues:** [GitHub Issues](https://github.com/yourusername/speakerkeep-alive/issues)
- **Email:** jerry@raptorlabs.com
- **PayPal:** [paypal.me/curlyman72](https://www.paypal.com/paypalme/curlyman72)

---

**Enjoy uninterrupted audio! 🔊**
```