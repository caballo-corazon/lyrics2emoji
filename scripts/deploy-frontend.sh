#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# carga AWS_PROFILE/AWS_REGION de .env, igual que los scripts de Node (--env-file) —
# sin esto, `aws s3 sync` usaría el perfil por defecto del sistema en vez del tuyo
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

BUCKET=$(terraform -chdir=infra output -raw frontend_bucket_name)
DISTRIBUTION_DOMAIN=$(terraform -chdir=infra output -raw cloudfront_domain)
DISTRIBUTION_ID=$(terraform -chdir=infra output -raw cloudfront_distribution_id)

echo "Subiendo public/ y src/ a s3://$BUCKET ..."
aws s3 sync public/ "s3://$BUCKET/" --delete
aws s3 sync src/ "s3://$BUCKET/src/" --delete

# sin esto, CloudFront sigue sirviendo la versión vieja desde cache hasta 24h
# (TTL por defecto de la managed policy CachingOptimized) aunque S3 ya tenga la nueva
echo "Invalidando cache de CloudFront..."
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/*" > /dev/null

echo "Listo: https://$DISTRIBUTION_DOMAIN"
