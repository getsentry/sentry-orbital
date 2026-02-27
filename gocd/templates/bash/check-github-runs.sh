#!/bin/bash
checks-githubactions-checkruns \
  getsentry/sentry-orbital \
  "${GO_REVISION_ORBITAL_REPO}" \
  "Build and smoke test" \
  --timeout-mins=15
