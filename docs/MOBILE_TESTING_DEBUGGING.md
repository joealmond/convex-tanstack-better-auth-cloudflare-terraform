# Mobile Testing & Debugging

Platform-specific issues, testing procedures, and debugging techniques for Capacitor apps. Complements [MOBILE.md](MOBILE.md) (setup) and [MOBILE_BEST_PRACTICES.md](MOBILE_BEST_PRACTICES.md) (design patterns).

---

## iOS Platform Issues

### Debug vs Release Build Logging

**Problem**: iOS Debug builds show verbose logs including:
- Capacitor native bridge logs (`⚡️ To Native →`, `⚡️ TO JS`)
- better-auth session tokens in console
- SQLite debug output from `@capacitor/preferences`

**Security Risk**: Session tokens visible in logs are a **production security concern**. Anyone with access to device logs (developers, testers, debugging tools) can steal user sessions.

**Cannot Be Fixed via Code**: The `loggingBehavior` option in `capacitor.config.ts` is invalid/non-functional. Capacitor's iOS logging is controlled by Xcode's **build configuration**, not runtime code.

**Solution**: Use **Release** build configuration for testing and production:

1. In Xcode, click the scheme dropdown (next to Stop button)
2. Select **Edit Scheme...**
3. Under **Run** → **Info** → **Build Configuration** → Select **Release**
4. Close and run (Cmd+R)

**When to Use Debug vs Release**:
| Build Config | Logs | Use Case |
|-------------|------|----------|
| **Debug** | Verbose (includes session tokens) | Active development, debugging Capacitor bridge |
| **Release** | Minimal (no sensitive data) | **All testing**, TestFlight, App Store |

**Important**: NEVER submit a build with Debug configuration to TestFlight or App Store. Apple's review may flag security concerns.

---

### SceneDelegate Incompatibility

**Problem**: Capacitor v8 has known compatibility issues with iOS SceneDelegate architecture (GitHub issues [#6662](https://github.com/ionic-team/capacitor/issues/6662), [#7961](https://github.com/ionic-team/capacitor/issues/7961)). If you attempt to add SceneDelegate support:

**Symptoms**:
- ✅ Build succeeds with no errors
- ❌ App launches to a **black screen**
- ❌ No error messages in console
- ❌ No crash logs — app appears "running" but frozen

**Root Cause**: SceneDelegate's UIScene lifecycle methods conflict with Capacitor's `CAPBridgeViewController` window management. The WebView never initializes.

**Solution**: Use traditional **AppDelegate** approach:

1. **Do NOT** implement `UISceneSession` lifecycle methods in `AppDelegate.swift`
2. **Remove** `UIApplicationSceneManifest` from `Info.plist`
3. **Delete** any `SceneDelegate.swift` file
4. **Ensure** `AppDelegate` has `var window: UIWindow?` property

**Correct AppDelegate Pattern**:
```swift
import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?  // Required for Capacitor

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return true
  }

  // ❌ DO NOT ADD these SceneDelegate methods:
  // func application(_ application: UIApplication, configurationForConnecting ...)
  // func application(_ application: UIApplication, didDiscardSceneSessions ...)
}
```

**If You Already Added SceneDelegate**:
1. In Xcode: **Product → Clean Build Folder** (Cmd+Shift+K)
2. Delete `ios/App/DerivedData/` folder
3. Revert `AppDelegate.swift` and `Info.plist` to traditional pattern
4. Rebuild

**UIScene Warnings Are Harmless**: You may see Xcode warnings like:
```
UISceneConfigurationName key doesn't exist in the Info.plist
```
These warnings **do not affect app functionality** when using AppDelegate. Ignore them.

**Why This Matters**:
- SceneDelegate is required for **iPadOS multi-window support**
- Capacitor v8 predates widespread SceneDelegate adoption
- Workaround: Wait for Capacitor v9+ (requires migration)
- Alternative: Use single-window AppDelegate pattern

---

## Android Platform Issues

### Emulator GPS Testing

**Problem**: Android emulators don't have real GPS hardware. Location features (`@capacitor/geolocation`) return `null` or timeout.

**Symptoms**:
- "Nearby" filters show no results
- Map doesn't center on user location
- Location permissions granted but `getCurrentPosition()` fails

**Solution**: Set **mock location** via Extended Controls or ADB.

#### Method 1: Extended Controls (Recommended)

1. In the running emulator, click the **"..."** button (More) on the right sidebar
2. Select **Location** from the menu
3. Enter coordinates manually:
   - Example: San Francisco → `37.7749, -122.4194`
   - Example: Budapest → `47.4979, 19.0402`
   - Example: Vienna → `48.2082, 16.3738`
4. Click **Send** to update the emulator's GPS

#### Method 2: Command Line (ADB)

```bash
# Format: longitude latitude (note the order!)
adb emu geo fix -122.4194 37.7749

# Or use telnet
telnet localhost 5554
geo fix -122.4194 37.7749
```

**Note**: ADB order is `longitude latitude` (reversed from typical convention).

#### Method 3: Simulate Movement (Routes)

1. Open Extended Controls → Location
2. Switch to **Routes** tab
3. Load a GPX/KML file or use the map to create a route
4. Click **Play Route** to simulate user movement along the path

**Verify GPS Works**:
- Open Google Maps on the emulator — blue dot should appear at mock location
- Check your app's location features — should now work correctly

**Testing Checklist**:
- [ ] Set mock location before testing location features
- [ ] Grant location permissions when prompted
- [ ] Verify coordinates are within expected range (if using "nearby" filters)
- [ ] Test permission denied flow (Settings → Apps → YourApp → Permissions → Location → Deny)

---

## Map Libraries (Leaflet/Mapbox) Gesture Handling

**Problem**: Pinch-to-zoom on maps is designed for touch screens. On MacBook trackpads, the gesture doesn't work as expected during development testing.

**Symptoms**:
- Two-finger pinch on trackpad doesn't zoom Leaflet/Mapbox maps
- Developers assume the map is broken
- Works perfectly on phone/tablet touch screens

**Solution**: Enable **all zoom methods** for cross-device compatibility.

### react-leaflet Configuration

```tsx
import { MapContainer, TileLayer } from 'react-leaflet'

<MapContainer
  center={[47.4979, 19.0402]}
  zoom={12}
  // Enable all zoom methods for desktop + mobile
  scrollWheelZoom={true}     // Two-finger scroll on trackpad
  doubleClickZoom={true}     // Double-click/tap
  touchZoom={true}           // Pinch gesture on touch screens
  boxZoom={true}             // Shift+drag to select area
  keyboard={true}            // +/- keys
  className="h-full w-full"
>
  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
</MapContainer>
```

### Zoom Method Compatibility Matrix

| Method | MacBook Trackpad | Mouse | Touch Screen | Notes |
|--------|-----------------|-------|--------------|-------|
| **scrollWheelZoom** | ✅ Two-finger scroll | ✅ Wheel | ❌ Not applicable | Best for desktop |
| **doubleClickZoom** | ✅ Double-click | ✅ Double-click | ✅ Double-tap | Works everywhere |
| **touchZoom** | ❌ | ❌ | ✅ Pinch gesture | Mobile-only |
| **boxZoom** | ✅ Shift+drag | ✅ Shift+drag | ❌ | Desktop power users |
| **keyboard** | ✅ +/- keys | ✅ +/- keys | ❌ | Accessibility |

**Best Practice**: Enable **all zoom methods** — they're mutually exclusive by input device, so no conflicts occur.

### Mapbox GL JS Configuration

```tsx
import mapboxgl from 'mapbox-gl'

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  // All gestures enabled by default
  scrollZoom: true,
  doubleClickZoom: true,
  touchZoomRotate: true,
  boxZoom: true,
  keyboard: true,
})
```

Mapbox enables these by default — no need to opt in unless you previously disabled them.

---

## Common Debugging Scenarios

### App Crashes on Launch (No Logs)

**Possible Causes**:
1. SceneDelegate conflict (iOS) — see above
2. Missing native plugin in `capacitor.config.ts`
3. Invalid deep link scheme format

**Debug Steps**:
1. In Xcode: **Window → Devices and Simulators** → View Device Logs
2. Filter for your app's bundle ID
3. Look for crash reports or `EXC_BAD_ACCESS` errors
4. Revert recent changes to `Info.plist` or `AppDelegate.swift`

### OAuth Fails Silently (No Error Message)

**Possible Causes**:
1. `VITE_CONVEX_SITE_URL` not set or wrong
2. `trustedOrigins` missing Capacitor scheme
3. Google Cloud Console redirect URI mismatch
4. Cookie Bridge not implemented (Convex-specific)

**Debug Steps**:
1. Check browser console during OAuth flow (system browser, not WebView)
2. Verify redirect URI in address bar matches Google Console config
3. Confirm `set-cookie` header present in `/api/auth/callback/google` response
4. Add logging to Cookie Bridge Proxy in `convex/http.ts`

### Black Screen After OAuth Redirect

**Possible Causes**:
1. Deep link scheme not registered in `Info.plist` / `AndroidManifest.xml`
2. App delegate not handling deep link
3. better-auth-capacitor not installed or misconfigured

**Debug Steps**:
1. Test deep link manually: `xcrun simctl openurl booted yourapp://test` (iOS)
2. Check deep link handler fires: add `console.log` in `App.addListener('appUrlOpen', ...)`
3. Verify scheme in `withCapacitor({ scheme: 'yourapp' })` matches manifest

### Location Always Returns Null (Android Emulator)

**Fix**: Set mock location via Extended Controls (see above). Emulators have no GPS hardware — this is **expected behavior**.

---

## Testing Checklists

### iOS Pre-Release Checklist

- [ ] Switch to **Release** build configuration (no Debug logs)
- [ ] Test on physical device (simulators can't test all Capacitor features)
- [ ] Verify no session tokens visible in Xcode console
- [ ] Test dark mode (Settings → Display & Brightness → Dark)
- [ ] Test Dynamic Type (Settings → Accessibility → Larger Text)
- [ ] Test VoiceOver (Settings → Accessibility → VoiceOver → On)
- [ ] Safe areas respected on iPhone with notch/Dynamic Island
- [ ] App Store screenshots use Release build

### Android Pre-Release Checklist

- [ ] Test on physical device (emulators have limited GPS/camera)
- [ ] Set mock location if testing on emulator
- [ ] Verify ProGuard patch applied (`grep proguard-android-optimize node_modules/@capacitor/camera/android/build.gradle`)
- [ ] Test dark mode (Settings → Display → Dark theme)
- [ ] Test TalkBack (Settings → Accessibility → TalkBack → On)
- [ ] Test on Android 10 (API 29) for backward compatibility
- [ ] Build succeeds with `./gradlew bundleRelease` (no errors)

---

## Reference Documentation

- [Capacitor iOS Documentation](https://capacitorjs.com/docs/ios)
- [Capacitor Android Documentation](https://capacitorjs.com/docs/android)
- [Xcode Build Configurations](https://developer.apple.com/documentation/xcode/customizing-the-build-schemes-for-a-project)
- [Android Emulator Extended Controls](https://developer.android.com/studio/run/emulator#extended)
- [Leaflet Interaction Options](https://leafletjs.com/reference.html#map-interaction-options)
- [Mapbox GL JS Interaction Handlers](https://docs.mapbox.com/mapbox-gl-js/api/handlers/)

---

*Last updated: February 2026*
