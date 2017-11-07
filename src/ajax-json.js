"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; // used by https://github.com/github/fetch

var _rvjsTools = require("rvjs-tools");

var _rvjsTools2 = _interopRequireDefault(_rvjsTools);

var _rvjsEmitter = require("rvjs-emitter");

var _rvjsEmitter2 = _interopRequireDefault(_rvjsEmitter);

var _es6Promise = require("es6-promise");

var _es6Promise2 = _interopRequireDefault(_es6Promise);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

// promise
if (typeof Promise === "undefined") {
	var Promise = _es6Promise2.default.Promise;
}

var self = _rvjsTools2.default.isBrowser ? window : _rvjsTools2.default.isNode ? global : typeof undefined !== 'undefined' ? undefined : {};

var supportSearchParams = 'URLSearchParams' in self;
var supportArrayBuffer = 'ArrayBuffer' in self;
var supportIterable = typeof Symbol === "function" && _typeof(Symbol.iterator) === "symbol";
var supportBlob = 'FileReader' in self && 'Blob' in self && function () {
	try {
		new Blob();
		return true;
	} catch (e) {
		return false;
	}
}();

var regIsName = /[^a-z0-9\-#$%&'*+.\^_`|~]/i;
var regHeaderSplit = /\r?\n/;

/**
 * @return {boolean}
 */
function Noop() {}

var isDataView = Noop,
    isArrayBufferView = Noop;

if (supportArrayBuffer) {
	var viewClasses = ['[object Int8Array]', '[object Uint8Array]', '[object Uint8ClampedArray]', '[object Int16Array]', '[object Uint16Array]', '[object Int32Array]', '[object Uint32Array]', '[object Float32Array]', '[object Float64Array]'];

	isDataView = function isDataView(obj) {
		return obj && DataView.prototype.isPrototypeOf(obj);
	};
	isArrayBufferView = ArrayBuffer.isView || function (obj) {
		return obj && viewClasses.indexOf(Object.prototype.toString.call(obj)) > -1;
	};
}

var AjaxJsonError = function (_Error) {
	_inherits(AjaxJsonError, _Error);

	function AjaxJsonError(message, name, code) {
		_classCallCheck(this, AjaxJsonError);

		var _this = _possibleConstructorReturn(this, (AjaxJsonError.__proto__ || Object.getPrototypeOf(AjaxJsonError)).call(this, message));

		_this.name = name;
		_this.code = code;
		return _this;
	}

	return AjaxJsonError;
}(Error);

// FormData

function hasFormData(form) {
	return typeof FormData !== "undefined" && FormData.prototype.isPrototypeOf(form);
}

// BLOB

function fileReaderReady(reader) {
	return new Promise(function (resolve, reject) {
		reader.onload = function () {
			resolve(reader.result);
		};
		reader.onerror = function () {
			reject(reader.error);
		};
	});
}

function readBlobAsArrayBuffer(blob) {
	var reader = new FileReader();
	var promise = fileReaderReady(reader);
	reader.readAsArrayBuffer(blob);
	return promise;
}

function readBlobAsText(blob) {
	var reader = new FileReader();
	var promise = fileReaderReady(reader);
	reader.readAsText(blob);
	return promise;
}

// QUERY

function getEmitter(data) {
	if (data instanceof _rvjsEmitter2.default) {
		return data;
	} else {
		return new _rvjsEmitter2.default(data);
	}
}

function normalizeName(name) {
	if (typeof name !== 'string') {
		name = String(name);
	}
	if (regIsName.test(name)) {
		throw new AjaxJsonError('Invalid character in header field name', 'argument', 200);
	}
	return name.toLowerCase();
}

function normalizeValue(value) {
	if (typeof value === 'function') {
		value = value();
	}
	if (typeof value !== 'string') {
		value = String(value);
	}
	return value;
}

// Build a destructive iterator for the value list
function iteratorFor(items) {
	var iterator = {
		next: function next() {
			var value = items.shift();
			return { done: value === undefined, value: value };
		}
	};

	if (supportIterable) {
		iterator[Symbol.iterator] = function () {
			return iterator;
		};
	}

	return iterator;
}

var Headers = function () {
	function Headers(headers) {
		_classCallCheck(this, Headers);

		this.map = {};

		if (headers instanceof Headers) {
			headers.forEach(function (value, name) {
				this.append(name, value);
			}, this);
		} else if (headers) {
			Object.getOwnPropertyNames(headers).forEach(function (name) {
				this.append(name, headers[name]);
			}, this);
		}
	}

	_createClass(Headers, [{
		key: "append",
		value: function append(name, value) {
			name = normalizeName(name);
			value = normalizeValue(value);
			var oldValue = this.map[name];
			this.map[name] = oldValue ? oldValue + ',' + value : value;
		}
	}, {
		key: "remove",
		value: function remove(name) {
			delete this.map[normalizeName(name)];
		}
	}, {
		key: "get",
		value: function get(name) {
			name = normalizeName(name);
			return this.has(name) ? this.map[name] : null;
		}
	}, {
		key: "has",
		value: function has(name) {
			return this.map.hasOwnProperty(normalizeName(name));
		}
	}, {
		key: "set",
		value: function set(name, value) {
			this.map[normalizeName(name)] = normalizeValue(value);
		}
	}, {
		key: "forEach",
		value: function forEach(callback, thisArg) {
			for (var name in this.map) {
				if (this.map.hasOwnProperty(name)) {
					callback.call(thisArg, this.map[name], name, this);
				}
			}
		}
	}, {
		key: "keys",
		value: function keys() {
			var items = [];
			this.forEach(function (value, name) {
				items.push(name);
			});
			return iteratorFor(items);
		}
	}, {
		key: "values",
		value: function values() {
			var items = [];
			this.forEach(function (value) {
				items.push(value);
			});
			return iteratorFor(items);
		}
	}, {
		key: "entries",
		value: function entries() {
			var items = [];
			this.forEach(function (value, name) {
				items.push([name, value]);
			});
			return iteratorFor(items);
		}
	}]);

	return Headers;
}();

if (supportIterable) {
	Headers.prototype[Symbol.iterator] = Headers.prototype.entries;
}

function consumed(body) {
	if (body.bodyUsed) {
		return Promise.reject(new AjaxJsonError('Already read', 'argument', 201));
	}
	body.bodyUsed = true;
}

function readArrayBufferAsText(buf) {
	var view = new Uint8Array(buf);
	var chars = new Array(view.length);

	for (var i = 0; i < view.length; i++) {
		chars[i] = String.fromCharCode(view[i]);
	}
	return chars.join('');
}

function bufferClone(buf) {
	if (buf.slice) {
		return buf.slice(0);
	} else {
		var view = new Uint8Array(buf.byteLength);
		view.set(new Uint8Array(buf));
		return view.buffer;
	}
}

function Body() {
	this.bodyUsed = false;

	this._initBody = function (body) {
		this._bodyInit = body;
		if (!body) {
			this._bodyText = '';
		} else if (typeof body === 'string') {
			this._bodyText = body;
		} else if (supportBlob && Blob.prototype.isPrototypeOf(body)) {
			this._bodyBlob = body;
		} else if (supportSearchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
			this._bodyText = body.toString();
		} else if (supportArrayBuffer && supportBlob && isDataView(body)) {
			this._bodyArrayBuffer = bufferClone(body.buffer);
			// IE 10-11 can't handle a DataView body.
			this._bodyInit = new Blob([this._bodyArrayBuffer]);
		} else if (supportArrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body))) {
			this._bodyArrayBuffer = bufferClone(body);
		} else if (hasFormData(body)) {
			this._bodyFormData = body;
		} else {
			throw new Error('unsupported BodyInit type');
		}

		if (!this.headers.get('content-type')) {
			if (typeof body === 'string') {
				this.headers.set('content-type', 'text/plain;charset=UTF-8');
			} else if (this._bodyBlob && this._bodyBlob.type) {
				this.headers.set('content-type', this._bodyBlob.type);
			} else if (supportSearchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
				this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8');
			}
		}
	};

	if (supportBlob) {
		this.blob = function () {
			var rejected = consumed(this);
			if (rejected) {
				return rejected;
			}

			if (this._bodyBlob) {
				return Promise.resolve(this._bodyBlob);
			} else if (this._bodyArrayBuffer) {
				return Promise.resolve(new Blob([this._bodyArrayBuffer]));
			} else if (this._bodyFormData) {
				throw new Error('could not read FormData body as blob');
			} else {
				return Promise.resolve(new Blob([this._bodyText]));
			}
		};

		this.arrayBuffer = function () {
			if (this._bodyArrayBuffer) {
				return consumed(this) || Promise.resolve(this._bodyArrayBuffer);
			} else {
				return this.blob().then(readBlobAsArrayBuffer);
			}
		};
	}

	this.text = function () {
		var rejected = consumed(this);
		if (rejected) {
			return rejected;
		}

		if (this._bodyBlob) {
			return readBlobAsText(this._bodyBlob);
		} else if (this._bodyArrayBuffer) {
			return Promise.resolve(readArrayBufferAsText(this._bodyArrayBuffer));
		} else if (this._bodyFormData) {
			throw new Error('could not read FormData body as text');
		} else {
			return Promise.resolve(this._bodyText);
		}
	};

	this.json = function () {
		return this.text().then(JSON.parse);
	};

	return this;
}

// HTTP methods whose capitalization should be normalized
var methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT'];

function normalizeMethod(method) {
	var upcased = method.toUpperCase();
	return methods.indexOf(upcased) > -1 ? upcased : method;
}

function Request(input, options) {
	options = options || {};
	var body = options.body;

	if (input instanceof Request) {
		if (input.bodyUsed) {
			throw new AjaxJsonError('Already read', 'argument', 201);
		}
		this.url = input.url;
		this.credentials = input.credentials;
		if (!options.headers) {
			this.headers = new Headers(input.headers);
		}
		this.method = input.method;
		this.mode = input.mode;
		if (!body && input._bodyInit !== null) {
			body = input._bodyInit;
			input.bodyUsed = true;
		}
	} else {
		this.url = String(input);
	}

	this.credentials = options.credentials || this.credentials || 'omit';
	if (options.headers || !this.headers) {
		this.headers = new Headers(options.headers);
	}
	this.method = normalizeMethod(options.method || this.method || 'GET');
	this.mode = options.mode || this.mode || null;
	this.referrer = null;
	this.timeout = null;

	if (typeof input.timeout === "number" && input.timeout > 0) {
		this.timeout = input.timeout;
	}

	if (body) {
		var object = (typeof body === "undefined" ? "undefined" : _typeof(body)) === "object";

		if (object && this.method === 'GET') {
			this.url += (~this.url.indexOf('?') ? '&' : '?') + getEmitter(body).toQueryString();
			body = null;
		} else if (this.method === 'GET' || this.method === 'HEAD') {
			throw new AjaxJsonError('Body not allowed for GET or HEAD requests', 'argument', 200);
		} else if (this.method === 'POST' && object && !hasFormData(body)) {
			body = getEmitter(body).toFormData();
		}
	}

	this._initBody(body);
}

Request.prototype.clone = function () {
	return new Request(this, { body: this._bodyInit });
};

function parseHeaders(rawHeaders) {
	var headers = new Headers();
	rawHeaders.split(regHeaderSplit).forEach(function (line) {
		var parts = line.split(':');
		var key = parts.shift().trim();
		if (key) {
			var value = parts.join(':').trim();
			headers.append(key, value);
		}
	});
	return headers;
}

Body.call(Request.prototype);

function Response(bodyInit, options) {
	if (!options) {
		options = {};
	}

	this.type = 'default';
	this.status = 'status' in options ? options.status : 200;
	this.ok = this.status >= 200 && this.status < 300;
	this.statusText = 'statusText' in options ? options.statusText : 'OK';
	this.headers = new Headers(options.headers);
	this.url = options.url || '';
	this._initBody(bodyInit);
}

Body.call(Response.prototype);

Response.prototype.clone = function () {
	return new Response(this._bodyInit, {
		status: this.status,
		statusText: this.statusText,
		headers: new Headers(this.headers),
		url: this.url
	});
};

Response.error = function () {
	var response = new Response(null, { status: 0, statusText: '' });
	response.type = 'error';
	return response;
};

var redirectStatuses = [301, 302, 303, 307, 308];

Response.redirect = function (url, status) {
	if (redirectStatuses.indexOf(status) === -1) {
		throw new RangeError('Invalid status code');
	}

	return new Response(null, { status: status, headers: { location: url } });
};

var queryStatus = 'complete';
var xhr = void 0;
var error = void 0;
var wait = [];
var progressBy = 1;

var TriggerOnUrl = function TriggerOnUrl(url) {
	return String(url);
};
var TriggerOnJson = function TriggerOnJson(json) {
	return json;
};
var TriggerOnProgress = Noop;

function Waited() {
	if (queryStatus !== 'progress' && wait.length) {
		var call = wait.shift();
		call();
	}
}

var AjaxJson = {
	set onUrl(trigger) {
		if (typeof trigger === "function") TriggerOnUrl = trigger;
	},
	set onJson(trigger) {
		if (typeof trigger === "function") TriggerOnJson = trigger;
	},
	set onProgress(trigger) {
		if (typeof trigger === "function") TriggerOnProgress = trigger;
	},

	get onUrl() {
		return TriggerOnUrl;
	},
	get onJson() {
		return TriggerOnJson;
	},
	get onProgress() {
		return TriggerOnProgress;
	},

	abort: function abort() {
		if (queryStatus === 'progress') {
			queryStatus = 'abort';
			xhr.abort();
			xhr = error = null;
		}
		return this;
	},


	get completed() {
		return queryStatus !== 'progress';
	},

	get status() {
		return queryStatus;
	},

	get progress() {
		return progressBy;
	},

	query: function query(input) {
		var init = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

		if (queryStatus === 'progress') {
			var e = error || function (e) {
				throw e;
			};
			this.abort();
			e(new AjaxJsonError('User aborted', 'abort', 3));
		}

		// init property
		var tof = typeof init === "undefined" ? "undefined" : _typeof(init);

		if (tof === 'function') {
			init = init(input);
			tof = typeof init === "undefined" ? "undefined" : _typeof(init);
		}

		if (tof !== 'object') {
			init = {};
		}

		if ((typeof input === "undefined" ? "undefined" : _typeof(input)) === 'object') {
			Object.assign(init, input);
			input = init.url || "";
		}

		var raw = init.raw === true;
		if (!raw) {
			input = TriggerOnUrl(input);
		}

		var request = new Request(input, init);
		xhr = new XMLHttpRequest();
		queryStatus = 'open';

		return new Promise(function (_resolve, _reject) {

			var reject = function reject(error) {
				if (queryStatus === 'progress') queryStatus = 'failure';
				progressBy = 1;
				setTimeout(Waited, 1);
				_reject(error);
			};

			var resolve = function resolve(result) {
				queryStatus = 'success';
				progressBy = 1;
				setTimeout(Waited, 1);
				if (!raw) try {
					result = TriggerOnJson(result);
				} catch (err) {
					return _reject(err);
				}
				_resolve(result);
			};

			var progress = typeof init.progress === 'function' ? init.progress : false;

			xhr.onload = function () {
				var options = {
					status: xhr.status,
					statusText: xhr.statusText,
					headers: parseHeaders(xhr.getAllResponseHeaders() || '')
				};

				options.url = 'responseURL' in xhr ? xhr.responseURL : options.headers.get('X-Request-URL');
				var body = 'response' in xhr ? xhr.response : xhr.responseText;

				new Response(body, options).json().then(resolve).catch(function () {
					reject(new AjaxJsonError('Unknown server answer [invalid JSON]', 'json', 100));
				});
			};

			xhr.onerror = function () {
				reject(new AjaxJsonError('Network request failed', 'network', 1));
			};

			xhr.ontimeout = function () {
				reject(new AjaxJsonError('Network request failed', 'timeout', 2));
			};

			xhr.onprogress = function (e) {
				progressBy = e.total > 0 ? e.loaded < e.total ? e.loaded / e.total : 1 : 0;
				TriggerOnProgress(e, progressBy);
				if (progress) {
					progress(e, progressBy);
				}
			};

			progressBy = 0;
			xhr.open(request.method, request.url, true);

			if (request.credentials === 'include') {
				xhr.withCredentials = true;
			} else if (request.credentials === 'omit') {
				xhr.withCredentials = false;
			}

			if ('responseType' in xhr && supportBlob) {
				xhr.responseType = 'blob';
			}

			if (request.timeout > 0) {
				xhr.timeout = request.timeout;
			}

			request.headers.forEach(function (value, name) {
				xhr.setRequestHeader(name, value);
			});

			queryStatus = 'progress';
			error = reject;
			xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit);
		});
	},
	queryWait: function queryWait(input, init) {
		if (queryStatus === 'progress') {
			return new Promise(function (resolve, reject) {
				wait.push(function () {
					AjaxJson.query(input, init).then(resolve, reject);
				});
			});
		} else {
			return AjaxJson.query(input, init);
		}
	}
};

exports.default = AjaxJson;