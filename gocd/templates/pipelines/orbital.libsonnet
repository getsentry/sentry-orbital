local gocdtasks = import 'github.com/getsentry/gocd-jsonnet/libs/gocd-tasks.libsonnet';

function(region) {
  materials: {
    orbital_repo: {
      git: 'git@github.com:getsentry/sentry-orbital.git',
      shallow_clone: false,
      branch: 'master',
      destination: 'orbital',
    },
  },
  lock_behavior: 'unlockWhenFinished',
  stages: [
    {
      checks: {
        fetch_materials: true,
        environment_variables: {
          GITHUB_APP_ID: '{{SECRET:[devinfra-github][app_id]}}',
          GITHUB_APP_PRIVATE_KEY: '{{SECRET:[devinfra-github][private_key]}}',
        },
        jobs: {
          check: {
            timeout: 1200,
            elastic_profile_id: 'orbital-k8s',
            tasks: [
              gocdtasks.script(importstr '../bash/check-github.sh'),
            ],
          },
        },
      },
    },
    {
      'deploy-primary': {
        fetch_materials: true,
        environment_variables: {
          SENTRY_REGION: region,
        },
        jobs: {
          deploy: {
            timeout: 1200,
            elastic_profile_id: 'orbital-k8s',
            tasks: [
              gocdtasks.script(importstr '../bash/deploy.sh'),
            ],
          },
        },
      },
    },
  ],
}
