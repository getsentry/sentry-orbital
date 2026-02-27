local orbital = import './pipelines/orbital.libsonnet';
local pipedream = import 'github.com/getsentry/gocd-jsonnet/libs/pipedream.libsonnet';

local pipedream_config = {
  name: 'orbital',
  // Orbital is only deployed to US
  include_regions: ['us'],
  materials: {
    orbital_repo: {
      git: 'git@github.com:getsentry/sentry-orbital.git',
      shallow_clone: true,
      branch: 'main',
      destination: 'sentry-orbital',
    },
  },
};

pipedream.render(pipedream_config, orbital)
