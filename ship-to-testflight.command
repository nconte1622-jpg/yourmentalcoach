#!/bin/bash
# Ship to TestFlight — runs npm build + cap sync, then opens Xcode
# Double-click this file in Finder to execute

# Navigate to the project directory (wherever this script lives)
cd "$(dirname "$0")"

echo "======================================"
echo "  Your Mental Coach — TestFlight Build"
echo "======================================"
echo ""
echo "Step 1: Building React/Vite app..."
npm run build

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ Build failed! Check errors above."
  read -p "Press Enter to close..."
  exit 1
fi

echo ""
echo "Step 2: Syncing Capacitor to iOS..."
npx cap sync ios

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ Cap sync failed! Check errors above."
  read -p "Press Enter to close..."
  exit 1
fi

echo ""
echo "======================================"
echo "✅ Build complete! Ready to Archive."
echo ""
echo "Next steps in Xcode:"
echo "  1. Product → Archive"
echo "  2. Distribute App → App Store Connect → Upload"
echo "======================================"
echo ""
read -p "Press Enter to close this window..."
