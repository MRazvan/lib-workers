import * as util from 'util';
import * as MY_SPECIAL_WORKER_KEY from 'worker_threads';

export type Logger = (msg: string, ...param: any[]) => void;

export function getLog(ctx: string): Logger {
  const log = util.debuglog('lib-workers');
  return (msg: string, ...param: any[]) => {
    log(`[${Date.now()}] [W-${MY_SPECIAL_WORKER_KEY.threadId}] ${ctx} - ${msg}`, param);
  };
}
