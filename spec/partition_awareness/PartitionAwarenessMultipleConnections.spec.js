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
const PartitionAwarenessTestUtils = require('./PartitionAwarenessTestUtils');
const { ObjectType } = require('apache-ignite-client');

const CACHE_NAME = '__test_cache';
const CUSTOM_AFFINITY_CACHE = 'custom-affinity';
const PARTITIONED_0_CACHE = 'partitioned0';
const PARTITIONED_1_CACHE = 'partitioned1';
const PARTITIONED_3_CACHE = 'partitioned3';
const REPLICATED_CACHE = 'replicated';
const SERVER_NUM = 3;

describe('partition awareness multiple connections test suite >', () => {
    let igniteClient = null;

    beforeAll((done) => {
        Promise.resolve().
            then(async () => {
                await TestingHelper.init(true, SERVER_NUM, true);
                igniteClient = TestingHelper.igniteClient;
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
            catch(_error => done());
    }, TestingHelper.TIMEOUT);

    it('all cache operations with partition awareness and multiple connections', (done) => {
        Promise.resolve().
            then(async () => {
                const cache = await getOrCreateCache(ObjectType.PRIMITIVE_TYPE.INTEGER, ObjectType.PRIMITIVE_TYPE.INTEGER);
                await PartitionAwarenessTestUtils.testAllCacheOperations(cache);
            }).
            then(done).
            catch(error => done.fail(error));
    });

    it('all cache operations with partition awareness and bad affinity', (done) => {
        Promise.resolve().
            then(async () => {
                const cache = await getOrCreateCache(ObjectType.PRIMITIVE_TYPE.INTEGER, ObjectType.PRIMITIVE_TYPE.INTEGER, CUSTOM_AFFINITY_CACHE);
                await PartitionAwarenessTestUtils.testRandomNode(cache);
            }).
            then(done).
            catch(error => done.fail(error));
    });
    
    it('put with partition awareness and unknown cache', (done) => {
        Promise.resolve().
            then(async () => {
                const cache = await getCache(ObjectType.PRIMITIVE_TYPE.INTEGER, ObjectType.PRIMITIVE_TYPE.INTEGER, '__unknown_cache_359f72tg');
                let key = 42;
                try {
                    await cache.put(key, key);
                }
                catch (error) {
                    expect(error.message).toContain('Cache does not exist');
                    return;
                }
                fail('Exception was expected');
            }).
            then(done).
            catch(error => done.fail(error));
    });

    it('get or create null cache with partition awareness', (done) => {
        Promise.resolve().
            then(async () => {
                try {
                    await getOrCreateCache(ObjectType.PRIMITIVE_TYPE.INTEGER, ObjectType.PRIMITIVE_TYPE.INTEGER, null);
                }
                catch (error) {
                    expect(error.toString()).toContain('"name" argument should not be empty');
                    return;
                }
                fail('Exception was expected');
            }).
            then(done).
            catch(error => done.fail(error));
    });

    it('get or create null cache with partition awareness', (done) => {
        Promise.resolve().
            then(async () => {
                try {
                    await getOrCreateCache(ObjectType.PRIMITIVE_TYPE.INTEGER, ObjectType.PRIMITIVE_TYPE.INTEGER, null);
                }
                catch (error) {
                    expect(error.toString()).toContain('"name" argument should not be empty');
                    return;
                }
                fail('Exception was expected');
            }).
            then(done).
            catch(error => done.fail(error));
    });

    it('all cache operations with partition awareness and partitioned cache with 0 backups', (done) => {
        Promise.resolve().
            then(async () => {
                const cache = await getCache(ObjectType.PRIMITIVE_TYPE.INTEGER, ObjectType.PRIMITIVE_TYPE.INTEGER, PARTITIONED_0_CACHE);
                
                // Update partition mapping
                await TestingHelper.ensureStableTopology(igniteClient, cache, 0, true);

                await PartitionAwarenessTestUtils.testAllCacheOperationsOnTheSameKey(cache, 42);
            }).
            then(done).
            catch(error => done.fail(error));
    });

    it('all cache operations with partition awareness and partitioned cache with 1 backups', (done) => {
        Promise.resolve().
            then(async () => {
                const cache = await getCache(ObjectType.PRIMITIVE_TYPE.INTEGER, ObjectType.PRIMITIVE_TYPE.INTEGER, PARTITIONED_1_CACHE);
                
                // Update partition mapping
                await TestingHelper.ensureStableTopology(igniteClient, cache, 0, true);

                await PartitionAwarenessTestUtils.testAllCacheOperationsOnTheSameKey(cache, 100500);
            }).
            then(done).
            catch(error => done.fail(error));
    });

    it('all cache operations with partition awareness and partitioned cache with 3 backups', (done) => {
        Promise.resolve().
            then(async () => {
                const cache = await getCache(ObjectType.PRIMITIVE_TYPE.INTEGER, ObjectType.PRIMITIVE_TYPE.INTEGER, PARTITIONED_3_CACHE);
                
                // Update partition mapping
                await TestingHelper.ensureStableTopology(igniteClient, cache, 0, true);

                await PartitionAwarenessTestUtils.testAllCacheOperationsOnTheSameKey(cache, 1337);
            }).
            then(done).
            catch(error => done.fail(error));
    });

    it('all cache operations with partition awareness and replicated cache', (done) => {
        Promise.resolve().
            then(async () => {
                const cache = await getCache(ObjectType.PRIMITIVE_TYPE.INTEGER, ObjectType.PRIMITIVE_TYPE.INTEGER, REPLICATED_CACHE);
                await PartitionAwarenessTestUtils.testAllCacheOperations(cache);
            }).
            then(done).
            catch(error => done.fail(error));
    });

    async function getOrCreateCache(keyType, valueType, cacheName = CACHE_NAME, cacheCfg = null) {
        return await PartitionAwarenessTestUtils.getOrCreateCache(igniteClient, keyType, valueType, cacheName, cacheCfg);
    }

    async function getCache(keyType, valueType, cacheName = CACHE_NAME, cacheCfg = null) {
        return (await igniteClient.getCache(cacheName, cacheCfg)).
            setKeyType(keyType).
            setValueType(valueType);
    }
    
    async function clearCache(name) {
        await (await igniteClient.getCache(name)).clear();
    }

    async function testSuiteCleanup(done) {
        await clearCache(CUSTOM_AFFINITY_CACHE);
        await clearCache(PARTITIONED_0_CACHE);
        await clearCache(PARTITIONED_1_CACHE);
        await clearCache(PARTITIONED_3_CACHE);
        await clearCache(REPLICATED_CACHE);
        await TestingHelper.destroyCache(CACHE_NAME, done);
    }
});
