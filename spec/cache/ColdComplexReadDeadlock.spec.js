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

const net = require('net');
const EventEmitter = require('events');
const Long = require('long');

// Drive the REAL ClientSocket against a mock TCP socket so this regression is
// deterministic and needs no cluster. It reproduces the exact async topology of
// the cold complex-object read: a single socket, one response whose payloadReader
// issues a nested request on that same socket and awaits its reply, where the
// reply only arrives as a later 'data' event. If response finalization is awaited
// on the socket's serialized processing queue, the nested reply is chained behind
// the still-pending outer entry and can never be processed -> the outer request
// hangs forever. With finalization dispatched off the queue, it resolves.
const ClientSocket = require('apache-ignite-client/dist/internal/ClientSocket').default;
const MessageBuffer = require('apache-ignite-client/dist/internal/MessageBuffer').default;

const HANDSHAKE_SUCCESS_STATUS_CODE = 1;
const OP_OUTER = 2001;
const OP_INNER = 2002;
const DEADLOCK_TIMEOUT_MS = 5000;

// Handshake reply frame: [length:int][status:byte]. The >= 1.4.0 path then reads a
// node-UUID via communicator.readObject, which the mock communicator stubs out, so
// no UUID bytes are required (frames are length-delimited, not reader-position
// delimited).
function buildHandshakeResponse() {
    const buf = new MessageBuffer();
    buf.position = 4;
    buf.writeByte(HANDSHAKE_SUCCESS_STATUS_CODE);
    const len = buf.length - 4;
    buf.position = 0;
    buf.writeInteger(len);
    return buf.data;
}

// Success response frame for protocol >= 1.4.0: [length:int][requestId:long][flags:short=0].
function buildResponse(requestId) {
    const buf = new MessageBuffer();
    buf.position = 4;
    buf.writeLong(requestId);
    buf.writeShort(0);
    const len = buf.length - 4;
    buf.position = 0;
    buf.writeInteger(len);
    return buf.data;
}

// Outgoing request frame layout (see ClientSocket Request.getMessage):
// [length:int][opCode:short][requestId:long][payload].
function parseOutgoing(data) {
    const buf = MessageBuffer.from(data, 0);
    buf.readInteger();
    const opCode = buf.readShort();
    const requestId = buf.readLong();
    return { opCode, requestId };
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

describe('cold complex object read deadlock (mock socket) test suite >', () => {
    let origCreateConnection;

    beforeEach(() => {
        origCreateConnection = net.createConnection;
    });

    afterEach(() => {
        net.createConnection = origCreateConnection;
    });

    it('response whose payloadReader awaits a nested same-socket request resolves', (done) => {
        let clientSocket = null;
        Promise.resolve().
            then(async () => {
                const mockSocket = new EventEmitter();
                mockSocket.end = () => {};

                let handshakeSent = false;
                mockSocket.write = (data) => {
                    if (!handshakeSent) {
                        // First write is the handshake (no opCode/id).
                        handshakeSent = true;
                        setImmediate(() => mockSocket.emit('data', buildHandshakeResponse()));
                        return true;
                    }
                    // Every subsequent request gets its reply on a LATER event loop
                    // tick — modelling the real "reply arrives as a future data event"
                    // ordering, including the nested request the outer reader issues.
                    const { opCode, requestId } = parseOutgoing(data);
                    if (opCode === OP_OUTER || opCode === OP_INNER) {
                        setImmediate(() => mockSocket.emit('data', buildResponse(requestId)));
                    }
                    return true;
                };

                net.createConnection = (options, onConnected) => {
                    setImmediate(onConnected);
                    return mockSocket;
                };

                const config = { options: {}, useTLS: false };
                const communicator = { readObject: async () => null };
                clientSocket = new ClientSocket(
                    '127.0.0.1:10800', config, communicator, () => {}, async () => {});

                await withTimeout(clientSocket.connect(), DEADLOCK_TIMEOUT_MS,
                    'handshake did not complete');

                let nestedIssued = false;
                let nestedResolved = false;
                const outer = clientSocket.sendRequest(
                    OP_OUTER,
                    async () => {},
                    async (buffer) => {
                        // Inline read of the outer response issues a nested request on
                        // this same socket and awaits it — exactly what readObject does
                        // for a COMPLEX_OBJECT whose binary type is not yet cached.
                        nestedIssued = true;
                        await clientSocket.sendRequest(OP_INNER, async () => {}, async () => {});
                        nestedResolved = true;
                    });

                await withTimeout(outer, DEADLOCK_TIMEOUT_MS,
                    'outer request did not resolve within ' + DEADLOCK_TIMEOUT_MS +
                        'ms — the response processing queue deadlocked on the nested ' +
                        'same-socket request');

                expect(nestedIssued).toBe(true);
                expect(nestedResolved).toBe(true);
            }).
            then(done).
            catch(error => done.fail(error)).
            then(() => {
                if (clientSocket) {
                    try { clientSocket.disconnect(); } catch (_e) { /* ignore */ }
                }
            });
    });
});
