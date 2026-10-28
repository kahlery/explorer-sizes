#!/bin/sh
# Renders the Marketplace screenshots from mock.html with headless Chrome (never a visible window)
# into ../images/ and copies them to ../extension/images/.
set -e
cd "$(dirname "$0")"
here="$(pwd)"
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
profile="$here/.chrome-profile"

shot() { # out width height query
  "$chrome" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
    --user-data-dir="$profile" --window-size="$2,$3" --screenshot="$here/../images/$1" \
    "file://$here/mock.html?$4" 2>/dev/null
}

shot explorer-dark.png 960 560 "theme=dark"
shot explorer-light.png 960 560 "theme=light"
shot tooltip.png 600 410 "theme=dark&sidebar=430&tabs=0&select=&hover=.git&tooltip=1"

cp ../images/explorer-dark.png ../images/explorer-light.png ../images/tooltip.png ../extension/images/
