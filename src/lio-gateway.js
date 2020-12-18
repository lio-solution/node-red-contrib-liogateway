'use strict'
/*
 *  Copyright (C) 2020 Lapis Semiconductor Co., Ltd.
 *  file: lazurite-iot.js
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
	function LazuriteIotDeviceIn(config) {
		RED.nodes.createNode(this,config);
		let node = this;
		node.config = config;
		require("./lazurite-iot-device-in")(RED,node);
	}
	RED.nodes.registerType("lazurite-iot-device-in",LazuriteIotDeviceIn);

	function LazuriteIotDeviceOut(config) {
		RED.nodes.createNode(this,config);
		let node = this;
		node.config = config;
		require("./lazurite-iot-device-out")(RED,node);
	}
	RED.nodes.registerType("lazurite-iot-device-out",LazuriteIotDeviceOut);

	function LazuriteIotMqttOut(config) {
		RED.nodes.createNode(this,config);
		let node = this;
		node.config = config;
		require("./lazurite-iot-mqtt-out")(RED,node);
	}
	RED.nodes.registerType("lazurite-iot-mqtt-out",LazuriteIotMqttOut);

	function LazuriteIotMqttIn(config) {
		RED.nodes.createNode(this,config);
		let node = this;
		node.config = config;
		require("./lazurite-iot-mqtt-in")(RED,node);
	}
	RED.nodes.registerType("lazurite-iot-mqtt-in",LazuriteIotMqttIn);

	function LazuriteIotCore(config) {
		RED.nodes.createNode(this,config);
		let node = this;
		node.config = config;
		require("./lazurite-iot-core")(RED,node);
	}
	RED.nodes.registerType("lazurite-iot-core",LazuriteIotCore);
}

