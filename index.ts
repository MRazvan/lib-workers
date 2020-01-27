import * as WP from './src/pool';
import { Test } from './worker';
WP.Threading.initialize(1);
setInterval(() => {
  WP.Create<Test>(Test)
    .resu()
    .then(console.log);
}, 500);

setInterval(() => {
  console.log('Main');
}, 1000);
