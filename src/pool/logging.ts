import * as util from 'util';
import * as MY_SPECIAL_WORKER_KEY from 'worker_threads';
const _rootLog = util.debuglog('lib-workers');
function getHRTime(): number {
  const time = process.hrtime();
  return time[0] * 10e9 + time[1];
}

export type Logger = (msg: string, ...param: any[]) => void;
export function getLog(ctx: string): Logger {
  return (msg: string, ...param: any[]) => {
    _rootLog(`[${getHRTime()}] [W-${MY_SPECIAL_WORKER_KEY.threadId}] ${ctx} - ${msg}`, param);
  };
}
