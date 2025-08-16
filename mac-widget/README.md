Mac widget for "Time to Salat"

This folder contains Swift source files you can drop into a macOS SwiftUI app with a WidgetKit extension to create a native macOS widget that shows the time-left until the next prayer.

Notes / limitations
- Widgets on macOS are driven by WidgetKit timelines. They cannot reliably update every second. The widget below updates every minute (suitable for HH:MM display). If you need per-second updates, use a small companion app or a menubar app instead.
- The widget computes prayer times locally (no network required) using a simplified solar algorithm ported from the PWA. It supports the same calculation methods (MWL, UmmAlQura, Egypt, Karachi, ISNA) and uses saved coordinates from UserDefaults (shared App Group) or falls back to a configurable default.

Quick install
1. In Xcode create a new macOS App project (App type: SwiftUI).
2. Add a new target: Widget Extension → WidgetKit Extension (macOS).
3. In the Widget Extension target, add the Swift files from this folder (`PrayerTimes.swift`, `SalatWidget.swift`).
4. (Optional) Create an App Group and enable it for both the app and the widget. Use the same group identifier in the code below if you want to save coordinates/settings from the main app.
5. Build & run. In Notification Center (widgets list) add your newly built widget.

Files
- PrayerTimes.swift — Swift port of the prayer time calculation helpers
- SalatWidget.swift — Widget code (timeline provider + SwiftUI view)

If you want, I can also:
- Add a tiny macOS companion app target that lets you set location and calculation method and shares them to the widget via App Group.
- Create a menubar app (for per-second updates) instead of a WidgetKit widget.
