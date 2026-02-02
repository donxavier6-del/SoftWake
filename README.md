# AlarmLit

A premium alarm clock app built with React Native and Expo.

## Features

- Multiple alarm dismiss types (simple, shake, breathing, math, affirmation)
- Sleep tracking and insights
- Customizable alarm sounds and wake intensity
- Dark/light theme support
- Haptic feedback

## Tech Stack

- **Framework:** React Native + Expo SDK 54
- **Language:** TypeScript
- **State:** React Hooks + AsyncStorage
- **Testing:** Jest + React Native Testing Library

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Android Studio (for Android) or Xcode (for iOS)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Linting & Formatting

```bash
# Run ESLint
npm run lint

# Fix ESLint issues
npm run lint:fix

# Format code with Prettier
npm run format

# Check formatting
npm run format:check
```

## Project Structure

```
src/
├── components/       # Reusable UI components
├── hooks/            # Custom React hooks
├── services/         # Business logic services
├── styles/           # StyleSheet definitions
├── types/            # TypeScript type definitions
├── utils/            # Utility functions
├── constants/        # Configuration constants
└── __tests__/        # Unit tests
```

## Architecture

The app follows a modular architecture with separation of concerns:

- **Components** handle UI rendering
- **Hooks** manage state and side effects
- **Services** handle external APIs and persistence
- **Utils** provide pure helper functions

## Contributing

1. Create a feature branch from `master`
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## License

Private - All rights reserved
