// @ts-check

import config from 'config';

const redisConfig = config.get('redis')
const sources = config.get('sources')
const updaterConfig = config.get('updater')
const appConfig = config.get('app')
//TODO: sanitize config files, check mandatory keys and provide default values
export { redisConfig, sources, updaterConfig, appConfig}
