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


import exp = require("constants");

/**
 * Supported Ignite type codes for primitive (simple) types.
 * @typedef ObjectType.PRIMITIVE_TYPE
 * @enum
 * @readonly
 * @property BYTE 1
 * @property SHORT 2
 * @property INTEGER 3
 * @property LONG 4
 * @property FLOAT 5
 * @property DOUBLE 6
 * @property CHAR 7
 * @property BOOLEAN 8
 * @property STRING 9
 * @property UUID 10
 * @property DATE 11
 * @property BYTE_ARRAY 12
 * @property SHORT_ARRAY 13
 * @property INTEGER_ARRAY 14
 * @property LONG_ARRAY 15
 * @property FLOAT_ARRAY 16
 * @property DOUBLE_ARRAY 17
 * @property CHAR_ARRAY 18
 * @property BOOLEAN_ARRAY 19
 * @property STRING_ARRAY 20
 * @property UUID_ARRAY 21
 * @property DATE_ARRAY 22
 * @property ENUM 28
 * @property ENUM_ARRAY 29
 * @property DECIMAL 30
 * @property DECIMAL_ARRAY 31
 * @property TIMESTAMP 33
 * @property TIMESTAMP_ARRAY 34
 * @property TIME 36
 * @property TIME_ARRAY 37
 */
export enum PRIMITIVE_TYPE {
    BYTE = 1,
    SHORT = 2,
    INTEGER = 3,
    LONG = 4,
    FLOAT = 5,
    DOUBLE = 6,
    CHAR = 7,
    BOOLEAN = 8,
    STRING = 9,
    UUID = 10,
    DATE = 11,
    BYTE_ARRAY = 12,
    SHORT_ARRAY = 13,
    INTEGER_ARRAY = 14,
    LONG_ARRAY = 15,
    FLOAT_ARRAY = 16,
    DOUBLE_ARRAY = 17,
    CHAR_ARRAY = 18,
    BOOLEAN_ARRAY = 19,
    STRING_ARRAY = 20,
    UUID_ARRAY = 21,
    DATE_ARRAY = 22,
    ENUM = 28,
    ENUM_ARRAY = 29,
    DECIMAL = 30,
    DECIMAL_ARRAY = 31,
    TIMESTAMP = 33,
    TIMESTAMP_ARRAY = 34,
    TIME = 36,
    TIME_ARRAY = 37
}

/**
 * Supported Ignite type codes for non-primitive (composite) types.
 * @typedef ObjectType.COMPOSITE_TYPE
 * @enum
 * @readonly
 * @property OBJECT_ARRAY 23
 * @property COLLECTION 24
 * @property MAP 25
 * @property NULL 101
 * @property COMPLEX_OBJECT 103
 */
export enum COMPOSITE_TYPE {
    OBJECT_ARRAY = 23,
    COLLECTION = 24,
    MAP = 25,
    NULL = 101,
    COMPLEX_OBJECT = 103
}