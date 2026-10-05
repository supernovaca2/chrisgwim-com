// Overworld: the catalog as a playable open world. This is the site's home page.
//
// The game is written as seven numbered parts (01_core.js to 07_main.js) that
// share one scope. The overworld-parts plugin in astro.config.mjs splices them,
// in order, into the function below when this file is built. Nothing else on
// the site imports the parts directly. See README.md in this folder.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { paintLanes, showFallback } from './fallback.js';

export default async function overworld() {
  /* @parts */
}
