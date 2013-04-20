#! /bin/sh
# call this with debug, compiled, or min

mode=$1

export NAMESPACES="screenstitch.Host screenstitch.Controller"
export EXTERNS="../../src/js/screenstitch/screenstitch-externs.js"
export ROOTS="../../src/js/"

# Compile
./make $mode screenstitch "../../build"

# Copy into static folder of django project
cp ../../build/screenstitch.js ../../django/static/js/screenstitch.js

echo "Build complete."
