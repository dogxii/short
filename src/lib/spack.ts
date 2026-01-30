/**
 * SPack - Short Pack Encoding v2
 * 一个为 URL 传输优化的轻量级文本编码库
 *
 * 特性:
 * - LZ77 压缩算法
 * - Base64URL 编码 (URL 安全)
 * - CRC8 校验
 * - AES-GCM 加密 (可选)
 * - TTL 过期时间 (可选)
 * - 自动检测最优编码方式
 *
 * 作者: Dogxi
 * 项目: s.dogxi.me
 */

// Base64URL 字符集 (64 字符, URL 安全)
import LZString from "lz-string";

const BASE64URL_CHARS =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

// 解码映射表
const BASE64URL_DECODE: Record<string, number> = {};
for (let i = 0; i < BASE64URL_CHARS.length; i++) {
	BASE64URL_DECODE[BASE64URL_CHARS[i]] = i;
}

// CRC8 查找表
const CRC8_TABLE = new Uint8Array(256);
(() => {
	const poly = 0x07;
	for (let i = 0; i < 256; i++) {
		let crc = i;
		for (let j = 0; j < 8; j++) {
			crc = crc & 0x80 ? (crc << 1) ^ poly : crc << 1;
		}
		CRC8_TABLE[i] = crc & 0xff;
	}
})();

// 版本号
const VERSION = 3;

// Flags
const FLAG_COMPRESSED = 0x01;
const FLAG_HAS_TTL = 0x02;
const FLAG_ENCRYPTED = 0x04;

// 常量
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const TIMESTAMP_LENGTH = 4;
const TTL_LENGTH = 4;

/**
 * 计算 CRC8 校验和
 */
function crc8(data: Uint8Array): number {
	let crc = 0;
	for (let i = 0; i < data.length; i++) {
		crc = CRC8_TABLE[(crc ^ data[i]) & 0xff];
	}
	return crc;
}

/**
 * 字符串转 UTF-8 字节数组
 */
function stringToBytes(str: string): Uint8Array {
	return new TextEncoder().encode(str);
}

/**
 * UTF-8 字节数组转字符串
 */
function bytesToString(bytes: Uint8Array): string {
	return new TextDecoder().decode(bytes);
}

/**
 * Base64URL 编码
 */
function base64UrlEncode(data: Uint8Array): string {
	let result = "";
	const len = data.length;

	for (let i = 0; i < len; i += 3) {
		const b0 = data[i];
		const b1 = i + 1 < len ? data[i + 1] : 0;
		const b2 = i + 2 < len ? data[i + 2] : 0;

		result += BASE64URL_CHARS[(b0 >> 2) & 0x3f];
		result += BASE64URL_CHARS[((b0 << 4) | (b1 >> 4)) & 0x3f];

		if (i + 1 < len) {
			result += BASE64URL_CHARS[((b1 << 2) | (b2 >> 6)) & 0x3f];
		}
		if (i + 2 < len) {
			result += BASE64URL_CHARS[b2 & 0x3f];
		}
	}

	return result;
}

/**
 * Base64URL 解码
 */
function base64UrlDecode(str: string): Uint8Array {
	const len = str.length;
	let outputLen = Math.floor((len * 3) / 4);
	if (len > 0) {
		const remainder = len % 4;
		if (remainder === 2) outputLen = Math.floor((len * 3) / 4);
		else if (remainder === 3) outputLen = Math.floor((len * 3) / 4);
	}

	const result = new Uint8Array(outputLen);
	let resultIndex = 0;

	for (let i = 0; i < len; i += 4) {
		const c0 = BASE64URL_DECODE[str[i]] || 0;
		const c1 = BASE64URL_DECODE[str[i + 1]] || 0;
		const c2 = i + 2 < len ? BASE64URL_DECODE[str[i + 2]] || 0 : 0;
		const c3 = i + 3 < len ? BASE64URL_DECODE[str[i + 3]] || 0 : 0;

		if (resultIndex < outputLen) {
			result[resultIndex++] = (c0 << 2) | (c1 >> 4);
		}
		if (resultIndex < outputLen && i + 2 < len) {
			result[resultIndex++] = ((c1 << 4) | (c2 >> 2)) & 0xff;
		}
		if (resultIndex < outputLen && i + 3 < len) {
			result[resultIndex++] = ((c2 << 6) | c3) & 0xff;
		}
	}

	return result;
}

/**
 * LZ77 压缩
 */
function lzCompress(data: Uint8Array): Uint8Array {
	const windowSize = 255;
	const maxLength = 15;
	const minMatch = 3;

	const output: number[] = [];
	let i = 0;

	while (i < data.length) {
		let bestOffset = 0;
		let bestLength = 0;

		const windowStart = Math.max(0, i - windowSize);
		for (let j = windowStart; j < i; j++) {
			let length = 0;
			while (
				length < maxLength &&
				i + length < data.length &&
				data[j + length] === data[i + length]
			) {
				length++;
			}

			if (length >= minMatch && length > bestLength) {
				bestOffset = i - j;
				bestLength = length;
			}
		}

		if (bestLength >= minMatch) {
			output.push(0xff);
			output.push(bestOffset);
			output.push(bestLength);
			i += bestLength;
		} else {
			if (data[i] === 0xff) {
				output.push(0xff);
				output.push(0);
				output.push(1);
				i++;
			} else {
				output.push(data[i]);
				i++;
			}
		}
	}

	return new Uint8Array(output);
}

/**
 * LZ77 解压
 */
function lzDecompress(data: Uint8Array): Uint8Array {
	const output: number[] = [];
	let i = 0;

	while (i < data.length) {
		if (data[i] === 0xff && i + 2 < data.length) {
			const offset = data[i + 1];
			const length = data[i + 2];

			if (offset === 0 && length === 1) {
				output.push(0xff);
			} else {
				const start = output.length - offset;
				for (let j = 0; j < length; j++) {
					output.push(output[start + j]);
				}
			}
			i += 3;
		} else {
			output.push(data[i]);
			i++;
		}
	}

	return new Uint8Array(output);
}

/**
 * 生成随机字节
 */
function getRandomBytes(length: number): Uint8Array {
	const bytes = new Uint8Array(length);
	crypto.getRandomValues(bytes);
	return bytes;
}

/**
 * 从密码派生密钥 (PBKDF2)
 */
async function deriveKey(
	password: string,
	salt: Uint8Array,
): Promise<CryptoKey> {
	const encoder = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		encoder.encode(password),
		"PBKDF2",
		false,
		["deriveKey"],
	);

	return crypto.subtle.deriveKey(
		{
			name: "PBKDF2",
			salt: salt.buffer as ArrayBuffer,
			iterations: 100000,
			hash: "SHA-256",
		},
		keyMaterial,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"],
	);
}

/**
 * AES-GCM 加密
 */
async function encryptData(
	data: Uint8Array,
	password: string,
): Promise<{ encrypted: Uint8Array; salt: Uint8Array; iv: Uint8Array }> {
	const salt = getRandomBytes(SALT_LENGTH);
	const iv = getRandomBytes(IV_LENGTH);
	const key = await deriveKey(password, salt);

	const encrypted = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
		key,
		data.buffer as ArrayBuffer,
	);

	return {
		encrypted: new Uint8Array(encrypted),
		salt,
		iv,
	};
}

/**
 * AES-GCM 解密
 */
async function decryptData(
	encrypted: Uint8Array,
	password: string,
	salt: Uint8Array,
	iv: Uint8Array,
): Promise<Uint8Array> {
	const key = await deriveKey(password, salt);

	const decrypted = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
		key,
		encrypted.buffer as ArrayBuffer,
	);

	return new Uint8Array(decrypted);
}

/**
 * 写入 32 位无符号整数 (大端序)
 */
function writeUint32(value: number): Uint8Array {
	const bytes = new Uint8Array(4);
	bytes[0] = (value >> 24) & 0xff;
	bytes[1] = (value >> 16) & 0xff;
	bytes[2] = (value >> 8) & 0xff;
	bytes[3] = value & 0xff;
	return bytes;
}

/**
 * 读取 32 位无符号整数 (大端序)
 */
function readUint32(bytes: Uint8Array, offset: number): number {
	return (
		(bytes[offset] << 24) |
		(bytes[offset + 1] << 16) |
		(bytes[offset + 2] << 8) |
		bytes[offset + 3]
	);
}

/**
 * SPack 编码错误
 */
export class SPackError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SPackError";
	}
}

/**
 * 编码选项
 */
export interface EncodeOptions {
	/** 密码（可选，启用加密） */
	password?: string;
	/** TTL 秒数（可选，0 或不设置表示永不过期） */
	ttlSeconds?: number;
}

/**
 * 解码选项
 */
export interface DecodeOptions {
	/** 密码（如果加密了需要提供） */
	password?: string;
	/** 是否检查 TTL（默认 true） */
	checkTtl?: boolean;
}

/**
 * TTL 信息
 */
export interface TtlInfo {
	createdAt: number;
	ttlSeconds: number;
	expiresAt: number | null;
	remainingSeconds: number;
	isExpired: boolean;
}

/**
 * 编码信息
 */
export interface EncodeInfo {
	originalLength: number;
	encodedLength: number;
	compressionRatio: number;
	isCompressed: boolean;
	isEncrypted: boolean;
	hasTtl: boolean;
	ttlInfo?: TtlInfo;
}

/**
 * SPack 编码 (同步版，不支持加密)
 *
 * 格式 v2: [version:1][flags:1][crc8:1][timestamp?:4][ttl?:4][salt?:16][iv?:12][payload...]
 *
 * @param input - 要编码的字符串
 * @param options - 编码选项
 * @returns Base64URL 编码的字符串
 */
export function encode(input: string, options: EncodeOptions = {}): string {
	if (!input) return "";

	if (options.password) {
		throw new SPackError("同步编码不支持加密，请使用 encodeAsync");
	}

	const bytes = stringToBytes(input);
	const checksum = crc8(bytes);

	// 尝试压缩
	const compressed = LZString.compressToUint8Array(input);

	// 选择更短的版本
	let flags = 0;
	let payload: Uint8Array;

	if (compressed.length < bytes.length) {
		flags |= FLAG_COMPRESSED;
		payload = compressed;
	} else {
		payload = bytes;
	}

	// 计算结果大小
	const hasTtl = options.ttlSeconds !== undefined && options.ttlSeconds > 0;
	if (hasTtl) {
		flags |= FLAG_HAS_TTL;
	}

	const headerSize = 3 + (hasTtl ? TIMESTAMP_LENGTH + TTL_LENGTH : 0);
	const result = new Uint8Array(headerSize + payload.length);

	let offset = 0;

	// 写入头部
	result[offset++] = VERSION;
	result[offset++] = flags;
	result[offset++] = checksum;

	// 写入 TTL 信息
	if (hasTtl) {
		const timestamp = Math.floor(Date.now() / 1000);
		const timestampBytes = writeUint32(timestamp);
		const ttlBytes = writeUint32(options.ttlSeconds!);
		result.set(timestampBytes, offset);
		offset += TIMESTAMP_LENGTH;
		result.set(ttlBytes, offset);
		offset += TTL_LENGTH;
	}

	// 写入 payload
	result.set(payload, offset);

	return base64UrlEncode(result);
}

/**
 * SPack 异步编码 (支持加密)
 */
export async function encodeAsync(
	input: string,
	options: EncodeOptions = {},
): Promise<string> {
	if (!input) return "";

	const bytes = stringToBytes(input);
	const checksum = crc8(bytes);

	// 尝试压缩
	const compressed = LZString.compressToUint8Array(input);

	// 选择更短的版本
	let flags = 0;
	let payload: Uint8Array;

	if (compressed.length < bytes.length) {
		flags |= FLAG_COMPRESSED;
		payload = compressed;
	} else {
		payload = bytes;
	}

	// TTL
	const hasTtl = options.ttlSeconds !== undefined && options.ttlSeconds > 0;
	if (hasTtl) {
		flags |= FLAG_HAS_TTL;
	}

	// 加密
	let salt: Uint8Array | null = null;
	let iv: Uint8Array | null = null;

	if (options.password) {
		flags |= FLAG_ENCRYPTED;
		const encryptResult = await encryptData(payload, options.password);
		payload = encryptResult.encrypted;
		salt = encryptResult.salt;
		iv = encryptResult.iv;
	}

	// 计算结果大小
	const headerSize =
		3 +
		(hasTtl ? TIMESTAMP_LENGTH + TTL_LENGTH : 0) +
		(options.password ? SALT_LENGTH + IV_LENGTH : 0);
	const result = new Uint8Array(headerSize + payload.length);

	let offset = 0;

	// 写入头部
	result[offset++] = VERSION;
	result[offset++] = flags;
	result[offset++] = checksum;

	// 写入 TTL 信息
	if (hasTtl) {
		const timestamp = Math.floor(Date.now() / 1000);
		const timestampBytes = writeUint32(timestamp);
		const ttlBytes = writeUint32(options.ttlSeconds!);
		result.set(timestampBytes, offset);
		offset += TIMESTAMP_LENGTH;
		result.set(ttlBytes, offset);
		offset += TTL_LENGTH;
	}

	// 写入加密信息
	if (salt && iv) {
		result.set(salt, offset);
		offset += SALT_LENGTH;
		result.set(iv, offset);
		offset += IV_LENGTH;
	}

	// 写入 payload
	result.set(payload, offset);

	return base64UrlEncode(result);
}

/**
 * SPack 解码 (同步版，不支持加密内容)
 */
export function decode(encoded: string, options: DecodeOptions = {}): string {
	if (!encoded) return "";

	const data = base64UrlDecode(encoded);

	if (data.length < 3) {
		throw new SPackError("数据太短");
	}

	let offset = 0;
	const version = data[offset++];

	// 兼容 v1
	if (version === 0 || version === 1) {
		// v1 格式: [flags:1][crc8:1][payload...]
		offset = 0;
		const flags = data[offset++];
		const expectedChecksum = data[offset++];
		const payload = data.slice(offset);

		let originalData: Uint8Array;
		if (flags & FLAG_COMPRESSED) {
			originalData = lzDecompress(payload);
		} else {
			originalData = payload;
		}

		const actualChecksum = crc8(originalData);
		if (expectedChecksum !== actualChecksum) {
			throw new SPackError("校验和不匹配");
		}

		return bytesToString(originalData);
	}

	// v2 格式
	if (version !== VERSION && version !== 2) {
		throw new SPackError(`不支持的版本: ${version}`);
	}

	const flags = data[offset++];
	const expectedChecksum = data[offset++];

	// 读取 TTL
	let createdAt: number | null = null;
	let ttlSeconds: number | null = null;

	if (flags & FLAG_HAS_TTL) {
		if (data.length < offset + TIMESTAMP_LENGTH + TTL_LENGTH) {
			throw new SPackError("TTL 数据不完整");
		}
		createdAt = readUint32(data, offset);
		offset += TIMESTAMP_LENGTH;
		ttlSeconds = readUint32(data, offset);
		offset += TTL_LENGTH;

		// 检查是否过期
		if (options.checkTtl !== false && ttlSeconds > 0) {
			const now = Math.floor(Date.now() / 1000);
			const expiresAt = createdAt + ttlSeconds;
			if (now > expiresAt) {
				throw new SPackError("内容已过期");
			}
		}
	}

	// 检查是否加密
	if (flags & FLAG_ENCRYPTED) {
		throw new SPackError("内容已加密，请使用 decodeAsync 并提供密码");
	}

	const payload = data.slice(offset);

	// 解压
	let originalData: Uint8Array;
	if (flags & FLAG_COMPRESSED) {
		if (version === 2) {
			originalData = lzDecompress(payload);
		} else {
			const decompressed = LZString.decompressFromUint8Array(payload);
			if (decompressed === null) throw new SPackError("解压失败");
			originalData = stringToBytes(decompressed);
		}
	} else {
		originalData = payload;
	}

	// 验证校验和
	const actualChecksum = crc8(originalData);
	if (expectedChecksum !== actualChecksum) {
		throw new SPackError("校验和不匹配，数据可能已损坏");
	}

	return bytesToString(originalData);
}

/**
 * SPack 异步解码 (支持加密内容)
 */
export async function decodeAsync(
	encoded: string,
	options: DecodeOptions = {},
): Promise<string> {
	if (!encoded) return "";

	const data = base64UrlDecode(encoded);

	if (data.length < 3) {
		throw new SPackError("数据太短");
	}

	let offset = 0;
	const version = data[offset++];

	// 兼容 v1
	if (version === 0 || version === 1) {
		return decode(encoded, options);
	}

	// v2 格式
	if (version !== VERSION && version !== 2) {
		throw new SPackError(`不支持的版本: ${version}`);
	}

	const flags = data[offset++];
	const expectedChecksum = data[offset++];

	// 读取 TTL
	let createdAt: number | null = null;
	let ttlSeconds: number | null = null;

	if (flags & FLAG_HAS_TTL) {
		if (data.length < offset + TIMESTAMP_LENGTH + TTL_LENGTH) {
			throw new SPackError("TTL 数据不完整");
		}
		createdAt = readUint32(data, offset);
		offset += TIMESTAMP_LENGTH;
		ttlSeconds = readUint32(data, offset);
		offset += TTL_LENGTH;

		// 检查是否过期
		if (options.checkTtl !== false && ttlSeconds > 0) {
			const now = Math.floor(Date.now() / 1000);
			const expiresAt = createdAt + ttlSeconds;
			if (now > expiresAt) {
				throw new SPackError("内容已过期");
			}
		}
	}

	// 读取加密信息
	let salt: Uint8Array | null = null;
	let iv: Uint8Array | null = null;

	if (flags & FLAG_ENCRYPTED) {
		if (data.length < offset + SALT_LENGTH + IV_LENGTH) {
			throw new SPackError("加密数据不完整");
		}
		salt = data.slice(offset, offset + SALT_LENGTH);
		offset += SALT_LENGTH;
		iv = data.slice(offset, offset + IV_LENGTH);
		offset += IV_LENGTH;
	}

	let payload: Uint8Array = data.slice(offset);

	// 解密
	if (flags & FLAG_ENCRYPTED) {
		if (!options.password) {
			throw new SPackError("内容已加密，请提供密码");
		}
		try {
			payload = await decryptData(payload, options.password, salt!, iv!);
		} catch {
			throw new SPackError("密码错误或数据已损坏");
		}
	}

	// 解压
	let originalData: Uint8Array;
	if (flags & FLAG_COMPRESSED) {
		if (version === 2) {
			originalData = lzDecompress(payload);
		} else {
			const decompressed = LZString.decompressFromUint8Array(payload);
			if (decompressed === null) throw new SPackError("解压失败");
			originalData = stringToBytes(decompressed);
		}
	} else {
		originalData = payload;
	}

	// 验证校验和
	const actualChecksum = crc8(originalData);
	if (expectedChecksum !== actualChecksum) {
		throw new SPackError("校验和不匹配，数据可能已损坏");
	}

	return bytesToString(originalData);
}

/**
 * 检查字符串是否是有效的 SPack 编码
 */
export function isValid(encoded: string): boolean {
	if (!encoded) return false;

	// 检查是否只包含 Base64URL 字符
	for (const char of encoded) {
		if (BASE64URL_DECODE[char] === undefined) {
			return false;
		}
	}

	try {
		const data = base64UrlDecode(encoded);
		return data.length >= 3;
	} catch {
		return false;
	}
}

/**
 * 检查是否需要密码
 */
export function isEncrypted(encoded: string): boolean {
	if (!encoded) return false;

	try {
		const data = base64UrlDecode(encoded);
		if (data.length < 3) return false;

		const version = data[0];
		if (version === VERSION) {
			const flags = data[1];
			return (flags & FLAG_ENCRYPTED) !== 0;
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * 检查是否有 TTL
 */
export function hasTtl(encoded: string): boolean {
	if (!encoded) return false;

	try {
		const data = base64UrlDecode(encoded);
		if (data.length < 3) return false;

		const version = data[0];
		if (version === VERSION) {
			const flags = data[1];
			return (flags & FLAG_HAS_TTL) !== 0;
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * 获取 TTL 信息
 */
export function getTtlInfo(encoded: string): TtlInfo | null {
	if (!encoded) return null;

	try {
		const data = base64UrlDecode(encoded);
		if (data.length < 3) return null;

		const version = data[0];
		if (version !== VERSION && version !== 2) return null;

		const flags = data[1];
		if ((flags & FLAG_HAS_TTL) === 0) return null;

		let offset = 3;
		if (data.length < offset + TIMESTAMP_LENGTH + TTL_LENGTH) return null;

		const createdAt = readUint32(data, offset);
		offset += TIMESTAMP_LENGTH;
		const ttlSeconds = readUint32(data, offset);

		const now = Math.floor(Date.now() / 1000);
		const expiresAt = ttlSeconds > 0 ? createdAt + ttlSeconds : null;
		const remainingSeconds =
			expiresAt !== null ? Math.max(0, expiresAt - now) : Infinity;
		const isExpired = expiresAt !== null && now > expiresAt;

		return {
			createdAt,
			ttlSeconds,
			expiresAt,
			remainingSeconds: remainingSeconds === Infinity ? -1 : remainingSeconds,
			isExpired,
		};
	} catch {
		return null;
	}
}

/**
 * 获取编码信息
 */
export function getInfo(encoded: string): EncodeInfo | null {
	if (!encoded) return null;

	try {
		const data = base64UrlDecode(encoded);
		if (data.length < 3) return null;

		const version = data[0];

		// v1 兼容
		if (version === 0 || version === 1) {
			const flags = data[0];
			const decoded = decode(encoded, { checkTtl: false });
			return {
				originalLength: decoded.length,
				encodedLength: encoded.length,
				compressionRatio: decoded.length / encoded.length,
				isCompressed: (flags & FLAG_COMPRESSED) !== 0,
				isEncrypted: false,
				hasTtl: false,
			};
		}

		if (version !== VERSION && version !== 2) return null;

		const flags = data[1];
		const hasEncryption = (flags & FLAG_ENCRYPTED) !== 0;
		const hasTtlFlag = (flags & FLAG_HAS_TTL) !== 0;

		let ttlInfo: TtlInfo | undefined;
		if (hasTtlFlag) {
			ttlInfo = getTtlInfo(encoded) || undefined;
		}

		// 如果没有加密，尝试解码获取原始长度
		let originalLength = 0;
		if (!hasEncryption) {
			try {
				const decoded = decode(encoded, { checkTtl: false });
				originalLength = decoded.length;
			} catch {
				// 忽略错误
			}
		}

		return {
			originalLength,
			encodedLength: encoded.length,
			compressionRatio:
				originalLength > 0 ? originalLength / encoded.length : 0,
			isCompressed: (flags & FLAG_COMPRESSED) !== 0,
			isEncrypted: hasEncryption,
			hasTtl: hasTtlFlag,
			ttlInfo,
		};
	} catch {
		return null;
	}
}

/**
 * 估算可以编码的最大字符数
 */
export function estimateMaxChars(urlLimit: number = 2000): number {
	// Base64 膨胀约 4/3，加上元数据
	// 压缩率假设约 0.7
	return Math.floor(urlLimit * 0.75 * 0.7);
}

/**
 * 格式化剩余时间
 */
export function formatRemainingTime(seconds: number): string {
	if (seconds < 0) return "永不过期";
	if (seconds === 0) return "已过期";
	if (seconds < 60) return `${seconds} 秒`;
	if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟`;
	if (seconds < 86400) {
		const hours = Math.floor(seconds / 3600);
		const mins = Math.floor((seconds % 3600) / 60);
		return mins > 0 ? `${hours} 小时 ${mins} 分钟` : `${hours} 小时`;
	}
	const days = Math.floor(seconds / 86400);
	const hours = Math.floor((seconds % 86400) / 3600);
	return hours > 0 ? `${days} 天 ${hours} 小时` : `${days} 天`;
}

// 导出默认对象
export default {
	encode,
	encodeAsync,
	decode,
	decodeAsync,
	isValid,
	isEncrypted,
	hasTtl,
	getTtlInfo,
	getInfo,
	estimateMaxChars,
	formatRemainingTime,
	SPackError,
};
