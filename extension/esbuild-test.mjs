import * as esbuild from "esbuild"

async function build() {
  const context = await esbuild.context({
    entryPoints: ["src/main-test.ts"],
    bundle: true,
    outfile: "dist/extension.js",
    platform: "node",
    target: "node16",
    format: "cjs",
    sourcemap: true,
    external: ["vscode"],
    banner: {
      js: `const vscode = require('vscode');`
    }
  })

  await context.rebuild()
  await context.dispose()
  console.log("✅ Minimal extension built successfully!")
}

build().catch((e) => {
  console.error(e)
  process.exit(1)
})
