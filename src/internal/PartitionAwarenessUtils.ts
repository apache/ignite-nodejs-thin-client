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

import * as Util from 'util';
import BinaryUtils from "./BinaryUtils";
import MessageBuffer from "./MessageBuffer";
import BinaryCommunicator from "./BinaryCommunicator";

export class AffinityTopologyVersion {

    private _major: number;

    private _minor: number;

    constructor(payload) {
        this._major = payload.readLong();
        this._minor = payload.readInteger();
    }

    compareTo(other) {
        let diff = this._major - other._major;
        if (diff !== 0) {
            return diff;
        }
        return this._minor - other._minor;
    }

    equals(other) {
        return this.compareTo(other) === 0;
    }

    toString() {
        return Util.format('%d.%d', this._major, this._minor);
    }
}

export class PartitionAwarenessCacheGroup {

    private _caches: Array<[number, Map<number, number>]>;

    private _partitionMap: Array<[number, number[]]>;

    constructor(caches: Array<[number, Map<number, number>]>, partitionMap: Array<[number, number[]]>) {
        this._caches = caches;
        this._partitionMap = partitionMap;
    }

    static async build(communicator, payload) {
        const applicable = payload.readBoolean();

        const cachesNum = payload.readInteger();
        const caches = new Array<[number, Map<number, number>]>(cachesNum);

        for (let i = 0; i < cachesNum; i++) {
            const cacheId = payload.readInteger();

            if (!applicable) {
                caches[i] = [cacheId, new Map()];
                continue;
            }

            caches[i] = [cacheId, this._readCacheKeyConfig(payload)];
        }

        if (!applicable) {
            return new PartitionAwarenessCacheGroup(caches, []);
        }

        const partitionMap: Array<[number, number[]]> = await this._readPartitionMap(communicator, payload);

        return new PartitionAwarenessCacheGroup(caches, partitionMap);
    }

    get caches(): Array<[number, Map<number, number>]> {
        // Array [[cacheId, cfg]]
        return this._caches;
    }

    get partitionMap(): Array<[number, number[]]> {
        // Array [[nodeId, [partitions]]]
        return this._partitionMap;
    }

    static _readCacheKeyConfig(payload): Map<number, number> {
        const configsNum = payload.readInteger();
        // {Key Type ID -> Affinity Key Field ID}
        let configs = new Map();

        if (configsNum > 0) {
            for (let i = 0; i < configsNum; i++) {
                const keyTypeId = payload.readInteger();
                const affinityKeyFieldId = payload.readInteger();

                configs.set(keyTypeId, affinityKeyFieldId);
            }
        }

        return configs;
    }

    static async _readPartitionMap(communicator: BinaryCommunicator, payload: MessageBuffer): Promise<Array<[number, number[]]>> {
        const partitionMapSize = payload.readInteger();
        // [[nodeId, [partitions]]]
        const partitionMap = new Array<[number, number[]]>(partitionMapSize);

        for (let i = 0; i < partitionMapSize; i++) {
            const nodeId = await communicator.readObject(payload, BinaryUtils.TYPE_CODE.UUID);
            const partitionsNum = payload.readInteger();
            const partitions = new Array<number>(partitionsNum);

            for (let j = 0; j < partitionsNum; j++) {
                partitions[j] = payload.readInteger();
            }

            partitionMap[i] = [nodeId, partitions];
        }

        return partitionMap;
    }
}

export class CacheAffinityMap {

    private _cacheId: number;

    // Map {partition -> nodeId}, nodeId is UUID represented by array of bytes
    private _partitionMapping: Map<number, number[]>;

    // Map {Key Type ID -> Affinity Key Field ID}
    private _keyConfig: Map<number, number>;

    constructor(cacheId: number, partitionMapping: Map<number, number[]>, keyConfig: Map<number, number>) {
        this._cacheId = cacheId;
        this._partitionMapping = partitionMapping;
        this._keyConfig = keyConfig;
    }

    get cacheId(): number {
        return this._cacheId;
    }

    get partitionMapping(): Map<number, number[]> {
        return this._partitionMapping;
    }

    get keyConfig(): Map<number, number> {
        return this._keyConfig;
    }
}

export class RendezvousAffinityFunction {
    static calcPartition(keyHash, partitionsNum): number {
        const mask = (partitionsNum & (partitionsNum - 1)) == 0 ? partitionsNum - 1 : -1;

        if (mask >= 0) {
            return (keyHash ^ (keyHash >> 16)) & mask;
        }

        return Math.abs(keyHash % partitionsNum);
    }
}
