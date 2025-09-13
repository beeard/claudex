#!/usr/bin/env node
// TypeScript source for future builds; runtime uses dist/claudex.cjs
import { Command } from 'commander';
import inquirer from 'inquirer';
import path from 'node:path';
import fs from 'node:fs';

const program = new Command();
program
  .name('orchestrator-kit')
  .description('Orchestration Kit + Interactive Installer')
  .version('0.1.0');

program
  .command('init')
  .description('Interactive installer to copy templates and add scripts')
  .action(async () => {
    const { ok } = await inquirer.prompt([{ type: 'confirm', name: 'ok', message: 'Copy templates to ./claudex and add scripts to package.json?', default: true }]);
    if (!ok) return;
    const src = path.resolve(__dirname, '../../templates');
    const dst = path.resolve(process.cwd(), 'claudex');
    fs.cpSync(src, dst, { recursive: true });
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      pkg.scripts = pkg.scripts || {};
      pkg.scripts['dashboard:quick'] = pkg.scripts['dashboard:quick'] || 'node dist/claudex.cjs dashboard';
      pkg.scripts['dashboard:quick:mem-off'] = pkg.scripts['dashboard:quick:mem-off'] || 'ENABLE_MEM_HTTP=0 node dist/claudex.cjs dashboard';
      pkg.scripts['dashboard:with-memory'] = pkg.scripts['dashboard:with-memory'] || 'ENABLE_MEM_HTTP=1 node dist/claudex.cjs dashboard';
      pkg.scripts['monitor:with-memory'] = pkg.scripts['monitor:with-memory'] || 'ENABLE_MEM_HTTP=1 node dist/claudex.cjs monitor';
      pkg.scripts['verify:orchestration'] = pkg.scripts['verify:orchestration'] || 'node dist/claudex.cjs verify';
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    }
    console.log('claudex templates installed and scripts added.');
  });

program.parseAsync();

