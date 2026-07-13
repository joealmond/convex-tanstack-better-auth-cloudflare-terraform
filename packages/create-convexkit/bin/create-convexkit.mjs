#!/usr/bin/env node
import { run } from '../lib/scaffold.mjs'

run().catch((error) => {
  console.error(`\nConvexKit could not create the project: ${error.message}`)
  process.exitCode = 1
})
