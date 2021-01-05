'use strict'
/*
 *  Copyright (C) 2021 Naotaka Saito
 *  file: lio-gateway-core.js
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

module.exports = function(RED,node){
	//const fs = require("fs");
	//const os = require("os");
	const https = require("https");
	const util = require("util");
	const mqtt = require("./mqtt");
	const lazurite = require("./lazurite");
	let local = {};
	if(node.connecting === undefined) node.connecting =  false;
	if(node.connected === undefined) node.connected =  false;
	if(node.closing === undefined) node.closing =  false;

	node.users = {};
	node.register = function(n) {
		node.users[n.id] = n;
		if((node.connecting === false) && (node.connected === false)) {
			node.users[n.id].status({fill:"red",shape:"ring",text:"node-red:common.status.disconnected"});
		} else if((node.connecting === true) && (node.connected === false)) {
			node.users[n.id].status({fill:"yellow",shape:"ring",text:"node-red:common.status.connecting"});
		} else {
			node.users[n.id].status({fill:"green",shape:"dot",text:"node-red:common.status.connected"});
		}
		if((node.connecting === false) && (node.connected === false) && (node.closing === false)) {
			node.connecting = true;
			node.devices = {};
			node.done = [];
			mqtt(RED,node);
			lazurite(RED,node);
			setImmediate(init);
		}
	}
	node.deregister = function(n) {
		if(n) delete node.users[n.id];
	}
	node.on("close",(done) => {
		node.closing = true;
		for(let id in node.users) {
			delete node.users[id];
		}
		delete node.sensors;
		if(node.done.length > 0) {
			let promise = Promise.resolve();
			for(const func of node.done) {
				promise = promise.then(func);
			}
			promise.then(() => {
				node.connecting = false;
				node.connected = false;
				node.closing = false;
				RED.log.info('success of end process');
				done();
			}).catch((e) => {
				node.error((typeof e === "object") ? JSON.stringify(e,null,"  ") : e);
				done();
			});
		} else {
			done();
		}
	});

	function init() {
		new Promise((resolve,reject) => {
			node.auth = {
				lazurite: node.devices.lazurite.init()
			};
			resolve();
		}).then(httpRequestGatewayActivate)
			.then(() => {
				return new Promise((resolve,reject) => {
					try {
						node.devices.lazurite.setup(local.connect.options.lazurite);
						resolve();
					} catch(e) {
						console.log(e);
						reject(e);
					}
				});
			}).then(() => {
				return node.mqtt.auth(local)
			}).then(httpRequestGatewayDevices)
			.then(() => {
				node.connecting = false;
				node.connected = true;
				node.mqtt.subscribe("event/dbupdate",function(topic,message){
					node.log({
						topic:topic,
						message: JSON.stringify(message)
					});
					if(message.table === "devices") {
						httpRequestGatewayDevices();
					}
				});
				for(let id in node.users) {
					node.users[id].status({fill:"green",shape:"dot",text:"node-red:common.status.connected"});
					if(node.users[id].registered) {
						node.users[id].registered();
					}
				}
				node.log("完了しました(completed)!!");
			}).catch((err) => {
				node.connecting = false;
				node.connected = false;
				if(typeof err === "object") err = JSON.stringify(err,null,"  ");
				node.error(err);
				for(let id in node.users) {
					node.users[id].status({fill:"red",shape:"ring",text:"node-red:common.status.disconnected"});
				}
			});
	}
	function httpRequestGatewayActivate() {
		return new Promise((resolve,reject) => {
			node.log("認証情報を取得中です(getting credentials)......");
			for(let id in node.users) {
				node.users[id].status({fill:"yellow",shape:"ring",text:"node-red:common.status.connecting"});
			}
			const options = {
				hostname: 'api.lio-solution.com',
				port: 443,
				path: `/gateway/activate?authMethod=lazurite&deviceId=${node.auth.lazurite}`,
				headers: {
					'Content-Type': 'application/json',
					'access_key': node.config.access_key,
				},
				method: 'GET'
			};
			const req = https.request(options, (res) => {
				let Body = "";
				res.on('data', (d) => {
					Body += d;
				});
				res.on('end',() => {
					if(res.statusCode === 200) {
						let params = JSON.parse(Body);
						for(const key in params) {
							local[key] = params[key];
						}
						resolve();
					} else {
						reject({
							file: module.filename.split("/").pop(),
							path: options.path,
							statusCode: res.statusCode,
							statusMessage: res.statusMessage,
							body: Body
						});
					}
				});
			});
			req.on('error', (e) => {
				reject(e);
			});
			req.end();
		});
	}
	function httpRequestGatewayDevices() {
		return new Promise((resolve,reject) => {
			node.log("センサーデバイス情報を取得中です。(downloading sensor device list)......");
			const options = {
				hostname: 'api.lio-solution.com',
				port: 443,
				path: `/gateway/devices?authMethod=lazurite&deviceId=${node.auth.lazurite}`,
				headers: {
					'Content-Type': 'application/json',
					'access_key': node.config.access_key,
				},
				method: 'GET'
			};
			const req = https.request(options, (res) => {
				let Body = "";
				res.on('data', (d) => {
					Body += d;
				});
				res.on('end',() => {
					if(res.statusCode === 200) {
						if(!node.db) node.db = {};
						node.db.devices = JSON.parse(Body.toString());
						node.devices.lazurite.eack();
						resolve();
					} else {
						reject({
							file: module.filename.split("/").pop(),
							path: options.path,
							statusCode: res.statusCode,
							statusMessage: res.statusMessage,
							Body: Body
						});
					}
				});
			});
			req.on('error', (e) => {
				reject(e);
			});
			req.end();
		});
	}
}

