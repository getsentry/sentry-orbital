#!/bin/bash
set -euo pipefail
checks-githubactions-checkruns \
  getsentry/sentry-orbital \
  "${GO_REVISION_ORBITAL}" \
  "Build and smoke test" \
  --timeout-mins=15
