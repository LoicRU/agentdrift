import type { Rule } from '../core/rule.js';
import { ad001 } from './ad001-missing-path.js';
import { ad002 } from './ad002-missing-script.js';
import { ad003 } from './ad003-package-manager-mismatch.js';
import { ad004 } from './ad004-runtime-version-mismatch.js';
import { ad005 } from './ad005-broken-reference.js';

export const rules: Rule[] = [ad001, ad002, ad003, ad004, ad005];
