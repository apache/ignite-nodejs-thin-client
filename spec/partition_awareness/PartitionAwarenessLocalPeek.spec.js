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

const TestingHelper = require('../TestingHelper');
const { IgniteClient, CacheConfiguration, CacheKeyConfiguration, ObjectType, BinaryObject, ComplexObjectType } = require('apache-ignite-client');

const CACHE_NAME = '__test_cache';

describe('partition awareness with local peek test suite >', () => {
    let igniteClient = null;
    const affinityKeyField = 'affKeyField';

    beforeAll((done) => {
        Promise.resolve().
            then(async () => {
                // Pass "true" to turn on Partition Awareness even
                // if APACHE_IGNITE_CLIENT_PARTITION_AWARENESS env var is not passed
                await TestingHelper.init(true, 3);
                igniteClient = TestingHelper.igniteClient;
                await checkPartitionAwarenessActive(done);
                await testSuiteCleanup(done);
            }).
            then(done).
            catch(error => done.fail(error));
    }, TestingHelper.TIMEOUT);

    afterAll((done) => {
        Promise.resolve().
            then(async () => {
                await testSuiteCleanup(done);
                await TestingHelper.cleanUp();
            }).
            then(done).
            catch(error => done());
    }, TestingHelper.TIMEOUT);

    it('put keys of different primitive types and check local peek', (done) => {
        Promise.resolve().
            then(async () => {
                const val = "someVal";
                const valType = ObjectType.PRIMITIVE_TYPE.STRING;

                for (let keyType of Object.keys(TestingHelper.primitiveValues)) {
                    keyType = parseInt(keyType);
                    if (keyType == ObjectType.PRIMITIVE_TYPE.DECIMAL) {
                        // Decimal is not a recommended type to use as a key
                        continue;
                    }
                    const typeInfo1 = TestingHelper.primitiveValues[keyType];
                    for (let value1 of typeInfo1.values) {
                        await putAndCheckLocalPeek(keyType, valType, value1, val);
                        if (typeInfo1.typeOptional) {
                            await putAndCheckLocalPeek(null, valType, value1, val);
                        }
                    }
                }
            }).
            then(done).
            catch(error => done.fail(error));
    });

    it('put binary object and check local peek', (done) => {
        Promise.resolve().
            then(async () => {
                const typeName = 'TestClass1';
                const intValue = 256256256;
                const stringValue = 'someStr';
                const boolValue = true;
                const doubleValue = 256.256;

                const key = new BinaryObject(typeName);

                key.setField('field_int', intValue, ObjectType.PRIMITIVE_TYPE.INTEGER);
                key.setField('field_string', stringValue);
                key.setField('field_bool', boolValue);
                key.setField('field_douible', doubleValue);

                await putAndCheckLocalPeek(null, null, key, intValue);
            }).
            then(done).
            catch(error => done.fail(error));
    });

    it('put binary object with affinity key and check local peek', (done) => {
        Promise.resolve().
            then(async () => {
                // We use separate cache here
                const cacheName = '__test_cache2';
                const typeName = 'TestClass2';

                const intValue = 256256256;
                const stringValue = 'someStr';

                const keyCfg = new CacheKeyConfiguration(typeName, affinityKeyField);
                const cacheCfg = createCacheConfig(keyCfg);

                const key = new BinaryObject(typeName);

                key.setField(affinityKeyField, intValue, ObjectType.PRIMITIVE_TYPE.INTEGER);
                key.setField('field_string', stringValue);
                key.setField('field_int', intValue, ObjectType.PRIMITIVE_TYPE.INTEGER);

                await putAndCheckLocalPeek(null, null, key, intValue, cacheName, cacheCfg);
            }).
            then(done).
            catch(error => done.fail(error));
    });

    it('put js object with affinity key and check local peek', (done) => {
        Promise.resolve().
            then(async () => {
                // We use separate cache here
                const cacheName = '__test_cache3';
                const typeName = 'TestClass3';

                const intValue = 16161616;
                const stringValue = 'someStr';

                const keyCfg = new CacheKeyConfiguration(typeName, affinityKeyField);
                const cacheCfg = createCacheConfig(keyCfg);

                const key = {};

                key[affinityKeyField] = intValue;
                key['field_string'] = stringValue;
                key['field_int'] = intValue;

                const keyType = new ComplexObjectType(key, typeName);

                // With keyType hint
                await putAndCheckLocalPeek(keyType, null, key, intValue, cacheName, cacheCfg);
                // Without keyType hint
                await putAndCheckLocalPeek(null, null, key, intValue, cacheName, cacheCfg);
            }).
            then(done).
            catch(error => done.fail(error));
    });

    async function putAndCheckLocalPeek(keyType, valueType, key, value, cache_name = CACHE_NAME, cacheCfg = null) {
        const cache = (await igniteClient.getOrCreateCache(cache_name, cacheCfg)).
            setKeyType(keyType).
            setValueType(valueType);

        try {
            await cache.put(key, value);
            await checkLocalPeek(cache, key, value);
        }
        finally {
            await cache.removeAll();
        }
    }

    async function checkLocalPeek(cache, key, value) {
        await TestingHelper.ensureStableTopology(igniteClient, cache, key);

        const affHint = cache._createAffinityHint(key);
        const bestSocket = await igniteClient._router._chooseConnection(affHint);

        for (const socket of igniteClient._router._getAllConnections()) {
            let localPeekVal = await cache._localPeek(socket, key);
            if (socket == bestSocket) {
                expect(localPeekVal).toBe(value, 'local peek did not return the expected value');
            }
            else {
                expect(localPeekVal).toBe(null, 'local peek returned not null value');
            }
        }
    }

    function createCacheConfig(keyCfg = null) {
        return new CacheConfiguration().
            setWriteSynchronizationMode(CacheConfiguration.WRITE_SYNCHRONIZATION_MODE.FULL_SYNC).
            setCacheMode(CacheConfiguration.CACHE_MODE.PARTITIONED).
            setKeyConfigurations(keyCfg);
    }

    async function checkPartitionAwarenessActive(done) {
        await TestingHelper.waitForConditionOrThrow(() => {
            return igniteClient._router._partitionAwarenessActive;
        }, 2000).
        then(done).
        catch(_e => done.fail("Partition Awareness hasn't been activated. Probably, the cluster doesn't support it"));
    }

    async function testSuiteCleanup(done) {
        await TestingHelper.destroyCache(CACHE_NAME, done);
    }
});
