'use strict'
/*
 *  Copyright (C) 2021 Naotaka Saito
 *  file: lio-gateway-mqtt-out.js
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
	let connected = false;
	node.registered = function (){
		connected = true;
	}
	node.on('input',(msg) => {
		if(connected === true) {
			if(!msg.topic) msg.topic = `custom/${node.config.topic}`;
			msg.options = msg.options || {};
			if(!msg.options.qos) msg.options.qos = parseInt(node.config.qos);
			node.core.mqtt.publish(msg,(err) => {
				if(err) {
					RED.log.warn(err);
				}
			});
		} else {
			RED.log.warn('mqtt is not connected yet');
		}
	});
	node.on('close',(done) => {
		node.core.deregister(node);
		done();
	});
	node.core.register(node);
}

