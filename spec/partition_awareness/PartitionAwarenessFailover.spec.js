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
const SERVER_NUM = 3;

describe('partition awareness multiple connections failover test suite >', () => {
    let igniteClient = null;

    beforeEach((done) => {
        Promise.resolve().
            then(async () => {
                await TestingHelper.init(true, SERVER_NUM, true);
                igniteClient = TestingHelper.igniteClient;
            }).
            then(done).
            catch(error => done.fail(error));
    }, TestingHelper.TIMEOUT);

    afterEach((done) => {
        Promise.resolve().
            then(async () => {
                await TestingHelper.cleanUp();
            }).
            then(done).
            catch(_error => done());
    }, TestingHelper.TIMEOUT);

    it('cache operation fails gracefully when all nodes are killed', (done) => {
        Promise.resolve().
            then(async () => {
                const cache = await getCache(ObjectType.PRIMITIVE_TYPE.INTEGER, ObjectType.PRIMITIVE_TYPE.INTEGER);
                let key = 1;

                // Put/Get
                await cache.put(key, key);
                expect(await cache.get(key)).toEqual(key);

                // Killing nodes
                await TestingHelper.stopTestServers();

                // Get
                try {
                    await cache.put(key, key);
                }
                catch (error) {
                    expect(error.message).toMatch(/(.*Cluster is unavailable*.)|(.*client is not in an appropriate state.*)/);

                    return;
                }

                throw 'Operation fail is expected';
            }).
            then(done).
            catch(error => done.fail(error));
    });

    it('cache operation does not fail when single node is killed', (done) => {
        Promise.resolve().
            then(async () => {
                const cache = await getCache(ObjectType.PRIMITIVE_TYPE.INTEGER, ObjectType.PRIMITIVE_TYPE.INTEGER);
                let key = 1;

                // Update partition mapping
                await TestingHelper.ensureStableTopology(igniteClient, cache, key, true);

                // Put test value to find out the right node
                await cache.put(key, key);
                expect(await cache.get(key)).toEqual(key);

                // Killing node for the key
                const serverId = await TestingHelper.getRequestGridIdx('Put');
                expect(serverId).not.toEqual(-1, 'Can not find node for a put request');

                await TestingHelper.killNodeByIdAndWait(serverId);

                await cache.put(key, key);
                expect(await cache.get(key)).toEqual(key);
            }).
            then(done).
            catch(error => done.fail(error));
    });

    it('cache operation does not fail when node is killed and recovered', (done) => {
        Promise.resolve().
            then(async () => {
                const cache = await getCache(ObjectType.PRIMITIVE_TYPE.INTEGER, ObjectType.PRIMITIVE_TYPE.INTEGER);
                let key = 1;

                // Update partition mapping
                await TestingHelper.ensureStableTopology(igniteClient, cache, key, true);

                // Put test value to find out the right node
                await cache.put(key, key);
                expect(await cache.get(key)).toEqual(key);

                // Killing node for the key
                const recoveredNodeId = await TestingHelper.getRequestGridIdx('Put');
                expect(recoveredNodeId).not.toEqual(-1, 'Can not find node for a put request');

                await TestingHelper.killNodeByIdAndWait(recoveredNodeId);
                await TestingHelper.sleep(1000);
                await TestingHelper.startTestServer(true, recoveredNodeId);
                
                // Update partition mapping
                await TestingHelper.ensureStableTopology(igniteClient, cache, key, true);

                let keys = 1000;
                for (let i = 1; i < keys; ++i) {
                    await cache.put(i * 1433, i);
                    const serverId = await TestingHelper.getRequestGridIdx('Put');

                    // It means request got to the new node.
                    if (serverId == recoveredNodeId)
                        return;
                }

                throw 'Not a single request out of ' + keys + ' got to the recovered node';
            }).
            then(done).
            catch(error => done.fail(error));
    });

    async function getCache(keyType, valueType, cacheName = CACHE_NAME, cacheCfg = null) {
        return await PartitionAwarenessTestUtils.getOrCreateCache(igniteClient, keyType, valueType, cacheName, cacheCfg);
    }
});
