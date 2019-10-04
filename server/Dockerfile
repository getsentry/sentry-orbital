FROM python:3.7-alpine

RUN mkdir -p /usr/src/orbital
WORKDIR /usr/src/orbital

COPY requirements.txt .
RUN set -eux; \
    apk add --no-cache --virtual .build-deps \
        gcc \
        make \
        musl-dev \
    ; \
    pip install --disable-pip-version-check --no-cache-dir -r requirements.txt; \
    apk del --no-network .build-deps

COPY . ./

RUN pip install --disable-pip-version-check --no-cache-dir .

EXPOSE 7000
EXPOSE 5556/udp

ENTRYPOINT ["orbital"]
CMD ["--host=0.0.0.0"]
