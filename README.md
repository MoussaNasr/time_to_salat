# Time to Salat (PWA)

A minimal full-screen landscape web app for iPad that shows a giant white digital countdown to the next prayer on a black background, with a settings page to choose the prayer time calculation method. Add it to your iPad Home Screen to run like a native app.

## Features
- Full-screen white-on-black countdown to the next prayer (HH:MM:SS)
- Uses device location (with manual override fallback)
- Choose calculation method (e.g., Muslim World League, Umm Al-Qura, etc.)
- Offline support via Service Worker
- Wake Lock to keep the screen on (if supported)

## Quick start

### Run locally
```bash
# Option A: Python 3 simple server
python3 -m http.server 5173

# Option B: Node (if you have http-server installed)
# npx http-server -p 5173 -c-1
```
Then open http://localhost:5173 in your desktop browser to test.

### Install on iPad (as an app)
1. Serve the app on your network so the iPad can access it (e.g., via your Mac’s local IP).
2. On iPad Safari, open the URL.
3. Tap Share → Add to Home Screen.
4. Launch from the Home Screen for a full-screen experience. Keep the iPad in landscape.

## Notes
- Location: The app requests geolocation permission. If denied or unavailable, you can set latitude/longitude manually in Settings.
- Icons: iOS may snapshot an icon if no Apple touch icon is provided. The app references icons, but if they are missing, iOS will generate a snapshot automatically.
- Wake Lock: If your iPad supports Screen Wake Lock, the app will keep the display on. Otherwise, ensure Auto-Lock is disabled in system settings for continuous display.

## License
MIT
