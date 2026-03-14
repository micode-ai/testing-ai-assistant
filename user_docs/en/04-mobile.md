# Mobile App

## Overview

The Testing AI Assistant mobile app is built with Expo 52 and React Native 0.76.5. It supports iOS and Android and provides access to core platform features on the go.

## System Requirements

| Component | Requirement |
|-----------|------------|
| Node.js | >= 20.0.0 |
| Expo CLI | Installed via `npx` |
| iOS | Xcode 15+ (for iOS development) |
| Android | Android Studio + SDK 34+ |
| Expo Go | For quick on-device testing |

## Installation and Running

### Local Development

```bash
cd apps/mobile
npm install

# Start Expo dev server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios

# Run in browser
npm run web
```

### Testing on a Device

1. Install **Expo Go** on your mobile device (App Store / Google Play)
2. Run `npm start` in the `apps/mobile` directory
3. Scan the QR code from the terminal with your device camera
4. The app will open in Expo Go

## Features

### Authentication

- Email and password login
- OAuth login via GitHub, GitLab, Bitbucket
- Secure token storage via `expo-secure-store`
- Automatic token refresh

### Main Screens

- **Home** — overview of current state: active runs, recent results
- **Organizations** — browse and switch between organizations
- **Projects** — project list, webhook status
- **Pipelines** — view and trigger pipelines
- **Test Runs** — track execution, view results
- **AI Generation** — start and view AI generations
- **Notifications** — push notifications for events

### Push Notifications

The app supports push notifications via `expo-notifications`:

- Test run completion
- Failure detection
- Organization invitations
- AI generation results

### Navigation

The app uses `expo-router` (file-based routing):

- Tabs for main sections
- Stack navigation for details
- Deep linking for direct access

## Technologies

| Technology | Purpose |
|-----------|---------|
| Expo 52 | React Native platform |
| React Native 0.76.5 | Mobile framework |
| expo-router 4 | File-based routing |
| expo-secure-store | Secure data storage |
| expo-notifications | Push notifications |
| Zustand | State management |
| React Query | Server state and caching |

## Useful Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start Expo dev server |
| `npm run android` | Run on Android |
| `npm run ios` | Run on iOS |
| `npm run web` | Run in browser |
| `npm run lint` | Run linter |
| `npm run typecheck` | TypeScript type checking |
