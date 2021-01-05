'use strict'
/*
 *  Copyright (C) 2021 Naotaka Saito
 *  file: lio-gateway.js
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

module.exports = function (RED) {
	function LioGatewayDeviceIn(config) {
		RED.nodes.createNode(this,config);
		let node = this;
		node.config = config;
		require("./lio-gateway-device-in")(RED,node);
	}
	RED.nodes.registerType("lio-gateway-device-in",LioGatewayDeviceIn);

	function LioGatewayDeviceOut(config) {
		RED.nodes.createNode(this,config);
		let node = this;
		node.config = config;
		require("./lio-gateway-device-out")(RED,node);
	}
	RED.nodes.registerType("lio-gateway-device-out",LioGatewayDeviceOut);

	function LioGatewayMqttOut(config) {
		RED.nodes.createNode(this,config);
		let node = this;
		node.config = config;
		require("./lio-gateway-mqtt-out")(RED,node);
	}
	RED.nodes.registerType("lio-gateway-mqtt-out",LioGatewayMqttOut);

	function LioGatewayMqttIn(config) {
		RED.nodes.createNode(this,config);
		let node = this;
		node.config = config;
		const func = require("./lio-gateway-mqtt-in");
		func(RED,node);
	}
	RED.nodes.registerType("lio-gateway-mqtt-in",LioGatewayMqttIn);

	function LioGatewayCore(config) {
		RED.nodes.createNode(this,config);
		let node = this;
		node.config = config;
		require("./lio-gateway-core")(RED,node);
	}
	RED.nodes.registerType("lio-gateway-core",LioGatewayCore);
}

