#!/bin/bash
# Pi for iOS - Setup Script
# Downloads pre-built vendor libraries or builds from source

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VENDOR_DIR="$PROJECT_DIR/vendor"

echo "Pi for iOS - Setup"
echo "=================="

# Check if vendor already exists
if [ -d "$VENDOR_DIR/ghostty" ] && [ -d "$VENDOR_DIR/bun-device" ]; then
    echo "Vendor libraries already exist."
    echo "Remove vendor/ to re-download."
    exit 0
fi

mkdir -p "$VENDOR_DIR"

echo ""
echo "Vendor libraries are required to build Pi."
echo ""
echo "Options:"
echo "  1. Download pre-built binaries from GitHub Releases (recommended)"
echo "  2. Build from source (requires ~2 hours)"
echo ""

read -p "Choose option [1/2]: " choice

case $choice in
    1)
        echo "Downloading pre-built binaries..."
        echo "Visit: https://github.com/dannote/pi-ios/releases"
        echo "Download vendor-libs.tar.gz and run:"
        echo "  tar -xzf vendor-libs.tar.gz -C vendor/"
        ;;
    2)
        echo "Building from source..."
        echo "This will take approximately 2 hours."
        read -p "Continue? [y/N]: " confirm
        if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
            "$SCRIPT_DIR/build-deps.sh"
        fi
        ;;
    *)
        echo "Invalid option"
        exit 1
        ;;
esac
