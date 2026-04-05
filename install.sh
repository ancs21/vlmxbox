#!/bin/bash
set -euo pipefail

# vlmxbox installer
# Usage: curl -fsSL https://raw.githubusercontent.com/ancs21/vlmxbox/main/install.sh | bash

REPO="ancs21/vlmxbox"
BINARY="vlmxbox"

# Detect OS and arch
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

case "$OS" in
  linux)  OS="linux" ;;
  darwin) OS="darwin" ;;
  *)      echo "Unsupported OS: $OS"; exit 1 ;;
esac

case "$ARCH" in
  x86_64|amd64)  ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *)             echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

ASSET="${BINARY}-${OS}-${ARCH}"

INSTALL_DIR="/usr/local/bin"

echo "vlmxbox installer"
echo "================="
echo ""
echo "  OS:      $OS"
echo "  Arch:    $ARCH"
echo "  Install: $INSTALL_DIR"
echo ""

# Get latest release tag
echo "Fetching latest release..."
LATEST=$(curl -sL "https://api.github.com/repos/${REPO}/releases" | grep '"tag_name"' | head -1 | cut -d'"' -f4)

if [ -z "$LATEST" ]; then
  echo "Error: Could not find latest release. Check https://github.com/${REPO}/releases"
  exit 1
fi

echo "  Version: $LATEST"

DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${LATEST}/${ASSET}"

# Download
echo "Downloading ${ASSET}..."
mkdir -p "$INSTALL_DIR"
curl -fsSL "$DOWNLOAD_URL" -o "${INSTALL_DIR}/${BINARY}"
chmod +x "${INSTALL_DIR}/${BINARY}"

echo ""
echo "Installed vlmxbox to ${INSTALL_DIR}/${BINARY}"

echo ""
echo "Get started:"
echo "  vlmxbox --help"
echo "  vlmxbox up"
