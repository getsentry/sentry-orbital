from setuptools import setup

setup(
    name="orbital-server",
    version="0.0.0.dev0",
    author="Sentry",
    author_email="ops@sentry.io",
    packages=["orbital_server"],
    zip_safe=False,
    include_package_data=True,
    entry_points={"console_scripts": ["orbital=orbital_server:main"]},
    classifiers=["DO NOT UPLOAD"],
    python_requires=">=3.7",
)
