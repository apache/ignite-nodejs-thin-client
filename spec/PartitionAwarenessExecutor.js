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

const Jasmine = require('jasmine');

const jasmine = new Jasmine();
jasmine.loadConfig({
    'spec_dir': 'spec',
    'spec_files': [
        "partition_awareness/**/*[sS]pec.js",
	    "cache/**/*[sS]pec.js",
	    "query/**/*[sS]pec.js"
    ],
    "random": false,
    // If this is set to true, we won't clean up environment, i.e. stop nodes
    "stopOnSpecFailure": false
});
jasmine.execute();
