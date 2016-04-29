'use strict';"use strict";
var collection_1 = require('angular2/src/facade/collection');
var lang_1 = require('angular2/src/facade/lang');
var metadata_1 = require('angular2/src/core/metadata');
var reflection_1 = require('angular2/src/core/reflection/reflection');
var provider_1 = require('angular2/src/core/di/provider');
var metadata_2 = require("angular2/src/core/di/metadata");
/**
 * A token representing the a reference to a static type.
 *
 * This token is unique for a moduleId and name and can be used as a hash table key.
 */
var StaticType = (function () {
    function StaticType(moduleId, name) {
        this.moduleId = moduleId;
        this.name = name;
    }
    return StaticType;
}());
exports.StaticType = StaticType;
/**
 * A static reflector implements enough of the Reflector API that is necessary to compile
 * templates statically.
 */
var StaticReflector = (function () {
    function StaticReflector(host) {
        this.host = host;
        this.typeCache = new Map();
        this.annotationCache = new Map();
        this.propertyCache = new Map();
        this.parameterCache = new Map();
        this.metadataCache = new Map();
        this.conversionMap = new Map();
        this.initializeConversionMap();
    }
    StaticReflector.prototype.importUri = function (typeOrFunc) { return typeOrFunc.moduleId; };
    /**
     * getStaticType produces a Type whose metadata is known but whose implementation is not loaded.
     * All types passed to the StaticResolver should be pseudo-types returned by this method.
     *
     * @param moduleId the module identifier as an absolute path.
     * @param name the name of the type.
     */
    StaticReflector.prototype.getStaticType = function (moduleId, name) {
        var key = "\"" + moduleId + "\"." + name;
        var result = this.typeCache.get(key);
        if (!lang_1.isPresent(result)) {
            result = new StaticType(moduleId, name);
            this.typeCache.set(key, result);
        }
        return result;
    };
    StaticReflector.prototype.annotations = function (type) {
        var annotations = this.annotationCache.get(type);
        if (!lang_1.isPresent(annotations)) {
            var classMetadata = this.getTypeMetadata(type);
            if (lang_1.isPresent(classMetadata['decorators'])) {
                annotations = this.simplify(type.moduleId, classMetadata['decorators'], false);
            }
            else {
                annotations = [];
            }
            this.annotationCache.set(type, annotations.filter(function (ann) { return lang_1.isPresent(ann); }));
        }
        return annotations;
    };
    StaticReflector.prototype.propMetadata = function (type) {
        var _this = this;
        var propMetadata = this.propertyCache.get(type);
        if (!lang_1.isPresent(propMetadata)) {
            var classMetadata = this.getTypeMetadata(type);
            var members = lang_1.isPresent(classMetadata) ? classMetadata['members'] : {};
            propMetadata = mapStringMap(members, function (propData, propName) {
                var prop = propData.find(function (a) { return a['__symbolic'] == 'property'; });
                if (lang_1.isPresent(prop) && lang_1.isPresent(prop['decorators'])) {
                    return _this.simplify(type.moduleId, prop['decorators'], false);
                }
                else {
                    return [];
                }
            });
            this.propertyCache.set(type, propMetadata);
        }
        return propMetadata;
    };
    StaticReflector.prototype.parameters = function (type) {
        var parameters = this.parameterCache.get(type);
        if (!lang_1.isPresent(parameters)) {
            var classMetadata = this.getTypeMetadata(type);
            var members = lang_1.isPresent(classMetadata) ? classMetadata['members'] : null;
            var ctorData = lang_1.isPresent(members) ? members['__ctor__'] : null;
            if (lang_1.isPresent(ctorData)) {
                var ctor = ctorData.find(function (a) { return a['__symbolic'] == 'constructor'; });
                var parameterTypes = this.simplify(type.moduleId, ctor['parameters'], false);
                var parameterDecorators_1 = this.simplify(type.moduleId, ctor['parameterDecorators'], false);
                parameters = [];
                collection_1.ListWrapper.forEachWithIndex(parameterTypes, function (paramType, index) {
                    var nestedResult = [];
                    if (lang_1.isPresent(paramType)) {
                        nestedResult.push(paramType);
                    }
                    var decorators = lang_1.isPresent(parameterDecorators_1) ? parameterDecorators_1[index] : null;
                    if (lang_1.isPresent(decorators)) {
                        collection_1.ListWrapper.addAll(nestedResult, decorators);
                    }
                    parameters.push(nestedResult);
                });
            }
            if (!lang_1.isPresent(parameters)) {
                parameters = [];
            }
            this.parameterCache.set(type, parameters);
        }
        return parameters;
    };
    StaticReflector.prototype.registerDecoratorOrConstructor = function (type, ctor, crossModuleProps) {
        var _this = this;
        if (crossModuleProps === void 0) { crossModuleProps = lang_1.CONST_EXPR([]); }
        this.conversionMap.set(type, function (moduleContext, args) {
            var argValues = [];
            collection_1.ListWrapper.forEachWithIndex(args, function (arg, index) {
                var argValue;
                if (lang_1.isStringMap(arg) && lang_1.isBlank(arg['__symbolic'])) {
                    argValue =
                        mapStringMap(arg, function (value, key) { return _this.simplify(moduleContext, value, crossModuleProps.indexOf(key) !== -1); });
                }
                else {
                    argValue = _this.simplify(moduleContext, arg, crossModuleProps.indexOf(index) !== -1);
                }
                argValues.push(argValue);
            });
            return lang_1.FunctionWrapper.apply(reflection_1.reflector.factory(ctor), argValues);
        });
    };
    StaticReflector.prototype.initializeConversionMap = function () {
        var coreDecorators = this.host.resolveModule('angular2/src/core/metadata');
        var diDecorators = this.host.resolveModule('angular2/src/core/di/decorators');
        var diMetadata = this.host.resolveModule('angular2/src/core/di/metadata');
        var provider = this.host.resolveModule('angular2/src/core/di/provider');
        this.registerDecoratorOrConstructor(this.getStaticType(provider, 'Provider'), provider_1.Provider);
        this.registerDecoratorOrConstructor(this.getStaticType(diDecorators, 'Host'), metadata_2.HostMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(diDecorators, 'Injectable'), metadata_2.InjectableMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(diDecorators, 'Self'), metadata_2.SelfMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(diDecorators, 'SkipSelf'), metadata_2.SkipSelfMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(diDecorators, 'Inject'), metadata_2.InjectMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(diDecorators, 'Optional'), metadata_2.OptionalMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(coreDecorators, 'Attribute'), metadata_1.AttributeMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(coreDecorators, 'Query'), metadata_1.QueryMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(coreDecorators, 'ViewQuery'), metadata_1.ViewQueryMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(coreDecorators, 'ContentChild'), metadata_1.ContentChildMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(coreDecorators, 'ContentChildren'), metadata_1.ContentChildrenMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(coreDecorators, 'ViewChild'), metadata_1.ViewChildMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(coreDecorators, 'ViewChildren'), metadata_1.ViewChildrenMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(coreDecorators, 'Input'), metadata_1.InputMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(coreDecorators, 'Output'), metadata_1.OutputMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(coreDecorators, 'Pipe'), metadata_1.PipeMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(coreDecorators, 'HostBinding'), metadata_1.HostBindingMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(coreDecorators, 'HostListener'), metadata_1.HostListenerMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(coreDecorators, 'Directive'), metadata_1.DirectiveMetadata, ['bindings', 'providers']);
        this.registerDecoratorOrConstructor(this.getStaticType(coreDecorators, 'Component'), metadata_1.ComponentMetadata, ['bindings', 'providers', 'directives', 'pipes']);
        // Note: Some metadata classes can be used directly with Provider.deps.
        this.registerDecoratorOrConstructor(this.getStaticType(diMetadata, 'HostMetadata'), metadata_2.HostMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(diMetadata, 'SelfMetadata'), metadata_2.SelfMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(diMetadata, 'SkipSelfMetadata'), metadata_2.SkipSelfMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(diMetadata, 'OptionalMetadata'), metadata_2.OptionalMetadata);
    };
    /** @internal */
    StaticReflector.prototype.simplify = function (moduleContext, value, crossModules) {
        var _this = this;
        function simplify(expression) {
            if (lang_1.isPrimitive(expression)) {
                return expression;
            }
            if (lang_1.isArray(expression)) {
                var result = [];
                for (var _i = 0, _a = expression; _i < _a.length; _i++) {
                    var item = _a[_i];
                    result.push(simplify(item));
                }
                return result;
            }
            if (lang_1.isPresent(expression)) {
                if (lang_1.isPresent(expression['__symbolic'])) {
                    switch (expression['__symbolic']) {
                        case "binop":
                            var left = simplify(expression['left']);
                            var right = simplify(expression['right']);
                            switch (expression['operator']) {
                                case '&&':
                                    return left && right;
                                case '||':
                                    return left || right;
                                case '|':
                                    return left | right;
                                case '^':
                                    return left ^ right;
                                case '&':
                                    return left & right;
                                case '==':
                                    return left == right;
                                case '!=':
                                    return left != right;
                                case '===':
                                    return left === right;
                                case '!==':
                                    return left !== right;
                                case '<':
                                    return left < right;
                                case '>':
                                    return left > right;
                                case '<=':
                                    return left <= right;
                                case '>=':
                                    return left >= right;
                                case '<<':
                                    return left << right;
                                case '>>':
                                    return left >> right;
                                case '+':
                                    return left + right;
                                case '-':
                                    return left - right;
                                case '*':
                                    return left * right;
                                case '/':
                                    return left / right;
                                case '%':
                                    return left % right;
                            }
                            return null;
                        case "pre":
                            var operand = simplify(expression['operand']);
                            switch (expression['operator']) {
                                case '+':
                                    return operand;
                                case '-':
                                    return -operand;
                                case '!':
                                    return !operand;
                                case '~':
                                    return ~operand;
                            }
                            return null;
                        case "index":
                            var indexTarget = simplify(expression['expression']);
                            var index = simplify(expression['index']);
                            if (lang_1.isPresent(indexTarget) && lang_1.isPrimitive(index))
                                return indexTarget[index];
                            return null;
                        case "select":
                            var selectTarget = simplify(expression['expression']);
                            var member = simplify(expression['member']);
                            if (lang_1.isPresent(selectTarget) && lang_1.isPrimitive(member))
                                return selectTarget[member];
                            return null;
                        case "reference":
                            var referenceModuleName = void 0;
                            var declarationPath = moduleContext;
                            var declaredName = expression['name'];
                            if (lang_1.isPresent(expression['module'])) {
                                referenceModuleName = _this.host.resolveModule(expression['module'], moduleContext);
                                var decl_1 = _this.host.findDeclaration(referenceModuleName, expression['name']);
                                declarationPath = decl_1['declarationPath'];
                                declaredName = decl_1['declaredName'];
                            }
                            var result = void 0;
                            if (crossModules || lang_1.isBlank(expression['module'])) {
                                var moduleMetadata = _this.getModuleMetadata(declarationPath);
                                var declarationValue = moduleMetadata['metadata'][declaredName];
                                if (isClassMetadata(declarationValue)) {
                                    result = _this.getStaticType(declarationPath, declaredName);
                                }
                                else {
                                    result = _this.simplify(declarationPath, declarationValue, crossModules);
                                }
                            }
                            else {
                                result = _this.getStaticType(declarationPath, declaredName);
                            }
                            return result;
                        case "new":
                        case "call":
                            var target = expression['expression'];
                            var moduleId = _this.host.resolveModule(target['module'], moduleContext);
                            var decl = _this.host.findDeclaration(moduleId, target['name']);
                            var staticType = _this.getStaticType(decl['declarationPath'], decl['declaredName']);
                            var converter = _this.conversionMap.get(staticType);
                            var args = expression['arguments'];
                            if (lang_1.isBlank(args)) {
                                args = [];
                            }
                            return lang_1.isPresent(converter) ? converter(moduleContext, args) : null;
                    }
                    return null;
                }
                return mapStringMap(expression, function (value, name) { return simplify(value); });
            }
            return null;
        }
        return simplify(value);
    };
    /**
     * @param module an absolute path to a module file.
     */
    StaticReflector.prototype.getModuleMetadata = function (module) {
        var moduleMetadata = this.metadataCache.get(module);
        if (!lang_1.isPresent(moduleMetadata)) {
            moduleMetadata = this.host.getMetadataFor(module);
            if (!lang_1.isPresent(moduleMetadata)) {
                moduleMetadata = { __symbolic: "module", module: module, metadata: {} };
            }
            this.metadataCache.set(module, moduleMetadata);
        }
        return moduleMetadata;
    };
    StaticReflector.prototype.getTypeMetadata = function (type) {
        var moduleMetadata = this.getModuleMetadata(type.moduleId);
        var result = moduleMetadata['metadata'][type.name];
        if (!lang_1.isPresent(result)) {
            result = { __symbolic: "class" };
        }
        return result;
    };
    return StaticReflector;
}());
exports.StaticReflector = StaticReflector;
function isClassMetadata(expression) {
    return !lang_1.isPrimitive(expression) && !lang_1.isArray(expression) && expression['__symbolic'] == 'class';
}
function mapStringMap(input, transform) {
    if (lang_1.isBlank(input))
        return {};
    var result = {};
    collection_1.StringMapWrapper.keys(input).forEach(function (key) { result[key] = transform(input[key], key); });
    return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdGljX3JlZmxlY3Rvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRpZmZpbmdfcGx1Z2luX3dyYXBwZXItb3V0cHV0X3BhdGgtZTdlTTd6d0UudG1wL2FuZ3VsYXIyL3NyYy9jb21waWxlci9zdGF0aWNfcmVmbGVjdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSwyQkFBNEMsZ0NBQWdDLENBQUMsQ0FBQTtBQUM3RSxxQkFRTywwQkFBMEIsQ0FBQyxDQUFBO0FBQ2xDLHlCQWdCTyw0QkFBNEIsQ0FBQyxDQUFBO0FBRXBDLDJCQUF3Qix5Q0FBeUMsQ0FBQyxDQUFBO0FBQ2xFLHlCQUF1QiwrQkFBK0IsQ0FBQyxDQUFBO0FBQ3ZELHlCQU9PLCtCQUErQixDQUFDLENBQUE7QUE0QnZDOzs7O0dBSUc7QUFDSDtJQUNFLG9CQUFtQixRQUFnQixFQUFTLElBQVk7UUFBckMsYUFBUSxHQUFSLFFBQVEsQ0FBUTtRQUFTLFNBQUksR0FBSixJQUFJLENBQVE7SUFBRyxDQUFDO0lBQzlELGlCQUFDO0FBQUQsQ0FBQyxBQUZELElBRUM7QUFGWSxrQkFBVSxhQUV0QixDQUFBO0FBRUQ7OztHQUdHO0FBQ0g7SUFRRSx5QkFBb0IsSUFBeUI7UUFBekIsU0FBSSxHQUFKLElBQUksQ0FBcUI7UUFQckMsY0FBUyxHQUFHLElBQUksR0FBRyxFQUFzQixDQUFDO1FBQzFDLG9CQUFlLEdBQUcsSUFBSSxHQUFHLEVBQXFCLENBQUM7UUFDL0Msa0JBQWEsR0FBRyxJQUFJLEdBQUcsRUFBb0MsQ0FBQztRQUM1RCxtQkFBYyxHQUFHLElBQUksR0FBRyxFQUFxQixDQUFDO1FBQzlDLGtCQUFhLEdBQUcsSUFBSSxHQUFHLEVBQWdDLENBQUM7UUFDeEQsa0JBQWEsR0FBRyxJQUFJLEdBQUcsRUFBMkQsQ0FBQztRQUUxQyxJQUFJLENBQUMsdUJBQXVCLEVBQUUsQ0FBQztJQUFDLENBQUM7SUFFbEYsbUNBQVMsR0FBVCxVQUFVLFVBQWUsSUFBWSxNQUFNLENBQWMs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QUUsT0FBTyxFQUFDLENBQUM7UUFDakMsQ0FBQztRQUNELE1BQU0sQ0FBQyxNQUFNLENBQUM7SUFDaEIsQ0FBQztJQUNILHNCQUFDO0FBQUQsQ0FBQyxBQXBVRCxJQW9VQztBQXBVWSx1QkFBZSxrQkFvVTNCLENBQUE7QUFFRCx5QkFBeUIsVUFBZTtJQUN0QyxNQUFNLENBQUMsQ0FBQyxrQkFBVyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsY0FBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxZQUFZLENBQUMsSUFBSSxPQUFPLENBQUM7QUFDakcsQ0FBQztBQUVELHNCQUFzQixLQUEyQixFQUMzQixTQUEyQztJQUMvRCxFQUFFLENBQUMsQ0FBQyxjQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7UUFBQyxNQUFNLENBQUMsRUFBRSxDQUFDO0lBQzlCLElBQUksTUFBTSxHQUFHLEVBQUUsQ0FBQztJQUNoQiw2QkFBZ0IsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQUMsR0FBRyxJQUFPLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxTQUFTLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDN0YsTUFBTSxDQUFDLE1BQU0sQ0FBQztBQUNoQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtTdHJpbmdNYXBXcmFwcGVyLCBMaXN0V3JhcHBlcn0gZnJvbSAnYW5ndWxhcjIvc3JjL2ZhY2FkZS9jb2xsZWN0aW9uJztcbmltcG9ydCB7XG4gIGlzQXJyYXksXG4gIGlzUHJlc2VudCxcbiAgaXNCbGFuayxcbiAgaXNQcmltaXRpdmUsXG4gIGlzU3RyaW5nTWFwLFxuICBDT05TVF9FWFBSLFxuICBGdW5jdGlvbldyYXBwZXJcbn0gZnJvbSAnYW5ndWxhcjIvc3JjL2ZhY2FkZS9sYW5nJztcbmltcG9ydCB7XG4gIEF0dHJpYnV0ZU1ldGFkYXRhLFxuICBEaXJlY3RpdmVNZXRhZGF0YSxcbiAgQ29tcG9uZW50TWV0YWRhdGEsXG4gIENvbnRlbnRDaGlsZHJlbk1ldGFkYXRhLFxuICBDb250ZW50Q2hpbGRNZXRhZGF0YSxcbiAgSW5wdXRNZXRhZGF0YSxcbiAgSG9zdEJpbmRpbmdNZXRhZGF0YSxcbiAgSG9zdExpc3RlbmVyTWV0YWRhdGEsXG4gIE91dHB1dE1ldGFkYXRhLFxuICBQaXBlTWV0YWRhdGEsXG4gIFZpZXdNZXRhZGF0YSxcbiAgVmlld0NoaWxkTWV0YWRhdGEsXG4gIFZpZXdDaGlsZHJlbk1ldGFkYXRhLFxuICBWaWV3UXVlcnlNZXRhZGF0YSxcbiAgUXVlcnlNZXRhZGF0YSxcbn0gZnJvbSAnYW5ndWxhcjIvc3JjL2NvcmUvbWV0YWRhdGEnO1xuaW1wb3J0IHtSZWZsZWN0b3JSZWFkZXJ9IGZyb20gJ2FuZ3VsYXIyL3NyYy9jb3JlL3JlZmxlY3Rpb24vcmVmbGVjdG9yX3JlYWRlcic7XG5pbXBvcnQge3JlZmxlY3Rvcn0gZnJvbSAnYW5ndWxhcjIvc3JjL2NvcmUvcmVmbGVjdGlvbi9yZWZsZWN0aW9uJztcbmltcG9ydCB7UHJvdmlkZXJ9IGZyb20gJ2FuZ3VsYXIyL3NyYy9jb3JlL2RpL3Byb3ZpZGVyJztcbmltcG9ydCB7XG4gIEhvc3RNZXRhZGF0YSxcbiAgT3B0aW9uYWxNZXRhZGF0YSxcbiAgSW5qZWN0YWJsZU1ldGFkYXRhLFxuICBTZWxmTWV0YWRhdGEsXG4gIFNraXBTZWxmTWV0YWRhdGEsXG4gIEluamVjdE1ldGFkYXRhXG59IGZyb20gXCJhbmd1bGFyMi9zcmMvY29yZS9kaS9tZXRhZGF0YVwiO1xuXG4vKipcbiAqIFRoZSBob3N0IG9mIHRoZSBzdGF0aWMgcmVzb2x2ZXIgaXMgZXhwZWN0ZWQgdG8gYmUgYWJsZSB0byBwcm92aWRlIG1vZHVsZSBtZXRhZGF0YSBpbiB0aGUgZm9ybSBvZlxuICogTW9kdWxlTWV0YWRhdGEuIEFuZ3VsYXIgMiBDTEkgd2lsbCBwcm9kdWNlIHRoaXMgbWV0YWRhdGEgZm9yIGEgbW9kdWxlIHdoZW5ldmVyIGEgLmQudHMgZmlsZXMgaXNcbiAqIHByb2R1Y2VkIGFuZCB0aGUgbW9kdWxlIGhhcyBleHBvcnRlZCB2YXJpYWJsZXMgb3IgY2xhc3NlcyB3aXRoIGRlY29yYXRvcnMuIE1vZHVsZSBtZXRhZGF0YSBjYW5cbiAqIGFsc28gYmUgcHJvZHVjZWQgZGlyZWN0bHkgZnJvbSBUeXBlU2NyaXB0IHNvdXJjZXMgYnkgdXNpbmcgTWV0YWRhdGFDb2xsZWN0b3IgaW4gdG9vbHMvbWV0YWRhdGEuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU3RhdGljUmVmbGVjdG9ySG9zdCB7XG4gIC8qKlxuICAgKiAgUmV0dXJuIGEgTW9kdWxlTWV0YWRhdGEgZm9yIHRoZSBnaXZlbiBtb2R1bGUuXG4gICAqXG4gICAqIEBwYXJhbSBtb2R1bGVJZCBpcyBhIHN0cmluZyBpZGVudGlmaWVyIGZvciBhIG1vZHVsZSBhcyBhbiBhYnNvbHV0ZSBwYXRoLlxuICAgKiBAcmV0dXJucyB0aGUgbWV0YWRhdGEgZm9yIHRoZSBnaXZlbiBtb2R1bGUuXG4gICAqL1xuICBnZXRNZXRhZGF0YUZvcihtb2R1bGVQYXRoOiBzdHJpbmcpOiB7W2tleTogc3RyaW5nXTogYW55fTtcblxuICAvKipcbiAgICogUmVzb2x2ZSBhIG1vZHVsZSBmcm9tIGFuIGltcG9ydCBzdGF0ZW1lbnQgZm9ybSB0byBhbiBhYnNvbHV0ZSBwYXRoLlxuICAgKiBAcGFyYW0gbW9kdWxlTmFtZSB0aGUgbG9jYXRpb24gaW1wb3J0ZWQgZnJvbVxuICAgKiBAcGFyYW0gY29udGFpbmluZ0ZpbGUgZm9yIHJlbGF0aXZlIGltcG9ydHMsIHRoZSBwYXRoIG9mIHRoZSBmaWxlIGNvbnRhaW5pbmcgdGhlIGltcG9ydFxuICAgKi9cbiAgcmVzb2x2ZU1vZHVsZShtb2R1bGVOYW1lOiBzdHJpbmcsIGNvbnRhaW5pbmdGaWxlPzogc3RyaW5nKTogc3RyaW5nO1xuXG4gIGZpbmREZWNsYXJhdGlvbihtb2R1bGVQYXRoOiBzdHJpbmcsXG4gICAgICAgICAgICAgICAgICBzeW1ib2xOYW1lOiBzdHJpbmcpOiB7ZGVjbGFyYXRpb25QYXRoOiBzdHJpbmcsIGRlY2xhcmVkTmFtZTogc3RyaW5nfTtcbn1cblxuLyoqXG4gKiBBIHRva2VuIHJlcHJlc2VudGluZyB0aGUgYSByZWZlcmVuY2UgdG8gYSBzdGF0aWMgdHlwZS5cbiAqXG4gKiBUaGlzIHRva2VuIGlzIHVuaXF1ZSBmb3IgYSBtb2R1bGVJZCBhbmQgbmFtZSBhbmQgY2FuIGJlIHVzZWQgYXMgYSBoYXNoIHRhYmxlIGtleS5cbiAqL1xuZXhwb3J0IGNsYXNzIFN0YXRpY1R5cGUge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgbW9kdWxlSWQ6IHN0cmluZywgcHVibGljIG5hbWU6IHN0cmluZykge31cbn1cblxuLyoqXG4gKiBBIHN0YXRpYyByZWZsZWN0b3IgaW1wbGVtZW50cyBlbm91Z2ggb2YgdGhlIFJlZmxlY3RvciBBUEkgdGhhdCBpcyBuZWNlc3NhcnkgdG8gY29tcGlsZVxuICogdGVtcGxhdGVzIHN0YXRpY2FsbHkuXG4gKi9cbmV4cG9ydCBjbGFzcyBTdGF0aWNSZWZsZWN0b3IgaW1wbGVtZW50cyBSZWZsZWN0b3JSZWFkZXIge1xuICBwcml2YXRlIHR5cGVDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBTdGF0aWNUeXBlPigpO1xuICBwcml2YXRlIGFubm90YXRpb25DYWNoZSA9IG5ldyBNYXA8U3RhdGljVHlwZSwgYW55W10+KCk7XG4gIHByaXZhdGUgcHJvcGVydHlDYWNoZSA9IG5ldyBNYXA8U3RhdGljVHlwZSwge1trZXk6IHN0cmluZ106IGFueX0+KCk7XG4gIHByaXZhdGUgcGFyYW1ldGVyQ2FjaGUgPSBuZXcgTWFwPFN0YXRpY1R5cGUsIGFueVtdPigpO1xuICBwcml2YXRlIG1ldGFkYXRhQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywge1trZXk6IHN0cmluZ106IGFueX0+KCk7XG4gIHByaXZhdGUgY29udmVyc2lvbk1hcCA9IG5ldyBNYXA8U3RhdGljVHlwZSwgKG1vZHVsZUNvbnRleHQ6IHN0cmluZywgYXJnczogYW55W10pID0+IGFueT4oKTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGhvc3Q6IFN0YXRpY1JlZmxlY3Rvckhvc3QpIHsgdGhpcy5pbml0aWFsaXplQ29udmVyc2lvbk1hcCgpOyB9XG5cbiAgaW1wb3J0VXJpKHR5cGVPckZ1bmM6IGFueSk6IHN0cmluZyB7IHJldHVybiAoPFN0YXRpY1R5cGU+dHlwZU9yRnVuYykubW9kdWxlSWQ7IH1cblxuICAvKipcbiAgICogZ2V0U3RhdGljVHlwZSBwcm9kdWNlcyBhIFR5cGUgd2hvc2UgbWV0YWRhdGEgaXMga25vd24gYnV0IHdob3NlIGltcGxlbWVudGF0aW9uIGlzIG5vdCBsb2FkZWQuXG4gICAqIEFsbCB0eXBlcyBwYXNzZWQgdG8gdGhlIFN0YXRpY1Jlc29sdmVyIHNob3VsZCBiZSBwc2V1ZG8tdHlwZXMgcmV0dXJuZWQgYnkgdGhpcyBtZXRob2QuXG4gICAqXG4gICAqIEBwYXJhbSBtb2R1bGVJZCB0aGUgbW9kdWxlIGlkZW50aWZpZXIgYXMgYW4gYWJzb2x1dGUgcGF0aC5cbiAgICogQHBhcmFtIG5hbWUgdGhlIG5hbWUgb2YgdGhlIHR5cGUuXG4gICAqL1xuICBwdWJsaWMgZ2V0U3RhdGljVHlwZShtb2R1bGVJZDogc3RyaW5nLCBuYW1lOiBzdHJpbmcpOiBTdGF0aWNUeXBlIHtcbiAgICBsZXQga2V5ID0gYFwiJHttb2R1bGVJZH1cIi4ke25hbWV9YDtcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy50eXBlQ2FjaGUuZ2V0KGtleSk7XG4gICAgaWYgKCFpc1ByZXNlbnQocmVzdWx0KSkge1xuICAgICAgcmVzdWx0ID0gbmV3IFN0YXRpY1R5cGUobW9kdWxlSWQsIG5hbWUpO1xuICAgICAgdGhpcy50eXBlQ2FjaGUuc2V0KGtleSwgcmVzdWx0KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHB1YmxpYyBhbm5vdGF0aW9ucyh0eXBlOiBTdGF0aWNUeXBlKTogYW55W10ge1xuICAgIGxldCBhbm5vdGF0aW9ucyA9IHRoaXMuYW5ub3RhdGlvbkNhY2hlLmdldCh0eXBlKTtcbiAgICBpZiAoIWlzUHJlc2VudChhbm5vdGF0aW9ucykpIHtcbiAgICAgIGxldCBjbGFzc01ldGFkYXRhID0gdGhpcy5nZXRUeXBlTWV0YWRhdGEodHlwZSk7XG4gICAgICBpZiAoaXNQcmVzZW50KGNsYXNzTWV0YWRhdGFbJ2RlY29yYXRvcnMnXSkpIHtcbiAgICAgICAgYW5ub3RhdGlvbnMgPSB0aGlzLnNpbXBsaWZ5KHR5cGUubW9kdWxlSWQsIGNsYXNzTWV0YWRhdGFbJ2RlY29yYXRvcnMnXSwgZmFsc2UpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYW5ub3RhdGlvbnMgPSBbXTtcbiAgICAgIH1cbiAgICAgIHRoaXMuYW5ub3RhdGlvbkNhY2hlLnNldCh0eXBlLCBhbm5vdGF0aW9ucy5maWx0ZXIoYW5uID0+IGlzUHJlc2VudChhbm4pKSk7XG4gICAgfVxuICAgIHJldHVybiBhbm5vdGF0aW9ucztcbiAgfVxuXG4gIHB1YmxpYyBwcm9wTWV0YWRhdGEodHlwZTogU3RhdGljVHlwZSk6IHtba2V5OiBzdHJpbmddOiBhbnl9IHtcbiAgICBsZXQgcHJvcE1ldGFkYXRhID0gdGhpcy5wcm9wZXJ0eUNhY2hlLmdldCh0eXBlKTtcbiAgICBpZiAoIWlzUHJlc2VudChwcm9wTWV0YWRhdGEpKSB7XG4gICAgICBsZXQgY2xhc3NNZXRhZGF0YSA9IHRoaXMuZ2V0VHlwZU1ldGFkYXRhKHR5cGUpO1xuICAgICAgbGV0IG1lbWJlcnMgPSBpc1ByZXNlbnQoY2xhc3NNZXRhZGF0YSkgPyBjbGFzc01ldGFkYXRhWydtZW1iZXJzJ10gOiB7fTtcbiAgICAgIHByb3BNZXRhZGF0YSA9IG1hcFN0cmluZ01hcChtZW1iZXJzLCAocHJvcERhdGEsIHByb3BOYW1lKSA9PiB7XG4gICAgICAgIGxldCBwcm9wID0gKDxhbnlbXT5wcm9wRGF0YSkuZmluZChhID0+IGFbJ19fc3ltYm9saWMnXSA9PSAncHJvcGVydHknKTtcbiAgICAgICAgaWYgKGlzUHJlc2VudChwcm9wKSAmJiBpc1ByZXNlbnQocHJvcFsnZGVjb3JhdG9ycyddKSkge1xuICAgICAgICAgIHJldHVybiB0aGlzLnNpbXBsaWZ5KHR5cGUubW9kdWxlSWQsIHByb3BbJ2RlY29yYXRvcnMnXSwgZmFsc2UpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICB0aGlzLnByb3BlcnR5Q2FjaGUuc2V0KHR5cGUsIHByb3BNZXRhZGF0YSk7XG4gICAgfVxuICAgIHJldHVybiBwcm9wTWV0YWRhdGE7XG4gIH1cblxuICBwdWJsaWMgcGFyYW1ldGVycyh0eXBlOiBTdGF0aWNUeXBlKTogYW55W10ge1xuICAgIGxldCBwYXJhbWV0ZXJzID0gdGhpcy5wYXJhbWV0ZXJDYWNoZS5nZXQodHlwZSk7XG4gICAgaWYgKCFpc1ByZXNlbnQocGFyYW1ldGVycykpIHtcbiAgICAgIGxldCBjbGFzc01ldGFkYXRhID0gdGhpcy5nZXRUeXBlTWV0YWRhdGEodHlwZSk7XG4gICAgICBsZXQgbWVtYmVycyA9IGlzUHJlc2VudChjbGFzc01ldGFkYXRhKSA/IGNsYXNzTWV0YWRhdGFbJ21lbWJlcnMnXSA6IG51bGw7XG4gICAgICBsZXQgY3RvckRhdGEgPSBpc1ByZXNlbnQobWVtYmVycykgPyBtZW1iZXJzWydfX2N0b3JfXyddIDogbnVsbDtcbiAgICAgIGlmIChpc1ByZXNlbnQoY3RvckRhdGEpKSB7XG4gICAgICAgIGxldCBjdG9yID0gKDxhbnlbXT5jdG9yRGF0YSkuZmluZChhID0+IGFbJ19fc3ltYm9saWMnXSA9PSAnY29uc3RydWN0b3InKTtcbiAgICAgICAgbGV0IHBhcmFtZXRlclR5cGVzID0gPGFueVtdPnRoaXMuc2ltcGxpZnkodHlwZS5tb2R1bGVJZCwgY3RvclsncGFyYW1ldGVycyddLCBmYWxzZSk7XG4gICAgICAgIGxldCBwYXJhbWV0ZXJEZWNvcmF0b3JzID1cbiAgICAgICAgICAgIDxhbnlbXT50aGlzLnNpbXBsaWZ5KHR5cGUubW9kdWxlSWQsIGN0b3JbJ3BhcmFtZXRlckRlY29yYXRvcnMnXSwgZmFsc2UpO1xuXG4gICAgICAgIHBhcmFtZXRlcnMgPSBbXTtcbiAgICAgICAgTGlzdFdyYXBwZXIuZm9yRWFjaFdpdGhJbmRleChwYXJhbWV0ZXJUeXBlcywgKHBhcmFtVHlwZSwgaW5kZXgpID0+IHtcbiAgICAgICAgICBsZXQgbmVzdGVkUmVzdWx0ID0gW107XG4gICAgICAgICAgaWYgKGlzUHJlc2VudChwYXJhbVR5cGUpKSB7XG4gICAgICAgICAgICBuZXN0ZWRSZXN1bHQucHVzaChwYXJhbVR5cGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBsZXQgZGVjb3JhdG9ycyA9IGlzUHJlc2VudChwYXJhbWV0ZXJEZWNvcmF0b3JzKSA/IHBhcmFtZXRlckRlY29yYXRvcnNbaW5kZXhdIDogbnVsbDtcbiAgICAgICAgICBpZiAoaXNQcmVzZW50KGRlY29yYXRvcnMpKSB7XG4gICAgICAgICAgICBMaXN0V3JhcHBlci5hZGRBbGwobmVzdGVkUmVzdWx0LCBkZWNvcmF0b3JzKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcGFyYW1ldGVycy5wdXNoKG5lc3RlZFJlc3VsdCk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgaWYgKCFpc1ByZXNlbnQocGFyYW1ldGVycykpIHtcbiAgICAgICAgcGFyYW1ldGVycyA9IFtdO1xuICAgICAgfVxuICAgICAgdGhpcy5wYXJhbWV0ZXJDYWNoZS5zZXQodHlwZSwgcGFyYW1ldGVycyk7XG4gICAgfVxuICAgIHJldHVybiBwYXJhbWV0ZXJzO1xuICB9XG5cbiAgcHJpdmF0ZSByZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IodHlwZTogU3RhdGljVHlwZSwgY3RvcjogYW55LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjcm9zc01vZHVsZVByb3BzOiBhbnlbXSA9IENPTlNUX0VYUFIoW10pKTogdm9pZCB7XG4gICAgdGhpcy5jb252ZXJzaW9uTWFwLnNldCh0eXBlLCAobW9kdWxlQ29udGV4dDogc3RyaW5nLCBhcmdzOiBhbnlbXSkgPT4ge1xuICAgICAgbGV0IGFyZ1ZhbHVlcyA9IFtdO1xuICAgICAgTGlzdFdyYXBwZXIuZm9yRWFjaFdpdGhJbmRleChhcmdzLCAoYXJnLCBpbmRleCkgPT4ge1xuICAgICAgICBsZXQgYXJnVmFsdWU7XG4gICAgICAgIGlmIChpc1N0cmluZ01hcChhcmcpICYmIGlzQmxhbmsoYXJnWydfX3N5bWJvbGljJ10pKSB7XG4gICAgICAgICAgYXJnVmFsdWUgPVxuICAgICAgICAgICAgICBtYXBTdHJpbmdNYXAoYXJnLCAodmFsdWUsIGtleSkgPT4gdGhpcy5zaW1wbGlmeShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1vZHVsZUNvbnRleHQsIHZhbHVlLCBjcm9zc01vZHVsZVByb3BzLmluZGV4T2Yoa2V5KSAhPT0gLTEpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBhcmdWYWx1ZSA9IHRoaXMuc2ltcGxpZnkobW9kdWxlQ29udGV4dCwgYXJnLCBjcm9zc01vZHVsZVByb3BzLmluZGV4T2YoaW5kZXgpICE9PSAtMSk7XG4gICAgICAgIH1cbiAgICAgICAgYXJnVmFsdWVzLnB1c2goYXJnVmFsdWUpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gRnVuY3Rpb25XcmFwcGVyLmFwcGx5KHJlZmxlY3Rvci5mYWN0b3J5KGN0b3IpLCBhcmdWYWx1ZXMpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBpbml0aWFsaXplQ29udmVyc2lvbk1hcCgpOiB2b2lkIHtcbiAgICBsZXQgY29yZURlY29yYXRvcnMgPSB0aGlzLmhvc3QucmVzb2x2ZU1vZHVsZSgnYW5ndWxhcjIvc3JjL2NvcmUvbWV0YWRhdGEnKTtcbiAgICBsZXQgZGlEZWNvcmF0b3JzID0gdGhpcy5ob3N0LnJlc29sdmVNb2R1bGUoJ2FuZ3VsYXIyL3NyYy9jb3JlL2RpL2RlY29yYXRvcnMnKTtcbiAgICBsZXQgZGlNZXRhZGF0YSA9IHRoaXMuaG9zdC5yZXNvbHZlTW9kdWxlKCdhbmd1bGFyMi9zcmMvY29yZS9kaS9tZXRhZGF0YScpO1xuXG4gICAgbGV0IHByb3ZpZGVyID0gdGhpcy5ob3N0LnJlc29sdmVNb2R1bGUoJ2FuZ3VsYXIyL3NyYy9jb3JlL2RpL3Byb3ZpZGVyJyk7XG4gICAgdGhpcy5yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IodGhpcy5nZXRTdGF0aWNUeXBlKHByb3ZpZGVyLCAnUHJvdmlkZXInKSwgUHJvdmlkZXIpO1xuXG4gICAgdGhpcy5yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IodGhpcy5nZXRTdGF0aWNUeXBlKGRpRGVjb3JhdG9ycywgJ0hvc3QnKSwgSG9zdE1ldGFkYXRhKTtcbiAgICB0aGlzLnJlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3Rvcih0aGlzLmdldFN0YXRpY1R5cGUoZGlEZWNvcmF0b3JzLCAnSW5qZWN0YWJsZScpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEluamVjdGFibGVNZXRhZGF0YSk7XG4gICAgdGhpcy5yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IodGhpcy5nZXRTdGF0aWNUeXBlKGRpRGVjb3JhdG9ycywgJ1NlbGYnKSwgU2VsZk1ldGFkYXRhKTtcbiAgICB0aGlzLnJlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3Rvcih0aGlzLmdldFN0YXRpY1R5cGUoZGlEZWNvcmF0b3JzLCAnU2tpcFNlbGYnKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBTa2lwU2VsZk1ldGFkYXRhKTtcbiAgICB0aGlzLnJlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3Rvcih0aGlzLmdldFN0YXRpY1R5cGUoZGlEZWNvcmF0b3JzLCAnSW5qZWN0JyksIEluamVjdE1ldGFkYXRhKTtcbiAgICB0aGlzLnJlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3Rvcih0aGlzLmdldFN0YXRpY1R5cGUoZGlEZWNvcmF0b3JzLCAnT3B0aW9uYWwnKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBPcHRpb25hbE1ldGFkYXRhKTtcbiAgICB0aGlzLnJlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3Rvcih0aGlzLmdldFN0YXRpY1R5cGUoY29yZURlY29yYXRvcnMsICdBdHRyaWJ1dGUnKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBBdHRyaWJ1dGVNZXRhZGF0YSk7XG4gICAgdGhpcy5yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IodGhpcy5nZXRTdGF0aWNUeXBlKGNvcmVEZWNvcmF0b3JzLCAnUXVlcnknKSwgUXVlcnlNZXRhZGF0YSk7XG4gICAgdGhpcy5yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IodGhpcy5nZXRTdGF0aWNUeXBlKGNvcmVEZWNvcmF0b3JzLCAnVmlld1F1ZXJ5JyksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgVmlld1F1ZXJ5TWV0YWRhdGEpO1xuICAgIHRoaXMucmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKHRoaXMuZ2V0U3RhdGljVHlwZShjb3JlRGVjb3JhdG9ycywgJ0NvbnRlbnRDaGlsZCcpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIENvbnRlbnRDaGlsZE1ldGFkYXRhKTtcbiAgICB0aGlzLnJlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3Rvcih0aGlzLmdldFN0YXRpY1R5cGUoY29yZURlY29yYXRvcnMsICdDb250ZW50Q2hpbGRyZW4nKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBDb250ZW50Q2hpbGRyZW5NZXRhZGF0YSk7XG4gICAgdGhpcy5yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IodGhpcy5nZXRTdGF0aWNUeXBlKGNvcmVEZWNvcmF0b3JzLCAnVmlld0NoaWxkJyksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgVmlld0NoaWxkTWV0YWRhdGEpO1xuICAgIHRoaXMucmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKHRoaXMuZ2V0U3RhdGljVHlwZShjb3JlRGVjb3JhdG9ycywgJ1ZpZXdDaGlsZHJlbicpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFZpZXdDaGlsZHJlbk1ldGFkYXRhKTtcbiAgICB0aGlzLnJlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3Rvcih0aGlzLmdldFN0YXRpY1R5cGUoY29yZURlY29yYXRvcnMsICdJbnB1dCcpLCBJbnB1dE1ldGFkYXRhKTtcbiAgICB0aGlzLnJlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3Rvcih0aGlzLmdldFN0YXRpY1R5cGUoY29yZURlY29yYXRvcnMsICdPdXRwdXQnKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBPdXRwdXRNZXRhZGF0YSk7XG4gICAgdGhpcy5yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IodGhpcy5nZXRTdGF0aWNUeXBlKGNvcmVEZWNvcmF0b3JzLCAnUGlwZScpLCBQaXBlTWV0YWRhdGEpO1xuICAgIHRoaXMucmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKHRoaXMuZ2V0U3RhdGljVHlwZShjb3JlRGVjb3JhdG9ycywgJ0hvc3RCaW5kaW5nJyksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgSG9zdEJpbmRpbmdNZXRhZGF0YSk7XG4gICAgdGhpcy5yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IodGhpcy5nZXRTdGF0aWNUeXBlKGNvcmVEZWNvcmF0b3JzLCAnSG9zdExpc3RlbmVyJyksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgSG9zdExpc3RlbmVyTWV0YWRhdGEpO1xuICAgIHRoaXMucmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKHRoaXMuZ2V0U3RhdGljVHlwZShjb3JlRGVjb3JhdG9ycywgJ0RpcmVjdGl2ZScpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIERpcmVjdGl2ZU1ldGFkYXRhLCBbJ2JpbmRpbmdzJywgJ3Byb3ZpZGVycyddKTtcbiAgICB0aGlzLnJlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3Rvcih0aGlzLmdldFN0YXRpY1R5cGUoY29yZURlY29yYXRvcnMsICdDb21wb25lbnQnKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBDb21wb25lbnRNZXRhZGF0YSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbJ2JpbmRpbmdzJywgJ3Byb3ZpZGVycycsICdkaXJlY3RpdmVzJywgJ3BpcGVzJ10pO1xuXG4gICAgLy8gTm90ZTogU29tZSBtZXRhZGF0YSBjbGFzc2VzIGNhbiBiZSB1c2VkIGRpcmVjdGx5IHdpdGggUHJvdmlkZXIuZGVwcy5cbiAgICB0aGlzLnJlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3Rvcih0aGlzLmdldFN0YXRpY1R5cGUoZGlNZXRhZGF0YSwgJ0hvc3RNZXRhZGF0YScpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEhvc3RNZXRhZGF0YSk7XG4gICAgdGhpcy5yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IodGhpcy5nZXRTdGF0aWNUeXBlKGRpTWV0YWRhdGEsICdTZWxmTWV0YWRhdGEnKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBTZWxmTWV0YWRhdGEpO1xuICAgIHRoaXMucmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKHRoaXMuZ2V0U3RhdGljVHlwZShkaU1ldGFkYXRhLCAnU2tpcFNlbGZNZXRhZGF0YScpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFNraXBTZWxmTWV0YWRhdGEpO1xuICAgIHRoaXMucmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKHRoaXMuZ2V0U3RhdGljVHlwZShkaU1ldGFkYXRhLCAnT3B0aW9uYWxNZXRhZGF0YScpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE9wdGlvbmFsTWV0YWRhdGEpO1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBwdWJsaWMgc2ltcGxpZnkobW9kdWxlQ29udGV4dDogc3RyaW5nLCB2YWx1ZTogYW55LCBjcm9zc01vZHVsZXM6IGJvb2xlYW4pOiBhbnkge1xuICAgIGxldCBfdGhpcyA9IHRoaXM7XG5cbiAgICBmdW5jdGlvbiBzaW1wbGlmeShleHByZXNzaW9uOiBhbnkpOiBhbnkge1xuICAgICAgaWYgKGlzUHJpbWl0aXZlKGV4cHJlc3Npb24pKSB7XG4gICAgICAgIHJldHVybiBleHByZXNzaW9uO1xuICAgICAgfVxuICAgICAgaWYgKGlzQXJyYXkoZXhwcmVzc2lvbikpIHtcbiAgICAgICAgbGV0IHJlc3VsdCA9IFtdO1xuICAgICAgICBmb3IgKGxldCBpdGVtIG9mKDxhbnk+ZXhwcmVzc2lvbikpIHtcbiAgICAgICAgICByZXN1bHQucHVzaChzaW1wbGlmeShpdGVtKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cbiAgICAgIGlmIChpc1ByZXNlbnQoZXhwcmVzc2lvbikpIHtcbiAgICAgICAgaWYgKGlzUHJlc2VudChleHByZXNzaW9uWydfX3N5bWJvbGljJ10pKSB7XG4gICAgICAgICAgc3dpdGNoIChleHByZXNzaW9uWydfX3N5bWJvbGljJ10pIHtcbiAgICAgICAgICAgIGNhc2UgXCJiaW5vcFwiOlxuICAgICAgICAgICAgICBsZXQgbGVmdCA9IHNpbXBsaWZ5KGV4cHJlc3Npb25bJ2xlZnQnXSk7XG4gICAgICAgICAgICAgIGxldCByaWdodCA9IHNpbXBsaWZ5KGV4cHJlc3Npb25bJ3JpZ2h0J10pO1xuICAgICAgICAgICAgICBzd2l0Y2ggKGV4cHJlc3Npb25bJ29wZXJhdG9yJ10pIHtcbiAgICAgICAgICAgICAgICBjYXNlICcmJic6XG4gICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCAmJiByaWdodDtcbiAgICAgICAgICAgICAgICBjYXNlICd8fCc6XG4gICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCB8fCByaWdodDtcbiAgICAgICAgICAgICAgICBjYXNlICd8JzpcbiAgICAgICAgICAgICAgICAgIHJldHVybiBsZWZ0IHwgcmlnaHQ7XG4gICAgICAgICAgICAgICAgY2FzZSAnXic6XG4gICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCBeIHJpZ2h0O1xuICAgICAgICAgICAgICAgIGNhc2UgJyYnOlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgJiByaWdodDtcbiAgICAgICAgICAgICAgICBjYXNlICc9PSc6XG4gICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCA9PSByaWdodDtcbiAgICAgICAgICAgICAgICBjYXNlICchPSc6XG4gICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCAhPSByaWdodDtcbiAgICAgICAgICAgICAgICBjYXNlICc9PT0nOlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgPT09IHJpZ2h0O1xuICAgICAgICAgICAgICAgIGNhc2UgJyE9PSc6XG4gICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCAhPT0gcmlnaHQ7XG4gICAgICAgICAgICAgICAgY2FzZSAnPCc6XG4gICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCA8IHJpZ2h0O1xuICAgICAgICAgICAgICAgIGNhc2UgJz4nOlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgPiByaWdodDtcbiAgICAgICAgICAgICAgICBjYXNlICc8PSc6XG4gICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCA8PSByaWdodDtcbiAgICAgICAgICAgICAgICBjYXNlICc+PSc6XG4gICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCA+PSByaWdodDtcbiAgICAgICAgICAgICAgICBjYXNlICc8PCc6XG4gICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCA8PCByaWdodDtcbiAgICAgICAgICAgICAgICBjYXNlICc+Pic6XG4gICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCA+PiByaWdodDtcbiAgICAgICAgICAgICAgICBjYXNlICcrJzpcbiAgICAgICAgICAgICAgICAgIHJldHVybiBsZWZ0ICsgcmlnaHQ7XG4gICAgICAgICAgICAgICAgY2FzZSAnLSc6XG4gICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCAtIHJpZ2h0O1xuICAgICAgICAgICAgICAgIGNhc2UgJyonOlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgKiByaWdodDtcbiAgICAgICAgICAgICAgICBjYXNlICcvJzpcbiAgICAgICAgICAgICAgICAgIHJldHVybiBsZWZ0IC8gcmlnaHQ7XG4gICAgICAgICAgICAgICAgY2FzZSAnJSc6XG4gICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCAlIHJpZ2h0O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgY2FzZSBcInByZVwiOlxuICAgICAgICAgICAgICBsZXQgb3BlcmFuZCA9IHNpbXBsaWZ5KGV4cHJlc3Npb25bJ29wZXJhbmQnXSk7XG4gICAgICAgICAgICAgIHN3aXRjaCAoZXhwcmVzc2lvblsnb3BlcmF0b3InXSkge1xuICAgICAgICAgICAgICAgIGNhc2UgJysnOlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIG9wZXJhbmQ7XG4gICAgICAgICAgICAgICAgY2FzZSAnLSc6XG4gICAgICAgICAgICAgICAgICByZXR1cm4gLW9wZXJhbmQ7XG4gICAgICAgICAgICAgICAgY2FzZSAnISc6XG4gICAgICAgICAgICAgICAgICByZXR1cm4gIW9wZXJhbmQ7XG4gICAgICAgICAgICAgICAgY2FzZSAnfic6XG4gICAgICAgICAgICAgICAgICByZXR1cm4gfm9wZXJhbmQ7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICBjYXNlIFwiaW5kZXhcIjpcbiAgICAgICAgICAgICAgbGV0IGluZGV4VGFyZ2V0ID0gc2ltcGxpZnkoZXhwcmVzc2lvblsnZXhwcmVzc2lvbiddKTtcbiAgICAgICAgICAgICAgbGV0IGluZGV4ID0gc2ltcGxpZnkoZXhwcmVzc2lvblsnaW5kZXgnXSk7XG4gICAgICAgICAgICAgIGlmIChpc1ByZXNlbnQoaW5kZXhUYXJnZXQpICYmIGlzUHJpbWl0aXZlKGluZGV4KSkgcmV0dXJuIGluZGV4VGFyZ2V0W2luZGV4XTtcbiAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICBjYXNlIFwic2VsZWN0XCI6XG4gICAgICAgICAgICAgIGxldCBzZWxlY3RUYXJnZXQgPSBzaW1wbGlmeShleHByZXNzaW9uWydleHByZXNzaW9uJ10pO1xuICAgICAgICAgICAgICBsZXQgbWVtYmVyID0gc2ltcGxpZnkoZXhwcmVzc2lvblsnbWVtYmVyJ10pO1xuICAgICAgICAgICAgICBpZiAoaXNQcmVzZW50KHNlbGVjdFRhcmdldCkgJiYgaXNQcmltaXRpdmUobWVtYmVyKSkgcmV0dXJuIHNlbGVjdFRhcmdldFttZW1iZXJdO1xuICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIGNhc2UgXCJyZWZlcmVuY2VcIjpcbiAgICAgICAgICAgICAgbGV0IHJlZmVyZW5jZU1vZHVsZU5hbWU7XG4gICAgICAgICAgICAgIGxldCBkZWNsYXJhdGlvblBhdGggPSBtb2R1bGVDb250ZXh0O1xuICAgICAgICAgICAgICBsZXQgZGVjbGFyZWROYW1lID0gZXhwcmVzc2lvblsnbmFtZSddO1xuICAgICAgICAgICAgICBpZiAoaXNQcmVzZW50KGV4cHJlc3Npb25bJ21vZHVsZSddKSkge1xuICAgICAgICAgICAgICAgIHJlZmVyZW5jZU1vZHVsZU5hbWUgPSBfdGhpcy5ob3N0LnJlc29sdmVNb2R1bGUoZXhwcmVzc2lvblsnbW9kdWxlJ10sIG1vZHVsZUNvbnRleHQpO1xuICAgICAgICAgICAgICAgIGxldCBkZWNsID0gX3RoaXMuaG9zdC5maW5kRGVjbGFyYXRpb24ocmVmZXJlbmNlTW9kdWxlTmFtZSwgZXhwcmVzc2lvblsnbmFtZSddKTtcbiAgICAgICAgICAgICAgICBkZWNsYXJhdGlvblBhdGggPSBkZWNsWydkZWNsYXJhdGlvblBhdGgnXTtcbiAgICAgICAgICAgICAgICBkZWNsYXJlZE5hbWUgPSBkZWNsWydkZWNsYXJlZE5hbWUnXTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBsZXQgcmVzdWx0O1xuICAgICAgICAgICAgICBpZiAoY3Jvc3NNb2R1bGVzIHx8IGlzQmxhbmsoZXhwcmVzc2lvblsnbW9kdWxlJ10pKSB7XG4gICAgICAgICAgICAgICAgbGV0IG1vZHVsZU1ldGFkYXRhID0gX3RoaXMuZ2V0TW9kdWxlTWV0YWRhdGEoZGVjbGFyYXRpb25QYXRoKTtcbiAgICAgICAgICAgICAgICBsZXQgZGVjbGFyYXRpb25WYWx1ZSA9IG1vZHVsZU1ldGFkYXRhWydtZXRhZGF0YSddW2RlY2xhcmVkTmFtZV07XG4gICAgICAgICAgICAgICAgaWYgKGlzQ2xhc3NNZXRhZGF0YShkZWNsYXJhdGlvblZhbHVlKSkge1xuICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gX3RoaXMuZ2V0U3RhdGljVHlwZShkZWNsYXJhdGlvblBhdGgsIGRlY2xhcmVkTmFtZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IF90aGlzLnNpbXBsaWZ5KGRlY2xhcmF0aW9uUGF0aCwgZGVjbGFyYXRpb25WYWx1ZSwgY3Jvc3NNb2R1bGVzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gX3RoaXMuZ2V0U3RhdGljVHlwZShkZWNsYXJhdGlvblBhdGgsIGRlY2xhcmVkTmFtZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgICAgIGNhc2UgXCJuZXdcIjpcbiAgICAgICAgICAgIGNhc2UgXCJjYWxsXCI6XG4gICAgICAgICAgICAgIGxldCB0YXJnZXQgPSBleHByZXNzaW9uWydleHByZXNzaW9uJ107XG4gICAgICAgICAgICAgIGxldCBtb2R1bGVJZCA9IF90aGlzLmhvc3QucmVzb2x2ZU1vZHVsZSh0YXJnZXRbJ21vZHVsZSddLCBtb2R1bGVDb250ZXh0KTtcbiAgICAgICAgICAgICAgbGV0IGRlY2wgPSBfdGhpcy5ob3N0LmZpbmREZWNsYXJhdGlvbihtb2R1bGVJZCwgdGFyZ2V0WyduYW1lJ10pO1xuICAgICAgICAgICAgICBsZXQgc3RhdGljVHlwZSA9IF90aGlzLmdldFN0YXRpY1R5cGUoZGVjbFsnZGVjbGFyYXRpb25QYXRoJ10sIGRlY2xbJ2RlY2xhcmVkTmFtZSddKTtcbiAgICAgICAgICAgICAgbGV0IGNvbnZlcnRlciA9IF90aGlzLmNvbnZlcnNpb25NYXAuZ2V0KHN0YXRpY1R5cGUpO1xuICAgICAgICAgICAgICBsZXQgYXJncyA9IGV4cHJlc3Npb25bJ2FyZ3VtZW50cyddO1xuICAgICAgICAgICAgICBpZiAoaXNCbGFuayhhcmdzKSkge1xuICAgICAgICAgICAgICAgIGFyZ3MgPSBbXTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm4gaXNQcmVzZW50KGNvbnZlcnRlcikgPyBjb252ZXJ0ZXIobW9kdWxlQ29udGV4dCwgYXJncykgOiBudWxsO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWFwU3RyaW5nTWFwKGV4cHJlc3Npb24sICh2YWx1ZSwgbmFtZSkgPT4gc2ltcGxpZnkodmFsdWUpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiBzaW1wbGlmeSh2YWx1ZSk7XG4gIH1cblxuICAvKipcbiAgICogQHBhcmFtIG1vZHVsZSBhbiBhYnNvbHV0ZSBwYXRoIHRvIGEgbW9kdWxlIGZpbGUuXG4gICAqL1xuICBwdWJsaWMgZ2V0TW9kdWxlTWV0YWRhdGEobW9kdWxlOiBzdHJpbmcpOiB7W2tleTogc3RyaW5nXTogYW55fSB7XG4gICAgbGV0IG1vZHVsZU1ldGFkYXRhID0gdGhpcy5tZXRhZGF0YUNhY2hlLmdldChtb2R1bGUpO1xuICAgIGlmICghaXNQcmVzZW50KG1vZHVsZU1ldGFkYXRhKSkge1xuICAgICAgbW9kdWxlTWV0YWRhdGEgPSB0aGlzLmhvc3QuZ2V0TWV0YWRhdGFGb3IobW9kdWxlKTtcbiAgICAgIGlmICghaXNQcmVzZW50KG1vZHVsZU1ldGFkYXRhKSkge1xuICAgICAgICBtb2R1bGVNZXRhZGF0YSA9IHtfX3N5bWJvbGljOiBcIm1vZHVsZVwiLCBtb2R1bGU6IG1vZHVsZSwgbWV0YWRhdGE6IHt9fTtcbiAgICAgIH1cbiAgICAgIHRoaXMubWV0YWRhdGFDYWNoZS5zZXQobW9kdWxlLCBtb2R1bGVNZXRhZGF0YSk7XG4gICAgfVxuICAgIHJldHVybiBtb2R1bGVNZXRhZGF0YTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0VHlwZU1ldGFkYXRhKHR5cGU6IFN0YXRpY1R5cGUpOiB7W2tleTogc3RyaW5nXTogYW55fSB7XG4gICAgbGV0IG1vZHVsZU1ldGFkYXRhID0gdGhpcy5nZXRNb2R1bGVNZXRhZGF0YSh0eXBlLm1vZHVsZUlkKTtcbiAgICBsZXQgcmVzdWx0ID0gbW9kdWxlTWV0YWRhdGFbJ21ldGFkYXRhJ11bdHlwZS5uYW1lXTtcbiAgICBpZiAoIWlzUHJlc2VudChyZXN1bHQpKSB7XG4gICAgICByZXN1bHQgPSB7X19zeW1ib2xpYzogXCJjbGFzc1wifTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc0NsYXNzTWV0YWRhdGEoZXhwcmVzc2lvbjogYW55KTogYm9vbGVhbiB7XG4gIHJldHVybiAhaXNQcmltaXRpdmUoZXhwcmVzc2lvbikgJiYgIWlzQXJyYXkoZXhwcmVzc2lvbikgJiYgZXhwcmVzc2lvblsnX19zeW1ib2xpYyddID09ICdjbGFzcyc7XG59XG5cbmZ1bmN0aW9uIG1hcFN0cmluZ01hcChpbnB1dDoge1trZXk6IHN0cmluZ106IGFueX0sXG4gICAgICAgICAgICAgICAgICAgICAgdHJhbnNmb3JtOiAodmFsdWU6IGFueSwga2V5OiBzdHJpbmcpID0+IGFueSk6IHtba2V5OiBzdHJpbmddOiBhbnl9IHtcbiAgaWYgKGlzQmxhbmsoaW5wdXQpKSByZXR1cm4ge307XG4gIHZhciByZXN1bHQgPSB7fTtcbiAgU3RyaW5nTWFwV3JhcHBlci5rZXlzKGlucHV0KS5mb3JFYWNoKChrZXkpID0+IHsgcmVzdWx0W2tleV0gPSB0cmFuc2Zvcm0oaW5wdXRba2V5XSwga2V5KTsgfSk7XG4gIHJldHVybiByZXN1bHQ7XG59XG4iXX0=