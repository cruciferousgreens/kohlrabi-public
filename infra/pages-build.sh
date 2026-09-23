#!/bin/bash
# Cloudflare Pages build step for the workout app.
# Publishes the repo root minus tests/ — parity with _config.yml's Jekyll
# `exclude: [tests]` on GitHub Pages. The unit-test harness stays in the
# repo but is never published to the site (it must not ship to phones).
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist
mkdir -p dist
tar --exclude='./dist' --exclude='./.git' --exclude='./tests' -cf - . | tar --no-same-owner -xf - -C dist
echo "pages-build: $(find dist -type f | wc -l) files staged in dist/"
