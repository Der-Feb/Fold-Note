const esbuild = require("esbuild");

const watch = process.argv.includes("--watch");

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  target: "node16",
  sourcemap: true,
  minify: process.env.NODE_ENV === "production",
};

if (watch) {
  esbuild
    .context(buildOptions)
    .then((ctx) => {
      ctx.watch();
      console.log("Watching for changes...");
    })
    .catch(() => process.exit(1));
} else {
  esbuild
    .build(buildOptions)
    .then(() => console.log("Build complete."))
    .catch(() => process.exit(1));
}
