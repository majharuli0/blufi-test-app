# Contributing to Blufi Test App

First off, thank you for considering contributing to the Blufi Test App! It's people like you that make the open-source community such an amazing place to learn, inspire, and create.

## How Can I Contribute?

### Reporting Bugs

- **Check the Issues**: Before opening a new issue, please check if the problem has already been reported.
- **Use a Template**: When reporting a bug, provide as much detail as possible, including steps to reproduce, expected behavior, and screenshots if applicable.

### Suggesting Enhancements

- **Open an Issue**: Explain the feature you'd like to see and why it would be useful.

### Pull Requests

1. **Fork the Repo**: Create your own copy of the project.
2. **Create a Branch**: Use a descriptive name for your branch (e.g., `fix-ios-bluetooth-callback`).
3. **Make Changes**: Follow the project's coding style and ensure your changes are well-tested.
4. **Submit for Review**: Open a Pull Request with a clear description of what you've done.

## Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/majharuli0/blufi-test-app.git
   cd blufi-test-app
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Configure Native Bridge**:
   ```bash
   npx expo prebuild
   npm run setup:ios
   npm run setup:android
   cd ios && pod install && cd ..
   ```

## Code of Conduct

Please be respectful and professional in all interactions within the project's community.

---

_Maintained by majharuli0_
