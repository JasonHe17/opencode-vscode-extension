import * as esbuild from "esbuild"

async function build() {
  const context = await esbuild.context({
    entryPoints: ["src/main.ts"],
    bundle: true,
    outfile: "dist/extension.js",
    platform: "node",
    target: "node16",
    format: "cjs",
    sourcemap: true,
    external: ["vscode"],
    treeShaking: true,
    logLevel: "info"
  })

  await context.rebuild()
  await context.dispose()
  console.log("✅ Extension built successfully!")
}

build().catch((e) => {
  console.error(e)
  process.exit(1)
})
