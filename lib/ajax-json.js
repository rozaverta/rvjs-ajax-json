// used by https://github.com/github/fetch

import Tools from "rvjs-tools";
import Es6Promise from "es6-promise";

// promise
if( typeof Promise === "undefined" )
{
	var Promise = Es6Promise.Promise
}

const self = Tools.isBrowser ? window : ( Tools.isNode ? global : (typeof this !== 'undefined' ? this : {}) );

const supportSearchParams = 'URLSearchParams' in self;
const supportArrayBuffer  = 'ArrayBuffer' in self;
const supportIterable = typeof Symbol === "function" && typeof Symbol.iterator === "symbol";
const supportBlob = 'FileReader' in self && 'Blob' in self && (() => {
	try {
		new Blob();
		return true
	} catch(e) {
		return false
	}
})();

const regIsName = /[^a-z0-9\-#$%&'*+.\^_`|~]/i;
const regHeaderSplit = /\r?\n/;

/**
 * @return {boolean}
 */
function Noop() {}

let isDataView = Noop, isArrayBufferView = Noop;

if (supportArrayBuffer) {
	const viewClasses = [
		'[object Int8Array]',
		'[object Uint8Array]',
		'[object Uint8ClampedArray]',
		'[object Int16Array]',
		'[object Uint16Array]',
		'[object Int32Array]',
		'[object Uint32Array]',
		'[object Float32Array]',
		'[object Float64Array]'
	];

	isDataView = obj => obj && DataView.prototype.isPrototypeOf(obj);
	isArrayBufferView = ArrayBuffer.isView || ( obj => obj && viewClasses.indexOf( Object.prototype.toString.call(obj) ) > -1 );
}

class AjaxJsonError extends Error
{
	constructor(message, name, code) {
		super(message);
		this.name = name;
		this.code = code;
	}
}

function makeQueryValue(name, value, isArray)
{
	if( value === null || value === undefined ) {
		value = ''
	}
	else if( typeof value === 'boolean' ) {
		value = value ? '1' : '0'
	}

	if( isArray ) {
		name += '[]'
	}
	else {
		name = encodeURIComponent(name);
		if( Array.isArray(value) ) {
			name = value.map(val => makeQueryValue(name, val, true)).join('&')
		}
		else if( value ) {
			name += '=' + encodeURIComponent(String(value))
		}
	}

	return name
}

// BLOB

function fileReaderReady(reader) {
	return new Promise((resolve, reject) => {
		reader.onload = function() {
			resolve(reader.result)
		};
		reader.onerror = function() {
			reject(reader.error)
		};
	})
}

function readBlobAsArrayBuffer(blob) {
	let reader = new FileReader();
	let promise = fileReaderReady(reader);
	reader.readAsArrayBuffer(blob);
	return promise
}

function readBlobAsText(blob) {
	let reader = new FileReader();
	let promise = fileReaderReady(reader);
	reader.readAsText(blob);
	return promise
}

// QUERY

function makeQuery( data )
{
	return Object.keys(data).map(name => makeQueryValue(name, data[name], false)).join('&');
}

function makeForm( data )
{
	let value;
	let form = new FormData();
	let json = [];

	Object.keys(data).forEach((name) => {

		value = data[name];
		if( value === null || value === undefined ) {
			value = ''
		}
		else if( typeof value === 'object' ) { // array too
			json.push(name);
			value = JSON.stringify(value);
		}
		else if( typeof value === 'boolean' ) {
			value = value ? '1' : '0'
		}
		else {
			value = String( value )
		}

		form.append(name, value)
	});

	if( json.length ) {
		form.append('__json', json)
	}

	return form;
}

function normalizeName(name) {
	if(typeof name !== 'string') {
		name = String(name)
	}
	if(regIsName.test(name)) {
		throw new AjaxJsonError('Invalid character in header field name', 'argument', 200)
	}
	return name.toLowerCase()
}

function normalizeValue(value) {
	if(typeof value === 'function' ) {
		value = value()
	}
	if(typeof value !== 'string') {
		value = String(value)
	}
	return value
}

// Build a destructive iterator for the value list
function iteratorFor(items) {
	let iterator = {
		next: function() {
			let value = items.shift();
			return { done: value === undefined, value: value }
		}
	};

	if(supportIterable) {
		iterator[Symbol.iterator] = function() {
			return iterator
		}
	}

	return iterator;
}

class Headers
{
	constructor(headers)
	{
		this.map = {};

		if (headers instanceof Headers) {
			headers.forEach(function(value, name) {
				this.append(name, value)
			}, this)

		}
		else if (headers) {
			Object.getOwnPropertyNames(headers).forEach(function(name) {
				this.append(name, headers[name])
			}, this)
		}
	}

	append(name, value) {
		name = normalizeName(name);
		value = normalizeValue(value);
		let oldValue = this.map[name];
		this.map[name] = oldValue ? oldValue + ',' + value : value
	}

	remove(name) {
		delete this.map[normalizeName(name)]
	}

	get(name) {
		name = normalizeName(name);
		return this.has(name) ? this.map[name] : null
	}

	has(name) {
		return this.map.hasOwnProperty(normalizeName(name))
	}

	set(name, value) {
		this.map[normalizeName(name)] = normalizeValue(value)
	}

	forEach(callback, thisArg) {
		for (let name in this.map) {
			if (this.map.hasOwnProperty(name)) {
				callback.call(thisArg, this.map[name], name, this)
			}
		}
	}

	keys() {
		let items = [];
		this.forEach(function(value, name) { items.push(name) });
		return iteratorFor(items)
	}

	values() {
		let items = [];
		this.forEach(function(value) { items.push(value) });
		return iteratorFor(items)
	}

	entries() {
		let items = [];
		this.forEach(function(value, name) { items.push([name, value]) });
		return iteratorFor(items)
	}
}

if( supportIterable ) {
	Headers.prototype[Symbol.iterator] = Headers.prototype.entries
}

function consumed(body) {
	if (body.bodyUsed) {
		return Promise.reject(new AjaxJsonError('Already read', 'argument', 201))
	}
	body.bodyUsed = true
}

function readArrayBufferAsText(buf) {
	let view = new Uint8Array(buf);
	let chars = new Array(view.length);

	for (let i = 0; i < view.length; i++) {
		chars[i] = String.fromCharCode(view[i])
	}
	return chars.join('')
}

function bufferClone(buf) {
	if (buf.slice) {
		return buf.slice(0)
	}
	else {
		let view = new Uint8Array(buf.byteLength);
		view.set(new Uint8Array(buf));
		return view.buffer
	}
}

function Body() {
	this.bodyUsed = false;

	this._initBody = function(body) {
		this._bodyInit = body;
		if (!body) {
			this._bodyText = ''
		} else if (typeof body === 'string') {
			this._bodyText = body
		} else if (supportBlob && Blob.prototype.isPrototypeOf(body)) {
			this._bodyBlob = body
		} else if (supportSearchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
			this._bodyText = body.toString()
		} else if (supportArrayBuffer && supportBlob && isDataView(body)) {
			this._bodyArrayBuffer = bufferClone(body.buffer);
			// IE 10-11 can't handle a DataView body.
			this._bodyInit = new Blob([this._bodyArrayBuffer])
		} else if (supportArrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body))) {
			this._bodyArrayBuffer = bufferClone(body)
		} else if(FormData.prototype.isPrototypeOf(body)) {
			this._bodyFormData = body
		} else {
			throw new Error('unsupported BodyInit type')
		}

		if (!this.headers.get('content-type')) {
			if (typeof body === 'string') {
				this.headers.set('content-type', 'text/plain;charset=UTF-8')
			} else if (this._bodyBlob && this._bodyBlob.type) {
				this.headers.set('content-type', this._bodyBlob.type)
			} else if (supportSearchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
				this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8')
			}
		}
	};

	if(supportBlob) {
		this.blob = function() {
			let rejected = consumed(this);
			if (rejected) {
				return rejected
			}

			if (this._bodyBlob) {
				return Promise.resolve(this._bodyBlob)
			} else if (this._bodyArrayBuffer) {
				return Promise.resolve(new Blob([this._bodyArrayBuffer]))
			} else if (this._bodyFormData) {
				throw new Error('could not read FormData body as blob')
			} else {
				return Promise.resolve(new Blob([this._bodyText]))
			}
		};

		this.arrayBuffer = function() {
			if (this._bodyArrayBuffer) {
				return consumed(this) || Promise.resolve(this._bodyArrayBuffer)
			} else {
				return this.blob().then(readBlobAsArrayBuffer)
			}
		}
	}

	this.text = function() {
		let rejected = consumed(this);
		if (rejected) {
			return rejected
		}

		if (this._bodyBlob) {
			return readBlobAsText(this._bodyBlob)
		} else if (this._bodyArrayBuffer) {
			return Promise.resolve(readArrayBufferAsText(this._bodyArrayBuffer))
		} else if (this._bodyFormData) {
			throw new Error('could not read FormData body as text')
		} else {
			return Promise.resolve(this._bodyText)
		}
	};

	this.json = function() {
		return this.text().then(JSON.parse)
	};

	return this
}

// HTTP methods whose capitalization should be normalized
const methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT'];

function normalizeMethod(method)
{
	let upcased = method.toUpperCase();
	return (methods.indexOf(upcased) > -1) ? upcased : method
}

function Request(input, options)
{
	options = options || {};
	let body = options.body;

	if (input instanceof Request) {
		if (input.bodyUsed) {
			throw new AjaxJsonError('Already read', 'argument', 201)
		}
		this.url = input.url;
		this.credentials = input.credentials;
		if (!options.headers) {
			this.headers = new Headers(input.headers)
		}
		this.method = input.method;
		this.mode = input.mode;
		if (!body && input._bodyInit !== null) {
			body = input._bodyInit;
			input.bodyUsed = true
		}
	} else {
		this.url = String(input)
	}

	this.credentials = options.credentials || this.credentials || 'omit';
	if (options.headers || !this.headers) {
		this.headers = new Headers(options.headers)
	}
	this.method = normalizeMethod(options.method || this.method || 'GET');
	this.mode = options.mode || this.mode || null;
	this.referrer = null;
	this.timeout = null;

	if (typeof input.timeout === "number" && input.timeout > 0) {
		this.timeout = input.timeout;
	}

	if( body ) {
		let object = typeof body === "object";
		if( object && this.method === 'GET' ) {
			this.url += (~this.url.indexOf('?') ? '&' : '?') + makeQuery(body);
			body = null
		}
		else if ( this.method === 'GET' || this.method === 'HEAD' ) {
			throw new AjaxJsonError('Body not allowed for GET or HEAD requests', 'argument', 200)
		}
		else if(this.method === 'POST' && object ) {
			body = makeForm(body)
		}
	}

	this._initBody(body)
}

Request.prototype.clone = function()
{
	return new Request(this, { body: this._bodyInit })
};

function parseHeaders(rawHeaders)
{
	let headers = new Headers();
	rawHeaders.split(regHeaderSplit).forEach(function(line) {
		let parts = line.split(':');
		let key = parts.shift().trim();
		if (key) {
			let value = parts.join(':').trim();
			headers.append(key, value)
		}
	});
	return headers
}

Body.call(Request.prototype);

function Response(bodyInit, options)
{
	if (!options) {
		options = {}
	}

	this.type = 'default';
	this.status = 'status' in options ? options.status : 200;
	this.ok = this.status >= 200 && this.status < 300;
	this.statusText = 'statusText' in options ? options.statusText : 'OK';
	this.headers = new Headers(options.headers);
	this.url = options.url || '';
	this._initBody(bodyInit)
}

Body.call(Response.prototype);

Response.prototype.clone = function()
{
	return new Response(this._bodyInit, {
		status: this.status,
		statusText: this.statusText,
		headers: new Headers(this.headers),
		url: this.url
	})
};

Response.error = function()
{
	let response = new Response(null, {status: 0, statusText: ''});
	response.type = 'error';
	return response
};

const redirectStatuses = [301, 302, 303, 307, 308];

Response.redirect = function(url, status)
{
	if (redirectStatuses.indexOf(status) === -1) {
		throw new RangeError('Invalid status code')
	}

	return new Response(null, {status: status, headers: {location: url}})
};

let queryStatus = 'complete';
let xhr;
let error;
let wait = [];
let progressBy = 1;

let TriggerOnUrl = url => String(url);
let TriggerOnJson = json => json;
let TriggerOnProgress = Noop;

function Waited()
{
	if( queryStatus !== 'progress' && wait.length )
	{
		let call = wait.shift();
		call()
	}
}

const AjaxJson =
	{
		set onUrl( trigger ) { if( typeof trigger === "function" ) TriggerOnUrl = trigger },
		set onJson( trigger ) { if( typeof trigger === "function" ) TriggerOnJson = trigger },
		set onProgress( trigger ) { if( typeof trigger === "function" ) TriggerOnProgress = trigger },

		get onUrl() { return TriggerOnUrl },
		get onJson() { return TriggerOnJson },
		get onProgress() { return TriggerOnProgress },

		abort()
		{
			if( queryStatus === 'progress' )
			{
				queryStatus = 'abort';
				xhr.abort();
				xhr = error = null;
			}
			return this
		},

		get completed()
		{
			return queryStatus !== 'progress'
		},

		get status()
		{
			return queryStatus
		},

		get progress()
		{
			return progressBy
		},

		query(input, init)
		{
			if( queryStatus === 'progress' )
			{
				let e = error || function (e) { throw e };
				this.abort();
				e( new AjaxJsonError('User aborted', 'abort', 3) )
			}

			let raw = typeof init === 'object' && init.raw === true;
			if( !raw ) {
				input = TriggerOnUrl(input);
			}

			let request = new Request(input, init);
			xhr = new XMLHttpRequest();
			queryStatus = 'open';

			return new Promise((_resolve, _reject) => {

				let reject = error => {
						if( queryStatus === 'progress' ) queryStatus = 'failure';
						progressBy = 1;
						setTimeout(Waited, 1);
						_reject(error)
					};

				let resolve = result => {
					queryStatus = 'success';
					progressBy = 1;
					setTimeout(Waited, 1);
					if( !raw )
						try {
							result = TriggerOnJson(result);
						}
						catch(err) {
							return _reject(err)
						}
					_resolve(result)
				};

				let progress = typeof init.progress === 'function' ? init.progress : false;

				xhr.onload = function()
				{
					let options = {
						status: xhr.status,
						statusText: xhr.statusText,
						headers: parseHeaders(xhr.getAllResponseHeaders() || '')
					};

					options.url = 'responseURL' in xhr ? xhr.responseURL : options.headers.get('X-Request-URL');
					let body = 'response' in xhr ? xhr.response : xhr.responseText;

					(new Response(body, options))
						.json()
						.then(resolve)
						.catch(() => {
							reject(new AjaxJsonError('Unknown server answer [invalid JSON]', 'json', 100))
						})
				};

				xhr.onerror = function() {
					reject(new AjaxJsonError('Network request failed', 'network', 1))
				};

				xhr.ontimeout = function() {
					reject(new AjaxJsonError('Network request failed', 'timeout', 2))
				};

				xhr.onprogress = e => {
					progressBy = e.total > 0 ? (e.loaded < e.total ? e.loaded / e.total : 1) : 0;
					TriggerOnProgress(e, progressBy);
					if(progress) {
						progress(e, progressBy)
					}
				};

				progressBy = 0;
				xhr.open(request.method, request.url, true);

				if (request.credentials === 'include') {
					xhr.withCredentials = true
				} else if (request.credentials === 'omit') {
					xhr.withCredentials = false
				}

				if ('responseType' in xhr && supportBlob) {
					xhr.responseType = 'blob'
				}

				if (request.timeout > 0) {
					xhr.timeout = request.timeout;
				}

				request.headers.forEach((value, name) => {
					xhr.setRequestHeader(name, value)
				});

				queryStatus = 'progress';
				error = reject;
				xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit)
			})
		},

		queryWait(input, init)
		{
			if( queryStatus === 'progress' )
			{
				return new Promise((resolve, reject) => {
					wait.push(() => {
						AjaxJson
							.query(input, init)
							.then(resolve, reject)
					});
				});
			}
			else
			{
				return AjaxJson.query(input, init)
			}
		}
	};

export default AjaxJson;
