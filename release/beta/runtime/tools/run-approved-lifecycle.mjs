import { runCommand, packageRoot } from '../lib/commands.mjs';
import { verifyArtifact } from '../lib/integrity.mjs';
await runCommand(async () => {
  await verifyArtifact(packageRoot);
  return { code: 'BTA_LIFECYCLE_NONE', message: 'This artifact permits no lifecycle scripts.' };
});
