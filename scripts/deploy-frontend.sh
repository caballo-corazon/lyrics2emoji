#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

BUCKET=$(terraform -chdir=infra output -raw frontend_bucket_name)
DISTRIBUTION_DOMAIN=$(terraform -chdir=infra output -raw cloudfront_domain)

echo "Subiendo public/ y src/ a s3://$BUCKET ..."
aws s3 sync public/ "s3://$BUCKET/" --delete
aws s3 sync src/ "s3://$BUCKET/src/" --delete

echo "Listo: https://$DISTRIBUTION_DOMAIN"
