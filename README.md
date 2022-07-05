# Node.js Client for Apache Ignite #

## Installation ##

[Node.js](https://nodejs.org/en/) version 8 or higher is required. Either download the Node.js [pre-built binary](https://nodejs.org/en/download/) for the target platform, or install Node.js via [package manager](https://nodejs.org/en/download/package-manager).

Once `node` and `npm` are installed, you can use one of the following installation options.

### Installation via npm ###

This is a recommended way for users. Execute the following command to install the Node.js Thin Client package:

```
npm install -g apache-ignite-client
```

### Installation from Sources ###

This way is more suitable for developers or if you install client from zip archive. If you want to install the Thin Client library from Ignite sources, please follow the steps:

1. Download and/or unzip Node.js Ignite sources to `nodejs-thin-client`
2. Go to `nodejs-thin-client` folder
3. Execute `npm link` command
4. Execute `npm link apache-ignite-client` command

```bash
cd nodejs-thin-client
npm install
npm run build
npm link
npm link apache-ignite-client #linking examples (optional)
```

### Updating from older version

If you installed GridGain client globally, run the following command:
```bash
npm update -g @gridgain/thin-client
```

If you installed GridGain client locally, follow the following instruction:
1. Navigate to the `nodejs-thin-client`
2. In project root directory, run the `npm update` command
3. To test the update, run the `npm outdated` command. There should not be any output

```bash
cd nodejs-thin-client
npm update
npm outdated
```
---------------------------------------------------------------------

# Tests #

Node.js Client for Apache Ignite contains [Jasmine](https://www.npmjs.com/package/jasmine) tests to check the behavior of the client. the tests include:
- functional tests which cover all API methods of the client
- examples executors which run all examples except AuthTlsExample
- AuthTlsExample executor

## Tests Installation ##

Tests are installed along with the client.
Follow the [Installation instructions](#installation).

## Tests Running ##

1. Run Ignite server locally or remotely with default configuration.
2. Set the environment variable:
    - **APACHE_IGNITE_CLIENT_ENDPOINTS** - comma separated list of Ignite node endpoints.
    - **APACHE_IGNITE_CLIENT_DEBUG** - (optional) if *true*, tests will display additional output (default: *false*).
3. Alternatively, instead of the environment variables setting, you can directly specify the values of the corresponding variables in [nodejs-thin-client/spec/config.js](./spec/config.js) file.
4. Run the tests:

### Run Functional Tests ###

Call `npm test` command from `nodejs-thin-client` folder.

### Run Examples Executors ###

Call `npm run test:examples` command from `nodejs-thin-client` folder.

### Run AuthTlsExample Executor ###

Active Ignite server node with non-default configuration is required (authentication and TLS switched on).

If the server runs locally:
- setup the server to accept TLS. During the setup use `keystore.jks` and `truststore.jks` certificates from `nodejs-thin-client/examples/certs/` folder. Password for the files: `123456`
- switch on the authentication on the server. Use the default username/password.

If the server runs remotely, and/or other certificates are required, and/or non-default username/password is required - see this [instruction](#additional-setup-for-authtlsexample).

Call `npm run test:auth_example` command from `nodejs-thin-client` folder.

## Additional Setup for AuthTlsExample ##

1. Obtain certificates required for TLS:
- either use pre-generated certificates provided in the [examples/certs](./examples/certs) folder. Password for the files: `123456`. Note, these certificates work for an Ignite server installed locally only.
- or obtain other existing certificates applicable for a concrete Ignite server.
- or generate new certificates applicable for a concrete Ignite server.

- The following files are needed:
    - keystore.jks, truststore.jks - for the server side
    - client.key, client.crt, ca.crt - for the client side

2. Place client.key, client.crt and ca.crt files somewhere locally, eg. into the [examples/certs](./examples/certs) folder.

3. If needed, modify `TLS_KEY_FILE_NAME`, `TLS_CERT_FILE_NAME` and `TLS_CA_FILE_NAME` constants in the example source file. The default values point to the files in the [examples/certs](./examples/certs) folder.

4. Setup Ignite server to accept TLS - see appropriate [Ignite documentation](https://www.Ignite.com/docs/latest/developers-guide/thin-clients/getting-started-with-thin-clients#cluster-configuration). Provide the obtained keystore.jks and truststore.jks certificates during the setup.

5. Switch on and setup authentication in Ignite server - see appropriate [Ignite documentation](https://www.Ignite.com/docs/latest/developers-guide/thin-clients/getting-started-with-thin-clients#cluster-configuration).

6. If needed, modify `USER_NAME` and `PASSWORD` constants in the example source file. The default values are the default Ignite username/password.

## Additional Setup for FailoverExample ##

1. Start three Ignite server nodes.

2. If needed, modify `ENDPOINT1`, `ENDPOINT2`, `ENDPOINT2` constants in an example source file - Ignite node endpoints.
   Default values are `localhost:10800`, `localhost:10801`, `localhost:10802` respectively.

2. Run an example by calling `node FailoverExample.js`.

3. Shut down the node the client is connected to (you can find it out from the client logs in the console).

4. From the logs, you will see that the client automatically reconnects to another node which is available.

5. Shut down all the nodes. You will see the client being stopped after failing to connect to each of the nodes.

---------------------------------------------------------------------

# API spec generation: instruction #

It should be done if a public API class/method has been changed.
1. Execute `npm install -g jsdoc` to install jsdoc (https://www.npmjs.com/package/jsdoc)
2. Go to `nodejs-thin-client/api_spec`
3. Execute `jsdoc -c conf.json --readme index.md` command.

Note: `nodejs-thin-client/api_spec/conf.json` is a file with jsdoc configuration.

For more information, see [Ignite Node.js Thin Client documentation](https://www.Ignite.com/docs/latest/developers-guide/thin-clients/nodejs-thin-client).