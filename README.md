# Orbital

Orbital is a geographical visualization of Sentry data.

## Setup

Pick a host (yes, it's a SPOF) to run the Orbital stream service on. Configure the the ``orbital`` service using supervisord etc.

```bash
$ orbital
```

If you need to pass custom configuration:

```bash
$ SENTRY_CONF=getsentry/settings.py orbital
```

Now within the Sentry app, you'll need to point things to the host you setup above:

```python
# settings.py
ORBITAL_UDP_SERVER = 'localhost:5556'
ORBITAL_STREAM_SERVER = 'http://localhost:7000'
```

Finally, register the URL:

```python
# urls.py
url(r'^live/', include('orbital.urls')),
```

Note: its assumed you know how to inject a custom ``urls.py``, and outside of the scope of Orbital to teach you.

## Contributing

You can generate mock data using the ``orbital`` cli:

```bash
$ orbital --test
```

