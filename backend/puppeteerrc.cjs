const { join } = require('path')

// Forces Puppeteer to download/look for Chrome inside THIS project folder
// instead of the OS home directory (~/.cache/puppeteer). This is the fix
// for "Could not find Chrome" on Render: Render's build step and runtime
// step can end up with different HOME/user contexts, so the default
// home-dir cache path can mean the browser gets downloaded in one place
// during build and looked up in a different place at runtime. A path
// relative to the project itself is guaranteed to be the same in both
// phases, since the whole project folder carries over as-is.
//
// After changing this, Puppeteer needs to redownload Chrome into the new
// location — `npm install` (which runs the "postinstall" script in
// package.json) does this automatically. On Render specifically, trigger
// this with "Clear build cache & deploy", not a normal redeploy, so the
// install step actually reruns instead of using a cached node_modules.
module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
}
