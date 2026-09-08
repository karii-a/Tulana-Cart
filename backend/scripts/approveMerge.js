// Manually merges two product rows you've confirmed by eye are the same
// real-world item (typically after looking through reviewQueue.js's
// output). The FIRST id you pass is the one that survives; the second is
// deleted and its price rows are moved onto the first.
//
// Usage (from the backend/ folder):
//   node scripts/approveMerge.js <keepId> <dropId>

const { mergeProductRows } = require('./mergeProducts')

async function main() {
  const [keepId, dropId] = process.argv.slice(2).map((n) => parseInt(n, 10))

  if (!keepId || !dropId) {
    console.error('Usage: node scripts/approveMerge.js <keepId> <dropId>')
    process.exit(1)
  }

  if (keepId === dropId) {
    console.error('keepId and dropId must be different products.')
    process.exit(1)
  }

  try {
    const { moved, skipped } = await mergeProductRows(keepId, dropId)
    console.log(`Merged product #${dropId} into #${keepId}.`)
    console.log(`  moved ${moved} price row(s)`)
    if (skipped > 0) console.log(`  skipped ${skipped} row(s) — #${keepId} already had a price for that store`)
  } catch (err) {
    console.error(`Merge failed: ${err.message}`)
    process.exit(1)
  }
}

main()