#!/bin/bash

eval "$(regions-project-env-vars --region="${SENTRY_REGION}")"

/devinfra/scripts/get-cluster-credentials \
  && k8s-deploy \
  --label-selector="service=orbital" \
  --image="ghcr.io/getsentry/sentry-orbital:${GO_REVISION_ORBITAL_REPO}" \
  --container-name="orbital"
