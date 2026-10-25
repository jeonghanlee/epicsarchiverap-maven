# Builds the narrative documentation book with pinned mdBook binaries.
# The same image builds the book locally and in the GitHub Pages workflow,
# so both use identical tool versions. Static musl binaries are downloaded
# from the upstream releases and verified against their pinned checksums.
#
#   docker build -t aa-mdbook docs/book
#   docker run --rm -v "$PWD/docs/book:/book" aa-mdbook build
FROM alpine:3.24

# mdBook is pinned to the last 0.4.x release: mdbook-admonish 1.20.0 predates
# mdBook 0.5.0 and does not support the 0.5 preprocessor schema. Raise both
# together once an admonish release supports mdBook 0.5.
ARG MDBOOK_VERSION=0.4.52
ARG MDBOOK_SHA256=c96bdabf3754d9e016fb803c1565a41050434479b2dc1e02a87c8d0da7524c6c
ARG ADMONISH_VERSION=1.20.0
ARG ADMONISH_SHA256=abe3eb5ec70a427cd922684e27d709a52dc53b7abe588a036a6af903f376695e

RUN apk add --no-cache curl ca-certificates \
 && cd /tmp \
 && curl -fsSLO "https://github.com/rust-lang/mdBook/releases/download/v${MDBOOK_VERSION}/mdbook-v${MDBOOK_VERSION}-x86_64-unknown-linux-musl.tar.gz" \
 && echo "${MDBOOK_SHA256}  mdbook-v${MDBOOK_VERSION}-x86_64-unknown-linux-musl.tar.gz" | sha256sum -c - \
 && tar -xzf "mdbook-v${MDBOOK_VERSION}-x86_64-unknown-linux-musl.tar.gz" -C /usr/local/bin \
 && curl -fsSLO "https://github.com/tommilligan/mdbook-admonish/releases/download/v${ADMONISH_VERSION}/mdbook-admonish-v${ADMONISH_VERSION}-x86_64-unknown-linux-musl.tar.gz" \
 && echo "${ADMONISH_SHA256}  mdbook-admonish-v${ADMONISH_VERSION}-x86_64-unknown-linux-musl.tar.gz" | sha256sum -c - \
 && tar -xzf "mdbook-admonish-v${ADMONISH_VERSION}-x86_64-unknown-linux-musl.tar.gz" -C /usr/local/bin \
 && rm -f /tmp/*.tar.gz \
 && apk del curl

WORKDIR /book
ENTRYPOINT ["mdbook"]
CMD ["build"]
