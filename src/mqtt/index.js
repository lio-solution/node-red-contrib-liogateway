module.exports = function(RED,node) {
	node.mqtt = {};
	let auth;
	let client;
	let baseTopic;
	const mqtt = require('mqtt');
	node.mqtt.auth = function(v) {
		return new Promise((resolve,reject) => {
			try {
				const ca = Buffer.from(v["RootCA"]);
				const cert = Buffer.from(v["CertificatePem"]);
				const key = Buffer.from(v["PrivateKey"]);
				baseTopic = v.connect.topic;
				const options = {
					clientId: `${v.connect.id}_nodered`,
					ca: ca,
					cert: cert,
					key: key,
				};
				node.mqtt.connecting = true;
				node.mqtt.connected = false;
				client = mqtt.connect(v.connect.broker,options);
				client.on('connect', function () {
					node.mqtt.connecting = false;
					node.mqtt.connected = true;
					resolve();
				});
				client.on('reconnect',mqttOnReconnect);
				client.on('disconnect', mqttOnDisconnect);
				client.on('message', mqttOnMessage);
				client.on('error', mqttOnError);
				client.on('close', mqttOnClose);
				node.done.push(MqttDone);
			} catch(e) {
				RED.log.error(e);
				reject('authorization error');
			}
		});
	};
	node.mqtt.init = function() {
		return new Promise((resolve,reject) => {
			resolve();
		});
	};
	node.mqtt.publish = function(msg,callback) {
		let message = (typeof msg.payload === "object") ? JSON.stringify(msg.payload) : msg.payload;
		client.publish(`${baseTopic}/${msg.topic}`,message,msg.options,callback);
	};
	node.mqtt.subscribe = function(topic,callback) {
		client.subscribe(`${baseTopic}/${topic}`,{qos: 1},function (err) {
			if(err) {
				RED.log.error(err);
			} else {
				RED.log.info(`subscribe: ${baseTopic}/${topic}`);
			}
		});
		node.mqtt.listener.push({
			topic : topic,
			callback: callback
		});
	};
	node.mqtt.listener = [];
	node.mqtt.reconnect = function() {
		for(let lis of node.mqtt.listener) {
		client.subscribe(`${baseTopic}/${lis.topic}`,{qos: 1},function (err) {
			if(err) {
				RED.log.error(err);
			} else {
				RED.log.info(`subscribe: ${baseTopic}/${lis.topic}`);
			}
		});
		}
	}
	node.mqtt.close = function() {
		return new Promise((resolve,reject) => {
			client.on('end', () => {
				node.mqtt.connecting = false;
				node.mqtt.connected = false;
				resolve();
			});
			if (node.mqtt.connected) {
				// Send close message
				if (node.mqtt.closeMessage) {
					node.mqtt.publish(node.mqtt.closeMessage);
				}
				client.end();
			} else if (node.mqtt.connecting) {
				client.end();
			} else {
				resolve();
			}
		});
	}
	function MqttDone() {
		return new Promise((resolve,reject) => {
			client.on('end', () => {
				node.mqtt.connecting = false;
				node.mqtt.connected = false;
				for(const id in node.mqtt.listeners) {
					node.mqtt.listeners[id].status({fill:"red",shape:"ring",text:"node-red:common.status.disconnected"});
				}
				resolve();
			});
			if (node.mqtt.connected) {
				// Send close message
				if (node.mqtt.closeMessage) {
					node.mqtt.publish(node.mqtt.closeMessage);
				}
				client.end();
			} else if (node.mqtt.connecting) {
				client.end();
			} else {
				resolve();
			}
		});
	};
	function mqttOnReconnect() {
		node.mqtt.connecting = true;
		node.mqtt.connected = false;
	}
	function mqttOnDisconnect(packet) {
		RED.log.info(packet)
		node.mqtt.connected = false;
		node.mqtt.connecting = false;
	}
	function mqttOnError(e) {
		RED.log.info('mqtt.error');
		RED.log.info(e);
	}
	function mqttOnMessage(topic,message) {
		// message is Buffer
		let msg;
		try {
			msg = JSON.parse(message);
		} catch(e) {
			msg = message;
		}
		let t = topic.split("/");
		t.splice(0,2);
		t = t.join("/");
		for(let l of node.mqtt.listener) {
			if(matchTopic(l.topic,t) === true) {
				l.callback(t,msg);
			}
		}
	}
	function mqttOnClose() {
		node.mqtt.connecting = false;
		node.mqtt.connected = false;
	}
}

function matchTopic(ts,t) {
	if (ts == "#") {
		return true;
	}
	/* The following allows shared subscriptions (as in MQTT v5)
					 http://docs.oasis-open.org/mqtt/mqtt/v5.0/cs02/mqtt-v5.0-cs02.html#_Toc514345522

					 4.8.2 describes shares like:
					 $share/{ShareName}/{filter}
					 $share is a literal string that marks the Topic Filter as being a Shared Subscription Topic Filter.
					 {ShareName} is a character string that does not include "/", "+" or "#"
					 {filter} The remainder of the string has the same syntax and semantics as a Topic Filter in a non-shared subscription. Refer to section 4.7.
					 */
	else if(ts.startsWith("$share")){
		ts = ts.replace(/^\$share\/[^#+/]+\/(.*)/g,"$1");

	}
	var re = new RegExp("^"+ts.replace(/([\[\]\?\(\)\\\\$\^\*\.|])/g,"\\$1").replace(/\+/g,"[^/]+").replace(/\/#$/,"(\/.*)?")+"$");
			return re.test(t);
		}
