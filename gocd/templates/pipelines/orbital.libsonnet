local gocdtasks = import 'github.com/getsentry/gocd-jsonnet/libs/gocd-tasks.libsonnet';

function(region) {
  environment_variables: {
    GITHUB_TOKEN: '{{SECRET:[devinfra-github][token]}}',
    SENTRY_REGION: region,
  },
  lock_behavior: 'unlockWhenFinished',
  materials: {
    orbital_repo: {
      git: 'git@github.com:getsentry/sentry-orbital.git',
      shallow_clone: true,
      branch: 'main',
      destination: 'sentry-orbital',
    },
  },
  stages: [
    {
      checks: {
        jobs: {
          'ci-orbital': {
            elastic_profile_id: 'orbital',
            tasks: [
              gocdtasks.script(importstr '../bash/check-github-runs.sh'),
            ],
          },
        },
      },
    },
    {
      'deploy-primary': {
        fetch_materials: true,
        jobs: {
          'deploy-orbital': {
            elastic_profile_id: 'orbital',
            tasks: [
              gocdtasks.script(importstr '../bash/deploy.sh'),
            ],
          },
        },
      },
    },
  ],
}
