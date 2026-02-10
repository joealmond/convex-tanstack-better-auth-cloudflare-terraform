# Mobile App Integration

Guide for converting the web app to native iOS/Android using Capacitor.

---

## Overview

| Approach | Stack | Effort | Best For |
|----------|-------|--------|----------|
| **Capacitor** | Web → Native | Low | Reuse existing code |
| **Expo/React Native** | React Native | Medium | Fresh mobile-first |
| **Tauri v2** | Web + Rust | High | Smallest bundles |

**Recommendation**: Capacitor for this template (reuses TanStack components).

---

## Quick Start with Capacitor

### 1. Install

```bash
npm install @capacitor/core @capacitor/cli
npx cap init "App Name" com.yourcompany.app
```

### 2. Add Platforms

```bash
npx cap add ios
npx cap add android
```

### 3. Build & Sync

```bash
npm run build
npx cap sync
```

### 4. Open in IDE

```bash
npx cap open ios      # Opens Xcode
npx cap open android  # Opens Android Studio
```

---

## Native Plugins

### Camera

```bash
npm i @capacitor/camera
```

```typescript
import { Camera, CameraResultType } from '@capacitor/camera'

const photo = await Camera.getPhoto({
  resultType: CameraResultType.Uri,
  quality: 90,
})
```

### Geolocation

```bash
npm i @capacitor/geolocation
```

```typescript
import { Geolocation } from '@capacitor/geolocation'

const position = await Geolocation.getCurrentPosition()
console.log(position.coords.latitude, position.coords.longitude)
```

### Push Notifications

```bash
npm i @capacitor/push-notifications
```

```typescript
import { PushNotifications } from '@capacitor/push-notifications'

await PushNotifications.requestPermissions()
await PushNotifications.register()

PushNotifications.addListener('registration', (token) => {
  // Send token to backend
})
```

---

## Convex in Mobile

Convex works the same way - real-time subscriptions work out of the box.

```typescript
// Works identically in web and mobile
const messages = useQuery(api.messages.list)
const sendMessage = useMutation(api.messages.send)
```

---

## Alternative: Replit + Expo

For AI-assisted mobile development:

1. Create new Replit project
2. Prompt: "Create a mobile app that stores data in Convex"
3. Run `npx convex dev` in shell
4. Deploy: `npx convex deploy --cmd 'npx expo export -p web'`

---

## PWA Fallback

The template already supports PWA via Cloudflare Workers. Users can "Add to Home Screen" without app store submission.

```typescript
// Already configured in vite.config.ts
```
