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
const {
    IgniteClientConfiguration, ObjectType, ComplexObjectType
} = require('apache-ignite-client');

const CACHE_NAME = '__test_cold_complex_read';

// Deadlock guard: a fresh client reading a complex object whose binary type is
// not yet in its own BinaryTypeStorage must issue a nested GET_BINARY_TYPE on the
// same socket from inside the get() payloadReader. If response finalization is
// awaited on the socket processing queue, that nested reply can never be parsed
// and get() hangs forever, so we race it against an explicit timeout.
const DEADLOCK_TIMEOUT_MS = 10000;

class ColdValue {
    constructor() {
        this.id = null;
        this.name = null;
    }
}

function coldValueType() {
    return new ComplexObjectType(new ColdValue(), 'ColdValue').
        setFieldType('id', ObjectType.PRIMITIVE_TYPE.INTEGER).
        setFieldType('name', ObjectType.PRIMITIVE_TYPE.STRING);
}

async function withTimeout(promise, ms, message) {
    let timer;
    const guard = new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
    });
    // try/finally rather than Promise.prototype.finally, which is Node 10+
    // (package.json declares engines.node >= 8.0.0).
    try {
        return await Promise.race([promise, guard]);
    } finally {
        clearTimeout(timer);
    }
}

describe('cold complex object read test suite >', () => {
    let igniteClient = null;

    beforeAll((done) => {
        Promise.resolve().
            then(async () => {
                await TestingHelper.init();
                igniteClient = TestingHelper.igniteClient;
                await igniteClient.destroyCache(CACHE_NAME).catch(() => {});
                await igniteClient.getOrCreateCache(CACHE_NAME);
            }).
            then(done).
            catch(error => done.fail(error));
    }, TestingHelper.TIMEOUT);

    afterAll((done) => {
        Promise.resolve().
            then(async () => {
                if (igniteClient) {
                    await igniteClient.destroyCache(CACHE_NAME).catch(() => {});
                }
                await TestingHelper.cleanUp();
            }).
            then(done).
            catch(error => done.fail(error));
    }, TestingHelper.TIMEOUT);

    it('fresh client reads a complex object it did not write without deadlock', (done) => {
        let clientB = null;
        Promise.resolve().
            then(async () => {
                const key = 1;
                const value = new ColdValue();
                value.id = 42;
                value.name = 'cold-read';

                // Writer client A: put registers the binary type in A's own type
                // storage (addType) and on the server, but NOT in any other client.
                const cacheA = igniteClient.getCache(CACHE_NAME).
                    setValueType(coldValueType());
                await cacheA.put(key, value);

                // Reader client B: a separate, freshly-connected client whose
                // BinaryTypeStorage._types is empty, so reading the value forces a
                // nested GET_BINARY_TYPE on B's single socket — the cold path that
                // the existing suites never exercise (they put before they read on
                // the same client, making getType a cache hit).
                clientB = TestingHelper.makeClient();
                const endpoints = TestingHelper.getEndpoints(1);
                await clientB.connect(new IgniteClientConfiguration(...endpoints).
                    setConnectionOptions(false, null, false));

                const cacheB = clientB.getCache(CACHE_NAME).
                    setValueType(coldValueType());

                const result = await withTimeout(
                    cacheB.get(key),
                    DEADLOCK_TIMEOUT_MS,
                    'cache.get() of an uncached complex object did not resolve within ' +
                        DEADLOCK_TIMEOUT_MS + 'ms — the response processing queue deadlocked');

                expect(result).not.toBeNull();
                expect(result.id).toBe(value.id);
                expect(result.name).toBe(value.name);
            }).
            then(done).
            catch(error => done.fail(error)).
            then(async () => {
                if (clientB) {
                    await clientB.disconnect();
                }
            });
    }, TestingHelper.TIMEOUT);
});
