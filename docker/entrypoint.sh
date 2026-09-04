#!/bin/sh
set -e

# Configuration precedence, highest first:
#   1. the container environment - Compose `environment:`, `env_file:`,
#      `docker run -e`, shell exports Compose interpolates
#   2. $DATA_DIR/config.env - operator values persisted in the data volume,
#      written by `setup` below or by hand; one KEY=VALUE per line, no quoting
#   3. $DATA_DIR/.secrets.env - values generated on first boot
# An empty environment value counts as unset, so a Compose default such as
# `${OPENAI_API_KEY:-}` never masks a persisted value.
#
# The command runs as a child of this script, which polls config.env every
# PLATFORM_CONFIG_WATCH_INTERVAL seconds (default 5) and restarts the child
# when the file changes, so `setup` applies without an operator restart. Set
# the interval to 0 to exec the command directly instead.

DATA_DIR="${PLATFORM_DATA_DIR:-/data}"
CONFIG_FILE="$DATA_DIR/config.env"
SECRETS_FILE="$DATA_DIR/.secrets.env"
STORAGE_FILE="$DATA_DIR/.storage.env"
WATCH_INTERVAL="${PLATFORM_CONFIG_WATCH_INTERVAL:-5}"

DEFAULT_SETUP_KEYS="OPENAI_API_KEY OPENROUTER_MODELS_API_KEY VERCEL_MODELS_API_KEY"

# @note every variable this script exports is recorded so a reload can unset
# them all and resolve from scratch; container environment values are never
# in the list, which is what keeps them winning
LOADED_KEYS=""

is_empty() {
  eval "[ -z \"\${$1}\" ]"
}

is_valid_key() {
  case "$1" in
    '' | [0-9]* | *[!A-Za-z0-9_]*) return 1 ;;
  esac
}

load_export() {
  export "$1=$2"
  LOADED_KEYS="$LOADED_KEYS $1"
}

config_get() {
  [ -f "$CONFIG_FILE" ] || return 0
  sed -n "s/^$1=//p" "$CONFIG_FILE" | tail -n 1
}

# config_set KEY VALUE - an empty VALUE removes the entry
config_set() {
  umask 077
  mkdir -p "$DATA_DIR"
  {
    if [ -f "$CONFIG_FILE" ]; then
      grep -v "^$1=" "$CONFIG_FILE" || true
    fi
    if [ -n "$2" ]; then
      printf '%s=%s\n' "$1" "$2"
    fi
  } > "$CONFIG_FILE.tmp"
  mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
}

config_load() {
  [ -f "$CONFIG_FILE" ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in '' | '#'*) continue ;; esac
    key="${line%%=*}"
    value="${line#*=}"
    is_valid_key "$key" || continue
    if is_empty "$key"; then
      load_export "$key" "$value"
    fi
  done < "$CONFIG_FILE"
}

config_fingerprint() {
  [ -f "$CONFIG_FILE" ] || return 0
  cksum < "$CONFIG_FILE"
}

# read_secret KEY - prompts on the terminal without echo; Enter keeps the
# current value, a single "-" clears it
read_secret() {
  current="$(config_get "$1")"
  if [ -n "$current" ]; then
    hint="currently set, ends with ${current#"${current%????}"}"
  else
    hint="not set"
  fi
  printf '%s [%s]: ' "$1" "$hint" >&2
  if [ -t 0 ]; then
    trap 'stty echo; exit 130' INT TERM
    stty -echo
    IFS= read -r input
    stty echo
    trap - INT TERM
    echo >&2
  else
    IFS= read -r input
  fi
  case "$input" in
    '') ;;
    '-') config_set "$1" '' ; echo "$1 cleared" >&2 ;;
    *) config_set "$1" "$input" ; echo "$1 saved" >&2 ;;
  esac
}

# setup [KEY | KEY=VALUE ...] - persists operator values in $CONFIG_FILE.
# Bare keys prompt; KEY=VALUE sets without prompting (KEY= removes). With no
# arguments the default provider keys are prompted for.
run_setup() {
  [ $# -gt 0 ] || set -- $DEFAULT_SETUP_KEYS
  for arg in "$@"; do
    key="${arg%%=*}"
    if ! is_valid_key "$key"; then
      echo "ERROR: invalid variable name: $key" >&2
      exit 1
    fi
    case "$arg" in
      *=*) config_set "$key" "${arg#*=}" ; echo "$key saved" >&2 ;;
      *)
        if [ ! -t 0 ]; then
          echo "ERROR: no terminal to prompt for $key - pass $key=VALUE or run with -it" >&2
          exit 1
        fi
        read_secret "$key"
        ;;
    esac
  done
  echo "INFO: values persisted in $CONFIG_FILE - a running platform service restarts itself to apply them; restart it by hand if config watching is disabled" >&2
}

if [ "$1" = "setup" ]; then
  shift
  run_setup "$@"
  exit 0
fi

# Fills empty NEXTAUTH_SECRET / QUEUE_SECRET / JWT_TOKEN_SECRET_KEY /
# CLOAK_ENCRYPTION_KEY with values generated once and persisted in $DATA_DIR,
# so sessions, queue signatures, issued tokens and encrypted values survive
# restarts as long as it is a volume.
secrets_load() {
  if [ -n "$NEXTAUTH_SECRET" ] && [ -n "$QUEUE_SECRET" ] && [ -n "$JWT_TOKEN_SECRET_KEY" ] && [ -n "$CLOAK_ENCRYPTION_KEY" ]; then
    return 0
  fi

  generate_secret() {
    node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))'
  }

  # @note the k1.aesgcm256 format @chatbotkit-dev/cloak expects: 32 random
  # bytes, base64url without padding
  generate_cloak_key() {
    node -e 'process.stdout.write("k1.aesgcm256." + require("node:crypto").randomBytes(32).toString("base64url"))'
  }

  if [ ! -f "$SECRETS_FILE" ]; then
    umask 077
    printf 'GENERATED_NEXTAUTH_SECRET=%s\nGENERATED_QUEUE_SECRET=%s\n' "$(generate_secret)" "$(generate_secret)" > "$SECRETS_FILE"
  fi

  . "$SECRETS_FILE"

  # @note volumes created before the JWT secret was generated here lack it
  if [ -z "$GENERATED_JWT_TOKEN_SECRET_KEY" ]; then
    GENERATED_JWT_TOKEN_SECRET_KEY="$(generate_secret)"
    printf 'GENERATED_JWT_TOKEN_SECRET_KEY=%s\n' "$GENERATED_JWT_TOKEN_SECRET_KEY" >> "$SECRETS_FILE"
  fi

  # @note likewise for the cloak key. Without it the application refused every
  # skillset call with an unrelated-looking TypeError, because the module that
  # parses it threw at import inside a require cycle
  if [ -z "$GENERATED_CLOAK_ENCRYPTION_KEY" ]; then
    GENERATED_CLOAK_ENCRYPTION_KEY="$(generate_cloak_key)"
    printf 'GENERATED_CLOAK_ENCRYPTION_KEY=%s\n' "$GENERATED_CLOAK_ENCRYPTION_KEY" >> "$SECRETS_FILE"
  fi

  if [ -z "$NEXTAUTH_SECRET" ]; then
    echo "WARNING: NEXTAUTH_SECRET is not set - using a generated value persisted in $SECRETS_FILE" >&2
    load_export NEXTAUTH_SECRET "$GENERATED_NEXTAUTH_SECRET"
  fi

  if [ -z "$QUEUE_SECRET" ]; then
    echo "WARNING: QUEUE_SECRET is not set - using a generated value persisted in $SECRETS_FILE" >&2
    load_export QUEUE_SECRET "$GENERATED_QUEUE_SECRET"
  fi

  if [ -z "$JWT_TOKEN_SECRET_KEY" ]; then
    echo "WARNING: JWT_TOKEN_SECRET_KEY is not set - using a generated value persisted in $SECRETS_FILE" >&2
    load_export JWT_TOKEN_SECRET_KEY "$GENERATED_JWT_TOKEN_SECRET_KEY"
  fi

  if [ -z "$CLOAK_ENCRYPTION_KEY" ]; then
    echo "WARNING: CLOAK_ENCRYPTION_KEY is not set - using a generated value persisted in $SECRETS_FILE" >&2
    load_export CLOAK_ENCRYPTION_KEY "$GENERATED_CLOAK_ENCRYPTION_KEY"
  fi
}

# Storage credentials generated by garage-init land in the shared data
# volume - see docker/garage/init.mjs.
storage_load() {
  if [ -z "$STORAGE_ACCESS_KEY_ID" ] && [ -f "$STORAGE_FILE" ]; then
    . "$STORAGE_FILE"

    echo "INFO: using generated storage credentials from $STORAGE_FILE" >&2

    load_export STORAGE_ACCESS_KEY_ID "$GENERATED_STORAGE_ACCESS_KEY_ID"
    load_export STORAGE_SECRET_ACCESS_KEY "$GENERATED_STORAGE_SECRET_ACCESS_KEY"
  fi
}

runtime_load() {
  config_load
  secrets_load
  storage_load
}

runtime_unload() {
  for key in $LOADED_KEYS; do
    unset "$key"
  done
  LOADED_KEYS=""
}

runtime_load

if [ "$WATCH_INTERVAL" = "0" ]; then
  exec "$@"
fi

# The command runs as a child; its own exit ends the container with its
# status, as `exec` would, so a crash still reaches the restart policy. Only a
# change to $CONFIG_FILE restarts it.
child=""
stopping=""

forward_signal() {
  stopping=1
  if [ -n "$child" ]; then
    kill -s "$1" "$child" 2>/dev/null || true
  fi
}

trap 'forward_signal TERM' TERM
trap 'forward_signal INT' INT

fingerprint="$(config_fingerprint)"

while :; do
  "$@" &
  child=$!

  while :; do
    # @note sleeping in the background keeps the wait interruptible, so a
    # trapped signal is forwarded at once rather than after the tick
    sleep "$WATCH_INTERVAL" &
    wait $! || true

    if [ -n "$stopping" ]; then
      break
    fi

    kill -0 "$child" 2>/dev/null || break

    current="$(config_fingerprint)"
    if [ "$current" != "$fingerprint" ]; then
      fingerprint="$current"
      echo "INFO: $CONFIG_FILE changed - restarting the command to apply it" >&2
      kill -s TERM "$child" 2>/dev/null || true
      wait "$child" || true
      child=""
      runtime_unload
      runtime_load
      continue 2
    fi
  done

  status=0
  wait "$child" || status=$?
  exit "$status"
done
