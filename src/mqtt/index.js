module.exports = function(RED,node) {
	node.mqtt = {};
	let auth;
	let client;
	let baseTopic;
	const mqtt = require('mqtt');
	node.mqtt.auth = function(v) {
		return new Promise((resolve,reject) => {
			try {
				const ca = Buffer.from(v["root-ca.pem"]);
				const cert = Buffer.from(v["cert.pem"]);
				const key = Buffer.from(v["private.key"]);
				const options = {
					clientId: `${v.config.name}_nodered`,
					ca: ca,
					cert: cert,
					key: key,
				};
				baseTopic = v.config.topic;
				node.mqtt.connecting = true;
				node.mqtt.connected = false;
				client = mqtt.connect(v.config.broker,options);
				client.on('connect', function () {
					node.mqtt.connecting = false;
					node.mqtt.connected = true;
					const topic = `${v.config.topic}/event/#`;
					client.subscribe(topic,{qos: 1},function (err) {
						if(err) {
							console.log(err);
							try {
								RED.log.warn(JSON.stringify(err,null,"  "));
							} catch(e) {
								RED.log.warn(err);
							}
						}
					});
					node.done.push(node.mqtt.done);
					resolve();
				});
				client.on('reconnect', function () {
					console.log(`mqtt.reconnect`);
					node.mqtt.connecting = false;
					node.mqtt.connected = true;
				});
				client.on('disconnect', function (packet) {
					console.log(`mqtt.disconnect`);
					node.mqtt.connected = false;
					node.mqtt.connecting = false;
				});
				client.on('message', function (topic, message) {
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
						if(matchTopic(t,l.topic) === true) {
							l.callback(t,msg);
						}
					}
				})
				client.on('error', function (error) {
					console.log(`mqtt.error`);
					console.log(error);
				});
				client.on('close', function () {
					console.log("mqtt.close");
					node.mqtt.connecting = true;
					node.mqtt.connected = false;
				});
				client.on('end', () => {
					node.mqtt.connecting = false;
					node.mqtt.connected = false;
					for(const id in node.mqtt.listeners) {
						node.mqtt.listeners[id].status({fill:"red",shape:"ring",text:"node-red:common.status.disconnected"});
					}
				});
			} catch(e) {
				console.log(e);
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
		if(baseTopic) {
			let message = (typeof msg.payload === "object") ? JSON.stringify(msg.payload) : msg.payload;
			client.publish(`${baseTopic}/${msg.topic}`,message,msg.options,callback);
		} else {
			callback("undefined base topic");
		}
	};
	node.mqtt.subscribe = function(topic,callback) {
		node.mqtt.listener.push({
			topic : topic,
			callback: callback
		});
	};
	node.mqtt.listener = [];
	node.mqtt.done  = function () {
		return new Promise((resolve,reject) => {
			if (node.mqtt.connected) {
				// Send close message
				if (node.mqtt.closeMessage) {
					node.mqtt.publish(node.mqtt.closeMessage);
				}
				client.once('close', function() {
					resolve();
				});
				client.end();
				resolve();
			} else if (node.mqtt.connecting) {
				client.end();
				resolve();
			} else {
				resolve();
			}
		});
	};
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
