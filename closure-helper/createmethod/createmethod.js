var fs = require('fs');
var util = require("util");
var XRegExp = require('xregexp').XRegExp;

var CLOUMN_WRAP = 80;

var TYPE_SINGLETON_STRICT = 'singleton';
var TYPE_CTOR_STRICT = 'constructor';
var TYPE_STATIC_STRICT = 'static';
var TYPE_PRIVATE_STRICT = 'private';
var TYPE_PROTECTED_STRICT = 'protected';
var TYPE_OVERRIDE_STRICT = 'override';
var TYPE_INHERIT_STRICT = 'inheritDoc';
var TYPE_ENUM_STRICT = 'enum';
var TYPE_DEFINE_STRICT = 'define';
var TYPE_PUBLIC_STRICT = 'public';

var TYPE_CONST_STRICT = 'const';

var TYPE_CTOR = '(' + TYPE_CTOR_STRICT + '|ctor)';
var TYPE_SINGLETON = '(' + TYPE_SINGLETON_STRICT + '|ston|single)';
var TYPE_STATIC = '(' + TYPE_STATIC_STRICT + '|' + TYPE_CONST_STRICT + ')';
var TYPE_PRIVATE = '(_|' + TYPE_PRIVATE_STRICT + ')';
var TYPE_PROTECTED = TYPE_PROTECTED_STRICT;
var TYPE_OVERRIDE = TYPE_OVERRIDE_STRICT;
var TYPE_INHERIT = '(inherit|' + TYPE_INHERIT_STRICT + ')';
var TYPE_ENUM = '(dict|' + TYPE_ENUM_STRICT + ')';
var TYPE_DEFINE = '(def|' + TYPE_DEFINE_STRICT + ')';
var TYPE_PUBLIC = TYPE_PUBLIC_STRICT;

var FUNCTION_TYPE = [TYPE_CTOR, TYPE_SINGLETON, TYPE_STATIC, TYPE_PRIVATE, TYPE_PROTECTED, TYPE_OVERRIDE, TYPE_INHERIT, TYPE_PUBLIC].join('|');
var PROPERTY_TYPE = [TYPE_ENUM, TYPE_DEFINE, TYPE_STATIC, TYPE_PRIVATE, TYPE_PROTECTED, TYPE_OVERRIDE, TYPE_INHERIT, TYPE_PUBLIC].join('|');

var TITLE = '([a-zA-Z_][a-zA-Z0-9_.]*)';

var RETURN_SEP = ':';
var VALUE_SEP = '=';

var VAR_DEFAULT_TYPE = '([^ ]+|[a-zA-Z]+\\.<.+>|{.+}|([a-zA-Z_][a-zA-Z0-9_]*)?\\(.+\\))';

var PARAM_NAME = '[a-zA-Z_][a-zA-Z0-9_]*';
var PARAM = '(' + VAR_DEFAULT_TYPE + ')\\s+' + PARAM_NAME;
var PARAMS = '(' + PARAM + ')\\s*(\\s*,\\s*(' + PARAM + '))*';

var FORMED_TITLE = '(?<title>' + TITLE + ')';
var FORMED_PARAMS = '\\((?<params>' + PARAMS + ')\\)';
var FORMED_RET = RETURN_SEP + '\\s*(?<ret>' + VAR_DEFAULT_TYPE + ')';
var FORMED_VAL = VALUE_SEP + '\\s*(?<val>.*)';

var NS = '[a-zA-Z][a-zA-Z0-9_]*(\\.[a-zA-Z_][a-zA-Z0-9_]*)*';

var VARTYPE_PREFIX_NULL = '\\?';
var VARTYPE_PREFIX_STRICT = '!';
var VARTYPE_POSTFIX_UNDEFINED = '=';
var VARTYPE_PRIM_NUM = '(number|num|int|float|double)';
var VARTYPE_PRIM_STR = '(string|str)';
var VARTYPE_PRIM_BOOL = '(boolean|bool)';
var VARTYPE_PRIM_NULL = 'null';
var VARTYPE_PRIM_UNDEFINED = 'undefined';
var VARTYPE_PRIM_NS = NS;

var VARTYPE_PRIM = '(' + [VARTYPE_PREFIX_NULL, VARTYPE_PREFIX_STRICT].join('|') + ')?' +
  '(' + [VARTYPE_PRIM_NUM, VARTYPE_PRIM_STR, VARTYPE_PRIM_BOOL, VARTYPE_PRIM_NULL, VARTYPE_PRIM_UNDEFINED, NS].join('|') + ')' +
  '(' + [VARTYPE_PREFIX_NULL, VARTYPE_POSTFIX_UNDEFINED].join('|') + ')?';

var VARTYPE_PRIMS = VARTYPE_PRIM + '(|' + VARTYPE_PRIM + ')?';

var VARTYPE_ARRAY = 'Array(\\.<' + VARTYPE_PRIMS + '>)?';
var VARTYPE_OBJECT = 'Object(\\.<(' + VARTYPE_PRIMS + '),\\s*(' + VARTYPE_PRIMS + ')>)?';
var VARTYPE_OBJECT_STRUCT = '{([a-zA-Z_][a-zA-Z0-9_]*\\s*(:\\s*' + VARTYPE_PRIMS + ')?)+}';
var VARTYPE_FUNCTION = '(Function(\\.<(' + VARTYPE_PRIMS + ')>)?|function\\(.*\\))';

var VARTYPE = '(' + [VARTYPE_PREFIX_STRICT, VARTYPE_PREFIX_NULL].join('|') + ')?' +
  [VARTYPE_PRIMS, VARTYPE_ARRAY, VARTYPE_OBJECT, VARTYPE_OBJECT_STRUCT, VARTYPE_FUNCTION, NS].join('|') +
  '(' + [VARTYPE_PREFIX_NULL, VARTYPE_POSTFIX_UNDEFINED].join('|') + ')?';

var PARAM_ITER = '(' + VARTYPE + ')\\s+' + PARAM_NAME;

var REGEX_FUNC = '^' +
  '\\s*' +
  '(' +
    '(?<type>' + FUNCTION_TYPE + ')' +
    '\\s+' +
  ')?' +
  FORMED_TITLE +
  '(\\(\\)|(\\s*' + FORMED_PARAMS + ')?)' +
  '(\\s*' + FORMED_RET    + ')?' +
  '\\s*$';

var REGEX_PROP = '^' +
  '\\s*' +
  '(' +
    '(?<type>' + PROPERTY_TYPE + ')' +
    '\\s+' +
  ')?' +
  '(?<propType>' + VAR_DEFAULT_TYPE + ')' +
  '\\s+' +
  FORMED_TITLE +
  '(\\s*' + FORMED_VAL + ')?' +
  '\\s*$';

// console.log(REGEX_FUNC);
// console.log(REGEX_PROP);

var CreateMethod = function(ns, instruction) {
  this.ns = ns;
  this.instr = this._analyze(instruction);
};
module.exports = CreateMethod;

CreateMethod.prototype._analyze = function(instr) {
  var funcRX = XRegExp(REGEX_FUNC);
  var propRX = XRegExp(REGEX_PROP);
  if (funcRX.test(instr)) {
    return this._analyzeFunc(instr);
  } else if (propRX.test(instr)) {
    return this._analyzeProp(instr);
  }

  throw "Bad instruction: " + instr;
};

CreateMethod.prototype._analyzeFunc = function(instr) {
  var regex = XRegExp(REGEX_FUNC);
  var matches = XRegExp.exec(instr, regex);
  this._normalizeMatches(matches);

  var ret = {
    '_type': 'function',
    title: matches.title
  };

  this._addTypeKeys(ret, matches);
  this._addParams(ret, matches);
  this._addRet(ret, matches);

  return ret;
};

CreateMethod.prototype._analyzeProp = function(instr) {
  var regex = XRegExp(REGEX_PROP);
  var matches = XRegExp.exec(instr, regex);
  this._normalizeMatches(matches);

  var ret = {
    '_type': 'property',
    title: matches.title,
    val: matches.val
  };

  this._addTypeKeys(ret, matches);
  this._addPropTypeKey(ret, matches);

  return ret;
};

CreateMethod.prototype._addTypeKeys = function(obj, matches) {
  obj.isConstructor = XRegExp('^(' + TYPE_CTOR + '|' + TYPE_SINGLETON + ')$').test(matches.type);
  obj.isSingleton   = XRegExp('^(' + TYPE_SINGLETON + ')$').test(matches.type);
  obj.isStatic      = XRegExp('^' + TYPE_STATIC + '$').test(matches.type);
  obj.isPrivate     = XRegExp('^' + TYPE_PRIVATE + '$').test(matches.type);
  obj.isProtected   = XRegExp('^' + TYPE_PROTECTED + '$').test(matches.type);
  obj.isOverride    = XRegExp('^' + TYPE_OVERRIDE + '$').test(matches.type);
  obj.isInherit     = XRegExp('^' + TYPE_INHERIT + '$').test(matches.type);
  obj.isEnum        = XRegExp('^' + TYPE_ENUM + '$').test(matches.type);
  obj.isDefine      = XRegExp('^' + TYPE_DEFINE + '$').test(matches.type);
  obj.isPublic      = XRegExp('^' + TYPE_PUBLIC + '$').test(matches.type);
};

CreateMethod.prototype._addPropTypeKey = function(obj, matches) {
  var type = 'null';

  var isNullable = XRegExp('^' + VARTYPE_PREFIX_NULL).test(matches.propType)
    || XRegExp(VARTYPE_PRIM_NUM + '$');
  var isUndefindable = XRegExp(VARTYPE_POSTFIX_UNDEFINED + '$').test(matches.propType);
  var isStrict = XRegExp('^' + VARTYPE_PREFIX_STRICT).test(matches.propType);

  var getRegexp = function(type) {
    return  XRegExp(
      '^(' + [VARTYPE_PREFIX_NULL, VARTYPE_PREFIX_STRICT].join('|') + ')?' +
      type +
      '(' + [VARTYPE_PREFIX_NULL, VARTYPE_POSTFIX_UNDEFINED].join('|') + ')?'
    );
  };

  if(XRegExp('^' + VARTYPE_PRIM_NUM).test(matches.propType)) {
    type = 'null';
  } else if(XRegExp(VARTYPE_PRIM_NUM + '$').test(matches.propType)) {
    type = 'null';
  } else if(getRegexp(VARTYPE_PRIM_NUM).test(matches.propType)) {
    type = 'number';
  } else if(getRegexp(VARTYPE_PRIM_STR).test(matches.propType)) {
    type = 'number';
  } else if(getRegexp(VARTYPE_PRIM_NULL).test(matches.propType)) {
    type = 'null';
  } else if(getRegexp(VARTYPE_PRIM_BOOL).test(matches.propType)) {
    type = 'boolean';
  } else if(getRegexp(VARTYPE_PRIM_UNDEFINED).test(matches.propType)) {
    type = 'undefined';
  } else if(XRegExp('^' + VARTYPE_PRIM_STR + '$').test(matches.propType)) {
    type = 'string';
  }

  obj.propType = matches.propType;
  obj.propStrictType = type;
};

CreateMethod.prototype._addPropTypeKey = function(obj, matches) {
  obj.propType = this._parseType(matches.propType);
};

CreateMethod.prototype._parseType = function(type) {
  var expression = type;
  var isNullable = XRegExp('^' + VARTYPE_PREFIX_NULL).test(type)
    || XRegExp(VARTYPE_PREFIX_NULL + '$').test(type);
  var isUndefindable = XRegExp(VARTYPE_POSTFIX_UNDEFINED + '$').test(type);
  var isStrict = XRegExp('^' + VARTYPE_PREFIX_STRICT).test(type);
  var isPrimitive = XRegExp('^' + VARTYPE_PRIM + '$').test(type);

  var getRegexp = function(t) {
    return  XRegExp(
      '^(' + [VARTYPE_PREFIX_NULL, VARTYPE_PREFIX_STRICT].join('|') + ')?' +
      t +
      '(' + [VARTYPE_PREFIX_NULL, VARTYPE_POSTFIX_UNDEFINED].join('|') + ')?'
    );
  };

  if (isPrimitive) {
    if(getRegexp(VARTYPE_PRIM_NUM).test(type)) {
      type = 'number';
    } else if(getRegexp(VARTYPE_PRIM_STR).test(type)) {
      type = 'string';
    } else if(getRegexp(VARTYPE_PRIM_NULL).test(type)) {
      type = 'null';
    } else if(getRegexp(VARTYPE_PRIM_BOOL).test(type)) {
      type = 'boolean';
    } else if(getRegexp(VARTYPE_PRIM_UNDEFINED).test(type)) {
      type = 'undefined';
    } else if(getRegexp(VARTYPE_PRIM_NS).test(type)) {
      type = type;
    }

    expression = (isNullable ? '?' : '') + (isStrict ? '!' : '') + type + (isUndefindable ? '=' : '');
  }


  return {
    name: type,
    expression: expression,
    isUndefindable: isUndefindable,
    isStrict: isStrict,
    isNullable: isNullable,
    isPrimitive: isPrimitive
  };
};

CreateMethod.prototype._addRet = function(obj, matches) {
  if (matches.ret) {
    obj.ret = this._parseType(matches.ret);
  }
};

CreateMethod.prototype._addParams = function(obj, matches) {
  var params = [];
  var replaces = [];

  var getRealIndex = function(index) {
    var realIndex = index;
    recursive.forEach(function(replace) {
      var start = replace.hasDot ? replace.start - 2 : replace.start - 1;
      var end = replace.end + 1;
      if (start < realIndex) {
        realIndex += end - start;
      }
    });
    return realIndex;
  };

  if (matches.params) {
    var str = matches.params;
    var recursive = XRegExp.matchRecursive(matches.params, '<', '>', 'g', {
      valueNames: [null, null, 'value', null],
      escapeChar: '\\'
    });
    recursive.forEach(function(match) {
      match.hasDot = matches.params[match.start - 2] && matches.params[match.start - 2] == '.';
      replaces.push(match);

      str = str.replace((match.hasDot ? '.' : '') + '<' + match.name + '>', '');
    });

    // var regex = XRegExp('^' + PARAMS + '$');
    var regex = XRegExp('(' + PARAM_ITER + ')', 'g');
    XRegExp.forEach(str, regex, function(match, i) {
      var realStart = getRealIndex(match.index);
      var realEnd = getRealIndex(match.index + match[0].length);
      var substr = matches.params.substring(realStart, realEnd);

      var paramRegex = XRegExp('\\s+(' + PARAM_NAME + ')$');
      var m = XRegExp.exec(substr, paramRegex);
      if (m) {
        params.push({
          name: m[1],
          type: this._parseType(substr.replace(m[0], ''))
        });
      }

    }, this);
  }

  if (params.length) {
    obj.params = params;
  }
};

CreateMethod.prototype._normalizeMatches = function(matches) {
  if (!matches) {
    return;
  }
  if (!matches.type) {
    if (matches.title && matches.title[0] == '_') {
      matches.type = TYPE_PRIVATE_STRICT;
    } else {
      matches.type = TYPE_PUBLIC_STRICT;
    }
  }
};


CreateMethod.prototype.create = function() {
  if (this.instr['_type'] == 'function') {
    return this._createFunc();
  } else {
    return this._createProp();
  }
};

CreateMethod.prototype._addTypeJsDoc = function(jsDoc) {
  if (this.instr.isConstructor) {
    jsDoc.push('@' + TYPE_CTOR_STRICT);
  }
  if (this.instr.isStatic) {
    if (this.instr['_type'] == 'function') {
      jsDoc.push('@' + TYPE_STATIC_STRICT);
    } else {
      jsDoc.push('@' + TYPE_CONST_STRICT);
    }
  }
  if (this.instr.isPrivate) {
    jsDoc.push('@' + TYPE_PRIVATE_STRICT);
  }
  if (this.instr.isProtected) {
    jsDoc.push('@' + TYPE_PROTECTED_STRICT);
  }
  if (this.instr.isOverride) {
    jsDoc.push('@' + TYPE_OVERRIDE_STRICT);
  }
  if (this.instr.isInherit) {
    jsDoc.push('@' + TYPE_INHERIT_STRICT);
  }
  if (this.instr.isEnum) {
    jsDoc.push('@' + TYPE_ENUM_STRICT);
  }
  if (this.instr.isDefine) {
    jsDoc.push('@' + TYPE_DEFINE_STRICT);
  }

  if (this.instr['_type'] == 'function' && !this.instr.isConstructor && this.instr.ret) {
    jsDoc.push('@return {' + this.instr.ret.expression + '}');
  }
  // if (this.instr.isPublic) {
  //   jsDoc.push('@' + TYPE_PUBLIC);
  // }
};

CreateMethod.prototype._createJsDoc = function(jsDoc) {
  var ret = '';
  if (jsDoc.length > 0) {
    if (jsDoc.length > 1) {
      ret += "/**\n * ";
      ret += jsDoc.join("\n * ");
      ret += "\n */\n";
    } else {
      ret += "/** ";
      ret += jsDoc[0];
      ret += " */\n";
    }
  }

  return ret;
};

CreateMethod.prototype._createFunc = function() {
  var jsDoc = [];

  if (!this.instr.isInherit && !this.instr.isOverride && this.instr.params) {
    this.instr.params.forEach(function(param) {
      jsDoc.push('@param {' + param.type.expression + '} ' + param.name);
    });
  }

  this._addTypeJsDoc(jsDoc);

  if (this.instr.isConstructor && this.instr.ret) {
    jsDoc.push('@extends {' + this.instr.ret.expression + '}');
  } else if (this.instr.isConstructor && this.instr.ret) {
    jsDoc.push('@return {' + this.instr.ret.expression + '}');
  }

  var ret = this._createJsDoc(jsDoc);
  var isStatic = this.instr.isStatic || this.instr.isConstructor;

  var method = this.ns + (isStatic ? '.' : '.prototype.') + this.instr.title + ' =';
  if (this.instr.isConstructor) {
    method = this.instr.title + ' =';
  }
  var funcStr = ' function(';
  if (method.length + funcStr.length > CLOUMN_WRAP) {
    method += "\n\t\t";
  }
  method +=  funcStr;
  if (this.instr.params) {
    this.instr.params.forEach(function(param, pos) {
      if (pos > 0) {
        method += ', ';
      }
      if (method.length + param.name.length > CLOUMN_WRAP) {
        method += "\n\t\t";
      }
      method += param.name;
    });
  }
  method += ') {' + "\n";

  ret += method;
  if (this.instr.isInherit) {
    ret += "\t${1:goog.base(this, '" + this.instr.title + "'${2});}\n";
  } else if (this.instr.isConstructor && this.instr.ret) {
    ret += "\t${1:goog.base(this);}\n";
  } else {
    ret += "\t${1}\n";
  }
  ret += "};";

  if (this.instr.isConstructor && this.instr.ret) {
    ret += "\n" + 'goog.inherits(' + this.instr.title + ', ' + this.instr.ret + ');';
  }
  if (this.isSingleton) {
    ret += "\n" + 'goog.addSingletonGetter(' + this.instr.title + ');';
  }

  return ret;
};

CreateMethod.prototype._createProp = function() {
  var jsDoc = [];

  if (this.instr.propType) {
    jsDoc.push('@type {' + this.instr.propType.expression + '}');
  }

  this._addTypeJsDoc(jsDoc);

  var ret = this._createJsDoc(jsDoc);
  var isStatic = this.instr.isDefine || this.instr.isStatic || this.instr.isEnum;

  var value = this.instr.val;
  if (value === undefined) {
    if (this.instr.propType.isUndefindable) {
      value = 'undefined';
    } else if (this.instr.propType.isNullable) {
      value = 'null';
    } else if (this.instr.propType.isPrimitive) {
      switch(this.instr.propType.name) {
        case 'boolean':
          value = 'false';
        break;
        case 'number':
          value = '0';
        break;
        case 'string':
          value = '""';
        break;
        case 'undefined':
          value = 'undefined';
        break;
        case 'null':
          value = 'null';
        break;
      }
      value = 'null';
    } else {
      value = 'null';
    }
  }

  ret += this.ns + (isStatic ? '.' : '.prototype.') + this.instr.title + (
    value === null ? '' : ' = ${1:' + value + '}'
  ) + ';';

  return ret;
};

//
// var tests = [
//  'ctor MyClass',
//  'private _myMethod(bool a, Array adw, Object ccc, Array.<Array.<Object.<string, number>>> param, Array.<Object.<string, number>> b, {a: number} c) : bool',
//  'ctor MyClass({a: number} data) : goog.Disposable',
//  'singleton Renderer : goog.BaseRenderer',
//  'private _myMethod(function(number, string) a, num b, str c) : bool',
//  'private _myMethod2',
//  'myMethod3',
//  'private bool _isActive = false',
//  'private {doc: my.Doc, pos: goog.math.Coordinate} _stack',
//  'override Array.<Array.<Object.<string, number>>> _stack',
//  'private bool _isLoading',
//  'str key',
//  'str? key',
//  'str= key',
//  'str _val'
// ];
//
// tests.forEach(function(test, pos) {
//   console.log('TEST #' + (pos + 1));
//   console.log(test);
//   console.log("--");
//   var m = new createMethod('goog', test);
//   console.log(m.create());
//   console.log(" ");
//   console.log(" ");
// });
