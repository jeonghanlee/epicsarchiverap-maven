#!/usr/bin/env bash

THIS_SRC=${BASH_SOURCE[0]:-${0}}

if [ -L "$THIS_SRC" ]; then
    # shellcheck disable=SC2046
    SRC_PATH="$( cd -P "$( dirname $(readlink -f "$THIS_SRC") )" && pwd )"
else
    SRC_PATH="$( cd -P "$( dirname "$THIS_SRC" )" && pwd )"
fi

if ! command -v sphinx-build &> /dev/null
then
    echo "Instaling sphinx-build in a new virtual environment"
    python -m venv ${SRC_PATH}/.venv
    source ${SRC_PATH}/.venv/bin/activate
    python -m pip install --upgrade --no-cache-dir pip setuptools
    python -m pip install --exists-action=w --no-cache-dir -r ${SRC_PATH}/docs/requirements.txt
else
    echo "Using sphinx-build from the environment"
fi
sphinx-build ${SRC_PATH}/docs/source ${SRC_PATH}/docs/build
