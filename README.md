# ipchecker

This is a service that will offer the possibility of knowing if a given IP is untrusted according to some of the rules defined in https://github.com/firehol/blocklist-ipsets.
Both individual IPS (X.X.X.X) and subnets/CIDR will be considering from the sources.

## architecture high level

Go to [architecture](./docs/architecture.md) to see how this has ben designed. (WIP)



## Responses from the service

When the IP is not blocked you will receive an HTTP **200** status code with the body:

```json
{
    "blocked": false
}
```

And when the ip is considered as a potential attacker and should be considered as blocked (also **200** with the next body):

```json
{
    "blocked": true,
    "metadata": {
        "block-level": <1|2>,
        "category": "<single-ip|subnet>",
        "update-time": "2022-01-26T19:43:11.631Z"
    }
}
```

if the input ip is invalid you will get and HTTP **400** status code

```json
{
    "message": "bad-ip is not a valid ip"
}
```

if the cache is down you will receive an HTTP **500** status code 

```json
{
    "message": "The request can not be processed now. Try again later."
}
```



Configure the sources that you may need in config/default.json

# Development & Testing

This is an express node app that can be modified and extended easilly.

## local deployment

You can use docker-compose to build & deploy the ipchecker locally with all required dependencies.

Build the ipchecker with docker-compose:

```
docker-compose build ipblocker
```

Run the ipchecker app and required dependencies

```
docker-compose up -d
```

Check the service:

```
curl --location --request GET 'localhost:3000/ipblocked?ip=X.X.X.X'
```

