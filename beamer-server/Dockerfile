# Use a Python image with uv pre-installed
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

# Setup a non-root user
RUN groupadd --system --gid 999 nonroot \
 && useradd --system --gid 999 --uid 999 --create-home nonroot

WORKDIR /app

# Enable bytecode compilation
ENV UV_COMPILE_BYTECODE=1
# Copy from the cache instead of linking since it's a mounted volume
ENV UV_LINK_MODE=copy
# Ensure installed tools can be executed out of the box
ENV UV_TOOL_BIN_DIR=/usr/local/bin

# Install the project's dependencies using the lockfile and settings
# (BuildKit mounts are supported on Cloud Build; if not, fall back to COPY pyproject/uv.lock)
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --locked --no-install-project --no-dev

# Add the rest of the project and install it
COPY . /app
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev

# Put the venv on PATH
ENV PATH="/app/.venv/bin:$PATH"

# Reset entrypoint
ENTRYPOINT []

# Use the non-root user
USER nonroot

# Cloud Run will set $PORT (usually 8080). Bind to it and to 0.0.0.0.
# We start uvicorn directly; no dev reload server in production.
CMD ["sh", "-c", "uv run uvicorn server:app --host 0.0.0.0 --port ${PORT:-8080}"]
