/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

require('jasmine-expect');
const JasmineReporters = require('jasmine-reporters');

const psTree = require('ps-tree');
const Util = require('util');
const path = require('path');
const fs = require('fs');
const child_process = require('child_process');
const config = require('./config');
const LogReader = require('./LogReader');
const {IgniteClient, IgniteClientConfiguration, Errors, EnumItem, Timestamp, Decimal, BinaryObject, ObjectType} = require('apache-ignite-client');

const TIMEOUT_MS = 60000;

jasmine.getEnv().addReporter(new JasmineReporters.TeamCityReporter());

const dateComparator = (date1, date2) => { return !date1 && !date2 || date1.value === date2.value; };
const floatComparator = (date1, date2) => { return Math.abs(date1 - date2) < 0.00001; };
const defaultComparator = (value1, value2) => { return value1 === value2; };
const enumComparator = (value1, value2) => {
    return value1.getTypeId() === value2.getTypeId() &&
        value1.getOrdinal() === value2.getOrdinal(); };
const decimalComparator = (value1, value2) => {
    return value1 === null && value2 === null ||
        value1.equals(value2);
};
const timestampComparator = (value1, value2) => {
    return value1 === null && value2 === null ||
        dateComparator(value1.getTime(), value2.getTime()) &&
        value1.getNanos() === value2.getNanos(); };

const numericValueModificator = (data) => { return data > 0 ? data - 10 : data + 10; };
const charValueModificator = (data) => { return String.fromCharCode(data.charCodeAt(0) + 5); };
const booleanValueModificator = (data) => { return !data; };
const stringValueModificator = (data) => { return data + 'xxx'; };
const dateValueModificator = (data) => { return new Date(data.getTime() + 12345); };
const UUIDValueModificator = (data) => { return data.reverse(); };
const enumValueModificator = (data) => { return new EnumItem(data.getTypeId(), data.getOrdinal() + 1); };
const decimalValueModificator = (data) => { return data.add(12345); };
const timestampValueModificator = (data) => { return new Timestamp(new Date(data.getTime() + 12345), data.getNanos() + 123); };

const primitiveValues = {
    [ObjectType.PRIMITIVE_TYPE.BYTE] : {
        values : [-128, 0, 127],
        isMapKey : true,
        modificator : numericValueModificator
    },
    [ObjectType.PRIMITIVE_TYPE.SHORT] : {
        values : [-32768, 0, 32767],
        isMapKey : true,
        modificator : numericValueModificator
    },
    [ObjectType.PRIMITIVE_TYPE.INTEGER] : {
        values : [12345, 0, -54321],
        isMapKey : true,
        modificator : numericValueModificator
    },
    [ObjectType.PRIMITIVE_TYPE.LONG] : {
        values : [12345678912345, 0, -98765432112345],
        isMapKey : true,
        modificator : numericValueModificator
    },
    [ObjectType.PRIMITIVE_TYPE.FLOAT] : {
        values : [-1.155, 0, 123e-5],
        isMapKey : false,
        modificator : numericValueModificator
    },
    [ObjectType.PRIMITIVE_TYPE.DOUBLE] : {
        values : [-123e5, 0, 0.0001],
        typeOptional : true,
        isMapKey : false,
        modificator : numericValueModificator
    },
    [ObjectType.PRIMITIVE_TYPE.CHAR] : {
        values : ['a', String.fromCharCode(0x1234)],
        isMapKey : true,
        modificator : charValueModificator
    },
    [ObjectType.PRIMITIVE_TYPE.BOOLEAN] : {
        values : [true, false],
        isMapKey : true,
        typeOptional : true,
        modificator : booleanValueModificator
    },
    [ObjectType.PRIMITIVE_TYPE.STRING] : {
        values : ['abc', ''],
        isMapKey : true,
        typeOptional : true,
        modificator : stringValueModificator
    },
    [ObjectType.PRIMITIVE_TYPE.UUID] : {
        values : [
            [ 18, 70, 2, 119, 154, 254, 198, 254, 195, 146, 33, 60, 116, 230, 0, 146 ],
            [ 141, 77, 31, 194, 127, 36, 184, 255, 192, 4, 118, 57, 253, 209, 111, 147 ]
        ],
        isMapKey : false,
        modificator : UUIDValueModificator
    },
    [ObjectType.PRIMITIVE_TYPE.DATE] : {
        values : [new Date(), new Date('1995-12-17T03:24:00'), new Date(0)],
        typeOptional : true,
        isMapKey : false,
        modificator : dateValueModificator
    },
    // [ObjectType.PRIMITIVE_TYPE.ENUM] : {
    //     values : [new EnumItem(12345, 7), new EnumItem(0, 0)],
    //     typeOptional : true,
    //     isMapKey : false,
    //     modificator : enumValueModificator
    // },
    [ObjectType.PRIMITIVE_TYPE.DECIMAL] : {
        values : [new Decimal('123456789.6789345'), new Decimal(0), new Decimal('-98765.4321e15')],
        typeOptional : true,
        isMapKey : false,
        modificator : decimalValueModificator
    },
    [ObjectType.PRIMITIVE_TYPE.TIMESTAMP] : {
        values : [new Timestamp(new Date().getTime(), 12345), new Timestamp(new Date('1995-12-17T03:24:00').getTime(), 543), new Timestamp(0, 0)],
        typeOptional : true,
        isMapKey : false,
        modificator : timestampValueModificator
    },
    [ObjectType.PRIMITIVE_TYPE.TIME] : {
        values : [new Date(), new Date('1995-12-17T03:24:00'), new Date(123)],
        isMapKey : false,
        modificator : dateValueModificator
    }
};

const arrayValues = {
    [ObjectType.PRIMITIVE_TYPE.BYTE_ARRAY] : { elemType : ObjectType.PRIMITIVE_TYPE.BYTE },
    [ObjectType.PRIMITIVE_TYPE.SHORT_ARRAY] : { elemType : ObjectType.PRIMITIVE_TYPE.SHORT },
    [ObjectType.PRIMITIVE_TYPE.INTEGER_ARRAY] : { elemType : ObjectType.PRIMITIVE_TYPE.INTEGER },
    [ObjectType.PRIMITIVE_TYPE.LONG_ARRAY] : { elemType : ObjectType.PRIMITIVE_TYPE.LONG },
    [ObjectType.PRIMITIVE_TYPE.FLOAT_ARRAY] : { elemType : ObjectType.PRIMITIVE_TYPE.FLOAT },
    [ObjectType.PRIMITIVE_TYPE.DOUBLE_ARRAY] : { elemType : ObjectType.PRIMITIVE_TYPE.DOUBLE, typeOptional : true },
    [ObjectType.PRIMITIVE_TYPE.CHAR_ARRAY] : { elemType : ObjectType.PRIMITIVE_TYPE.CHAR },
    [ObjectType.PRIMITIVE_TYPE.BOOLEAN_ARRAY] : { elemType : ObjectType.PRIMITIVE_TYPE.BOOLEAN, typeOptional : true },
    [ObjectType.PRIMITIVE_TYPE.STRING_ARRAY] : { elemType : ObjectType.PRIMITIVE_TYPE.STRING, typeOptional : true },
    [ObjectType.PRIMITIVE_TYPE.UUID_ARRAY] : { elemType : ObjectType.PRIMITIVE_TYPE.UUID },
    [ObjectType.PRIMITIVE_TYPE.DATE_ARRAY] : { elemType : ObjectType.PRIMITIVE_TYPE.DATE, typeOptional : true },
    //[ObjectType.PRIMITIVE_TYPE.ENUM_ARRAY] : { elemType : ObjectType.PRIMITIVE_TYPE.ENUM, typeOptional : true },
    [ObjectType.PRIMITIVE_TYPE.DECIMAL_ARRAY] : { elemType : ObjectType.PRIMITIVE_TYPE.DECIMAL, typeOptional : true },
    [ObjectType.PRIMITIVE_TYPE.TIMESTAMP_ARRAY] : { elemType : ObjectType.PRIMITIVE_TYPE.TIMESTAMP, typeOptional : true },
    [ObjectType.PRIMITIVE_TYPE.TIME_ARRAY] : { elemType : ObjectType.PRIMITIVE_TYPE.TIME }
};

// Helper class for testing apache-ignite-client library.
// Contains common methods for testing environment initialization and cleanup.
class TestingHelper {
    static get TIMEOUT() {
        return TIMEOUT_MS;
    }

    static get primitiveValues() {
        return primitiveValues;
    }

    static get arrayValues() {
        return arrayValues;
    }

    // Initializes only cluster
    static async initClusterOnly(serversNum = 1, needLogging = false) {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = TIMEOUT_MS;

        await TestingHelper.startTestServers(needLogging, serversNum);
    }

    // Create test client instance
    static makeClient() {
        const client = new IgniteClient();
        client.setDebug(config.debug);
        return client;
    }

    // Initializes testing environment: creates and starts the library client, sets default jasmine test timeout.
    // Should be called from any test suite beforeAll method.
    static async init(partitionAwareness = config.partitionAwareness, serversNum = 1, needLogging = false, endpoints) {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = TIMEOUT_MS;

        if (!endpoints)
            endpoints = TestingHelper.getEndpoints(serversNum);

        await TestingHelper.startTestServers(needLogging, serversNum);

        TestingHelper._igniteClient = TestingHelper.makeClient();
        await TestingHelper._igniteClient.connect(new IgniteClientConfiguration(...endpoints).
            setConnectionOptions(false, null, partitionAwareness));
    }

    // Cleans up testing environment.
    // Should be called from any test suite afterAll method.
    static async cleanUp() {
        try {
            if (TestingHelper._igniteClient) {
                await TestingHelper._igniteClient.disconnect();
                delete TestingHelper._igniteClient;
            }

            if (TestingHelper._logReaders)
                delete TestingHelper._logReaders;
        }
        finally {
            await TestingHelper.stopTestServers();
        }
    }

    static get igniteClient() {
        return TestingHelper._igniteClient;
    }

    static async destroyCache(cacheName, done) {
        try {
            await TestingHelper.igniteClient.destroyCache(cacheName);
        }
        catch (err) {
            TestingHelper.checkOperationError(err, done);
        }
    }

    static getEndpoints(serversNum) {
        if (serversNum < 1)
            throw 'Wrong number of nodes: ' + serversNum;

        let res = [];
        for (let i = 1; i < serversNum + 1; ++i)
            res.push('127.0.0.1:' + (10800 + i));

        return res;
    }

    static isWindows() {
        return process.platform === 'win32';
    }

    static getNodeRunner() {
        if (!config.igniteHome)
            throw 'Can not start node: ' +
            'IGNITE_HOME is not set';

        const ext = TestingHelper.isWindows() ? '.bat' : '.sh';
        const runner = path.join(config.igniteHome, 'bin', 'ignite' + ext);
        if (!fs.existsSync(runner))
            throw 'Can not find ' + runner + '. Please, check your IGNITE_HOME environment variable';

        return runner;
    }

    static getConfigPath(needLogging, idx = 1) {
        if (!needLogging)
            return path.join(__dirname, 'configs', 'ignite-config-default.xml');

        return path.join(__dirname, 'configs', Util.format('ignite-config-%d.xml', idx));
    }

    static async sleep(milliseconds) {
        return new Promise(resolve => setTimeout(resolve, milliseconds));
    }

    static async waitForCondition(cond, timeout) {
        const startTime = Date.now();
        let now = startTime;
        do {
            const ok = await cond();
            if (ok)
                return true;

            await TestingHelper.sleep(100);
            now = Date.now();
        } while ((now - startTime) < timeout);

        return await cond();
    }

    static async waitForConditionOrThrow(cond, timeout) {
        const startTime = Date.now();

        while (!await cond()) {
            if (Date.now() - startTime > timeout) {
                throw 'Failed to achieve condition within timeout ' + timeout;
            }

            await TestingHelper.sleep(100);
        }
    }

    static async tryConnectClient(idx = 1, debug = false) {
        const endPoint = Util.format('127.0.0.1:%d', 10800 + idx);

        TestingHelper.logDebug('Checking endpoint: ' + endPoint);

        let cli = new IgniteClient();
        cli.setDebug(debug);

        return await cli.connect(new IgniteClientConfiguration(endPoint).
            setConnectionOptions(false, null, false)).
            then(() => {
                TestingHelper.logDebug('Successfully connected');
                cli.disconnect();
                return true;
            }).
            catch(error => {
                TestingHelper.logDebug('Error while connecting: ' + error.toString());
                return false;
            });
    }

    static async startTestServers(needLogging, serversNum) {
        TestingHelper.logDebug('Starting ' + serversNum + ' node[s]');
        if (serversNum < 0)
            throw 'Wrong number of servers to start: ' + serversNum;

        for (let i = 1; i < serversNum + 1; ++i)
            await TestingHelper.startTestServer(needLogging, i);
    }

    static async startTestServer(needLogging, idx) {
        if (!TestingHelper._servers)
            TestingHelper._servers = [];

        if (!TestingHelper._logReaders)
            TestingHelper._logReaders = new Map();

        TestingHelper._servers.push(await TestingHelper._startNode(needLogging, idx));

        const logs = TestingHelper.getLogFiles(idx);
        if (!needLogging && logs.length > 0)
            throw 'Unexpected log file for node ' + idx;

        if (needLogging) {
            if (logs.length !== 1)
                throw 'Unexpected number of log files for node ' + idx + ': ' + logs.length;

            TestingHelper._logReaders.set(idx, new LogReader(logs[0]));
        }
    }

    static async stopTestServers() {
        if (TestingHelper._servers) {
            for (let server of TestingHelper._servers) {
                await TestingHelper.killNodeAndWait(server);
            }

            delete TestingHelper._servers;
        }
    }

    static async killNodeByIdAndWait(idx) {
        if (!TestingHelper._servers || idx < 0 || idx > TestingHelper._servers.length)
            throw 'Invalid index';

        const srv = TestingHelper._servers[idx - 1];
        if (srv)
            await TestingHelper.killNodeAndWait(srv);
    }

    static async killNodeAndWait(proc) {
        const ProcessExists = require('process-exists');

        const pid = proc.pid;
        TestingHelper.killNode(proc);

        await TestingHelper.waitForConditionOrThrow(async () => {
            return !(await ProcessExists(pid));
        }, 5000);
    }

    static killNode(proc) {
        TestingHelper.logDebug('Killing Ignite process: ' + proc.pid);
        if (TestingHelper.isWindows()) {
            child_process.spawnSync('taskkill', ['/F', '/T', '/PID', proc.pid.toString()])
        }
        psTree(proc.pid, function (err, children) {
            children.map((p) => {
                TestingHelper.logDebug('Killing Ignite process child: ' + p.PID);
                try {
                    process.kill(p.PID, 'SIGKILL');
                }
                catch (_error) {
                    TestingHelper.logDebug('Can not kill Ignite process child: ' + _error.toString());
                }
            });
          });
    }

    // Make sure that topology is stable, version won't change and partition map is up-to-date for the given cache.
    static async ensureStableTopology(igniteClient, cache, key = 1, skipLogs=false, timeout=5000) {
        let oldTopVer = igniteClient._router._affinityTopologyVer;

        await cache.get(key);

        let newTopVer = igniteClient._router._affinityTopologyVer;

        while (newTopVer !== oldTopVer) {
            oldTopVer = newTopVer;
            await cache.get(key);
            newTopVer = igniteClient._router._affinityTopologyVer;
        }

        // Now when topology stopped changing, let's ensure we received distribution map.
        let ok = await TestingHelper.waitForCondition(async () => {
            await cache.get(key);
            return await TestingHelper._waitMapObtained(igniteClient, cache, 1000);
        }, timeout);

        if (!ok)
            throw 'getting of partition map timed out';

        if (skipLogs)
            await TestingHelper.getRequestGridIdx();
    }

    // Waiting for distribution map to be obtained.
    static async _waitMapObtained(igniteClient, cache, timeout) {
        return await TestingHelper.waitForCondition(() => {
            return igniteClient._router._distributionMap.has(cache._cacheId);
        }, timeout);
    }

    static async readLogFile(idx) {
        const reader = TestingHelper._logReaders.get(idx);
        if (!reader) {
            TestingHelper.logDebug('WARNING: Reader is null');
            return null;
        }

        return await reader.nextRequest();
    }

    static async getRequestGridIdx(message='Get') {
        if (!TestingHelper._logReaders)
            throw 'Logs are not enabled for the cluster';

        let res = -1
        for(let [id, logReader] of TestingHelper._logReaders) {
            if (!logReader)
                continue;

            let req = null;
            do {
                req = await logReader.nextRequest();
                TestingHelper.logDebug('Node' + id +': Got ' + req + ', looking for ' + message);
                if (req === message)
                    res = id;
            } while (req != null);
        }

        TestingHelper.logDebug('Request "' + message + '" node: ' + res);

        return res;
    }

    static getLogFiles(idx) {
        const glob = require('glob');
        // glob package only works with slashes so no need in 'path' here.
        const logsPattern = Util.format('./logs/ignite-log-%d*.txt', idx);
        const res = glob.sync(logsPattern);
        return res;
    }

    static clearLogs(idx) {
        for (const f of TestingHelper.getLogFiles(idx))
            fs.unlinkSync(f);
    }

    static async _startNode(needLogging, idx = 1) {
        TestingHelper.clearLogs(idx);

        const runner = TestingHelper.getNodeRunner();

        let nodeEnv = {};
        for (const ev in process.env)
            nodeEnv[ev] = process.env[ev];

        if (config.debug) {
            nodeEnv['JVM_OPTS'] = '-Djava.net.preferIPv4Stack=true -Xdebug -Xnoagent -Djava.compiler=NONE \
                                   -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=' + (5005 + idx);
        }

        const nodeCfg = TestingHelper.getConfigPath(needLogging, idx);
        TestingHelper.logDebug('Trying to start node using following command: ' + runner + ' ' + nodeCfg);

        const srv = child_process.spawn(runner, [nodeCfg], {env: nodeEnv});

        srv.on('error', (error) => {
            jasmine.fail('Failed to start node: ' + error);
            throw 'Failed to start node: ' + error;
        });

        srv.stdout.on('data', (data) => {
            if (config.nodeDebug)
                console.log(data.toString());
        });

        srv.stderr.on('data', (data) => {
            if (config.nodeDebug)
                console.error(data.toString());
        });

        const started = await TestingHelper.waitForCondition(async () =>
            TestingHelper.tryConnectClient(idx), 30000);

        if (!started) {
            await TestingHelper.killNodeAndWait(srv);
            throw 'Failed to start Node: timeout while trying to connect';
        }

        return srv;
    }

    static executeExample(name, outputChecker) {
        return new Promise((resolve, reject) => {
                child_process.exec('node ' + name, (error, stdout, stderr) => {
                    TestingHelper.logDebug(stdout);
                    resolve(stdout);
                })
            }).
            then(output => {
                expect(output).not.toMatch('ERROR:');
                expect(output).toMatch('Client is started');
            });
    }

    static checkOperationError(error, done) {
        TestingHelper.checkError(error, Errors.OperationError, done)
    }

    static checkIllegalArgumentError(error, done) {
        TestingHelper.checkError(error, Errors.IgniteClientError, done)
    }

    static checkEnumItemSerializationError(error, done) {
        if (!(error instanceof Errors.IgniteClientError) ||
            error.message.indexOf('Enum item can not be serialized') < 0) {
            done.fail('unexpected error: ' + error);
        }
    }

    static checkError(error, errorType, done) {
        if (!(error instanceof errorType)) {
            done.fail('unexpected error: ' + error);
        }
    }

    static logDebug(message) {
        if (config.debug) {
            console.log(message);
        }
    }

    static printValue(value) {
        const val = Util.inspect(value, false, null);
        const length = 500;
        return val.length > length ? val.substr(0, length) + '...' : val;
    }

    static async compare(value1, value2) {
        TestingHelper.logDebug(Util.format('compare: %s and %s', TestingHelper.printValue(value1), TestingHelper.printValue(value2)));
        if (value1 === undefined || value2 === undefined) {
            TestingHelper.logDebug(Util.format('compare: unexpected "undefined" value'));
            return false;
        }
        if (value1 === null && value2 === null) {
            return true;
        }
        if (value1 === null && value2 !== null || value1 !== null && value2 === null) {
            return false;
        }
        if (typeof value1 !== typeof value2) {
            TestingHelper.logDebug(Util.format('compare: value types are different: %s and %s',
                typeof value1, typeof value2));
            return false;
        }
        if (typeof value1 === 'number') {
            return floatComparator(value1, value2);
        }
        else if (typeof value1 !== 'object') {
            return defaultComparator(value1, value2);
        }
        else if (value1.constructor.name !== value2.constructor.name && !value2 instanceof BinaryObject) {
            TestingHelper.logDebug(Util.format('compare: value types are different: %s and %s',
                value1.constructor.name, value2.constructor.name));
            return false;
        }
        else if (value1 instanceof Date && value2 instanceof Date) {
            return dateComparator(value1, value2);
        }
        else if (value1 instanceof EnumItem && value2 instanceof EnumItem) {
            return enumComparator(value1, value2);
        }
        else if (value1 instanceof Decimal && value2 instanceof Decimal) {
            return decimalComparator(value1, value2);
        }
        else if (value1 instanceof Timestamp && value2 instanceof Timestamp) {
            return timestampComparator(value1, value2);
        }
        else if (value1 instanceof Array && value2 instanceof Array) {
            if (value1.length !== value2.length) {
                TestingHelper.logDebug(Util.format('compare: array lengths are different'));
                return false;
            }
            for (var i = 0; i < value1.length; i++) {
                if (!await TestingHelper.compare(value1[i], value2[i])) {
                    TestingHelper.logDebug(Util.format('compare: array elements are different: %s, %s',
                        TestingHelper.printValue(value1[i]), TestingHelper.printValue(value2[i])));
                    return false;
                }
            }
            return true;
        }
        else if (value1 instanceof Map && value2 instanceof Map) {
            if (value1.size !== value2.size) {
                TestingHelper.logDebug(Util.format('compare: map sizes are different'));
                return false;
            }
            for (var [key, val] of value1) {
                if (!value2.has(key)) {
                    TestingHelper.logDebug(Util.format('compare: maps are different: %s key is absent', TestingHelper.printValue(key)));
                    return false;
                }
                if (!(await TestingHelper.compare(val, value2.get(key)))) {
                    TestingHelper.logDebug(Util.format('compare: map values are different: %s, %s',
                        TestingHelper.printValue(val), TestingHelper.printValue(value2.get(key))));
                    return false;
                }
            }
            return true;
        }
        else if (value1 instanceof Set && value2 instanceof Set) {
            if (value1.size !== value2.size) {
                TestingHelper.logDebug(Util.format('compare: set sizes are different'));
                return false;
            }
            const value1Arr = [...value1].sort();
            const value2Arr = [...value2].sort();
            if (!await TestingHelper.compare(value1Arr, value2Arr)) {
                TestingHelper.logDebug(Util.format('compare: sets are different: %s and %s',
                    TestingHelper.printValue(value1Arr), TestingHelper.printValue(value2Arr)));
                return false;
            }
            return true;
        }
        else if (value2 instanceof BinaryObject) {
            if (value1 instanceof BinaryObject) {
                if (value1.getTypeName() !== value2.getTypeName()) {
                    TestingHelper.logDebug(Util.format('compare: binary object type names are different'));
                    return false;
                }
                if (!await TestingHelper.compare(value1.getFieldNames(), value2.getFieldNames())) {
                    TestingHelper.logDebug(Util.format('compare: binary object field names are different'));
                    return false;
                }
                for (let fieldName of value1.getFieldNames()) {
                    if (!value1.hasField(fieldName) || !value2.hasField(fieldName) ||
                        !await TestingHelper.compare(await value1.getField(fieldName), await value1.getField(fieldName))) {
                        TestingHelper.logDebug(Util.format('compare: binary objects field "%s" values are different', fieldName));
                        return false;
                    }
                }
                return true;
            }
            else {
                let value;
                for (let key of Object.keys(value1)) {
                    value = await value2.getField(key);
                    if (!(await TestingHelper.compare(value1[key], value))) {
                        TestingHelper.logDebug(Util.format('compare: binary object values for key %s are different: %s and %s',
                            TestingHelper.printValue(key), TestingHelper.printValue(value1[key]), TestingHelper.printValue(value)));
                        return false;
                    }
                }
                return true;
            }
        }
        else {
            for (let key of Object.keys(value1)) {
                if (!(await TestingHelper.compare(value1[key], value2[key]))) {
                    TestingHelper.logDebug(Util.format('compare: object values for key %s are different: %s and %s',
                        TestingHelper.printValue(key), TestingHelper.printValue(value1[key]), TestingHelper.printValue(value2[key])));
                    return false;
                }
            }
            return true;
        }
    }
}

module.exports = TestingHelper;
