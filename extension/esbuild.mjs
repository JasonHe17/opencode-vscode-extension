import * as esbuild from "esbuild"

async function build() {
  // Build extension main process
  const extensionContext = await esbuild.context({
    entryPoints: ["src/main.ts"],
    bundle: true,
    outfile: "dist/extension.js",
    platform: "node",
    target: "node16",
    format: "esm",
    sourcemap: true,
    external: ["vscode"],
    treeShaking: true,
    logLevel: "info"
  })

  // Build webview chat script
  const webviewContext = await esbuild.context({
    entryPoints: ["webviews/chat/main.ts"],
    bundle: true,
    outfile: "webviews/chat/main.js",
    platform: "browser",
    target: "es2020",
    format: "iife",
    sourcemap: true,
    logLevel: "info"
  })

  await extensionContext.rebuild()
  await webviewContext.rebuild()
  
  await extensionContext.dispose()
  await webviewContext.dispose()
  
  console.log("✅ Extension and webview built successfully!")
}

build().catch((e) => {
  console.error(e)
  process.exit(1)
})
