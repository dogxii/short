/**
 * QR Code Generator
 * 轻量级纯 TypeScript QR 码生成器
 *
 * 基于 QR Code Model 2 标准
 * 支持 L, M, Q, H 四种纠错等级
 *
 * 作者: Dogxi
 * 项目: s.dogxi.me
 */

// 纠错等级
export type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";

// 纠错等级对应的容量（Version 1-10）
const CAPACITIES: Record<ErrorCorrectionLevel, number[]> = {
	L: [17, 32, 53, 78, 106, 134, 154, 192, 230, 271],
	M: [14, 26, 42, 62, 84, 106, 122, 152, 180, 213],
	Q: [11, 20, 32, 46, 60, 74, 86, 108, 130, 151],
	H: [7, 14, 24, 34, 44, 58, 64, 84, 98, 119],
};

// 纠错码字数
const EC_CODEWORDS: Record<ErrorCorrectionLevel, number[]> = {
	L: [7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
	M: [10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
	Q: [13, 22, 18, 26, 18, 24, 18, 22, 20, 24],
	H: [17, 28, 22, 16, 22, 28, 26, 26, 24, 28],
};

// 格式信息查找表
const FORMAT_INFO: Record<ErrorCorrectionLevel, number[]> = {
	L: [0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6976],
	M: [0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0],
	Q: [0x355f, 0x3068, 0x3f31, 0x3a06, 0x24b4, 0x2183, 0x2eda, 0x2bed],
	H: [0x1689, 0x13be, 0x1ce7, 0x19d0, 0x0762, 0x0255, 0x0d0c, 0x083b],
};

// GF(2^8) 指数表
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

// 初始化 Galois Field 查找表
(() => {
	let x = 1;
	for (let i = 0; i < 255; i++) {
		GF_EXP[i] = x;
		GF_LOG[x] = i;
		x = x << 1;
		if (x & 0x100) {
			x ^= 0x11d; // x^8 + x^4 + x^3 + x^2 + 1
		}
	}
	for (let i = 255; i < 512; i++) {
		GF_EXP[i] = GF_EXP[i - 255];
	}
})();

// GF 乘法
function gfMul(a: number, b: number): number {
	if (a === 0 || b === 0) return 0;
	return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

// 生成多项式
function getGeneratorPolynomial(degree: number): Uint8Array {
	let poly = new Uint8Array([1]);

	for (let i = 0; i < degree; i++) {
		const newPoly = new Uint8Array(poly.length + 1);
		const factor = GF_EXP[i];

		for (let j = 0; j < poly.length; j++) {
			newPoly[j] ^= poly[j];
			newPoly[j + 1] ^= gfMul(poly[j], factor);
		}
		poly = newPoly;
	}

	return poly;
}

// 计算纠错码
function calculateEC(data: Uint8Array, ecLength: number): Uint8Array {
	const generator = getGeneratorPolynomial(ecLength);
	const result = new Uint8Array(data.length + ecLength);
	result.set(data);

	for (let i = 0; i < data.length; i++) {
		const coef = result[i];
		if (coef !== 0) {
			for (let j = 0; j < generator.length; j++) {
				result[i + j] ^= gfMul(generator[j], coef);
			}
		}
	}

	return result.slice(data.length);
}

// 获取最小版本
function getMinVersion(
	data: string,
	ecLevel: ErrorCorrectionLevel,
): number | null {
	const byteLength = new TextEncoder().encode(data).length;
	const capacities = CAPACITIES[ecLevel];

	for (let v = 0; v < capacities.length; v++) {
		// 减去模式指示符和字符计数指示符的开销
		const overhead = v < 9 ? 2 : 3;
		if (byteLength <= capacities[v] - overhead) {
			return v + 1;
		}
	}
	return null;
}

// 创建数据码字
function createDataCodewords(
	data: string,
	version: number,
	ecLevel: ErrorCorrectionLevel,
): Uint8Array {
	const bytes = new TextEncoder().encode(data);
	const capacity = CAPACITIES[ecLevel][version - 1];
	const ecCodewords = EC_CODEWORDS[ecLevel][version - 1];
	const totalCodewords = getModuleCount(version) * getModuleCount(version);

	// 计算数据码字数
	const dataCodewordsCount =
		Math.floor((totalCodewords - 31 - (version > 1 ? 25 : 0)) / 8) -
		ecCodewords;

	const result: number[] = [];

	// 模式指示符 (0100 = 字节模式)
	result.push(0x40 | (bytes.length >> 4));
	result.push(((bytes.length & 0x0f) << 4) | (bytes[0] >> 4));

	// 数据
	for (let i = 0; i < bytes.length - 1; i++) {
		result.push(((bytes[i] & 0x0f) << 4) | (bytes[i + 1] >> 4));
	}
	result.push((bytes[bytes.length - 1] & 0x0f) << 4);

	// 终止符和填充
	while (result.length < dataCodewordsCount) {
		result.push(result.length % 2 === 0 ? 0xec : 0x11);
	}

	return new Uint8Array(result.slice(0, dataCodewordsCount));
}

// 获取模块数量
function getModuleCount(version: number): number {
	return 17 + version * 4;
}

// 创建 QR 矩阵
function createMatrix(version: number): boolean[][] {
	const size = getModuleCount(version);
	const matrix: boolean[][] = [];

	for (let i = 0; i < size; i++) {
		matrix.push(new Array(size).fill(false));
	}

	return matrix;
}

// 绘制定位图案
function drawFinderPattern(
	matrix: boolean[][],
	row: number,
	col: number,
): void {
	for (let r = -1; r <= 7; r++) {
		for (let c = -1; c <= 7; c++) {
			const pr = row + r;
			const pc = col + c;

			if (pr < 0 || pc < 0 || pr >= matrix.length || pc >= matrix.length) {
				continue;
			}

			if (
				(r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
				(c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
				(r >= 2 && r <= 4 && c >= 2 && c <= 4)
			) {
				matrix[pr][pc] = true;
			}
		}
	}
}

// 绘制定时图案
function drawTimingPatterns(matrix: boolean[][]): void {
	const size = matrix.length;
	for (let i = 8; i < size - 8; i++) {
		const isBlack = i % 2 === 0;
		matrix[6][i] = isBlack;
		matrix[i][6] = isBlack;
	}
}

// 绘制格式信息
function drawFormatInfo(
	matrix: boolean[][],
	ecLevel: ErrorCorrectionLevel,
	maskPattern: number,
): void {
	const size = matrix.length;
	const formatBits = FORMAT_INFO[ecLevel][maskPattern];

	// 左上角
	for (let i = 0; i <= 5; i++) {
		matrix[8][i] = ((formatBits >> (14 - i)) & 1) === 1;
	}
	matrix[8][7] = ((formatBits >> 8) & 1) === 1;
	matrix[8][8] = ((formatBits >> 7) & 1) === 1;
	matrix[7][8] = ((formatBits >> 6) & 1) === 1;
	for (let i = 0; i <= 5; i++) {
		matrix[5 - i][8] = ((formatBits >> i) & 1) === 1;
	}

	// 右上角和左下角
	for (let i = 0; i <= 7; i++) {
		matrix[size - 1 - i][8] = ((formatBits >> i) & 1) === 1;
	}
	for (let i = 0; i <= 7; i++) {
		matrix[8][size - 8 + i] = ((formatBits >> (14 - i)) & 1) === 1;
	}

	// 暗模块
	matrix[size - 8][8] = true;
}

// 掩码函数
const MASK_FUNCTIONS = [
	(r: number, c: number) => (r + c) % 2 === 0,
	(r: number, _c: number) => r % 2 === 0,
	(_r: number, c: number) => c % 3 === 0,
	(r: number, c: number) => (r + c) % 3 === 0,
	(r: number, c: number) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
	(r: number, c: number) => ((r * c) % 2) + ((r * c) % 3) === 0,
	(r: number, c: number) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
	(r: number, c: number) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

// 检查是否是功能模块
function isFunctionModule(row: number, col: number, size: number): boolean {
	// 定位图案
	if (
		(row < 9 && col < 9) ||
		(row < 9 && col >= size - 8) ||
		(row >= size - 8 && col < 9)
	) {
		return true;
	}
	// 定时图案
	if (row === 6 || col === 6) {
		return true;
	}
	return false;
}

// 放置数据
function placeData(
	matrix: boolean[][],
	data: Uint8Array,
	ec: Uint8Array,
	maskPattern: number,
): void {
	const size = matrix.length;
	const allData = new Uint8Array(data.length + ec.length);
	allData.set(data);
	allData.set(ec, data.length);

	let bitIndex = 0;
	const maskFn = MASK_FUNCTIONS[maskPattern];

	// 从右下角开始，向上再向下交替
	let upward = true;
	let col = size - 1;

	while (col > 0) {
		if (col === 6) col--; // 跳过定时图案列

		for (let i = 0; i < size; i++) {
			const row = upward ? size - 1 - i : i;

			for (let j = 0; j < 2; j++) {
				const c = col - j;

				if (!isFunctionModule(row, c, size)) {
					if (bitIndex < allData.length * 8) {
						const byteIndex = Math.floor(bitIndex / 8);
						const bitOffset = 7 - (bitIndex % 8);
						const bit = ((allData[byteIndex] >> bitOffset) & 1) === 1;
						matrix[row][c] = bit !== maskFn(row, c);
						bitIndex++;
					}
				}
			}
		}

		col -= 2;
		upward = !upward;
	}
}

/**
 * 生成 QR 码数据
 */
export function generateQRCode(
	data: string,
	ecLevel: ErrorCorrectionLevel = "M",
): boolean[][] | null {
	if (!data) return null;

	const version = getMinVersion(data, ecLevel);
	if (version === null || version > 10) {
		// 只支持 Version 1-10
		return null;
	}

	const size = getModuleCount(version);
	const matrix = createMatrix(version);

	// 绘制功能图案
	drawFinderPattern(matrix, 0, 0);
	drawFinderPattern(matrix, 0, size - 7);
	drawFinderPattern(matrix, size - 7, 0);
	drawTimingPatterns(matrix);

	// 创建数据
	const dataCodewords = createDataCodewords(data, version, ecLevel);
	const ecCodewords = calculateEC(
		dataCodewords,
		EC_CODEWORDS[ecLevel][version - 1],
	);

	// 选择最佳掩码 (简化：使用掩码 0)
	const maskPattern = 0;

	// 绘制格式信息
	drawFormatInfo(matrix, ecLevel, maskPattern);

	// 放置数据
	placeData(matrix, dataCodewords, ecCodewords, maskPattern);

	return matrix;
}

/**
 * 将 QR 矩阵转换为 SVG
 */
export function qrToSvg(
	matrix: boolean[][],
	options: {
		size?: number;
		margin?: number;
		darkColor?: string;
		lightColor?: string;
	} = {},
): string {
	const {
		size = 256,
		margin = 4,
		darkColor = "#000000",
		lightColor = "#ffffff",
	} = options;

	const moduleCount = matrix.length;
	const cellSize = size / (moduleCount + margin * 2);
	const qrSize = size;

	let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${qrSize} ${qrSize}" width="${qrSize}" height="${qrSize}">`;
	svg += `<rect width="100%" height="100%" fill="${lightColor}"/>`;

	for (let row = 0; row < moduleCount; row++) {
		for (let col = 0; col < moduleCount; col++) {
			if (matrix[row][col]) {
				const x = (col + margin) * cellSize;
				const y = (row + margin) * cellSize;
				svg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${darkColor}"/>`;
			}
		}
	}

	svg += "</svg>";
	return svg;
}

/**
 * 将 QR 矩阵转换为 Data URL
 */
export function qrToDataUrl(
	matrix: boolean[][],
	options: {
		size?: number;
		margin?: number;
		darkColor?: string;
		lightColor?: string;
	} = {},
): string {
	const svg = qrToSvg(matrix, options);
	return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * 直接生成 QR 码 SVG
 */
export function generateQRCodeSvg(
	data: string,
	options: {
		ecLevel?: ErrorCorrectionLevel;
		size?: number;
		margin?: number;
		darkColor?: string;
		lightColor?: string;
	} = {},
): string | null {
	const { ecLevel = "M", ...svgOptions } = options;
	const matrix = generateQRCode(data, ecLevel);
	if (!matrix) return null;
	return qrToSvg(matrix, svgOptions);
}

/**
 * 直接生成 QR 码 Data URL
 */
export function generateQRCodeDataUrl(
	data: string,
	options: {
		ecLevel?: ErrorCorrectionLevel;
		size?: number;
		margin?: number;
		darkColor?: string;
		lightColor?: string;
	} = {},
): string | null {
	const { ecLevel = "M", ...svgOptions } = options;
	const matrix = generateQRCode(data, ecLevel);
	if (!matrix) return null;
	return qrToDataUrl(matrix, svgOptions);
}

export default {
	generateQRCode,
	qrToSvg,
	qrToDataUrl,
	generateQRCodeSvg,
	generateQRCodeDataUrl,
};
