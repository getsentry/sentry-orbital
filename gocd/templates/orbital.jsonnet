local orbital = import './pipelines/orbital.libsonnet';
local pipedream = import 'github.com/getsentry/gocd-jsonnet/libs/pipedream.libsonnet';

local pipedream_config = {
  name: 'orbital-k8s',
  auto_deploy: true,
  // US-only
  exclude_regions: [
    's4s',
    's4s2',
    'de',
    'customer-1',
    'customer-2',
    'customer-4',
    'customer-7',
  ],
  materials: {
    orbital_repo: {
      git: 'git@github.com:getsentry/sentry-orbital.git',
      shallow_clone: false,
      branch: 'master',
      destination: 'orbital',
    },
  },
  rollback: {
    material_name: 'orbital_repo',
    stage: 'deploy-primary',
    elastic_profile_id: 'orbital-k8s',
  },
};

pipedream.render(pipedream_config, orbital)
