import WidgetKit
import SwiftUI

struct SalatEntry: TimelineEntry {
    let date: Date
    let nextName: String
    let nextTime: Date
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SalatEntry {
        SalatEntry(date: Date(), nextName: "Dhuhr", nextTime: Date().addingTimeInterval(3600))
    }

    func getSnapshot(in context: Context, completion: @escaping (SalatEntry) -> Void) {
        let entry = computeEntry()
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SalatEntry>) -> Void) {
        // Update every minute
        var entries: [SalatEntry] = []
        let now = Date()
        for offset in 0..<60*24 { // one day of minute entries
            if let d = Calendar.current.date(byAdding: .minute, value: offset, to: now) {
                let entry = computeEntry(at: d)
                entries.append(entry)
            }
        }
        let timeline = Timeline(entries: entries, policy: .atEnd)
        completion(timeline)
    }

    func computeEntry(at date: Date = Date()) -> SalatEntry {
        // Try user defaults group first (optional)
        let defaults = UserDefaults.standard
        let lat = defaults.double(forKey: "tts.lat") == 0 ? 21.3891 : defaults.double(forKey: "tts.lat")
        let lon = defaults.double(forKey: "tts.lon") == 0 ? 39.8579 : defaults.double(forKey: "tts.lon")
        let methodRaw = defaults.string(forKey: "tts.method") ?? "MWL"
        let method = CalculationMethod(rawValue: methodRaw) ?? .MWL

        let times = computePrayerTimes(for: date, lat: lat, lon: lon, method: method)
        // Determine next prayer
        let order: [(String, Date)] = [("Fajr", times.fajr), ("Dhuhr", times.dhuhr), ("Asr", times.asr), ("Maghrib", times.maghrib), ("Isha", times.isha)]
        for (name, t) in order {
            if date < t { return SalatEntry(date: date, nextName: name, nextTime: t) }
        }
        // tomorrow fajr
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: date)!
        let tTimes = computePrayerTimes(for: tomorrow, lat: lat, lon: lon, method: method)
        return SalatEntry(date: date, nextName: "Fajr", nextTime: tTimes.fajr)
    }
}

struct SalatWidgetEntryView : View {
    var entry: Provider.Entry

    var body: some View {
        ZStack {
            Color.black
            VStack(spacing: 6) {
                Text("Next: \(entry.nextName)")
                    .foregroundColor(Color(.systemGray))
                    .font(.system(size: 14, weight: .regular, design: .rounded))
                Text(timeString(from: Date().distance(to: entry.nextTime)))
                    .foregroundColor(.white)
                    .font(.system(size: 36, weight: .bold, design: .monospaced))
                Text("at \(shortTime(entry.nextTime))")
                    .foregroundColor(Color(.systemGray2))
                    .font(.system(size: 12))
            }
            .padding()
        }
    }

    func shortTime(_ d: Date) -> String {
        let f = DateFormatter()
        f.timeStyle = .short
        return f.string(from: d)
    }

    func timeString(from interval: TimeInterval) -> String {
        let total = max(0, Int(interval))
        let h = total / 3600
        let m = (total % 3600) / 60
        return String(format: "%d:%02d", h, m)
    }
}

@main
struct SalatWidget: Widget {
    let kind: String = "SalatWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            SalatWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Time to Salat")
        .description("Shows time remaining to the next prayer.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
