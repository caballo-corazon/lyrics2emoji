#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

BUILD_DIR=".build/lambda"

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/lambda" "$BUILD_DIR/server-lib" "$BUILD_DIR/public/data"

cp ../lambda/handler.mjs "$BUILD_DIR/lambda/handler.mjs"
cp ../server-lib/*.js "$BUILD_DIR/server-lib/"
cp ../public/data/openmoji.json "$BUILD_DIR/public/data/openmoji.json"

cat > "$BUILD_DIR/package.json" <<'EOF'
{
  "type": "module",
  "dependencies": {
    "@aws-sdk/client-bedrock-runtime": "^3.1098.0",
    "@aws-sdk/client-dynamodb": "^3.1098.0",
    "@aws-sdk/client-s3": "^3.1098.0",
    "@aws-sdk/lib-dynamodb": "^3.1098.0"
  }
}
EOF

npm install --omit=dev --no-audit --no-fund --prefix "$BUILD_DIR" > /dev/null
