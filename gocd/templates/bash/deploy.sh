#!/bin/bash
set -euo pipefail

eval "$(regions-project-env-vars --region="${SENTRY_REGION}")"

/devinfra/scripts/get-cluster-credentials

k8s-deploy \
  --type="deployment" \
  --label-selector="service=orbital" \
  --container-name="orbital" \
  --image="ghcr.io/getsentry/sentry-orbital:${GO_REVISION_ORBITAL_REPO}" \
  --wait-timeout-mins=5
