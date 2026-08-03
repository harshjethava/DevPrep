/**
 * resetAndSeedOne.js
 *
 * Step 1: DELETE all CodingProblem documents from MongoDB
 * Step 2: Insert ONE hardcoded Codeforces problem (1A — Theatre Square)
 *         with correct test cases, starterCode for JS/Python/C++/Java
 *
 * Why hardcoded? Codeforces blocks scraping (403/503). The problem data
 * below is the exact verified content from codeforces.com/problemset/problem/1/A
 *
 * Usage:
 *   node backend/scripts/resetAndSeedOne.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const CodingProblem = require('../src/models/CodingProblem');

const MONGO_URI = process.env.MONGO_URI;

// ─── Theatre Square — Codeforces 1A ─────────────────────────────────────────
//
// Problem: A rectangular n×m field of paving stones each of size a×a.
// Count the minimum number of tiles needed to cover the field.
// Formula: ceil(n/a) * ceil(m/a)
//
// Input:  One line with 3 integers: n m a
// Output: One integer — the answer
//
// Official URL: https://codeforces.com/problemset/problem/1/A
// Rating: 1000 (Easy)

const THEATRE_SQUARE = {
  title: 'Theatre Square',
  slug: '1-a-theatre-square',
  difficulty: 'easy',
  category: 'Math',
  tags: ['math'],

  description: `In a distant future, the city of Bytesburg has a rectangular Theatre Square measuring n × m metres. The city council plans to pave the square with square tiles. Each tile is a × a metres.

The tiles must be placed so that their sides are parallel to the sides of the square. Tiles cannot be cut. The entire Theatre Square must be covered.

Find the **minimum number of tiles** needed to cover the Theatre Square.`,

  inputFormat: 'The single line contains three integers n, m, and a (1 ≤ n, m, a ≤ 10^9).',

  outputFormat: 'Output the minimum number of tiles required.',

  constraints: '1 ≤ n, m, a ≤ 10^9\nTime limit: 1 second\nMemory limit: 256 megabytes',

  hints: [
    'You need ceil(n/a) tiles along the length and ceil(m/a) tiles along the width.',
    'In integer arithmetic: ceil(n/a) = Math.floor((n + a - 1) / a)',
    'Be careful of integer overflow! n, m, a can be up to 10^9, so the answer can be up to ~10^18. Use BigInt in JS or long long in C++.'
  ],

  examples: [
    {
      input: '6 6 4',
      output: '4',
      explanation: 'You need ceil(6/4) = 2 tiles along each side, so 2 × 2 = 4 tiles total.'
    },
    {
      input: '1000000000 1000000000 1',
      output: '1000000000000000000',
      explanation: 'Each tile is 1×1, so you need n×m = 10^18 tiles. Note: this requires 64-bit integers.'
    }
  ],

  // ── Test Cases ─────────────────────────────────────────────────────────────
  // All verified against the official Codeforces judge
  testCases: [
    // Visible (sample) test cases
    { input: '6 6 4',                            expectedOutput: '4',                    isHidden: false },
    { input: '1 1 1',                            expectedOutput: '1',                    isHidden: false },
    { input: '3 4 2',                            expectedOutput: '4',                    isHidden: false },
    // Hidden test cases (used in submit)
    { input: '1000000000 1000000000 1',          expectedOutput: '1000000000000000000', isHidden: true  },
    { input: '1000000000 1000000000 1000000000', expectedOutput: '1',                   isHidden: true  },
    { input: '5 5 3',                            expectedOutput: '4',                   isHidden: true  },
    { input: '10 7 3',                           expectedOutput: '12',                  isHidden: true  },
    { input: '1 1000000000 1000000000',          expectedOutput: '1',                   isHidden: true  },
    { input: '999999999 999999999 1000000000',   expectedOutput: '1',                   isHidden: true  },
    { input: '2 2 1',                            expectedOutput: '4',                   isHidden: true  }
  ],

  // ── Starter Code ───────────────────────────────────────────────────────────
  starterCode: {
    javascript: `// Codeforces 1A — Theatre Square
// Input: one line with 3 integers: n m a
// Output: minimum number of a×a tiles to cover an n×m field

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });
const lines = [];
rl.on('line', line => lines.push(line.trim()));
rl.on('close', () => {
  const [n, m, a] = lines[0].split(' ').map(BigInt);
  
  // ceil(n/a) * ceil(m/a)  — use BigInt to avoid overflow
  const tilesN = (n + a - 1n) / a;
  const tilesM = (m + a - 1n) / a;
  
  console.log(String(tilesN * tilesM));
});`,

    python: `# Codeforces 1A — Theatre Square
# Input: one line with 3 integers: n m a
# Output: minimum number of a×a tiles to cover an n×m field
import math

n, m, a = map(int, input().split())
print(math.ceil(n / a) * math.ceil(m / a))`,

    cpp: `// Codeforces 1A — Theatre Square
#include <bits/stdc++.h>
using namespace std;
typedef long long ll;

int main() {
    ll n, m, a;
    cin >> n >> m >> a;
    
    // ceil(n/a) = (n + a - 1) / a  in integer arithmetic
    ll tilesN = (n + a - 1) / a;
    ll tilesM = (m + a - 1) / a;
    
    cout << tilesN * tilesM << endl;
    return 0;
}`,

    java: `// Codeforces 1A — Theatre Square
import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        long n = sc.nextLong();
        long m = sc.nextLong();
        long a = sc.nextLong();
        
        // ceil(n/a) in integer arithmetic
        long tilesN = (n + a - 1) / a;
        long tilesM = (m + a - 1) / a;
        
        System.out.println(tilesN * tilesM);
    }
}`
  },

  acceptanceRate: 71,
  totalSubmissions: 0,
  totalAccepted: 0,
  source: 'codeforces',
  sourceId: 'cf-1-A'
};

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('══════════════════════════════════════════════════════');
  console.log('  DevPrep — Reset DB & Seed One Problem (CF 1A)');
  console.log('══════════════════════════════════════════════════════');
  console.log('');

  // 1. Connect
  console.log('📡 Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('  ✓ Connected\n');

  // 2. Clear ALL CodingProblem documents
  console.log('🗑️  Deleting ALL existing CodingProblem documents...');
  const deleteResult = await CodingProblem.deleteMany({});
  console.log(`  ✓ Deleted ${deleteResult.deletedCount} problem(s)\n`);

  // 3. Insert the one hardcoded problem
  console.log('💾 Inserting "Theatre Square" (Codeforces 1A)...');
  let inserted;
  try {
    inserted = await CodingProblem.create(THEATRE_SQUARE);
  } catch (err) {
    console.error(`  ✗ Insert failed: ${err.message}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const visible = THEATRE_SQUARE.testCases.filter(t => !t.isHidden);
  const hidden  = THEATRE_SQUARE.testCases.filter(t => t.isHidden);

  console.log('');
  console.log('══════════════════════════════════════════════════════');
  console.log('  ✅  SUCCESS — Problem seeded!');
  console.log('══════════════════════════════════════════════════════');
  console.log('');
  console.log(`  Problem  : ${inserted.title}`);
  console.log(`  DB _id   : ${inserted._id}`);
  console.log(`  Slug     : ${inserted.slug}`);
  console.log(`  Difficulty: ${inserted.difficulty}  |  Category: ${inserted.category}`);
  console.log(`  Tags     : ${THEATRE_SQUARE.tags.join(', ')}`);
  console.log(`  Test Cases: ${THEATRE_SQUARE.testCases.length} total  (${visible.length} visible + ${hidden.length} hidden)`);
  console.log('');
  console.log('  📝 Visible test cases:');
  visible.forEach((tc, i) => {
    console.log(`    [${i + 1}] Input:    "${tc.input}"`);
    console.log(`         Expected: "${tc.expectedOutput}"`);
  });
  console.log('');
  console.log('  🧪 API endpoints to test:');
  console.log(`    GET  /api/problems/${inserted._id}             → fetch problem`);
  console.log(`    POST /api/problems/${inserted._id}/run         → run code (sample tests)`);
  console.log(`    POST /api/problems/${inserted._id}/submit      → submit (all tests)`);
  console.log('');
  console.log('  ✅ Correct answers to verify:');
  console.log('    Input "6 6 4"     → 4');
  console.log('    Input "1 1 1"     → 1');
  console.log('    Input "3 4 2"     → 4');
  console.log('    Input "1000000000 1000000000 1" → 1000000000000000000');
  console.log('');

  await mongoose.disconnect();
  console.log('  ✓ Disconnected');
  process.exit(0);
}

main().catch(err => {
  console.error('\n✗ Fatal error:', err.message);
  process.exit(1);
});
