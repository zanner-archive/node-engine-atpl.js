///<reference path='../imports.d.ts'/>

import ParserNode = module('./ParserNode');
import RuntimeUtils = module('../runtime/RuntimeUtils');
import SandboxPolicy = module('../SandboxPolicy');

export class TokenParserContextCommon {
	sandbox: bool = false;

	constructor(info: any = {}) {
		if (RuntimeUtils.isObject(info)) for (var key in info) this[key] = info[key];
	}

	serialize() {
		var ret = {};
		for (var key in this) ret[key] = this[key];
		return ret;
	}

	setSandbox(callback: () => void ) {
		this.sandbox = true;
		try {
			callback();
		} finally {
			this.sandbox = false;
		}
	}
}

export class TokenParserContext {
	private blocksOutput: any = {};
	private macrosOutput: any = {};

	constructor(public common: TokenParserContextCommon, public sandboxPolicy: SandboxPolicy.SandboxPolicy) {
	}

	iterateBlocks(callback: (node: ParserNode.ParserNode, name: string) => void) {
		for (var name in this.blocksOutput) callback(this.blocksOutput[name], name);
	}

	iterateMacros(callback: (node: ParserNode.ParserNode, name: string) => void ) {
		for (var name in this.macrosOutput) callback(this.macrosOutput[name], name);
	}

	setBlock(blockName, node: ParserNode.ParserNode) {
		return this.blocksOutput[blockName] = node;
	}

	setMacro(macroName, node: ParserNode.ParserNode) {
		return this.macrosOutput[macroName] = node;
	}
}
