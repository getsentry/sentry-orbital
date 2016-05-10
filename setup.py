#!/usr/bin/env python
"""
Orbital
=======

Orbital is a visualization for `Sentry <http://getsentry.com/>`_.
"""

# Hack to prevent stupid "TypeError: 'NoneType' object is not callable" error
# in multiprocessing/util.py _exit_function when running `python
# setup.py test` (see
# http://www.eby-sarna.com/pipermail/peak/2010-May/003357.html)
for m in ('multiprocessing', 'billiard'):
    try:
        __import__(m)
    except ImportError:
        pass

from setuptools import setup, find_packages

install_requires = [
    'gevent',
    'sentry',
]

setup(
    name='sentry-orbital',
    version='0.1.0',
    author='Sentry',
    author_email='hello@getsentry.com',
    url='https://github.com/getsentry/sentry-orbital',
    description='Orbital is a visualization for Sentry (https://getsentry.com)',
    long_description=__doc__,
    packages=find_packages(exclude=("tests", "tests.*",)),
    zip_safe=False,
    license='Apache 2.0',
    install_requires=install_requires,
    include_package_data=True,
    entry_points={
        'sentry.apps': [
            'orbital = orbital',
        ],
        'console_scripts': [
            'orbital = orbital.cli:main',
        ],
    },
    classifiers=[
        'Intended Audience :: Developers',
        'Intended Audience :: System Administrators',
        'Operating System :: OS Independent',
        'Programming Language :: Python :: 2',
        'Programming Language :: Python :: 2.6',
        'Programming Language :: Python :: 2.7',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.2',
        'Programming Language :: Python :: 3.3',
        'Programming Language :: Python :: 3.4',
        'Programming Language :: Python',
        'Topic :: Software Development',
    ],
)
