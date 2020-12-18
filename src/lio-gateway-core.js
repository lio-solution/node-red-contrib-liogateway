'use strict'
/*
 *  Copyright (C) 2020 Lapis Semiconductor Co., Ltd.
 *  file: lazurite-iot-core.js
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

let local = {};
module.exports = function(RED,node){
	const fs = require("fs");
	const os = require("os");
	const https = require("https");
	const util = require("util");
	const mqtt = require("./mqtt");
	const lazurite = require("./lazurite");
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
			Promise.all(node.done.map((p) => {
				return p();
			})).then(() => {
				node.connecting = false;
				node.connected = false;
				node.closing = false;
				done();
			}).catch((e) => {
				console.log(e);
				RED.log.warn((typeof e === "object") ? JSON.stringify(e,null,"  ") : e);
			});
		} else {
			done();
		}
	});

	function init() {
		getApiKeyAndDeviceInfo()
			.then(httpRequestGatewayConnect)
			.then(() => {
				return Promise.all([
					node.mqtt.auth(local.Keys),
					httpRequestGatewayMachine()
				]);
			}).then(() => {
				return new Promise((resolve,reject) => {
					let rf = local.Keys.config.rf.find((elm) => elm.type === "lazurite");
					if(rf) {
						node.devices.lazurite.setup(rf);
						resolve();
					} else {
						reject("can not find lazurite config");
					}
				});
			}).then(() => {
				node.connecting = false;
				node.connected = true;
				node.mqtt.subscribe("dbupdate",function(topic,message){
					if(message.type === "machine") {
						updateDatabase();
					}
				});
				for(let id in node.users) {
					node.users[id].status({fill:"green",shape:"dot",text:"node-red:common.status.connected"});
				}
				console.log("完了しました(completed)!!");
			}).catch((err) => {
				console.log(err);
				node.connecting = false;
				node.connected = false;
				if(typeof err === "object") err = JSON.stringify(err,null,"  ");
				RED.log.warn(err);
				for(let id in node.users) {
					node.users[id].status({fill:"red",shape:"ring",text:"node-red:common.status.disconnected"});
				}
			});
	}

	function getApiKeyAndDeviceInfo() {
		return new Promise((resolve,reject) => {
			console.log("デバイス情報を取得中です(collecting device information)......");
			if(fs.existsSync(node.config.keyPath) === false) {
				reject(`keyPath is not found`);
				return;
			}
			try {
				let Body = fs.readFileSync(node.config.keyPath,'utf-8');
				var key = JSON.parse(Body);
				if(!key.apiKey) {
					reject("invalid key");
					return;
				}
			} catch(e) {
				console.log(e);
				reject(`invalid key. ${JSON.stringify(e)}`);
				return;
			}
			const ni = os.networkInterfaces()["wwan0"];
			const subghz = node.devices.lazurite.init();

			local.auth = {
				apiKey : key.apiKey
			}
			if(ni) {
				local.auth.soracom = ni;
			}
			if(subghz) {
				local.auth.subghz = subghz.substr(-16);
			}
			resolve();
		});
	}
	function httpRequestGatewayConnect() {
		return new Promise((resolve,reject) => {
			console.log("認証情報を取得中です(getting credentials)......");
			for(let id in node.users) {
				node.users[id].status({fill:"yellow",shape:"ring",text:"node-red:common.status.connecting"});
			}
			const options = {
				hostname: 'test2.lazurite.io',
				port: 443,
				path: '/v2/gateway/connect',
				headers: {
					'Content-Type': 'application/json',
				},
				method: 'POST'
			};
			const req = https.request(options, (res) => {
				let Body = "";
				res.on('data', (d) => {
					Body += d;
				});
				res.on('end',() => {
					if(res.statusCode === 200) {
						local.Keys = JSON.parse(Body).Item;
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
			req.write(JSON.stringify({Item:local.auth}));
			req.on('error', (e) => {
				reject(e);
			});
			req.end();
		});
	}
	function httpRequestGatewayMachine() {
		return new Promise((resolve,reject) => {
			console.log("センサーデバイス情報を取得中です。(downloading sensor device list)......");
			const options = {
				hostname: 'test2.lazurite.io',
				port: 443,
				path: '/v2/gateway/machine',
				headers: {
					'Content-Type': 'application/json',
				},
				method: 'POST'
			};
			const req = https.request(options, (res) => {
				let Body = "";
				res.on('data', (d) => {
					Body += d;
				});
				res.on('end',() => {
					if(res.statusCode === 200) {
						node.db = JSON.parse(Body.toString()).Items;
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
			req.write(JSON.stringify({Item:local.auth}));
			req.on('error', (e) => {
				console.log(e);
				reject(e);
			});
			req.end();
		});
	}
	function updateDatabase() {
		return new Promise((resolve,reject) => {
			console.log("センサーデバイス情報のデータベースが更新されました(update sensor device list)......");
			const options = {
				hostname: 'test2.lazurite.io',
				port: 443,
				path: '/v2/gateway/machine',
				headers: {
					"lazurite-api-key": node.config.key,
					"lazurite-api-token": node.config.token,
					'Content-Type': 'application/json',
				},
				method: 'GET'
			};
			const req = https.request(options, (res) => {
				let body = "";
				res.on('data', (d) => {
					body += d;
				});
				res.on('end',() => {
					let machine = body.toString();
					node.sensors = JSON.parse(machine.toString()).Items;
					resolve();
				});
			});
			req.on('error', (e) => {
				reject(e);
			});
			req.end();
		}).then((values) => {
			let device = Object.keys(node.device);
			for(let d of device) {
				node.device[d].update();
			}
		});
	}
	function remapMachine() {
	}
}

