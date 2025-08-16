import Foundation

// Minimal prayer time calculations ported to Swift
// This is an approximation suitable for a minute-granularity widget.

public enum CalculationMethod: String, Codable {
    case MWL, UmmAlQura, Egypt, Karachi, ISNA
}

public struct PrayerTimes {
    public let fajr: Date
    public let sunrise: Date
    public let dhuhr: Date
    public let asr: Date
    public let maghrib: Date
    public let isha: Date
}

fileprivate func dayOfYear(_ date: Date, calendar: Calendar) -> Int {
    return calendar.ordinality(of: .day, in: .year, for: date) ?? 0
}

fileprivate let DEG2RAD = Double.pi / 180.0
fileprivate let RAD2DEG = 180.0 / Double.pi

fileprivate func equationOfTimeMinutes(_ N: Int) -> Double {
    let B = 2.0 * Double.pi * (Double(N) - 81.0) / 364.0
    return 9.87 * sin(2 * B) - 7.53 * cos(B) - 1.5 * sin(B)
}

fileprivate func solarDeclinationRad(_ N: Int) -> Double {
    let deg = 23.45 * sin((2.0 * Double.pi / 365.0) * (284.0 + Double(N)))
    return deg * DEG2RAD
}

fileprivate func hourAngleForAltitude(latRad: Double, decRad: Double, altRad: Double) -> Double {
    let cosH = (sin(altRad) - sin(latRad) * sin(decRad)) / (cos(latRad) * cos(decRad))
    let c = min(max(cosH, -1.0), 1.0)
    return acos(c)
}

fileprivate func solarNoonLocalHours(date: Date, longitude: Double, calendar: Calendar) -> Double {
    let tz = Double(TimeZone.current.secondsFromGMT(for: date)) / 3600.0
    let N = dayOfYear(date, calendar: calendar)
    let eot = equationOfTimeMinutes(N)
    return 12.0 + tz - (longitude / 15.0) - (eot / 60.0)
}

fileprivate func timeFromNoon(date: Date, noonHours: Double, deltaHours: Double, calendar: Calendar) -> Date {
    var d = calendar.startOfDay(for: date)
    let ms = (noonHours + deltaHours) * 3600.0
    return d.addingTimeInterval(ms)
}

public func computePrayerTimes(for date: Date, lat: Double, lon: Double, method: CalculationMethod = .MWL, asrFactor: Double = 1.0, calendar: Calendar = .current) -> PrayerTimes {
    let latRad = lat * DEG2RAD
    let N = dayOfYear(date, calendar: calendar)
    let dec = solarDeclinationRad(N)
    let noon = solarNoonLocalHours(date: date, longitude: lon, calendar: calendar)

    let altSunrise = (-0.833) * DEG2RAD
    // method angles
    let fajrAngle: Double
    let ishaAngle: Double?
    let ishaInterval: Double?
    switch method {
    case .MWL:
        fajrAngle = 18.0; ishaAngle = 17.0; ishaInterval = nil
    case .UmmAlQura:
        fajrAngle = 18.5; ishaAngle = nil; ishaInterval = 90.0
    case .Egypt:
        fajrAngle = 19.5; ishaAngle = 17.5; ishaInterval = nil
    case .Karachi:
        fajrAngle = 18.0; ishaAngle = 18.0; ishaInterval = nil
    case .ISNA:
        fajrAngle = 15.0; ishaAngle = 15.0; ishaInterval = nil
    }

    let altFajr = (-fajrAngle) * DEG2RAD
    let H_sunrise = hourAngleForAltitude(latRad: latRad, decRad: dec, altRad: altSunrise)
    let H_fajr = hourAngleForAltitude(latRad: latRad, decRad: dec, altRad: altFajr)

    let sunrise = timeFromNoon(date: date, noonHours: noon, deltaHours: -(H_sunrise * RAD2DEG) / 15.0, calendar: calendar)
    let sunset = timeFromNoon(date: date, noonHours: noon, deltaHours: +(H_sunrise * RAD2DEG) / 15.0, calendar: calendar)
    let fajr = timeFromNoon(date: date, noonHours: noon, deltaHours: -(H_fajr * RAD2DEG) / 15.0, calendar: calendar)

    let isha: Date
    if let ia = ishaAngle {
        let altIsha = (-ia) * DEG2RAD
        let H_isha = hourAngleForAltitude(latRad: latRad, decRad: dec, altRad: altIsha)
        isha = timeFromNoon(date: date, noonHours: noon, deltaHours: +(H_isha * RAD2DEG) / 15.0, calendar: calendar)
    } else {
        isha = sunset.addingTimeInterval((ishaInterval ?? 90.0) * 60.0)
    }

    let dhuhr = timeFromNoon(date: date, noonHours: noon, deltaHours: 0.0, calendar: calendar)

    let n = asrFactor
    // approximate asr angle
    let angle = atan(1.0 / (n + tan(abs(latRad - dec))))
    let H_asr = hourAngleForAltitude(latRad: latRad, decRad: dec, altRad: angle)
    let asr = timeFromNoon(date: date, noonHours: noon, deltaHours: +(H_asr * RAD2DEG) / 15.0, calendar: calendar)

    let maghrib = sunset

    return PrayerTimes(fajr: fajr, sunrise: sunrise, dhuhr: dhuhr, asr: asr, maghrib: maghrib, isha: isha)
}
