#!/bin/bash

checks-githubactions-checkruns2 \
  getsentry/sentry-orbital \
  "${GO_REVISION_ORBITAL_REPO}" \
  "Build and smoke test"
