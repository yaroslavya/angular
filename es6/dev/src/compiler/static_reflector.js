import { StringMapWrapper, ListWrapper } from 'angular2/src/facade/collection';
import { isArray, isPresent, isBlank, isPrimitive, isStringMap, CONST_EXPR, FunctionWrapper } from 'angular2/src/facade/lang';
import { AttributeMetadata, DirectiveMetadata, ComponentMetadata, ContentChildrenMetadata, ContentChildMetadata, InputMetadata, HostBindingMetadata, HostListenerMetadata, OutputMetadata, PipeMetadata, ViewChildMetadata, ViewChildrenMetadata, ViewQueryMetadata, QueryMetadata } from 'angular2/src/core/metadata';
import { reflector } from 'angular2/src/core/reflection/reflection';
import { Provider } from 'angular2/src/core/di/provider';
import { HostMetadata, OptionalMetadata, InjectableMetadata, SelfMetadata, SkipSelfMetadata, InjectMetadata } from "angular2/src/core/di/metadata";
/**
 * A token representing the a reference to a static type.
 *
 * This token is unique for a moduleId and name and can be used as a hash table key.
 */
export class StaticType {
    constructor(moduleId, name) {
        this.moduleId = moduleId;
        this.name = name;
    }
}
/**
 * A static reflector implements enough of the Reflector API that is necessary to compile
 * templates statically.
 */
export class StaticReflector {
    constructor(host) {
        this.host = host;
        this.typeCache = new Map();
        this.annotationCache = new Map();
        this.propertyCache = new Map();
        this.parameterCache = new Map();
        this.metadataCache = new Map();
        this.conversionMap = new Map();
        this.initializeConversionMap();
    }
    importUri(typeOrFunc) { return typeOrFunc.moduleId; }
    /**
     * getStaticType produces a Type whose metadata is known but whose implementation is not loaded.
     * All types passed to the StaticResolver should be pseudo-types returned by this method.
     *
     * @param moduleId the module identifier as an absolute path.
     * @param name the name of the type.
     */
    getStaticType(moduleId, name) {
        let key = `"${moduleId}".${name}`;
        let result = this.typeCache.get(key);
        if (!isPresent(result)) {
            result = new StaticType(moduleId, name);
            this.typeCache.set(key, result);
        }
        return result;
    }
    annotations(type) {
        let annotations = this.annotationCache.get(type);
        if (!isPresent(annotations)) {
            let classMetadata = this.getTypeMetadata(type);
            if (isPresent(classMetadata['decorators'])) {
                annotations = this.simplify(type.moduleId, classMetadata['decorators'], false);
            }
            else {
                annotations = [];
            }
            this.annotationCache.set(type, annotations.filter(ann => isPresent(ann)));
        }
        return annotations;
    }
    propMetadata(type) {
        let propMetadata = this.propertyCache.get(type);
        if (!isPresent(propMetadata)) {
            let classMetadata = this.getTypeMetadata(type);
            let members = isPresent(classMetadata) ? classMetadata['members'] : {};
            propMetadata = mapStringMap(members, (propData, propName) => {
                let prop = propData.find(a => a['__symbolic'] == 'property');
                if (isPresent(prop) && isPresent(prop['decorators'])) {
                    return this.simplify(type.moduleId, prop['decorators'], false);
                }
                else {
                    return [];
                }
            });
            this.propertyCache.set(type, propMetadata);
        }
        return propMetadata;
    }
    parameters(type) {
        let parameters = this.parameterCache.get(type);
        if (!isPresent(parameters)) {
            let classMetadata = this.getTypeMetadata(type);
            let members = isPresent(classMetadata) ? classMetadata['members'] : null;
            let ctorData = isPresent(members) ? members['__ctor__'] : null;
            if (isPresent(ctorData)) {
                let ctor = ctorData.find(a => a['__symbolic'] == 'constructor');
                let parameterTypes = this.simplify(type.moduleId, ctor['parameters'], false);
                let parameterDecorators = this.simplify(type.moduleId, ctor['parameterDecorators'], false);
                parameters = [];
                ListWrapper.forEachWithIndex(parameterTypes, (paramType, index) => {
                    let nestedResult = [];
                    if (isPresent(paramType)) {
                        nestedResult.push(paramType);
                    }
                    let decorators = isPresent(parameterDecorators) ? parameterDecorators[index] : null;
                    if (isPresent(decorators)) {
                        ListWrapper.addAll(nestedResult, decorators);
                    }
                    parameters.push(nestedResult);
                });
            }
            if (!isPresent(parameters)) {
                parameters = [];
            }
            this.parameterCache.set(type, parameters);
        }
        return parameters;
    }
    registerDecoratorOrConstructor(type, ctor, crossModuleProps = CONST_EXPR([])) {
        this.conversionMap.set(type, (moduleContext, args) => {
            let argValues = [];
            ListWrapper.forEachWithIndex(args, (arg, index) => {
                let argValue;
                if (isStringMap(arg) && isBlank(arg['__symbolic'])) {
                    argValue =
                        mapStringMap(arg, (value, key) => this.simplify(moduleContext, value, crossModuleProps.indexOf(key) !== -1));
                }
                else {
                    argValue = this.simplify(moduleContext, arg, crossModuleProps.indexOf(index) !== -1);
                }
                argValues.push(argValue);
            });
            return FunctionWrapper.apply(reflector.factory(ctor), argValues);
        });
    }
    initializeConversionMap() {
        let coreDecorators = this.host.resolveModule('angular2/src/core/metadata');
        let diDecorators = this.host.resolveModule('angular2/src/core/di/decorators');
        let diMetadata = this.host.resolveModule('angular2/src/core/di/metadata');
        let provider = this.host.resolveModule('angular2/src/core/di/provider');
        this.registerDecoratorOrConstructor(this.getStaticType(provider, 'Provider'), Provider);
        this.registerDecoratorOrConstructor(this.getStaticType(diDecorators, 'Host'), HostMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(diDecorators, 'Injectable'), InjectableMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(diDecorators, 'Self'), SelfMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(diDecorators, 'SkipSelf'), SkipSelfMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(diDecorators, 'Inject'), InjectMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(diDecorators, 'Optional'), OptionalMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(coreDecorators, 'Attribute'), AttributeMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(coreDecorators, 'Query'), QueryMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(coreDecorators, 'ViewQuery'), ViewQueryMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(coreDecorators, 'ContentChild'), ContentChildMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(coreDecorators, 'ContentChildren'), ContentChildrenMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(coreDecorators, 'ViewChild'), ViewChildMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(coreDecorators, 'ViewChildren'), ViewChildrenMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(coreDecorators, 'Input'), InputMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(coreDecorators, 'Output'), OutputMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(coreDecorators, 'Pipe'), PipeMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(coreDecorators, 'HostBinding'), HostBindingMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(coreDecorators, 'HostListener'), HostListenerMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(coreDecorators, 'Directive'), DirectiveMetadata, ['bindings', 'providers']);
        this.registerDecoratorOrConstructor(this.getStaticType(coreDecorators, 'Component'), ComponentMetadata, ['bindings', 'providers', 'directives', 'pipes']);
        // Note: Some metadata classes can be used directly with Provider.deps.
        this.registerDecoratorOrConstructor(this.getStaticType(diMetadata, 'HostMetadata'), HostMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(diMetadata, 'SelfMetadata'), SelfMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(diMetadata, 'SkipSelfMetadata'), SkipSelfMetadata);
        this.registerDecoratorOrConstructor(this.getStaticType(diMetadata, 'OptionalMetadata'), OptionalMetadata);
    }
    /** @internal */
    simplify(moduleContext, value, crossModules) {
        let _this = this;
        function simplify(expression) {
            if (isPrimitive(expression)) {
                return expression;
            }
            if (isArray(expression)) {
                let result = [];
                for (let item of expression) {
                    result.push(simplify(item));
                }
                return result;
            }
            if (isPresent(expression)) {
                if (isPresent(expression['__symbolic'])) {
                    switch (expression['__symbolic']) {
                        case "binop":
                            let left = simplify(expression['left']);
                            let right = simplify(expression['right']);
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
                            let operand = simplify(expression['operand']);
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
                            let indexTarget = simplify(expression['expression']);
                            let index = simplify(expression['index']);
                            if (isPresent(indexTarget) && isPrimitive(index))
                                return indexTarget[index];
                            return null;
                        case "select":
                            let selectTarget = simplify(expression['expression']);
                            let member = simplify(expression['member']);
                            if (isPresent(selectTarget) && isPrimitive(member))
                                return selectTarget[member];
                            return null;
                        case "reference":
                            let referenceModuleName;
                            let declarationPath = moduleContext;
                            let declaredName = expression['name'];
                            if (isPresent(expression['module'])) {
                                referenceModuleName = _this.host.resolveModule(expression['module'], moduleContext);
                                let decl = _this.host.findDeclaration(referenceModuleName, expression['name']);
                                declarationPath = decl['declarationPath'];
                                declaredName = decl['declaredName'];
                            }
                            let result;
                            if (crossModules || isBlank(expression['module'])) {
                                let moduleMetadata = _this.getModuleMetadata(declarationPath);
                                let declarationValue = moduleMetadata['metadata'][declaredName];
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
                            let target = expression['expression'];
                            let moduleId = _this.host.resolveModule(target['module'], moduleContext);
                            let decl = _this.host.findDeclaration(moduleId, target['name']);
                            let staticType = _this.getStaticType(decl['declarationPath'], decl['declaredName']);
                            let converter = _this.conversionMap.get(staticType);
                            let args = expression['arguments'];
                            if (isBlank(args)) {
                                args = [];
                            }
                            return isPresent(converter) ? converter(moduleContext, args) : null;
                    }
                    return null;
                }
                return mapStringMap(expression, (value, name) => simplify(value));
            }
            return null;
        }
        return simplify(value);
    }
    /**
     * @param module an absolute path to a module file.
     */
    getModuleMetadata(module) {
        let moduleMetadata = this.metadataCache.get(module);
        if (!isPresent(moduleMetadata)) {
            moduleMetadata = this.host.getMetadataFor(module);
            if (!isPresent(moduleMetadata)) {
                moduleMetadata = { __symbolic: "module", module: module, metadata: {} };
            }
            this.metadataCache.set(module, moduleMetadata);
        }
        return moduleMetadata;
    }
    getTypeMetadata(type) {
        let moduleMetadata = this.getModuleMetadata(type.moduleId);
        let result = moduleMetadata['metadata'][type.name];
        if (!isPresent(result)) {
            result = { __symbolic: "class" };
        }
        return result;
    }
}
function isClassMetadata(expression) {
    return !isPrimitive(expression) && !isArray(expression) && expression['__symbolic'] == 'class';
}
function mapStringMap(input, transform) {
    if (isBlank(input))
        return {};
    var result = {};
    StringMapWrapper.keys(input).forEach((key) => { result[key] = transform(input[key], key); });
    return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdGljX3JlZmxlY3Rvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRpZmZpbmdfcGx1Z2luX3dyYXBwZXItb3V0cHV0X3BhdGgtV3hxYmp6dzUudG1wL2FuZ3VsYXIyL3NyYy9jb21waWxlci9zdGF0aWNfcmVmbGVjdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJPQUFPLEVBQUMsZ0JBQWdCLEVBQUUsV0FBVyxFQUFDLE1BQU0sZ0NBQWdDO09BQ3JFLEVBQ0wsT0FBTyxFQUNQLFNBQVMsRUFDVCxPQUFPLEVBQ1AsV0FBVyxFQUNYLFdBQVcsRUFDWCxVQUFVLEVBQ1YsZUFBZSxFQUNoQixNQUFNLDBCQUEwQjtPQUMxQixFQUNMLGlCQUFpQixFQUNqQixpQkFBaUIsRUFDakIsaUJBQWlCLEVBQ2pCLHVCQUF1QixFQUN2QixvQkFBb0IsRUFDcEIsYUFBYSxFQUNiLG1CQUFtQixFQUNuQixvQkFBb0IsRUFDcEIsY0FBYyxFQUNkLFlBQVksRUFFWixpQkFBaUIsRUFDakIsb0JBQW9CLEVBQ3BCLGlCQUFpQixFQUNqQixhQUFhLEVBQ2QsTUFBTSw0QkFBNEI7T0FFNUIsRUFBQyxTQUFTLEVBQUMsTUFBTSx5Q0FBeUM7T0FDMUQsRUFBQyxRQUFRLEVBQUMsTUFBTSwrQkFBK0I7T0FDL0MsRUFDTCxZQUFZLEVBQ1osZ0JBQWdCLEVBQ2hCLGtCQUFrQixFQUNsQixZQUFZLEVBQ1osZ0JBQWdCLEVBQ2hCLGNBQWMsRUFDZixNQUFNLCtCQUErQjtBQTRCdEM7Ozs7R0FJRztBQUNIO0lBQ0UsWUFBbUIsUUFBZ0IsRUFBUyxJQUFZO1FBQXJDLGFBQVEsR0FBUixRQUFRLENBQVE7UUFBUyxTQUFJLEdBQUosSUFBSSxDQUFRO0lBQUcsQ0FBQztBQUM5RCxDQUFDO0FBRUQ7OztHQUdHO0FBQ0g7SUFRRSxZQUFvQixJQUF5QjtRQUF6QixTQUFJLEdBQUosSUFBSSxDQUFxQjtRQVByQyxjQUFTLEdBQUcsSUFBSSxHQUFHLEVBQXNCLENBQUM7UUFDMUMsb0JB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Q0QsTUFBTSxDQUFDLE1BQU0sQ0FBQztJQUNoQixDQUFDO0FBQ0gsQ0FBQztBQUVELHlCQUF5QixVQUFlO0lBQ3RDLE1BQU0sQ0FBQyxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxVQUFVLENBQUMsWUFBWSxDQUFDLElBQUksT0FBTyxDQUFDO0FBQ2pHLENBQUM7QUFFRCxzQkFBc0IsS0FBMkIsRUFDM0IsU0FBMkM7SUFDL0QsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztJQUM5QixJQUFJLE1BQU0sR0FBRyxFQUFFLENBQUM7SUFDaEIsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEdBQUcsT0FBTyxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzdGLE1BQU0sQ0FBQyxNQUFNLENBQUM7QUFDaEIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7U3RyaW5nTWFwV3JhcHBlciwgTGlzdFdyYXBwZXJ9IGZyb20gJ2FuZ3VsYXIyL3NyYy9mYWNhZGUvY29sbGVjdGlvbic7XG5pbXBvcnQge1xuICBpc0FycmF5LFxuICBpc1ByZXNlbnQsXG4gIGlzQmxhbmssXG4gIGlzUHJpbWl0aXZlLFxuICBpc1N0cmluZ01hcCxcbiAgQ09OU1RfRVhQUixcbiAgRnVuY3Rpb25XcmFwcGVyXG59IGZyb20gJ2FuZ3VsYXIyL3NyYy9mYWNhZGUvbGFuZyc7XG5pbXBvcnQge1xuICBBdHRyaWJ1dGVNZXRhZGF0YSxcbiAgRGlyZWN0aXZlTWV0YWRhdGEsXG4gIENvbXBvbmVudE1ldGFkYXRhLFxuICBDb250ZW50Q2hpbGRyZW5NZXRhZGF0YSxcbiAgQ29udGVudENoaWxkTWV0YWRhdGEsXG4gIElucHV0TWV0YWRhdGEsXG4gIEhvc3RCaW5kaW5nTWV0YWRhdGEsXG4gIEhvc3RMaXN0ZW5lck1ldGFkYXRhLFxuICBPdXRwdXRNZXRhZGF0YSxcbiAgUGlwZU1ldGFkYXRhLFxuICBWaWV3TWV0YWRhdGEsXG4gIFZpZXdDaGlsZE1ldGFkYXRhLFxuICBWaWV3Q2hpbGRyZW5NZXRhZGF0YSxcbiAgVmlld1F1ZXJ5TWV0YWRhdGEsXG4gIFF1ZXJ5TWV0YWRhdGEsXG59IGZyb20gJ2FuZ3VsYXIyL3NyYy9jb3JlL21ldGFkYXRhJztcbmltcG9ydCB7UmVmbGVjdG9yUmVhZGVyfSBmcm9tICdhbmd1bGFyMi9zcmMvY29yZS9yZWZsZWN0aW9uL3JlZmxlY3Rvcl9yZWFkZXInO1xuaW1wb3J0IHtyZWZsZWN0b3J9IGZyb20gJ2FuZ3VsYXIyL3NyYy9jb3JlL3JlZmxlY3Rpb24vcmVmbGVjdGlvbic7XG5pbXBvcnQge1Byb3ZpZGVyfSBmcm9tICdhbmd1bGFyMi9zcmMvY29yZS9kaS9wcm92aWRlcic7XG5pbXBvcnQge1xuICBIb3N0TWV0YWRhdGEsXG4gIE9wdGlvbmFsTWV0YWRhdGEsXG4gIEluamVjdGFibGVNZXRhZGF0YSxcbiAgU2VsZk1ldGFkYXRhLFxuICBTa2lwU2VsZk1ldGFkYXRhLFxuICBJbmplY3RNZXRhZGF0YVxufSBmcm9tIFwiYW5ndWxhcjIvc3JjL2NvcmUvZGkvbWV0YWRhdGFcIjtcblxuLyoqXG4gKiBUaGUgaG9zdCBvZiB0aGUgc3RhdGljIHJlc29sdmVyIGlzIGV4cGVjdGVkIHRvIGJlIGFibGUgdG8gcHJvdmlkZSBtb2R1bGUgbWV0YWRhdGEgaW4gdGhlIGZvcm0gb2ZcbiAqIE1vZHVsZU1ldGFkYXRhLiBBbmd1bGFyIDIgQ0xJIHdpbGwgcHJvZHVjZSB0aGlzIG1ldGFkYXRhIGZvciBhIG1vZHVsZSB3aGVuZXZlciBhIC5kLnRzIGZpbGVzIGlzXG4gKiBwcm9kdWNlZCBhbmQgdGhlIG1vZHVsZSBoYXMgZXhwb3J0ZWQgdmFyaWFibGVzIG9yIGNsYXNzZXMgd2l0aCBkZWNvcmF0b3JzLiBNb2R1bGUgbWV0YWRhdGEgY2FuXG4gKiBhbHNvIGJlIHByb2R1Y2VkIGRpcmVjdGx5IGZyb20gVHlwZVNjcmlwdCBzb3VyY2VzIGJ5IHVzaW5nIE1ldGFkYXRhQ29sbGVjdG9yIGluIHRvb2xzL21ldGFkYXRhLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFN0YXRpY1JlZmxlY3Rvckhvc3Qge1xuICAvKipcbiAgICogIFJldHVybiBhIE1vZHVsZU1ldGFkYXRhIGZvciB0aGUgZ2l2ZW4gbW9kdWxlLlxuICAgKlxuICAgKiBAcGFyYW0gbW9kdWxlSWQgaXMgYSBzdHJpbmcgaWRlbnRpZmllciBmb3IgYSBtb2R1bGUgYXMgYW4gYWJzb2x1dGUgcGF0aC5cbiAgICogQHJldHVybnMgdGhlIG1ldGFkYXRhIGZvciB0aGUgZ2l2ZW4gbW9kdWxlLlxuICAgKi9cbiAgZ2V0TWV0YWRhdGFGb3IobW9kdWxlUGF0aDogc3RyaW5nKToge1trZXk6IHN0cmluZ106IGFueX07XG5cbiAgLyoqXG4gICAqIFJlc29sdmUgYSBtb2R1bGUgZnJvbSBhbiBpbXBvcnQgc3RhdGVtZW50IGZvcm0gdG8gYW4gYWJzb2x1dGUgcGF0aC5cbiAgICogQHBhcmFtIG1vZHVsZU5hbWUgdGhlIGxvY2F0aW9uIGltcG9ydGVkIGZyb21cbiAgICogQHBhcmFtIGNvbnRhaW5pbmdGaWxlIGZvciByZWxhdGl2ZSBpbXBvcnRzLCB0aGUgcGF0aCBvZiB0aGUgZmlsZSBjb250YWluaW5nIHRoZSBpbXBvcnRcbiAgICovXG4gIHJlc29sdmVNb2R1bGUobW9kdWxlTmFtZTogc3RyaW5nLCBjb250YWluaW5nRmlsZT86IHN0cmluZyk6IHN0cmluZztcblxuICBmaW5kRGVjbGFyYXRpb24obW9kdWxlUGF0aDogc3RyaW5nLFxuICAgICAgICAgICAgICAgICAgc3ltYm9sTmFtZTogc3RyaW5nKToge2RlY2xhcmF0aW9uUGF0aDogc3RyaW5nLCBkZWNsYXJlZE5hbWU6IHN0cmluZ307XG59XG5cbi8qKlxuICogQSB0b2tlbiByZXByZXNlbnRpbmcgdGhlIGEgcmVmZXJlbmNlIHRvIGEgc3RhdGljIHR5cGUuXG4gKlxuICogVGhpcyB0b2tlbiBpcyB1bmlxdWUgZm9yIGEgbW9kdWxlSWQgYW5kIG5hbWUgYW5kIGNhbiBiZSB1c2VkIGFzIGEgaGFzaCB0YWJsZSBrZXkuXG4gKi9cbmV4cG9ydCBjbGFzcyBTdGF0aWNUeXBlIHtcbiAgY29uc3RydWN0b3IocHVibGljIG1vZHVsZUlkOiBzdHJpbmcsIHB1YmxpYyBuYW1lOiBzdHJpbmcpIHt9XG59XG5cbi8qKlxuICogQSBzdGF0aWMgcmVmbGVjdG9yIGltcGxlbWVudHMgZW5vdWdoIG9mIHRoZSBSZWZsZWN0b3IgQVBJIHRoYXQgaXMgbmVjZXNzYXJ5IHRvIGNvbXBpbGVcbiAqIHRlbXBsYXRlcyBzdGF0aWNhbGx5LlxuICovXG5leHBvcnQgY2xhc3MgU3RhdGljUmVmbGVjdG9yIGltcGxlbWVudHMgUmVmbGVjdG9yUmVhZGVyIHtcbiAgcHJpdmF0ZSB0eXBlQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgU3RhdGljVHlwZT4oKTtcbiAgcHJpdmF0ZSBhbm5vdGF0aW9uQ2FjaGUgPSBuZXcgTWFwPFN0YXRpY1R5cGUsIGFueVtdPigpO1xuICBwcml2YXRlIHByb3BlcnR5Q2FjaGUgPSBuZXcgTWFwPFN0YXRpY1R5cGUsIHtba2V5OiBzdHJpbmddOiBhbnl9PigpO1xuICBwcml2YXRlIHBhcmFtZXRlckNhY2hlID0gbmV3IE1hcDxTdGF0aWNUeXBlLCBhbnlbXT4oKTtcbiAgcHJpdmF0ZSBtZXRhZGF0YUNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIHtba2V5OiBzdHJpbmddOiBhbnl9PigpO1xuICBwcml2YXRlIGNvbnZlcnNpb25NYXAgPSBuZXcgTWFwPFN0YXRpY1R5cGUsIChtb2R1bGVDb250ZXh0OiBzdHJpbmcsIGFyZ3M6IGFueVtdKSA9PiBhbnk+KCk7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBob3N0OiBTdGF0aWNSZWZsZWN0b3JIb3N0KSB7IHRoaXMuaW5pdGlhbGl6ZUNvbnZlcnNpb25NYXAoKTsgfVxuXG4gIGltcG9ydFVyaSh0eXBlT3JGdW5jOiBhbnkpOiBzdHJpbmcgeyByZXR1cm4gKDxTdGF0aWNUeXBlPnR5cGVPckZ1bmMpLm1vZHVsZUlkOyB9XG5cbiAgLyoqXG4gICAqIGdldFN0YXRpY1R5cGUgcHJvZHVjZXMgYSBUeXBlIHdob3NlIG1ldGFkYXRhIGlzIGtub3duIGJ1dCB3aG9zZSBpbXBsZW1lbnRhdGlvbiBpcyBub3QgbG9hZGVkLlxuICAgKiBBbGwgdHlwZXMgcGFzc2VkIHRvIHRoZSBTdGF0aWNSZXNvbHZlciBzaG91bGQgYmUgcHNldWRvLXR5cGVzIHJldHVybmVkIGJ5IHRoaXMgbWV0aG9kLlxuICAgKlxuICAgKiBAcGFyYW0gbW9kdWxlSWQgdGhlIG1vZHVsZSBpZGVudGlmaWVyIGFzIGFuIGFic29sdXRlIHBhdGguXG4gICAqIEBwYXJhbSBuYW1lIHRoZSBuYW1lIG9mIHRoZSB0eXBlLlxuICAgKi9cbiAgcHVibGljIGdldFN0YXRpY1R5cGUobW9kdWxlSWQ6IHN0cmluZywgbmFtZTogc3RyaW5nKTogU3RhdGljVHlwZSB7XG4gICAgbGV0IGtleSA9IGBcIiR7bW9kdWxlSWR9XCIuJHtuYW1lfWA7XG4gICAgbGV0IHJlc3VsdCA9IHRoaXMudHlwZUNhY2hlLmdldChrZXkpO1xuICAgIGlmICghaXNQcmVzZW50KHJlc3VsdCkpIHtcbiAgICAgIHJlc3VsdCA9IG5ldyBTdGF0aWNUeXBlKG1vZHVsZUlkLCBuYW1lKTtcbiAgICAgIHRoaXMudHlwZUNhY2hlLnNldChrZXksIHJlc3VsdCk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwdWJsaWMgYW5ub3RhdGlvbnModHlwZTogU3RhdGljVHlwZSk6IGFueVtdIHtcbiAgICBsZXQgYW5ub3RhdGlvbnMgPSB0aGlzLmFubm90YXRpb25DYWNoZS5nZXQodHlwZSk7XG4gICAgaWYgKCFpc1ByZXNlbnQoYW5ub3RhdGlvbnMpKSB7XG4gICAgICBsZXQgY2xhc3NNZXRhZGF0YSA9IHRoaXMuZ2V0VHlwZU1ldGFkYXRhKHR5cGUpO1xuICAgICAgaWYgKGlzUHJlc2VudChjbGFzc01ldGFkYXRhWydkZWNvcmF0b3JzJ10pKSB7XG4gICAgICAgIGFubm90YXRpb25zID0gdGhpcy5zaW1wbGlmeSh0eXBlLm1vZHVsZUlkLCBjbGFzc01ldGFkYXRhWydkZWNvcmF0b3JzJ10sIGZhbHNlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGFubm90YXRpb25zID0gW107XG4gICAgICB9XG4gICAgICB0aGlzLmFubm90YXRpb25DYWNoZS5zZXQodHlwZSwgYW5ub3RhdGlvbnMuZmlsdGVyKGFubiA9PiBpc1ByZXNlbnQoYW5uKSkpO1xuICAgIH1cbiAgICByZXR1cm4gYW5ub3RhdGlvbnM7XG4gIH1cblxuICBwdWJsaWMgcHJvcE1ldGFkYXRhKHR5cGU6IFN0YXRpY1R5cGUpOiB7W2tleTogc3RyaW5nXTogYW55fSB7XG4gICAgbGV0IHByb3BNZXRhZGF0YSA9IHRoaXMucHJvcGVydHlDYWNoZS5nZXQodHlwZSk7XG4gICAgaWYgKCFpc1ByZXNlbnQocHJvcE1ldGFkYXRhKSkge1xuICAgICAgbGV0IGNsYXNzTWV0YWRhdGEgPSB0aGlzLmdldFR5cGVNZXRhZGF0YSh0eXBlKTtcbiAgICAgIGxldCBtZW1iZXJzID0gaXNQcmVzZW50KGNsYXNzTWV0YWRhdGEpID8gY2xhc3NNZXRhZGF0YVsnbWVtYmVycyddIDoge307XG4gICAgICBwcm9wTWV0YWRhdGEgPSBtYXBTdHJpbmdNYXAobWVtYmVycywgKHByb3BEYXRhLCBwcm9wTmFtZSkgPT4ge1xuICAgICAgICBsZXQgcHJvcCA9ICg8YW55W10+cHJvcERhdGEpLmZpbmQoYSA9PiBhWydfX3N5bWJvbGljJ10gPT0gJ3Byb3BlcnR5Jyk7XG4gICAgICAgIGlmIChpc1ByZXNlbnQocHJvcCkgJiYgaXNQcmVzZW50KHByb3BbJ2RlY29yYXRvcnMnXSkpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5zaW1wbGlmeSh0eXBlLm1vZHVsZUlkLCBwcm9wWydkZWNvcmF0b3JzJ10sIGZhbHNlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgdGhpcy5wcm9wZXJ0eUNhY2hlLnNldCh0eXBlLCBwcm9wTWV0YWRhdGEpO1xuICAgIH1cbiAgICByZXR1cm4gcHJvcE1ldGFkYXRhO1xuICB9XG5cbiAgcHVibGljIHBhcmFtZXRlcnModHlwZTogU3RhdGljVHlwZSk6IGFueVtdIHtcbiAgICBsZXQgcGFyYW1ldGVycyA9IHRoaXMucGFyYW1ldGVyQ2FjaGUuZ2V0KHR5cGUpO1xuICAgIGlmICghaXNQcmVzZW50KHBhcmFtZXRlcnMpKSB7XG4gICAgICBsZXQgY2xhc3NNZXRhZGF0YSA9IHRoaXMuZ2V0VHlwZU1ldGFkYXRhKHR5cGUpO1xuICAgICAgbGV0IG1lbWJlcnMgPSBpc1ByZXNlbnQoY2xhc3NNZXRhZGF0YSkgPyBjbGFzc01ldGFkYXRhWydtZW1iZXJzJ10gOiBudWxsO1xuICAgICAgbGV0IGN0b3JEYXRhID0gaXNQcmVzZW50KG1lbWJlcnMpID8gbWVtYmVyc1snX19jdG9yX18nXSA6IG51bGw7XG4gICAgICBpZiAoaXNQcmVzZW50KGN0b3JEYXRhKSkge1xuICAgICAgICBsZXQgY3RvciA9ICg8YW55W10+Y3RvckRhdGEpLmZpbmQoYSA9PiBhWydfX3N5bWJvbGljJ10gPT0gJ2NvbnN0cnVjdG9yJyk7XG4gICAgICAgIGxldCBwYXJhbWV0ZXJUeXBlcyA9IDxhbnlbXT50aGlzLnNpbXBsaWZ5KHR5cGUubW9kdWxlSWQsIGN0b3JbJ3BhcmFtZXRlcnMnXSwgZmFsc2UpO1xuICAgICAgICBsZXQgcGFyYW1ldGVyRGVjb3JhdG9ycyA9XG4gICAgICAgICAgICA8YW55W10+dGhpcy5zaW1wbGlmeSh0eXBlLm1vZHVsZUlkLCBjdG9yWydwYXJhbWV0ZXJEZWNvcmF0b3JzJ10sIGZhbHNlKTtcblxuICAgICAgICBwYXJhbWV0ZXJzID0gW107XG4gICAgICAgIExpc3RXcmFwcGVyLmZvckVhY2hXaXRoSW5kZXgocGFyYW1ldGVyVHlwZXMsIChwYXJhbVR5cGUsIGluZGV4KSA9PiB7XG4gICAgICAgICAgbGV0IG5lc3RlZFJlc3VsdCA9IFtdO1xuICAgICAgICAgIGlmIChpc1ByZXNlbnQocGFyYW1UeXBlKSkge1xuICAgICAgICAgICAgbmVzdGVkUmVzdWx0LnB1c2gocGFyYW1UeXBlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgbGV0IGRlY29yYXRvcnMgPSBpc1ByZXNlbnQocGFyYW1ldGVyRGVjb3JhdG9ycykgPyBwYXJhbWV0ZXJEZWNvcmF0b3JzW2luZGV4XSA6IG51bGw7XG4gICAgICAgICAgaWYgKGlzUHJlc2VudChkZWNvcmF0b3JzKSkge1xuICAgICAgICAgICAgTGlzdFdyYXBwZXIuYWRkQWxsKG5lc3RlZFJlc3VsdCwgZGVjb3JhdG9ycyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHBhcmFtZXRlcnMucHVzaChuZXN0ZWRSZXN1bHQpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGlmICghaXNQcmVzZW50KHBhcmFtZXRlcnMpKSB7XG4gICAgICAgIHBhcmFtZXRlcnMgPSBbXTtcbiAgICAgIH1cbiAgICAgIHRoaXMucGFyYW1ldGVyQ2FjaGUuc2V0KHR5cGUsIHBhcmFtZXRlcnMpO1xuICAgIH1cbiAgICByZXR1cm4gcGFyYW1ldGVycztcbiAgfVxuXG4gIHByaXZhdGUgcmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKHR5cGU6IFN0YXRpY1R5cGUsIGN0b3I6IGFueSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3Jvc3NNb2R1bGVQcm9wczogYW55W10gPSBDT05TVF9FWFBSKFtdKSk6IHZvaWQge1xuICAgIHRoaXMuY29udmVyc2lvbk1hcC5zZXQodHlwZSwgKG1vZHVsZUNvbnRleHQ6IHN0cmluZywgYXJnczogYW55W10pID0+IHtcbiAgICAgIGxldCBhcmdWYWx1ZXMgPSBbXTtcbiAgICAgIExpc3RXcmFwcGVyLmZvckVhY2hXaXRoSW5kZXgoYXJncywgKGFyZywgaW5kZXgpID0+IHtcbiAgICAgICAgbGV0IGFyZ1ZhbHVlO1xuICAgICAgICBpZiAoaXNTdHJpbmdNYXAoYXJnKSAmJiBpc0JsYW5rKGFyZ1snX19zeW1ib2xpYyddKSkge1xuICAgICAgICAgIGFyZ1ZhbHVlID1cbiAgICAgICAgICAgICAgbWFwU3RyaW5nTWFwKGFyZywgKHZhbHVlLCBrZXkpID0+IHRoaXMuc2ltcGxpZnkoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb2R1bGVDb250ZXh0LCB2YWx1ZSwgY3Jvc3NNb2R1bGVQcm9wcy5pbmRleE9mKGtleSkgIT09IC0xKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYXJnVmFsdWUgPSB0aGlzLnNpbXBsaWZ5KG1vZHVsZUNvbnRleHQsIGFyZywgY3Jvc3NNb2R1bGVQcm9wcy5pbmRleE9mKGluZGV4KSAhPT0gLTEpO1xuICAgICAgICB9XG4gICAgICAgIGFyZ1ZhbHVlcy5wdXNoKGFyZ1ZhbHVlKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIEZ1bmN0aW9uV3JhcHBlci5hcHBseShyZWZsZWN0b3IuZmFjdG9yeShjdG9yKSwgYXJnVmFsdWVzKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgaW5pdGlhbGl6ZUNvbnZlcnNpb25NYXAoKTogdm9pZCB7XG4gICAgbGV0IGNvcmVEZWNvcmF0b3JzID0gdGhpcy5ob3N0LnJlc29sdmVNb2R1bGUoJ2FuZ3VsYXIyL3NyYy9jb3JlL21ldGFkYXRhJyk7XG4gICAgbGV0IGRpRGVjb3JhdG9ycyA9IHRoaXMuaG9zdC5yZXNvbHZlTW9kdWxlKCdhbmd1bGFyMi9zcmMvY29yZS9kaS9kZWNvcmF0b3JzJyk7XG4gICAgbGV0IGRpTWV0YWRhdGEgPSB0aGlzLmhvc3QucmVzb2x2ZU1vZHVsZSgnYW5ndWxhcjIvc3JjL2NvcmUvZGkvbWV0YWRhdGEnKTtcblxuICAgIGxldCBwcm92aWRlciA9IHRoaXMuaG9zdC5yZXNvbHZlTW9kdWxlKCdhbmd1bGFyMi9zcmMvY29yZS9kaS9wcm92aWRlcicpO1xuICAgIHRoaXMucmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKHRoaXMuZ2V0U3RhdGljVHlwZShwcm92aWRlciwgJ1Byb3ZpZGVyJyksIFByb3ZpZGVyKTtcblxuICAgIHRoaXMucmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKHRoaXMuZ2V0U3RhdGljVHlwZShkaURlY29yYXRvcnMsICdIb3N0JyksIEhvc3RNZXRhZGF0YSk7XG4gICAgdGhpcy5yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IodGhpcy5nZXRTdGF0aWNUeXBlKGRpRGVjb3JhdG9ycywgJ0luamVjdGFibGUnKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBJbmplY3RhYmxlTWV0YWRhdGEpO1xuICAgIHRoaXMucmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKHRoaXMuZ2V0U3RhdGljVHlwZShkaURlY29yYXRvcnMsICdTZWxmJyksIFNlbGZNZXRhZGF0YSk7XG4gICAgdGhpcy5yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IodGhpcy5nZXRTdGF0aWNUeXBlKGRpRGVjb3JhdG9ycywgJ1NraXBTZWxmJyksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgU2tpcFNlbGZNZXRhZGF0YSk7XG4gICAgdGhpcy5yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IodGhpcy5nZXRTdGF0aWNUeXBlKGRpRGVjb3JhdG9ycywgJ0luamVjdCcpLCBJbmplY3RNZXRhZGF0YSk7XG4gICAgdGhpcy5yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IodGhpcy5nZXRTdGF0aWNUeXBlKGRpRGVjb3JhdG9ycywgJ09wdGlvbmFsJyksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgT3B0aW9uYWxNZXRhZGF0YSk7XG4gICAgdGhpcy5yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IodGhpcy5nZXRTdGF0aWNUeXBlKGNvcmVEZWNvcmF0b3JzLCAnQXR0cmlidXRlJyksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQXR0cmlidXRlTWV0YWRhdGEpO1xuICAgIHRoaXMucmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKHRoaXMuZ2V0U3RhdGljVHlwZShjb3JlRGVjb3JhdG9ycywgJ1F1ZXJ5JyksIFF1ZXJ5TWV0YWRhdGEpO1xuICAgIHRoaXMucmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKHRoaXMuZ2V0U3RhdGljVHlwZShjb3JlRGVjb3JhdG9ycywgJ1ZpZXdRdWVyeScpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFZpZXdRdWVyeU1ldGFkYXRhKTtcbiAgICB0aGlzLnJlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3Rvcih0aGlzLmdldFN0YXRpY1R5cGUoY29yZURlY29yYXRvcnMsICdDb250ZW50Q2hpbGQnKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBDb250ZW50Q2hpbGRNZXRhZGF0YSk7XG4gICAgdGhpcy5yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IodGhpcy5nZXRTdGF0aWNUeXBlKGNvcmVEZWNvcmF0b3JzLCAnQ29udGVudENoaWxkcmVuJyksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQ29udGVudENoaWxkcmVuTWV0YWRhdGEpO1xuICAgIHRoaXMucmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKHRoaXMuZ2V0U3RhdGljVHlwZShjb3JlRGVjb3JhdG9ycywgJ1ZpZXdDaGlsZCcpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFZpZXdDaGlsZE1ldGFkYXRhKTtcbiAgICB0aGlzLnJlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3Rvcih0aGlzLmdldFN0YXRpY1R5cGUoY29yZURlY29yYXRvcnMsICdWaWV3Q2hpbGRyZW4nKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBWaWV3Q2hpbGRyZW5NZXRhZGF0YSk7XG4gICAgdGhpcy5yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IodGhpcy5nZXRTdGF0aWNUeXBlKGNvcmVEZWNvcmF0b3JzLCAnSW5wdXQnKSwgSW5wdXRNZXRhZGF0YSk7XG4gICAgdGhpcy5yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IodGhpcy5nZXRTdGF0aWNUeXBlKGNvcmVEZWNvcmF0b3JzLCAnT3V0cHV0JyksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgT3V0cHV0TWV0YWRhdGEpO1xuICAgIHRoaXMucmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKHRoaXMuZ2V0U3RhdGljVHlwZShjb3JlRGVjb3JhdG9ycywgJ1BpcGUnKSwgUGlwZU1ldGFkYXRhKTtcbiAgICB0aGlzLnJlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3Rvcih0aGlzLmdldFN0YXRpY1R5cGUoY29yZURlY29yYXRvcnMsICdIb3N0QmluZGluZycpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEhvc3RCaW5kaW5nTWV0YWRhdGEpO1xuICAgIHRoaXMucmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKHRoaXMuZ2V0U3RhdGljVHlwZShjb3JlRGVjb3JhdG9ycywgJ0hvc3RMaXN0ZW5lcicpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEhvc3RMaXN0ZW5lck1ldGFkYXRhKTtcbiAgICB0aGlzLnJlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3Rvcih0aGlzLmdldFN0YXRpY1R5cGUoY29yZURlY29yYXRvcnMsICdEaXJlY3RpdmUnKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBEaXJlY3RpdmVNZXRhZGF0YSwgWydiaW5kaW5ncycsICdwcm92aWRlcnMnXSk7XG4gICAgdGhpcy5yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IodGhpcy5nZXRTdGF0aWNUeXBlKGNvcmVEZWNvcmF0b3JzLCAnQ29tcG9uZW50JyksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQ29tcG9uZW50TWV0YWRhdGEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgWydiaW5kaW5ncycsICdwcm92aWRlcnMnLCAnZGlyZWN0aXZlcycsICdwaXBlcyddKTtcblxuICAgIC8vIE5vdGU6IFNvbWUgbWV0YWRhdGEgY2xhc3NlcyBjYW4gYmUgdXNlZCBkaXJlY3RseSB3aXRoIFByb3ZpZGVyLmRlcHMuXG4gICAgdGhpcy5yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IodGhpcy5nZXRTdGF0aWNUeXBlKGRpTWV0YWRhdGEsICdIb3N0TWV0YWRhdGEnKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBIb3N0TWV0YWRhdGEpO1xuICAgIHRoaXMucmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKHRoaXMuZ2V0U3RhdGljVHlwZShkaU1ldGFkYXRhLCAnU2VsZk1ldGFkYXRhJyksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgU2VsZk1ldGFkYXRhKTtcbiAgICB0aGlzLnJlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3Rvcih0aGlzLmdldFN0YXRpY1R5cGUoZGlNZXRhZGF0YSwgJ1NraXBTZWxmTWV0YWRhdGEnKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBTa2lwU2VsZk1ldGFkYXRhKTtcbiAgICB0aGlzLnJlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3Rvcih0aGlzLmdldFN0YXRpY1R5cGUoZGlNZXRhZGF0YSwgJ09wdGlvbmFsTWV0YWRhdGEnKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBPcHRpb25hbE1ldGFkYXRhKTtcbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgcHVibGljIHNpbXBsaWZ5KG1vZHVsZUNvbnRleHQ6IHN0cmluZywgdmFsdWU6IGFueSwgY3Jvc3NNb2R1bGVzOiBib29sZWFuKTogYW55IHtcbiAgICBsZXQgX3RoaXMgPSB0aGlzO1xuXG4gICAgZnVuY3Rpb24gc2ltcGxpZnkoZXhwcmVzc2lvbjogYW55KTogYW55IHtcbiAgICAgIGlmIChpc1ByaW1pdGl2ZShleHByZXNzaW9uKSkge1xuICAgICAgICByZXR1cm4gZXhwcmVzc2lvbjtcbiAgICAgIH1cbiAgICAgIGlmIChpc0FycmF5KGV4cHJlc3Npb24pKSB7XG4gICAgICAgIGxldCByZXN1bHQgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgaXRlbSBvZig8YW55PmV4cHJlc3Npb24pKSB7XG4gICAgICAgICAgcmVzdWx0LnB1c2goc2ltcGxpZnkoaXRlbSkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG4gICAgICBpZiAoaXNQcmVzZW50KGV4cHJlc3Npb24pKSB7XG4gICAgICAgIGlmIChpc1ByZXNlbnQoZXhwcmVzc2lvblsnX19zeW1ib2xpYyddKSkge1xuICAgICAgICAgIHN3aXRjaCAoZXhwcmVzc2lvblsnX19zeW1ib2xpYyddKSB7XG4gICAgICAgICAgICBjYXNlIFwiYmlub3BcIjpcbiAgICAgICAgICAgICAgbGV0IGxlZnQgPSBzaW1wbGlmeShleHByZXNzaW9uWydsZWZ0J10pO1xuICAgICAgICAgICAgICBsZXQgcmlnaHQgPSBzaW1wbGlmeShleHByZXNzaW9uWydyaWdodCddKTtcbiAgICAgICAgICAgICAgc3dpdGNoIChleHByZXNzaW9uWydvcGVyYXRvciddKSB7XG4gICAgICAgICAgICAgICAgY2FzZSAnJiYnOlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgJiYgcmlnaHQ7XG4gICAgICAgICAgICAgICAgY2FzZSAnfHwnOlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgfHwgcmlnaHQ7XG4gICAgICAgICAgICAgICAgY2FzZSAnfCc6XG4gICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCB8IHJpZ2h0O1xuICAgICAgICAgICAgICAgIGNhc2UgJ14nOlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgXiByaWdodDtcbiAgICAgICAgICAgICAgICBjYXNlICcmJzpcbiAgICAgICAgICAgICAgICAgIHJldHVybiBsZWZ0ICYgcmlnaHQ7XG4gICAgICAgICAgICAgICAgY2FzZSAnPT0nOlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgPT0gcmlnaHQ7XG4gICAgICAgICAgICAgICAgY2FzZSAnIT0nOlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgIT0gcmlnaHQ7XG4gICAgICAgICAgICAgICAgY2FzZSAnPT09JzpcbiAgICAgICAgICAgICAgICAgIHJldHVybiBsZWZ0ID09PSByaWdodDtcbiAgICAgICAgICAgICAgICBjYXNlICchPT0nOlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgIT09IHJpZ2h0O1xuICAgICAgICAgICAgICAgIGNhc2UgJzwnOlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgPCByaWdodDtcbiAgICAgICAgICAgICAgICBjYXNlICc+JzpcbiAgICAgICAgICAgICAgICAgIHJldHVybiBsZWZ0ID4gcmlnaHQ7XG4gICAgICAgICAgICAgICAgY2FzZSAnPD0nOlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgPD0gcmlnaHQ7XG4gICAgICAgICAgICAgICAgY2FzZSAnPj0nOlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgPj0gcmlnaHQ7XG4gICAgICAgICAgICAgICAgY2FzZSAnPDwnOlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgPDwgcmlnaHQ7XG4gICAgICAgICAgICAgICAgY2FzZSAnPj4nOlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgPj4gcmlnaHQ7XG4gICAgICAgICAgICAgICAgY2FzZSAnKyc6XG4gICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCArIHJpZ2h0O1xuICAgICAgICAgICAgICAgIGNhc2UgJy0nOlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgLSByaWdodDtcbiAgICAgICAgICAgICAgICBjYXNlICcqJzpcbiAgICAgICAgICAgICAgICAgIHJldHVybiBsZWZ0ICogcmlnaHQ7XG4gICAgICAgICAgICAgICAgY2FzZSAnLyc6XG4gICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCAvIHJpZ2h0O1xuICAgICAgICAgICAgICAgIGNhc2UgJyUnOlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgJSByaWdodDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIGNhc2UgXCJwcmVcIjpcbiAgICAgICAgICAgICAgbGV0IG9wZXJhbmQgPSBzaW1wbGlmeShleHByZXNzaW9uWydvcGVyYW5kJ10pO1xuICAgICAgICAgICAgICBzd2l0Y2ggKGV4cHJlc3Npb25bJ29wZXJhdG9yJ10pIHtcbiAgICAgICAgICAgICAgICBjYXNlICcrJzpcbiAgICAgICAgICAgICAgICAgIHJldHVybiBvcGVyYW5kO1xuICAgICAgICAgICAgICAgIGNhc2UgJy0nOlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIC1vcGVyYW5kO1xuICAgICAgICAgICAgICAgIGNhc2UgJyEnOlxuICAgICAgICAgICAgICAgICAgcmV0dXJuICFvcGVyYW5kO1xuICAgICAgICAgICAgICAgIGNhc2UgJ34nOlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIH5vcGVyYW5kO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgY2FzZSBcImluZGV4XCI6XG4gICAgICAgICAgICAgIGxldCBpbmRleFRhcmdldCA9IHNpbXBsaWZ5KGV4cHJlc3Npb25bJ2V4cHJlc3Npb24nXSk7XG4gICAgICAgICAgICAgIGxldCBpbmRleCA9IHNpbXBsaWZ5KGV4cHJlc3Npb25bJ2luZGV4J10pO1xuICAgICAgICAgICAgICBpZiAoaXNQcmVzZW50KGluZGV4VGFyZ2V0KSAmJiBpc1ByaW1pdGl2ZShpbmRleCkpIHJldHVybiBpbmRleFRhcmdldFtpbmRleF07XG4gICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgY2FzZSBcInNlbGVjdFwiOlxuICAgICAgICAgICAgICBsZXQgc2VsZWN0VGFyZ2V0ID0gc2ltcGxpZnkoZXhwcmVzc2lvblsnZXhwcmVzc2lvbiddKTtcbiAgICAgICAgICAgICAgbGV0IG1lbWJlciA9IHNpbXBsaWZ5KGV4cHJlc3Npb25bJ21lbWJlciddKTtcbiAgICAgICAgICAgICAgaWYgKGlzUHJlc2VudChzZWxlY3RUYXJnZXQpICYmIGlzUHJpbWl0aXZlKG1lbWJlcikpIHJldHVybiBzZWxlY3RUYXJnZXRbbWVtYmVyXTtcbiAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICBjYXNlIFwicmVmZXJlbmNlXCI6XG4gICAgICAgICAgICAgIGxldCByZWZlcmVuY2VNb2R1bGVOYW1lO1xuICAgICAgICAgICAgICBsZXQgZGVjbGFyYXRpb25QYXRoID0gbW9kdWxlQ29udGV4dDtcbiAgICAgICAgICAgICAgbGV0IGRlY2xhcmVkTmFtZSA9IGV4cHJlc3Npb25bJ25hbWUnXTtcbiAgICAgICAgICAgICAgaWYgKGlzUHJlc2VudChleHByZXNzaW9uWydtb2R1bGUnXSkpIHtcbiAgICAgICAgICAgICAgICByZWZlcmVuY2VNb2R1bGVOYW1lID0gX3RoaXMuaG9zdC5yZXNvbHZlTW9kdWxlKGV4cHJlc3Npb25bJ21vZHVsZSddLCBtb2R1bGVDb250ZXh0KTtcbiAgICAgICAgICAgICAgICBsZXQgZGVjbCA9IF90aGlzLmhvc3QuZmluZERlY2xhcmF0aW9uKHJlZmVyZW5jZU1vZHVsZU5hbWUsIGV4cHJlc3Npb25bJ25hbWUnXSk7XG4gICAgICAgICAgICAgICAgZGVjbGFyYXRpb25QYXRoID0gZGVjbFsnZGVjbGFyYXRpb25QYXRoJ107XG4gICAgICAgICAgICAgICAgZGVjbGFyZWROYW1lID0gZGVjbFsnZGVjbGFyZWROYW1lJ107XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgbGV0IHJlc3VsdDtcbiAgICAgICAgICAgICAgaWYgKGNyb3NzTW9kdWxlcyB8fCBpc0JsYW5rKGV4cHJlc3Npb25bJ21vZHVsZSddKSkge1xuICAgICAgICAgICAgICAgIGxldCBtb2R1bGVNZXRhZGF0YSA9IF90aGlzLmdldE1vZHVsZU1ldGFkYXRhKGRlY2xhcmF0aW9uUGF0aCk7XG4gICAgICAgICAgICAgICAgbGV0IGRlY2xhcmF0aW9uVmFsdWUgPSBtb2R1bGVNZXRhZGF0YVsnbWV0YWRhdGEnXVtkZWNsYXJlZE5hbWVdO1xuICAgICAgICAgICAgICAgIGlmIChpc0NsYXNzTWV0YWRhdGEoZGVjbGFyYXRpb25WYWx1ZSkpIHtcbiAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IF90aGlzLmdldFN0YXRpY1R5cGUoZGVjbGFyYXRpb25QYXRoLCBkZWNsYXJlZE5hbWUpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICByZXN1bHQgPSBfdGhpcy5zaW1wbGlmeShkZWNsYXJhdGlvblBhdGgsIGRlY2xhcmF0aW9uVmFsdWUsIGNyb3NzTW9kdWxlcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlc3VsdCA9IF90aGlzLmdldFN0YXRpY1R5cGUoZGVjbGFyYXRpb25QYXRoLCBkZWNsYXJlZE5hbWUpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgICBjYXNlIFwibmV3XCI6XG4gICAgICAgICAgICBjYXNlIFwiY2FsbFwiOlxuICAgICAgICAgICAgICBsZXQgdGFyZ2V0ID0gZXhwcmVzc2lvblsnZXhwcmVzc2lvbiddO1xuICAgICAgICAgICAgICBsZXQgbW9kdWxlSWQgPSBfdGhpcy5ob3N0LnJlc29sdmVNb2R1bGUodGFyZ2V0Wydtb2R1bGUnXSwgbW9kdWxlQ29udGV4dCk7XG4gICAgICAgICAgICAgIGxldCBkZWNsID0gX3RoaXMuaG9zdC5maW5kRGVjbGFyYXRpb24obW9kdWxlSWQsIHRhcmdldFsnbmFtZSddKTtcbiAgICAgICAgICAgICAgbGV0IHN0YXRpY1R5cGUgPSBfdGhpcy5nZXRTdGF0aWNUeXBlKGRlY2xbJ2RlY2xhcmF0aW9uUGF0aCddLCBkZWNsWydkZWNsYXJlZE5hbWUnXSk7XG4gICAgICAgICAgICAgIGxldCBjb252ZXJ0ZXIgPSBfdGhpcy5jb252ZXJzaW9uTWFwLmdldChzdGF0aWNUeXBlKTtcbiAgICAgICAgICAgICAgbGV0IGFyZ3MgPSBleHByZXNzaW9uWydhcmd1bWVudHMnXTtcbiAgICAgICAgICAgICAgaWYgKGlzQmxhbmsoYXJncykpIHtcbiAgICAgICAgICAgICAgICBhcmdzID0gW107XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIGlzUHJlc2VudChjb252ZXJ0ZXIpID8gY29udmVydGVyKG1vZHVsZUNvbnRleHQsIGFyZ3MpIDogbnVsbDtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1hcFN0cmluZ01hcChleHByZXNzaW9uLCAodmFsdWUsIG5hbWUpID0+IHNpbXBsaWZ5KHZhbHVlKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4gc2ltcGxpZnkodmFsdWUpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwYXJhbSBtb2R1bGUgYW4gYWJzb2x1dGUgcGF0aCB0byBhIG1vZHVsZSBmaWxlLlxuICAgKi9cbiAgcHVibGljIGdldE1vZHVsZU1ldGFkYXRhKG1vZHVsZTogc3RyaW5nKToge1trZXk6IHN0cmluZ106IGFueX0ge1xuICAgIGxldCBtb2R1bGVNZXRhZGF0YSA9IHRoaXMubWV0YWRhdGFDYWNoZS5nZXQobW9kdWxlKTtcbiAgICBpZiAoIWlzUHJlc2VudChtb2R1bGVNZXRhZGF0YSkpIHtcbiAgICAgIG1vZHVsZU1ldGFkYXRhID0gdGhpcy5ob3N0LmdldE1ldGFkYXRhRm9yKG1vZHVsZSk7XG4gICAgICBpZiAoIWlzUHJlc2VudChtb2R1bGVNZXRhZGF0YSkpIHtcbiAgICAgICAgbW9kdWxlTWV0YWRhdGEgPSB7X19zeW1ib2xpYzogXCJtb2R1bGVcIiwgbW9kdWxlOiBtb2R1bGUsIG1ldGFkYXRhOiB7fX07XG4gICAgICB9XG4gICAgICB0aGlzLm1ldGFkYXRhQ2FjaGUuc2V0KG1vZHVsZSwgbW9kdWxlTWV0YWRhdGEpO1xuICAgIH1cbiAgICByZXR1cm4gbW9kdWxlTWV0YWRhdGE7XG4gIH1cblxuICBwcml2YXRlIGdldFR5cGVNZXRhZGF0YSh0eXBlOiBTdGF0aWNUeXBlKToge1trZXk6IHN0cmluZ106IGFueX0ge1xuICAgIGxldCBtb2R1bGVNZXRhZGF0YSA9IHRoaXMuZ2V0TW9kdWxlTWV0YWRhdGEodHlwZS5tb2R1bGVJZCk7XG4gICAgbGV0IHJlc3VsdCA9IG1vZHVsZU1ldGFkYXRhWydtZXRhZGF0YSddW3R5cGUubmFtZV07XG4gICAgaWYgKCFpc1ByZXNlbnQocmVzdWx0KSkge1xuICAgICAgcmVzdWx0ID0ge19fc3ltYm9saWM6IFwiY2xhc3NcIn07XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNDbGFzc01ldGFkYXRhKGV4cHJlc3Npb246IGFueSk6IGJvb2xlYW4ge1xuICByZXR1cm4gIWlzUHJpbWl0aXZlKGV4cHJlc3Npb24pICYmICFpc0FycmF5KGV4cHJlc3Npb24pICYmIGV4cHJlc3Npb25bJ19fc3ltYm9saWMnXSA9PSAnY2xhc3MnO1xufVxuXG5mdW5jdGlvbiBtYXBTdHJpbmdNYXAoaW5wdXQ6IHtba2V5OiBzdHJpbmddOiBhbnl9LFxuICAgICAgICAgICAgICAgICAgICAgIHRyYW5zZm9ybTogKHZhbHVlOiBhbnksIGtleTogc3RyaW5nKSA9PiBhbnkpOiB7W2tleTogc3RyaW5nXTogYW55fSB7XG4gIGlmIChpc0JsYW5rKGlucHV0KSkgcmV0dXJuIHt9O1xuICB2YXIgcmVzdWx0ID0ge307XG4gIFN0cmluZ01hcFdyYXBwZXIua2V5cyhpbnB1dCkuZm9yRWFjaCgoa2V5KSA9PiB7IHJlc3VsdFtrZXldID0gdHJhbnNmb3JtKGlucHV0W2tleV0sIGtleSk7IH0pO1xuICByZXR1cm4gcmVzdWx0O1xufVxuIl19