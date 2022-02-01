import redis from 'redis';
import { getLastUpdateTime } from './updater.js';
import pkg from 'ip-set';
const IPSet = pkg;

let client;
let ttl_cache;
const NETSET_HASH = "netset";
let allNetSets = new IPSet();


export const setupCache = async (config) => {
    ttl_cache = config.ttl_hours * 60 * 60
    client = redis.createClient(config);
    try {
        console.log("connecting to redis");
        await client.connect();
        await client.ping();
        console.log("connected to redis");
    
    } catch(error) {
        console.log(`Connection to redis can not be initiated: ${error.message}`);
        process.exit(1);
    }

    // trace when connection to redis are happening
    client.on("error", (err) => {
        console.log("Connection to redis lost, trying to reconnect");
        //TODO: check if too many renonections happens since last time and not be verbose with logs
    })
};

export const getIP = async (ip) => {
    try {
        return await client.get(ip);
    } catch(err) {
        throw err;
    }
};

export const setIP = async (ip, updateTime) => {
    try {
        await client.set(ip, updateTime, {
            EX: ttl_cache
          });
    } catch(err) {
        console.log(`Error including ip ${ip} in redis at update time of ${updateTime}: ${err.message}`);
        return false
    }
    return true
};

export const getCurrentNetSet = () => {
    return allNetSets;
}

export const replaceAllNetSet = async () => {
    const allNetSetsSize = Number(await getAllNetSetsSize());

    if (allNetSetsSize > 0) {
        allNetSets = await getAllNetSetsFromCache();
    } else {
        allNetSets = new IPSet();
    }
    return allNetSetsSize;
    
}

// Return a netset object with all netsets included for easy check subnets
// TODO: typescript may help ?
const getAllNetSetsFromCache = async () => {
    let newNetSet = new IPSet();
    // FIXME: think in some way of not having to iterate all every time ...
    for await (const {field, value} of client.hScanIterator(NETSET_HASH)) {
        //FIXME: consider expired netsets comparing with value
        newNetSet.add(field);
    }
    return newNetSet;
};

export const getAllNetSetsSize = async () => {
    try {
        return await client.hLen(NETSET_HASH);
    } catch(err) {
        console.log(`Error getting subnets size: ${err.message}`);
        return null;
    }
}

export const setNetSet = async (netset, updateTime) => {
    try {
        // this ttl could change for netsets or for sources ?
        await client.hSet(NETSET_HASH, netset, updateTime, {
            EX: ttl_cache
          });
    } catch(err) {
        console.log(`Error including ip netset ${netset} in redis at update time of ${updateTime}: ${err.message}`);
        return false
    }
    return true
};

export const checkNotReleasedIP = async (ip, updateTime) => {

    //we do not convert to date as the in our case the update time is always increasing
    //if the value doesn match, the entry has been removed in last update
    //TODO: maybe include a kind of gap for validity?
    if (getLastUpdateTime() !== updateTime)
    {
        console.log(`Ip ${ip} considered expired as it has not been included in the last update. It may have ben released`);
        try {
            await client.del(ip);
        } catch(err) {
            console.log(`Error cleaing released ip; ${err.message}`);
        }
        
        return false;
    }
    return true
}
