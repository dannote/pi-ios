#!/bin/bash
set -euo pipefail

# Bundle pi-coding-agent for iOS
# Creates app/PiTerminal/Resources/pi-ios-bundle.js

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/.."
OUTPUT="$PROJECT_DIR/app/PiTerminal/Resources/pi-ios-bundle.js"

PI_PATH="$HOME/.bun/install/global/node_modules/@mariozechner/pi-coding-agent"

if [ ! -d "$PI_PATH" ]; then
    echo "Installing pi-coding-agent globally..."
    bun install -g @mariozechner/pi-coding-agent
fi

echo "Bundling pi-coding-agent..."

# Create temp entry file
TEMP_ENTRY=$(mktemp /tmp/pi-entry.XXXXXX.ts)
cat > "$TEMP_ENTRY" << EOF
export * from "@mariozechner/pi-coding-agent";
export { getModel, getModels, getProviders } from "@mariozechner/pi-ai/models";
export { InteractiveMode } from "@mariozechner/pi-tui/interactive-mode";
export { Container, TUI } from "@mariozechner/pi-tui";
EOF

# Bundle with Bun
bun build "$TEMP_ENTRY" \
    --outfile "$OUTPUT" \
    --target=bun \
    --minify

rm "$TEMP_ENTRY"

SIZE=$(du -h "$OUTPUT" | cut -f1)
echo "Bundle created: $OUTPUT ($SIZE)"
