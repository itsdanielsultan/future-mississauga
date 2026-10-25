import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function resolve(specifier,context,nextResolve){if(specifier==='three')return {url:pathToFileURL(path.join(root,'public/vendor/three.module.js')).href,shortCircuit:true};return nextResolve(specifier,context);}
