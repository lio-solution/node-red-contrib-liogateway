'use strict'
/*
 *  Copyright (C) 2020 Lapis Semiconductor Co., Ltd.
 *  file: lazurite-iot-mqtt-out.js
 *
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *	  http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

module.exports = (RED,node) => {
	node.core = RED.nodes.getNode(node.config.core);
	node.core.register(node);
	node.on('input',(msg) => {
		if(!msg.topic) msg.topic = node.config.topic;
		msg.options = msg.options || {};
		if(!msg.options.qos) msg.options.qos = parseInt(node.config.qos);
		node.core.mqtt.publish(msg,(err) => {
			console.log(err);
		});
	});
	node.on('close',(done) => {
		node.core.deregister(node);
		done();
	});
}

