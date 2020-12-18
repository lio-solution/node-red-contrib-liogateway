module.exports = function(RED,node) {
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
	let lib;
	let eack = [];
	let local = {};
	let emitter = new events.EventEmitter();

	node.devices.lazurite.init = function () {
		lib = new LAZURITE();
		lib.init();
		local.addr64 = lib.getMyAddr64();
		return local.addr64;
	}

	node.devices.lazurite.setup = function(conf) {
		if(isNaN(conf.myAddress) === false) {
			local.addr16 = conf.myAddress;
			lib.setMyAddress(parseInt(local.addr16));
		}
		local.ch = isNaN(conf.ch) ? 36 : parseInt(conf.ch);
		local.panid = isNaN(conf.panid) ? parseInt(Math.random() * 65533) : parseInt(conf.panid);
		local.baud = isNaN(conf.baud) ? 100 : parseInt(conf.baud);
		local.pwr = isNaN(conf.pwr) ? 20 : parseInt(conf.pwr);
		lib.begin(local);
		lib.rxEnable();
		for(let d of node.db) {
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
		eack.push({
			addr: 0xffff,
			data:[cmd.DISCONNECT,5,0]
		});
		lib.setEnhanceAck(eack);
		lib.on("rx",rxCallback);
		node.done.push(done);
	}
	node.devices.lazurite.on = function(type,callback) {
		emitter.on(type,callback);
	}

	function rxCallback(msg) {
		let payload = msg.payload.split(",");
		if(payload[0] === 'factory-iot') {
			let retMsg = {};
			src0 = ('0000'+msg.src_addr.toString(16)).substr(-16);
			src1 = parseInt(msg.src_addr%65536n);
			let db = node.db.filter((elm) => {
				let addr = elm.addr.split("_");
				if(isNaN(addr) === true) {
					return addr === src0;
				} else {
					return parseInt(addr) === src1;
				}
			});
			if(db) {
				retMsg.payload = `activate,${local.panid},${local.addr16},${db[0].id},${db[0].thres0},${db[0].detect0},${db[0].thres1},${db[0].detect1}`;
				retMsg.dst_addr = msg.src_addr;
				let e = eack.find((elm) => {
					return elm.addr === db[0].id;
				});
				if(e) {
					if(db[0].debug === true) {
						e.data = [cmd.FORCE_SEND,measInterval & 0x00FF, (measInterval >> 8) & 0x00FF];
					} else if(db[0].lowFreq === true) {
						e.data = [cmd.FORCE_SEND,keepAlive & 0x00FF, (keepAlive >> 8) & 0x00FF];
					} else {
						e.data = [cmd.NORMAL,db[0].interval & 0x00FF, (db[0].interval >> 8) & 0x00FF];
					}
				}
				lib.setEnhanceAck(eack);
				lib.send64(retMsg);
			}
		} else if(msg.dst_panid === local.panid){
			let db = node.db.find((elm) => elm.id === msg.src_addr);
			if(db) {
				msg.db = db;
			}
			if(payload[0] === "update"){
				let newMsg = {
					panid: local.panid,
					dst_addr: msg.src_addr,
					payload : `activate,${local.panid},${local.addr16},${db[0].id},${db[0].thres0},${db[0].detect0},${db[0].thres1},${db[0].detect1}`,
				};
				lib.send(newMsg);
			} else {
				emitter.emit('rx',msg);
			}
		}
	}

	function done() {
		return new Promise((resolve,reject) => {
			lib.rxDisable();
			lib.close();
			lib.remove();
			resolve();
		});
	}
}
