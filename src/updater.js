import fetch from 'node-fetch';
import split from 'split';
//TODO: precompile regexps in a local module
import { isIP, isRange } from 'range_check';
import { setIP, setNetSet, replaceAllNetSet } from './cache.js';

let sources, config
let lastUpdateTime

const initUpdateSources = (_config, _sources) => {
    // keep sources and config in module for later use
    sources = _sources;
    config = _config;
    updateAndFetchSources();
};

const updateAndFetchSources = () => {
    console.log(`Fetching sources and updating redis`);

    (async () => {
        let updateTime = new Date().toISOString();

        let networkFailures = await fetchSourcesHandler(sources, updateTime);

        // More logic of when to consider an update successful can give robustness to the solution
        if ( networkFailures >= config.network_failures_threshold) {
            console.log("Too many network issues while fetching ips from sources");
            setTimeout(updateAndFetchSources, config.network_failures_refresh_time_minutes * 60 * 1000);
        } else {
            lastUpdateTime = updateTime;

            setTimeout(updateAndFetchSources, config.refresh_time_minutes * 60 * 1000);
            // The netset will be updated when all fetches sources have finished ...
            
        }
    })();
   
};

//FIXME: Can be implemented as an Event Listener or in a more elegant way ?
class FetchSourcesMonitor {
    constructor (sources) {
        this.sources = sources;
        this.done = [];
    }

    endSource(source) {
        console.log(`end read source ${source.name}`);
        this.done.push(source);
        if (this.done.length == this.sources.length) {
            console.log(`end read all sources`);
            (async () => {
                await refreshSubnets();
            })();
        }
    }

}

const refreshSubnets = async () => {
    console.log("Replacing subnet object");
    let netSetsSize = await replaceAllNetSet();   
    if (netSetsSize) {
        console.log(`The subnet entries is ${netSetsSize}. netSet object updated.`);
    } else {
        console.log(`The subnet entries is empty.`);
    }
};


const fetchSourcesHandler = async (sources, updateTime) => {
    let networkFailures = 0;
    const fetchResults = new FetchSourcesMonitor(sources);

    //FIXME: paralelize promises with an internal queue or something like that (will depend of each source frequency)
    for(const source of sources) {
        console.log(`Fetching ${source.name}`);

        try{
            const response = await fetch(source.url);
            if (response.status != 200) {
                networkFailures +=1;
            } else {
                response.body
                    .pipe(split())
                    .on("data", async line => {
                        if (isIP(line)) {
                            await setIP(line, updateTime);
                        } else if (isRange(line)) {
                            await setNetSet(line, updateTime);
                        }
                    })
                    .on("end", () => {
                        fetchResults.endSource(source);
                    });
            }
            
        } catch(err) {
            console.log(`Error fetching url ${source.url}: ${err.message}`)
            networkFailures += 1;
        }

    }
    return networkFailures;
};

export const getLastUpdateTime = () => {
    return lastUpdateTime;
};

export { initUpdateSources };
