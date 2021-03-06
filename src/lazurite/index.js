module.exports = function(RED,node) {
	const util = require("util");
	const LAZURITE = require("lazurite");
	const events = require("events");
	const cmd = {
		NORMAL: 0,
		FORCE_SEND: 1,
		UPDATE: 2,
		DISCONNECT: 3,
		FIRMWARE_UPDATE: 0xF0
	}
	const keepAlive = 30*60;
	const measInterval = 5;

	if(node.devices.lazurite === undefined) {
		node.devices.lazurite = {};
	}
	let lib;							// node lazurite
	let local = {
		isOpen:false,
	};
	let eack;
	let emitter = new events.EventEmitter();

	node.devices.lazurite.init = function () {
		lib = new LAZURITE();
		lib.init();
		local.addr64 = lib.getMyAddr64();
		node.done.push(LazuriteDone);
		return local.addr64.replace(/^0x/,"");
	}

	node.devices.lazurite.setup = function(conf) {
		if(local.isOpen === true) {
			lib.close();
		}
		local.addr16 = parseInt(conf.addr16);
		if(isNaN(local.addr16)) {
			local.addr16 = 0xFFFD;
		}
		lib.setMyAddress(local.addr16);
		local.ch = isNaN(conf.ch) ? 36 : parseInt(conf.ch);
		local.panid = isNaN(conf.panid) ? parseInt(Math.random() * 65533) : parseInt(conf.panid);
		local.baud = isNaN(conf.baud) ? 100 : parseInt(conf.baud);
		local.pwr = isNaN(conf.pwr) ? 20 : parseInt(conf.pwr);
		lib.begin(local);
		lib.on("rx",rxCallback);
		local.isOpen = true;
	}

	node.devices.lazurite.on = function(type,callback) {
		emitter.on(type,callback);
	}

	node.devices.lazurite.eack = function() {
		lib.rxDisable();
		eack = [];
		for(let d of node.db.devices) {
			if(d.authMethod === 'lazurite') {
				if(d.debug === true) {
					eack.push({
						addr: parseInt(d.id),
						data: [cmd.FORCE_SEND,measInterval & 0x00FF, (measInterval >> 8) & 0x00FF]
					});
				} else if(d.lowFreq === true) {
					eack.push({
						addr: parseInt(d.id),
						data: [cmd.FORCE_SEND,keepAlive & 0x00FF, (keepAlive >> 8) & 0x00FF]
					});
				} else {
					eack.push({
						addr: parseInt(d.id),
						data: [cmd.UPDATE,d.interval & 0x00FF, (d.interval >> 8) & 0x00FF]
					});
				}
			}
		}
		eack.push({
			addr: 0xffff,
			data:[cmd.DISCONNECT,5,0]
		});
		lib.setEnhanceAck(eack);
		lib.rxEnable();
	}
	node.devices.lazurite.close = function() {
		lib.rxDisable();
		lib.close();
		local.isOpen = false;
	}

	function rxCallback(msg) {
		try {
			if(!node.db.devices) return;
		} catch(e) {
			return;
		}
		let payload = msg.payload.split(",");
		if(payload[0] === 'factory-iot') {
			let retMsg = {};
			let src0,src1;
			src0 = ('0000'+msg.src_addr.toString(16)).substr(-16);
			try {
				src1 = (msg.src_addr%65536n);
			} catch(e) {
				RED.log.error(e);
				return;
			}
			let db = node.db.devices.find((elm) => {
				return ((elm.authMethod === 'lazurite') && (src0.toLowerCase() === elm.deviceId.toLowerCase()));
			});
			if(db) {
				retMsg.payload = `activate,${local.panid},${local.addr16},${db.id},${db.thres0},${db.detect0},${db.thres1},${db.detect1}`;
				retMsg.dst_addr = msg.src_addr;
				let e = eack.find((elm) => {
					return elm.addr === db.id;
				});
				if(e) {
					if(db.debug === true) {
						e.data = [cmd.FORCE_SEND,measInterval & 0x00FF, (measInterval >> 8) & 0x00FF];
					} else if(db.lowFreq === true) {
						e.data = [cmd.FORCE_SEND,keepAlive & 0x00FF, (keepAlive >> 8) & 0x00FF];
					} else {
						e.data = [cmd.NORMAL,db.interval & 0x00FF, (db.interval >> 8) & 0x00FF];
					}
				}
				lib.setEnhanceAck(eack);
				let ret = lib.send64(retMsg);
			} else {
				console.log(util.inspect({
					rxCallback:msg
				},{colors:true,depth:null}))
			}
		} else if(msg.dst_panid === local.panid){
			let db = node.db.devices.find((elm) => elm.id === msg.src_addr);
			if(db) {
				msg.devices = db;
			}
			if(payload[0] === "update"){
				let newMsg = {
					panid: local.panid,
					dst_addr: msg.src_addr,
					payload : `activate,${local.panid},${local.addr16},${db.id},${db.thres0},${db.detect0},${db.thres1},${db.detect1}`,
				};
				let e = eack.find((elm) => {
					return elm.addr === msg.src_addr;
				});
				if(e) {
					if(db.debug === true) {
						e.data = [cmd.FORCE_SEND,measInterval & 0x00FF, (measInterval >> 8) & 0x00FF];
					} else if(db.lowFreq === true) {
						e.data = [cmd.FORCE_SEND,keepAlive & 0x00FF, (keepAlive >> 8) & 0x00FF];
					} else {
						e.data = [cmd.NORMAL,db.interval & 0x00FF, (db.interval >> 8) & 0x00FF];
					}
				}
				lib.setEnhanceAck(eack);
				lib.send(newMsg);
			} else {
				if(msg.devices.application === "other") {
					emitter.emit('rx',msg);
				} else {
					let payload = msg.payload.split(",");
					let pub = {
						topic: `data/${msg.devices.application}/log/${msg.src_addr}`,
						payload: {
							timestamp: msg.rxtime,
							state: payload[0],
							value: Number(payload[1]),
							vbat: Number(payload[2]),
							rssi: msg.rssi,
						},
						options: {
							qos: 1
						}
					}
					if(payload[0] === 'off') {
						if(payload[3] !== undefined) {
							pub.payload.reasonId = parseInt(payload[3]);
						}
					}
					node.mqtt.publish(pub,(a,b,c) => {
					});
				}
			}
		}
	}
	function LazuriteDone() {
		return new Promise((resolve,reject) => {
			local.isOpen = false;
			lib.rxDisable();
			lib.close();
			lib.remove();
			RED.log.info('removing lazdriver');
			resolve();
		});
	}
}
