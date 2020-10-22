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

describe('partition awareness with single server test suite >', () => {
    let igniteClient = null;

    beforeAll((done) => {
        Promise.resolve().
            then(async () => {
                let endpoints = TestingHelper.getEndpoints(SERVER_NUM);
                await TestingHelper.init(true, SERVER_NUM, true, [endpoints[0]]);
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

    it('all cache operations with partition aware client and single connection', (done) => {
        Promise.resolve().
            then(async () => {
                const cache = await getCache(ObjectType.PRIMITIVE_TYPE.INTEGER, ObjectType.PRIMITIVE_TYPE.INTEGER);
                await PartitionAwarenessTestUtils.testSameNode(cache);
            }).
            then(done).
            catch(error => done.fail(error));
    });

    async function getCache(keyType, valueType, cacheName = CACHE_NAME, cacheCfg = null) {
        return await PartitionAwarenessTestUtils.getOrCreateCache(igniteClient, keyType, valueType, cacheName, cacheCfg);
    }

    async function testSuiteCleanup(done) {
        await TestingHelper.destroyCache(CACHE_NAME, done);
    }
});
