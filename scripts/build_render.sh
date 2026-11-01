#!/usr/bin/env bash
set -e

echo "=== Building Frontend SPA ==="
cd client
npm ci || npm install
npm run build
cd ..

echo "=== Installing Python Backend Dependencies ==="
python -m pip install --upgrade pip
pip install -r requirements-render.txt

echo "=== Build Finished Successfully ==="
