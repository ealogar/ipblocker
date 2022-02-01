
import express from 'express';
import { setupCache, getIP, checkNotReleasedIP, getCurrentNetSet } from './src/cache.js';

import { updaterConfig, sources, redisConfig, appConfig } from './src/config.js';
import { getLastUpdateTime, initUpdateSources } from './src/updater.js';

import { isIP, isRange } from 'range_check';

const app = express();



(async () => {
  await setupCache(redisConfig);
  // init poll sources (wait for redis conected as we can not work without redis for first time)
  initUpdateSources(updaterConfig, sources);

  // just one route, all work is done in mw
  app.get('/ipblocked', async (req, res) => {

    //FIXME: include a logger that will not output anthing for production usage (just errors)
    let ip = req.query.ip ;
    // FIXME: skip this validation for gaining peformance ???
    // We can also use the ip type received (IPv4 and IPv6) and use that for querying cache if we want to
    // get rid of the internal object for subnets...
    if (!isIP(ip)) {
      console.log(`Invalid ip ${ip} received`);
      return res.status(400).send({"message": `${ip} is not a valid ip`})
    }

    try {
      //TODO: ignore the updateTime of the entries, and just go ahead with EXISTS in redis (quickiest operation)
      // We get rid of expired entries in the updater with a asynchornous non blocking task ...
      // Also the metada won't be extensible but this is a good tradeoff 
      let updateTime = await getIP(ip);

      //FIXME: metadata still needs some more work on definition
      if (updateTime && await checkNotReleasedIP(ip, updateTime)) {
        console.log(`The ip ${ip} is blocked according to our rules`);
        return res.send({
            blocked: true,
            metadata: {
              "block-level": 2,
              category: "single-ip",
              "update-time": updateTime  
            }
        });
      } else if(getCurrentNetSet().contains(ip)) {
        // TODO: Think in away of getting rid of the object in memory (it solves the problem for now ...)
        // Can we use redis collections (sorted sets) or Lua for storing ranges ips and check at once ?

        console.log(`The ip ${ip} belongs to some blocked subnet according to our rules`);
        return res.send({
          blocked: true,
          metadata: {
            "block-level": 1,
            category: "netset",
            "update-time": getLastUpdateTime()  
          }
        });
      }
    } catch(err) {
      console.log(`error accessing cache: ${err.message}`);
      return res.status(500).send({"message": "The request can not be processed now. Try again later"});
    }
    
    res.send({blocked: false});
  });

  const PORT = appConfig.port
  app.listen(PORT, () => {
    console.log(`ipblocker service listening on port ${PORT}`);
  });

})();
