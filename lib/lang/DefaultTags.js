var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var ExpressionParser = require('../parser/ExpressionParser');
var ParserNode = require('../parser/ParserNode');
var TemplateParser = require('../parser/TemplateParser');
function checkNoMoreTokens(expressionTokenReader) {
    //console.log(expressionTokenReader);
    //console.log(expressionTokenReader.hasMore());
    if (expressionTokenReader.hasMore()) {
        //console.log(expressionTokenReader);
        throw (new Error("Unexpected token '" + JSON.stringify(expressionTokenReader.peek()) + "'"));
    }
    return expressionTokenReader;
}
function _flowexception(blockType, templateParser, tokenParserContext, templateTokenReader, expressionTokenReader) {
    throw (new TemplateParser.FlowException(blockType, templateParser, tokenParserContext, templateTokenReader, expressionTokenReader));
}
function handleOpenedTag(blockType, templateParser, tokenParserContext, templateTokenReader, expressionTokenReader, handlers, innerNodeHandler) {
    while (true) {
        try {
            var keys = [];
            for (var key in handlers)
                keys.push(key);
            //console.log("[[");
            var node = templateParser.parseTemplateSyncOne(tokenParserContext, templateTokenReader);
            if (node == null)
                throw (new Error("Unexpected end of '" + blockType + "' no any of [" + keys.map(function (key) { return "'" + key + "'"; }).join(', ') + "]"));
            //console.log("]]");
            //console.log(node);
            innerNodeHandler(node);
        }
        catch (e) {
            if (!(e instanceof TemplateParser.FlowException))
                throw (e);
            var handler = handlers[e.blockType];
            if (handler !== undefined) {
                if (handler(e))
                    return;
            }
            else {
                throw (new Error("Unexpected '" + e.blockType + "' for '" + blockType + "'"));
            }
        }
    }
}
var ParserNodeAutoescape = (function (_super) {
    __extends(ParserNodeAutoescape, _super);
    function ParserNodeAutoescape(expression, inner) {
        _super.call(this);
        this.expression = expression;
        this.inner = inner;
    }
    ParserNodeAutoescape.prototype.iterate = function (handler) {
        handler(this);
        this.expression.iterate(handler);
        this.inner.iterate(handler);
    };
    ParserNodeAutoescape.prototype.generateCode = function (context) {
        return ('runtimeContext.autoescape(' + this.expression.generateCode(context) + ', function() {' +
            this.inner.generateCode(context) +
            '}, true);');
    };
    return ParserNodeAutoescape;
})(ParserNode.ParserNodeStatement);
var ParserNodeExpressionFilter = (function (_super) {
    __extends(ParserNodeExpressionFilter, _super);
    function ParserNodeExpressionFilter(inner) {
        _super.call(this);
        this.inner = inner;
        this.filters = [];
    }
    ParserNodeExpressionFilter.prototype.iterate = function (handler) {
        handler(this);
        this.inner.iterate(handler);
        this.filters.forEach(function (item) { return item.parameters.iterate(handler); });
    };
    ParserNodeExpressionFilter.prototype.addFilter = function (filterName, filterParameters) {
        this.filters.push({
            name: filterName,
            parameters: filterParameters,
        });
    };
    ParserNodeExpressionFilter.prototype.generateCode = function (context) {
        var out = '';
        this.filters.reverse().forEach(function (filter) {
            out += 'runtimeContext.filter(' + JSON.stringify(filter.name) + ', [';
        });
        out += 'runtimeContext.captureOutput(function () {';
        out += this.inner.generateCode(context);
        out += '})';
        this.filters.reverse().forEach(function (filter) {
            if (filter.parameters && filter.parameters.expressions.length > 0) {
                out += ',';
                out += filter.parameters.generateCode(context);
            }
            out += '])';
        });
        return out;
    };
    return ParserNodeExpressionFilter;
})(ParserNode.ParserNodeExpression);
var ParserNodeScopeSet = (function (_super) {
    __extends(ParserNodeScopeSet, _super);
    function ParserNodeScopeSet(key, value) {
        _super.call(this);
        this.key = key;
        this.value = value;
    }
    ParserNodeScopeSet.prototype.iterate = function (handler) {
        handler(this);
        this.value.iterate(handler);
    };
    ParserNodeScopeSet.prototype.generateCode = function (context) {
        return 'runtimeContext.scope.set(' + JSON.stringify(this.key) + ', ' + this.value.generateCode(context) + ');';
    };
    return ParserNodeScopeSet;
})(ParserNode.ParserNodeStatement);
var ParserNodeIf = (function (_super) {
    __extends(ParserNodeIf, _super);
    function ParserNodeIf() {
        _super.apply(this, arguments);
        this.conditions = [];
    }
    ParserNodeIf.prototype.iterate = function (handler) {
        handler(this);
        this.conditions.forEach(function (node) { node.code.iterate(handler); node.expression.iterate(handler); });
    };
    ParserNodeIf.prototype.addCaseCondition = function (expression) {
        this.conditions.push({
            expression: expression,
            code: new ParserNode.ParserNodeContainer([]),
        });
    };
    ParserNodeIf.prototype.addElseCondition = function () {
        this.conditions.push({
            expression: null,
            code: new ParserNode.ParserNodeContainer([]),
        });
    };
    ParserNodeIf.prototype.addCodeToCondition = function (node) {
        this.conditions[this.conditions.length - 1].code.add(node);
    };
    ParserNodeIf.prototype.generateCode = function (context) {
        var out = '';
        for (var n = 0; n < this.conditions.length; n++) {
            var condition = this.conditions[n];
            if (out != '')
                out += 'else ';
            if (condition.expression != null)
                out += 'if (' + condition.expression.generateCode(context) + ')';
            out += '{ ';
            out += condition.code.generateCode(context);
            out += '}';
        }
        return out;
    };
    return ParserNodeIf;
})(ParserNode.ParserNodeStatement);
var ParserNodeFor = (function (_super) {
    __extends(ParserNodeFor, _super);
    function ParserNodeFor(keyId, condId, valueId, nodeList, forCode, elseCode) {
        _super.call(this);
        this.keyId = keyId;
        this.condId = condId;
        this.valueId = valueId;
        this.nodeList = nodeList;
        this.forCode = forCode;
        this.elseCode = elseCode;
    }
    ParserNodeFor.prototype.iterate = function (handler) {
        handler(this);
        this.valueId.iterate(handler);
        this.nodeList.iterate(handler);
        this.forCode.iterate(handler);
        this.elseCode.iterate(handler);
    };
    ParserNodeFor.prototype.generateCode = function (context) {
        var out = '';
        out += ('runtimeContext.createScope((function() { ');
        out += (' var list = ' + this.nodeList.generateCode(context) + ';');
        out += (' if (!runtimeContext.emptyList(list)) {');
        out += ('  runtimeContext.each(list, function(k, v) { ');
        out += ('   ' + (new ParserNode.ParserNodeAssignment(this.valueId, new ParserNode.ParserNodeRaw("v"))).generateCode(context) + ';');
        if (this.keyId !== undefined) {
            out += ('   ' + (new ParserNode.ParserNodeAssignment(this.keyId, new ParserNode.ParserNodeRaw("k"))).generateCode(context) + ';');
        }
        if (this.condId) {
            out += ('   if (' + this.condId.generateCode() + ') { ');
        }
        else {
            out += ('   if (true) { ');
        }
        out += this.forCode.generateCode(context);
        out += ('}'); // if condition
        out += ('  });'); // each
        out += ('} else {');
        {
            out += this.elseCode.generateCode(context);
        }
        out += ('} '); // if/else
        out += ('}));'); // createScope
        return out;
    };
    return ParserNodeFor;
})(ParserNode.ParserNodeStatement);
var DefaultTags = (function () {
    function DefaultTags() {
    }
    DefaultTags.autoescape = function (blockType, templateParser, tokenParserContext, templateTokenReader, expressionTokenReader) {
        var expressionNode = (new ExpressionParser(expressionTokenReader, tokenParserContext)).parseExpression();
        checkNoMoreTokens(expressionTokenReader);
        var innerNode = new ParserNode.ParserNodeContainer([]);
        handleOpenedTag(blockType, templateParser, tokenParserContext, templateTokenReader, expressionTokenReader, {
            'endautoescape': function (e) {
                return true;
            },
        }, function (node) {
            innerNode.add(node);
        });
        return new ParserNodeAutoescape(expressionNode, innerNode);
    };
    DefaultTags.set = function (blockType, templateParser, tokenParserContext, templateTokenReader, expressionTokenReader) {
        var expressionParser = new ExpressionParser(expressionTokenReader, tokenParserContext);
        var nodeIds = expressionParser.parseIdentifierCommaList();
        if (expressionTokenReader.checkAndMoveNext(['='])) {
            var nodeValues = expressionParser.parseCommaExpression();
            checkNoMoreTokens(expressionTokenReader);
            if (nodeIds.length != nodeValues.expressions.length)
                throw (new Error("variables doesn't match values"));
            var container = new ParserNode.ParserNodeContainer([]);
            for (var n = 0; n < nodeIds.length; n++) {
                container.add(new ParserNodeScopeSet(String(nodeIds[n].value), nodeValues.expressions[n]));
            }
            return container;
        }
        else {
            var innerNode = new ParserNode.ParserNodeContainer([]);
            //console.log('************************');
            handleOpenedTag(blockType, templateParser, tokenParserContext, templateTokenReader, expressionTokenReader, {
                'endset': function (e) {
                    return true;
                },
            }, function (node) {
                //console.log(node);
                innerNode.add(node);
            });
            //console.log('************************');
            return new ParserNode.ParserNodeStatementExpression((new ParserNode.ParserNodeContainer([
                new ParserNode.ParserNodeRaw('runtimeContext.scopeSet(' + JSON.stringify(nodeIds[0].value) + ', (runtimeContext.captureOutput(function() { '),
                innerNode,
                new ParserNode.ParserNodeRaw('})))')
            ])));
        }
    };
    DefaultTags.$do = function (blockType, templateParser, tokenParserContext, templateTokenReader, expressionTokenReader) {
        var expressionNode = (new ExpressionParser(expressionTokenReader, tokenParserContext)).parseExpression();
        checkNoMoreTokens(expressionTokenReader);
        return new ParserNode.ParserNodeStatementExpression(expressionNode);
    };
    DefaultTags.embed = function (blockType, templateParser, tokenParserContext, templateTokenReader, expressionTokenReader) {
        var expressionString = expressionTokenReader.getSliceWithCallback(function () {
            var includeName = (new ExpressionParser(expressionTokenReader, tokenParserContext)).parseExpression();
        }).map(function (item) { return item.rawValue; });
        checkNoMoreTokens(expressionTokenReader);
        var offsetStart = templateTokenReader.getOffset();
        var offsetEnd = offsetStart;
        handleOpenedTag(blockType, templateParser, tokenParserContext, templateTokenReader, expressionTokenReader, {
            'endembed': function (e) { offsetEnd = templateTokenReader.getOffset() - 1; return true; },
        }, function (node) {
        });
        var rawText = templateTokenReader.getSlice(offsetStart, offsetEnd).map(function (item) { return item.rawText; }).join('');
        var templateString = '{% extends ' + expressionString + ' %}' + rawText;
        return new ParserNode.ParserNodeRaw('runtimeContext.include(runtimeContext.compileString(' + JSON.stringify(templateString) + '));');
    };
    DefaultTags.filter = function (blockType, templateParser, tokenParserContext, templateTokenReader, expressionTokenReader) {
        var innerNode = new ParserNode.ParserNodeContainer([]);
        handleOpenedTag(blockType, templateParser, tokenParserContext, templateTokenReader, expressionTokenReader, {
            'endfilter': function (e) { return true; },
        }, function (node) {
            innerNode.add(node);
        });
        var filterNode = new ParserNodeExpressionFilter(innerNode);
        var expressionParser = new ExpressionParser(expressionTokenReader, tokenParserContext);
        while (true) {
            var filterName = expressionParser.parseIdentifier().value;
            var parameters = null;
            //console.log(filterName);
            if (expressionTokenReader.checkAndMoveNext(['('])) {
                parameters = expressionParser.parseCommaExpression();
                //console.log(parameters);
                expressionTokenReader.expectAndMoveNext([')']);
            }
            filterNode.addFilter(filterName, parameters);
            if (!expressionTokenReader.checkAndMoveNext(['|'])) {
                break;
            }
        }
        checkNoMoreTokens(expressionTokenReader);
        return new ParserNode.ParserNodeStatementExpression(new ParserNode.ParserNodeOutputNodeExpression(filterNode));
    };
    // FLUSH
    // http://twig.sensiolabs.org/doc/tags/flush.html
    DefaultTags.flush = function (blockType, templateParser, tokenParserContext, templateTokenReader, expressionTokenReader) {
        // do nothing (all output is buffered and can't be flushed)
    };
    DefaultTags.macro = function (blockType, templateParser, tokenParserContext, templateTokenReader, expressionTokenReader) {
        var expressionParser = new ExpressionParser(expressionTokenReader, tokenParserContext);
        var macroName = expressionTokenReader.read().value;
        var paramNames = [];
        expressionTokenReader.expectAndMoveNext(['(']);
        if (expressionTokenReader.peek().value != ")") {
            while (true) {
                paramNames.push(expressionParser.parseIdentifier());
                if (expressionTokenReader.expectAndMoveNext([')', ',']) == ')')
                    break;
            }
        }
        else {
            expressionTokenReader.expectAndMoveNext([')']);
        }
        checkNoMoreTokens(expressionTokenReader);
        var macroNode = new ParserNode.ParserNodeContainer([]);
        macroNode.add(new ParserNode.ParserNodeRaw('var _arguments = arguments;'));
        macroNode.add(new ParserNode.ParserNodeRaw('return runtimeContext.captureOutput(function() { '));
        macroNode.add(new ParserNode.ParserNodeRaw('return runtimeContext.autoescape(false, function() { '));
        macroNode.add(new ParserNode.ParserNodeRaw('runtimeContext.createScope(function() { '));
        paramNames.forEach(function (paramName, index) {
            var assign = new ParserNode.ParserNodeAssignment(paramName, new ParserNode.ParserNodeRaw('_arguments[' + index + ']'));
            macroNode.add(new ParserNode.ParserNodeStatementExpression(assign));
        });
        handleOpenedTag(blockType, templateParser, tokenParserContext, templateTokenReader, expressionTokenReader, {
            'endmacro': function (e) {
                return true;
            },
        }, function (node) {
            macroNode.add(node);
        });
        macroNode.add(new ParserNode.ParserNodeRaw('});')); // createScope
        macroNode.add(new ParserNode.ParserNodeRaw('});')); // autoescape
        macroNode.add(new ParserNode.ParserNodeRaw('});')); // captureOutput
        var macroCode = tokenParserContext.setMacro(macroName, macroNode);
        //console.log(macroCode);
        return new ParserNode.ParserNodeRaw('');
    };
    DefaultTags.from = function (blockType, templateParser, tokenParserContext, templateTokenReader, expressionTokenReader) {
        var expressionParser = new ExpressionParser(expressionTokenReader, tokenParserContext);
        var fileNameNode = expressionParser.parseExpression();
        expressionTokenReader.expectAndMoveNext(['import']);
        var pairs = [];
        while (expressionTokenReader.peek().value != null) {
            var fromNode = expressionTokenReader.read().value;
            var toNode = fromNode;
            var token = expressionTokenReader.expectAndMoveNext(['as', ',', null]);
            if (token == 'as') {
                toNode = expressionTokenReader.read().value;
                expressionTokenReader.expectAndMoveNext([',', null]);
            }
            pairs.push([fromNode, toNode]);
        }
        checkNoMoreTokens(expressionTokenReader);
        return new ParserNode.ParserNodeContainer([
            new ParserNode.ParserNodeRaw('runtimeContext.fromImport('),
            fileNameNode,
            new ParserNode.ParserNodeRaw(', ' + JSON.stringify(pairs) + ');')
        ]);
    };
    DefaultTags.$import = function (blockType, templateParser, tokenParserContext, templateTokenReader, expressionTokenReader) {
        var expressionParser = new ExpressionParser(expressionTokenReader, tokenParserContext);
        var fileNameNode = expressionParser.parseExpression();
        expressionTokenReader.expectAndMoveNext(['as']);
        var aliasNode = expressionParser.parseIdentifier();
        checkNoMoreTokens(expressionTokenReader);
        return new ParserNode.ParserNodeStatementExpression(new ParserNode.ParserNodeAssignment(aliasNode, new ParserNode.ParserNodeContainerExpression([
            new ParserNode.ParserNodeRaw('runtimeContext.import('),
            fileNameNode,
            new ParserNode.ParserNodeRaw(')'),
        ])));
    };
    // USE
    // http://twig.sensiolabs.org/doc/tags/use.html
    DefaultTags.use = function (blockType, templateParser, tokenParserContext, templateTokenReader, expressionTokenReader) {
        var expressionParser = new ExpressionParser(expressionTokenReader, tokenParserContext);
        var fileName = expressionParser.parseStringLiteral().value;
        var pairs = {};
        while (expressionTokenReader.checkAndMoveNext(['with'])) {
            var fromNode = expressionParser.parseIdentifierOnly().value;
            expressionTokenReader.expectAndMoveNext(['as']);
            var toNode = expressionParser.parseIdentifierOnly().value;
            pairs['block_' + fromNode] = 'block_' + toNode;
        }
        checkNoMoreTokens(expressionTokenReader);
        var info = templateParser.getEvalCode(fileName, tokenParserContext.common);
        info.tokenParserContext.iterateBlocks(function (node, name) {
            if (name.match(/^block_/)) {
                if (pairs[name]) {
                    tokenParserContext.setBlock(pairs[name], node);
                }
                else {
                    tokenParserContext.setBlock(name, node);
                }
            }
        });
        return new ParserNode.ParserNodeRaw('');
    };
    // INCLUDE
    DefaultTags.include = function (blockType, templateParser, tokenParserContext, templateTokenReader, expressionTokenReader) {
        //console.log(tokenParserContext.common);
        var node = new ParserNode.ParserNodeContainer([]);
        node.add(new ParserNode.ParserNodeRaw('runtimeContext.include('));
        var expressionNode = (new ExpressionParser(expressionTokenReader, tokenParserContext)).parseExpression();
        node.add(expressionNode);
        if (expressionTokenReader.checkAndMoveNext(['with'])) {
            node.add(new ParserNode.ParserNodeRaw(','));
            node.add((new ExpressionParser(expressionTokenReader, tokenParserContext)).parseExpression());
        }
        else {
            node.add(new ParserNode.ParserNodeRaw(', undefined'));
        }
        if (expressionTokenReader.checkAndMoveNext(['only'])) {
            node.add(new ParserNode.ParserNodeRaw(', true'));
        }
        else {
            node.add(new ParserNode.ParserNodeRaw(', false'));
        }
        node.add(new ParserNode.ParserNodeRaw(', ' + JSON.stringify(tokenParserContext.common.serialize())));
        checkNoMoreTokens(expressionTokenReader);
        node.add(new ParserNode.ParserNodeRaw(');'));
        return node;
    };
    DefaultTags.raw = function (blockType, templateParser, tokenParserContext, templateTokenReader, expressionTokenReader) {
        checkNoMoreTokens(expressionTokenReader);
        //console.log(templateTokenReader);
        //var rawText = templateTokenReader.tokens
        var res = templateTokenReader.tokenizer.stringReader.findRegexp(/\{%\-?\s*endverbatim\s*\-?%\}/);
        if (res.position === null)
            throw (new Error("Expecting endverbatim"));
        var rawText = templateTokenReader.tokenizer.stringReader.readChars(res.position);
        templateTokenReader.tokenizer.stringReader.skipChars(res.length);
        return new ParserNode.ParserNodeOutputText(rawText);
    };
    DefaultTags.sandbox = function (blockType, templateParser, tokenParserContext, templateTokenReader, expressionTokenReader) {
        checkNoMoreTokens(expressionTokenReader);
        var innerNode = new ParserNode.ParserNodeContainer([]);
        tokenParserContext.common.setSandbox(function () {
            handleOpenedTag(blockType, templateParser, tokenParserContext, templateTokenReader, expressionTokenReader, {
                'endsandbox': function (e) {
                    return true;
                },
            }, function (node) {
                innerNode.add(node);
            });
        });
        return new ParserNode.ParserNodeContainer([
            new ParserNode.ParserNodeRaw('runtimeContext.createScope(function() { '),
            new ParserNode.ParserNodeRaw('  runtimeContext.scopeSet("__sandboxed", true);'),
            innerNode,
            new ParserNode.ParserNodeRaw('});')
        ]);
    };
    DefaultTags.spaceless = function (blockType, templateParser, tokenParserContext, templateTokenReader, expressionTokenReader) {
        checkNoMoreTokens(expressionTokenReader);
        var innerNode = new ParserNode.ParserNodeContainer([]);
        //console.log('************************');
        handleOpenedTag(blockType, templateParser, tokenParserContext, templateTokenReader, expressionTokenReader, {
            'endspaceless': function (e) {
                return true;
            },
        }, function (node) {
            //console.log(node);
            innerNode.add(node);
        });
        //console.log('************************');
        return new ParserNode.ParserNodeStatementExpression(new ParserNode.ParserNodeOutputNodeExpression(new ParserNode.ParserNodeContainer([
            new ParserNode.ParserNodeRaw('runtimeContext.filter("spaceless", [runtimeContext.captureOutput(function() { '),
            innerNode,
            new ParserNode.ParserNodeRaw('})])')
        ])));
    };
    DefaultTags.$if = function (blockType, templateParser, tokenParserContext, templateTokenReader, expressionTokenReader) {
        var didElse = false;
        var expressionNode = (new ExpressionParser(expressionTokenReader, tokenParserContext)).parseExpression();
        checkNoMoreTokens(expressionTokenReader);
        var parserNodeIf = new ParserNodeIf();
        parserNodeIf.addCaseCondition(expressionNode);
        handleOpenedTag(blockType, templateParser, tokenParserContext, templateTokenReader, expressionTokenReader, {
            'elseif': function (e) {
                if (didElse)
                    throw (new Error("Can't put 'elseif' after the 'else'"));
                var expressionNode = (new ExpressionParser(e.expressionTokenReader, tokenParserContext)).parseExpression();
                checkNoMoreTokens(expressionTokenReader);
                parserNodeIf.addCaseCondition(expressionNode);
            },
            'else': function (e) {
                if (didElse)
                    throw (new Error("Can't have two 'else'"));
                parserNodeIf.addElseCondition();
                didElse = true;
            },
            'endif': function (e) {
                return true;
            },
        }, function (node) {
            parserNodeIf.addCodeToCondition(node);
        });
        return parserNodeIf;
    };
    DefaultTags.block = function (blockType, templateParser, tokenParserContext, templateTokenReader, expressionTokenReader) {
        var blockName = 'block_' + expressionTokenReader.read().value;
        var innerNode = new ParserNode.ParserNodeContainer([]);
        if (expressionTokenReader.hasMore()) {
            var expressionNode = (new ExpressionParser(expressionTokenReader, tokenParserContext)).parseExpression();
            checkNoMoreTokens(expressionTokenReader);
            innerNode.add(new ParserNode.ParserNodeReturnStatement(new ParserNode.ParserNodeWriteExpression(expressionNode)));
        }
        else {
            handleOpenedTag(blockType, templateParser, tokenParserContext, templateTokenReader, expressionTokenReader, {
                'endblock': function (e) {
                    return true;
                },
            }, function (node) {
                innerNode.add(node);
            });
        }
        tokenParserContext.setBlock(blockName, innerNode);
        return new ParserNode.ParserNodeRaw('runtimeContext.putBlock(' + JSON.stringify(blockName) + ');', false);
    };
    // EXTENDS
    DefaultTags.$extends = function (blockType, templateParser, tokenParserContext, templateTokenReader, expressionTokenReader) {
        var expressionNode = (new ExpressionParser(expressionTokenReader, tokenParserContext)).parseExpression();
        checkNoMoreTokens(expressionTokenReader);
        tokenParserContext.addAfterMainNode(new ParserNode.ParserNodeContainer([
            new ParserNode.ParserNodeRaw('return runtimeContext.extends('),
            expressionNode,
            new ParserNode.ParserNodeRaw(');')
        ]));
        return new ParserNode.ParserNodeRaw('');
    };
    DefaultTags.$for = function (blockType, templateParser, tokenParserContext, templateTokenReader, expressionTokenReader) {
        var didElse = false;
        var expressionParser = new ExpressionParser(expressionTokenReader, tokenParserContext);
        var valueId = expressionParser.parseIdentifier();
        var keyId = undefined;
        var condId = undefined;
        var res = expressionTokenReader.expectAndMoveNext([',', 'in']);
        if (res == ',') {
            keyId = valueId;
            valueId = expressionParser.parseIdentifier();
            expressionTokenReader.expectAndMoveNext(['in']);
        }
        var nodeList = expressionParser.parseExpression();
        // Since Twig 1.2
        if (expressionTokenReader.checkAndMoveNext(['if'])) {
            condId = expressionParser.parseExpression();
        }
        checkNoMoreTokens(expressionTokenReader);
        var forCode = new ParserNode.ParserNodeContainer([]);
        var elseCode = new ParserNode.ParserNodeContainer([]);
        handleOpenedTag(blockType, templateParser, tokenParserContext, templateTokenReader, expressionTokenReader, {
            'else': function (e) {
                if (didElse)
                    throw (new Error("Can't have two 'else'"));
                didElse = true;
            },
            'endfor': function (e) {
                return true;
            },
        }, function (node) {
            if (!didElse) {
                forCode.add(node);
            }
            else {
                elseCode.add(node);
            }
        });
        return new ParserNodeFor(keyId, condId, valueId, nodeList, forCode, elseCode);
    };
    // autoescape
    DefaultTags.endautoescape = _flowexception;
    // DO/SET
    DefaultTags.endset = _flowexception;
    // EMBED
    // http://twig.sensiolabs.org/doc/tags/embed.html
    DefaultTags.endembed = _flowexception;
    // FILTER
    // http://twig.sensiolabs.org/doc/tags/filter.html
    DefaultTags.endfilter = _flowexception;
    // MACRO/FROM/IMPORTUSE
    DefaultTags.endmacro = _flowexception;
    // RAW/VERBATIM
    // http://twig.sensiolabs.org/doc/tags/verbatim.html
    DefaultTags.endraw = _flowexception;
    DefaultTags.endverbatim = _flowexception;
    DefaultTags.verbatim = DefaultTags.raw;
    // SANDBOX
    // http://twig.sensiolabs.org/doc/tags/sandbox.html
    DefaultTags.endsandbox = _flowexception;
    // SPACELESS
    // http://twig.sensiolabs.org/doc/tags/spaceless.html
    DefaultTags.endspaceless = _flowexception;
    // IF/ELSEIF/ELSE/ENDIF
    DefaultTags.$else = _flowexception;
    DefaultTags.$elseif = _flowexception;
    DefaultTags.$endif = _flowexception;
    // BLOCK/ENDBLOCK
    DefaultTags.endblock = _flowexception;
    // http://twig.sensiolabs.org/doc/tags/for.html
    DefaultTags.$endfor = _flowexception;
    return DefaultTags;
})();
module.exports = DefaultTags;
