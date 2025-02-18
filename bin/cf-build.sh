#! /bin/bash
# set -x

create_config() {
  case $CF_PAGES_BRANCH in
      main)
          export BASE_URL=$PRODUCTION_URL
          ;;
      *)
          export BASE_URL=$CF_PAGES_URL
          ;;
  esac

  envsubst < cloudflare-config.toml > build_cloudflare_config.toml
}



build() {
  zola -c build_cloudflare_config.toml build
}

create_config
build
