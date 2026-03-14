import { bundleWorkflowCode } from '@temporalio/worker';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  const bundle = await bundleWorkflowCode({
    workflowsPath: path.resolve(__dirname, '../workflows'),
  });

  const outDir = path.resolve(__dirname, '../../dist');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const bundlePath = path.join(outDir, 'workflow-bundle.js');
  fs.writeFileSync(bundlePath, bundle.code);
  console.log(`Workflow bundle written to ${bundlePath}`);
}

main().catch((err) => {
  console.error('Failed to build workflow bundle:', err);
  process.exit(1);
});
