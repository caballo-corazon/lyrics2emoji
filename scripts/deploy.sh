#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Aplicando infraestructura (infra/)..."
terraform -chdir=infra apply

echo
./scripts/deploy-frontend.sh
