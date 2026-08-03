import spineLeafDemoExport from "../../examples/sean-sie-spine-leaf-demo.json" with { type: "json" };

import { validateProject } from "./topology-validation.ts";

export const SEAN_SPINE_LEAF_TOPOLOGY_ID = "topology-sean-spine-leaf-demo";
export const SEAN_SPINE_LEAF_TOPOLOGY_NAME = "Sean Spine-Leaf 示範拓樸";
export const SEAN_SPINE_LEAF_PROJECT = validateProject(spineLeafDemoExport.project);
