import fs from "node:fs";
import path from "node:path";

import { readJson, validateA08FormalEvidence, validateA08Matrix, validateA08ToolReview } from "./a08-assertions.mjs";

const [matrixArg, reviewArg, evidenceArg, outputArg] = process.argv.slice(2);
if (![matrixArg, reviewArg, evidenceArg, outputArg].every(Boolean)) {
  throw new Error("Usage: node a08-formal-runner.mjs <matrix.json> <tool-review.json> <formal-evidence.json> <result.json>");
}
const matrix = validateA08Matrix(readJson(path.resolve(matrixArg)));
const review = validateA08ToolReview(readJson(path.resolve(reviewArg)));
const evidence = validateA08FormalEvidence(matrix, readJson(path.resolve(evidenceArg)));
const result = {
  status: "A08_EVIDENCE_SCHEMA_VALIDATED_NOT_ACCEPTANCE",
  acceptance: "BLOCKED_PENDING_RAW_PROVENANCE_AND_HUMAN_QA_REVIEW",
  candidate: evidence.candidate,
  toolReviewStatus: review.status,
  destination: { host: evidence.destination.host, port: evidence.destination.port },
  networkControlExecutableCount: matrix.networkControlExecutables.length,
  productChannelCount: matrix.productChannels.length,
  dailyFlowCount: matrix.dailyFlow.length,
  cleanup: evidence.cleanup,
  warning: "This result validates declared evidence structure only. It is not A08_QA_PASS.",
};
const output = path.resolve(outputArg);
if (fs.existsSync(output)) throw new Error("A08 result output must not pre-exist");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
