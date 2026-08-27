#!/usr/bin/env node
// Verify JSX compilation with @babel/standalone

const fs = require('fs');
const path = require('path');
const Babel = require('@babel/standalone');

const htmlPath = path.join(__dirname, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// Extract JSX from <script type="text/babel"> tags
const scriptRegex = /<script\s+type=["']text\/babel["'][^>]*>([\s\S]*?)<\/script>/gi;
let match;
let jsxCode = '';
let scriptCount = 0;

while ((match = scriptRegex.exec(html)) !== null) {
  jsxCode += match[1] + '\n';
  scriptCount++;
}

console.log(`Found ${scriptCount} babel script(s), total ${jsxCode.length} chars`);

try {
  const result = Babel.transform(jsxCode, {
    presets: ['react'],
    filename: 'app.jsx'
  });
  console.log('✅ JSX compilation successful!');
  console.log(`Output size: ${result.code.length} chars`);
} catch (err) {
  console.error('❌ JSX compilation failed:');
  console.error(err.message);
  if (err.loc) {
    console.error(`Line ${err.loc.line}, Column ${err.loc.column}`);
    // Print surrounding lines
    const lines = jsxCode.split('\n');
    const start = Math.max(0, err.loc.line - 3);
    const end = Math.min(lines.length, err.loc.line + 2);
    for (let i = start; i < end; i++) {
      const marker = (i === err.loc.line - 1) ? '→' : ' ';
      console.log(`  ${marker} ${i + 1}: ${lines[i]}`);
    }
  }
  process.exit(1);
}
