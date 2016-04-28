library angular2.src.compiler.static_reflector;

import "package:angular2/src/facade/collection.dart"
    show StringMapWrapper, ListWrapper;
import "package:angular2/src/facade/lang.dart"
    show isArray, isPresent, isBlank, isPrimitive, isStringMap, FunctionWrapper;
import "package:angular2/src/core/metadata.dart"
    show
        AttributeMetadata,
        DirectiveMetadata,
        ComponentMetadata,
        ContentChildrenMetadata,
        ContentChildMetadata,
        InputMetadata,
        HostBindingMetadata,
        HostListenerMetadata,
        OutputMetadata,
        PipeMetadata,
        ViewMetadata,
        ViewChildMetadata,
        ViewChildrenMetadata,
        ViewQueryMetadata,
        QueryMetadata;
import "package:angular2/src/core/reflection/reflector_reader.dart"
    show ReflectorReader;
import "package:angular2/src/core/reflection/reflection.dart" show reflector;
import "package:angular2/src/core/di/provider.dart" show Provider;
import "package:angular2/src/core/di/metadata.dart"
    show
        HostMetadata,
        OptionalMetadata,
        InjectableMetadata,
        SelfMetadata,
        SkipSelfMetadata,
        InjectMetadata;

/**
 * The host of the static resolver is expected to be able to provide module metadata in the form of
 * ModuleMetadata. Angular 2 CLI will produce this metadata for a module whenever a .d.ts files is
 * produced and the module has exported variables or classes with decorators. Module metadata can
 * also be produced directly from TypeScript sources by using MetadataCollector in tools/metadata.
 */
abstract class StaticReflectorHost {
  /**
   *  Return a ModuleMetadata for the given module.
   *
   * 
   * 
   */
  Map<String, dynamic> getMetadataFor(String modulePath);
  /**
   * Resolve a module from an import statement form to an absolute path.
   * 
   * 
   */
  String resolveModule(String moduleName, [String containingFile]);
  dynamic findDeclaration(String modulePath, String symbolName);
}

/**
 * A token representing the a reference to a static type.
 *
 * This token is unique for a moduleId and name and can be used as a hash table key.
 */
class StaticType {
  String moduleId;
  String name;
  StaticType(this.moduleId, this.name) {}
}

/**
 * A static reflector implements enough of the Reflector API that is necessary to compile
 * templates statically.
 */
class StaticReflector implements ReflectorReader {
  StaticReflectorHost host;
  var typeCache = new Map<String, StaticType>();
  var annotationCache = new Map<StaticType, List<dynamic>>();
  var propertyCache = new Map<StaticType, Map<String, dynamic>>();
  var parameterCache = new Map<StaticType, List<dynamic>>();
  var metadataCache = new Map<String, Map<String, dynamic>>();
  var conversionMap = new Map<StaticType,
      dynamic /* (moduleContext: string, args: any[]) => any */ >();
  StaticReflector(this.host) {
    this.initializeConversionMap();
  }
  String importUri(dynamic typeOrFunc) {
    return ((typeOrFunc as StaticType)).moduleId;
  }

  /**
   * getStaticType produces a Type whose metadata is known but whose implementation is not loaded.
   * All types passed to the StaticResolver should be pseudo-types returned by this method.
   *
   * 
   * 
   */
  StaticType getStaticType(String moduleId, String name) {
    var key = '''"${ moduleId}".${ name}''';
    var result = this.typeCache[key];
    if (!isPresent(result)) {
      result = new StaticType(moduleId, name);
      this.typeCache[key] = result;
    }
    return result;
  }

  List<dynamic> annotations(StaticType type) {
    var annotations = this.annotationCache[type];
    if (!isPresent(annotations)) {
      var classMetadata = this.getTypeMetadata(type);
      if (isPresent(classMetadata["decorators"])) {
        annotations =
            this.simplify(type.moduleId, classMetadata["decorators"], false);
      } else {
        annotations = [];
      }
      this.annotationCache[type] =
          annotations.where((ann) => isPresent(ann)).toList();
    }
    return annotations;
  }

  Map<String, dynamic> propMetadata(StaticType type) {
    var propMetadata = this.propertyCache[type];
    if (!isPresent(propMetadata)) {
      var classMetadata = this.getTypeMetadata(type);
      var members = isPresent(classMetadata) ? classMetadata["members"] : {};
      propMetadata = mapStringMap(members, (propData, propName) {
        var prop = ((propData as List<dynamic>)).firstWhere(
            (a) => a["___symbolic"] == "property",
            orElse: () => null);
        if (isPresent(prop) && isPresent(prop["decorators"])) {
          return this.simplify(type.moduleId, prop["decorators"], false);
        } else {
          return [];
        }
      });
      this.propertyCache[type] = propMetadata;
    }
    return propMetadata;
  }

  List<dynamic> parameters(StaticType type) {
    var parameters = this.parameterCache[type];
    if (!isPresent(parameters)) {
      var classMetadata = this.getTypeMetadata(type);
      var members = isPresent(classMetadata) ? classMetadata["members"] : null;
      var ctorData = isPresent(members) ? members["___ctor__"] : null;
      if (isPresent(ctorData)) {
        var ctor = ((ctorData as List<dynamic>)).firstWhere(
            (a) => a["___symbolic"] == "constructor",
            orElse: () => null);
        var parameterTypes =
            (this.simplify(type.moduleId, ctor["parameters"], false)
                as List<dynamic>);
        var parameterDecorators =
            (this.simplify(type.moduleId, ctor["parameterDecorators"], false)
                as List<dynamic>);
        parameters = [];
        ListWrapper.forEachWithIndex(parameterTypes, (paramType, index) {
          var nestedResult = [];
          if (isPresent(paramType)) {
            nestedResult.add(paramType);
          }
          var decorators = isPresent(parameterDecorators)
              ? parameterDecorators[index]
              : null;
          if (isPresent(decorators)) {
            ListWrapper.addAll(nestedResult, decorators);
          }
          parameters.add(nestedResult);
        });
      }
      if (!isPresent(parameters)) {
        parameters = [];
      }
      this.parameterCache[type] = parameters;
    }
    return parameters;
  }

  void registerDecoratorOrConstructor(StaticType type, dynamic ctor,
      [List<dynamic> crossModuleProps = const []]) {
    this.conversionMap[type] = (String moduleContext, List<dynamic> args) {
      var argValues = [];
      ListWrapper.forEachWithIndex(args, (arg, index) {
        var argValue;
        if (isStringMap(arg) && isBlank(arg["___symbolic"])) {
          argValue = mapStringMap(
              arg,
              (value, key) => this.simplify(moduleContext, value,
                  !identical(crossModuleProps.indexOf(key), -1)));
        } else {
          argValue = this.simplify(moduleContext, arg,
              !identical(crossModuleProps.indexOf(index), -1));
        }
        argValues.add(argValue);
      });
      return FunctionWrapper.apply(reflector.factory(ctor), argValues);
    };
  }

  void initializeConversionMap() {
    var coreDecorators = this.host.resolveModule("angular2/src/core/metadata");
    var diDecorators =
        this.host.resolveModule("angular2/src/core/di/decorators");
    var diMetadata = this.host.resolveModule("angular2/src/core/di/metadata");
    var provider = this.host.resolveModule("angular2/src/core/di/provider");
    this.registerDecoratorOrConstructor(
        this.getStaticType(provider, "Provider"), Provider);
    this.registerDecoratorOrConstructor(
        this.getStaticType(diDecorators, "Host"), HostMetadata);
    this.registerDecoratorOrConstructor(
        this.getStaticType(diDecorators, "Injectable"), InjectableMetadata);
    this.registerDecoratorOrConstructor(
        this.getStaticType(diDecorators, "Self"), SelfMetadata);
    this.registerDecoratorOrConstructor(
        this.getStaticType(diDecorators, "SkipSelf"), SkipSelfMetadata);
    this.registerDecoratorOrConstructor(
        this.getStaticType(diDecorators, "Inject"), InjectMetadata);
    this.registerDecoratorOrConstructor(
        this.getStaticType(diDecorators, "Optional"), OptionalMetadata);
    this.registerDecoratorOrConstructor(
        this.getStaticType(coreDecorators, "Attribute"), AttributeMetadata);
    this.registerDecoratorOrConstructor(
        this.getStaticType(coreDecorators, "Query"), QueryMetadata);
    this.registerDecoratorOrConstructor(
        this.getStaticType(coreDecorators, "ViewQuery"), ViewQueryMetadata);
    this.registerDecoratorOrConstructor(
        this.getStaticType(coreDecorators, "ContentChild"),
        ContentChildMetadata);
    this.registerDecoratorOrConstructor(
        this.getStaticType(coreDecorators, "ContentChildren"),
        ContentChildrenMetadata);
    this.registerDecoratorOrConstructor(
        this.getStaticType(coreDecorators, "ViewChild"), ViewChildMetadata);
    this.registerDecoratorOrConstructor(
        this.getStaticType(coreDecorators, "ViewChildren"),
        ViewChildrenMetadata);
    this.registerDecoratorOrConstructor(
        this.getStaticType(coreDecorators, "Input"), InputMetadata);
    this.registerDecoratorOrConstructor(
        this.getStaticType(coreDecorators, "Output"), OutputMetadata);
    this.registerDecoratorOrConstructor(
        this.getStaticType(coreDecorators, "Pipe"), PipeMetadata);
    this.registerDecoratorOrConstructor(
        this.getStaticType(coreDecorators, "HostBinding"), HostBindingMetadata);
    this.registerDecoratorOrConstructor(
        this.getStaticType(coreDecorators, "HostListener"),
        HostListenerMetadata);
    this.registerDecoratorOrConstructor(
        this.getStaticType(coreDecorators, "Directive"),
        DirectiveMetadata,
        ["bindings", "providers"]);
    this.registerDecoratorOrConstructor(
        this.getStaticType(coreDecorators, "Component"),
        ComponentMetadata,
        ["bindings", "providers", "directives", "pipes"]);
    // Note: Some metadata classes can be used directly with Provider.deps.
    this.registerDecoratorOrConstructor(
        this.getStaticType(diMetadata, "HostMetadata"), HostMetadata);
    this.registerDecoratorOrConstructor(
        this.getStaticType(diMetadata, "SelfMetadata"), SelfMetadata);
    this.registerDecoratorOrConstructor(
        this.getStaticType(diMetadata, "SkipSelfMetadata"), SkipSelfMetadata);
    this.registerDecoratorOrConstructor(
        this.getStaticType(diMetadata, "OptionalMetadata"), OptionalMetadata);
  }

  /** @internal */
  dynamic simplify(String moduleContext, dynamic value, bool crossModules) {
    var _this = this;
    dynamic simplify(dynamic expression) {
      if (isPrimitive(expression)) {
        return expression;
      }
      if (isArray(expression)) {
        var result = [];
        for (var item in ((expression as dynamic))) {
          result.add(simplify(item));
        }
        return result;
      }
      if (isPresent(expression)) {
        if (isPresent(expression["___symbolic"])) {
          switch (expression["___symbolic"]) {
            case "binop":
              var left = simplify(expression["left"]);
              var right = simplify(expression["right"]);
              switch (expression["operator"]) {
                case "&&":
                  return left && right;
                case "||":
                  return left || right;
                case "|":
                  return left | right;
                case "^":
                  return left ^ right;
                case "&":
                  return left & right;
                case "==":
                  return left == right;
                case "!=":
                  return left != right;
                case "===":
                  return identical(left, right);
                case "!==":
                  return !identical(left, right);
                case "<":
                  return left < right;
                case ">":
                  return left > right;
                case "<=":
                  return left <= right;
                case ">=":
                  return left >= right;
                case "<<":
                  return left << right;
                case ">>":
                  return left >> right;
                case "+":
                  return left + right;
                case "-":
                  return left - right;
                case "*":
                  return left * right;
                case "/":
                  return left / right;
                case "%":
                  return left % right;
              }
              return null;
            case "pre":
              var operand = simplify(expression["operand"]);
              switch (expression["operator"]) {
                case "+":
                  return operand;
                case "-":
                  return -operand;
                case "!":
                  return !operand;
                case "~":
                  return ~operand;
              }
              return null;
            case "index":
              var indexTarget = simplify(expression["expression"]);
              var index = simplify(expression["index"]);
              if (isPresent(indexTarget) && isPrimitive(index))
                return indexTarget[index];
              return null;
            case "select":
              var selectTarget = simplify(expression["expression"]);
              var member = simplify(expression["member"]);
              if (isPresent(selectTarget) && isPrimitive(member))
                return selectTarget[member];
              return null;
            case "reference":
              var referenceModuleName;
              var declarationPath = moduleContext;
              var declaredName = expression["name"];
              if (isPresent(expression["module"])) {
                referenceModuleName = _this.host
                    .resolveModule(expression["module"], moduleContext);
                var decl = _this.host
                    .findDeclaration(referenceModuleName, expression["name"]);
                declarationPath = decl["declarationPath"];
                declaredName = decl["declaredName"];
              }
              var result;
              if (crossModules || isBlank(expression["module"])) {
                var moduleMetadata = _this.getModuleMetadata(declarationPath);
                var declarationValue = moduleMetadata["metadata"][declaredName];
                if (isClassMetadata(declarationValue)) {
                  result = _this.getStaticType(declarationPath, declaredName);
                } else {
                  result = _this.simplify(
                      declarationPath, declarationValue, crossModules);
                }
              } else {
                result = _this.getStaticType(declarationPath, declaredName);
              }
              return result;
            case "new":
            case "call":
              var target = expression["expression"];
              var moduleId =
                  _this.host.resolveModule(target["module"], moduleContext);
              var decl = _this.host.findDeclaration(moduleId, target["name"]);
              var staticType = _this.getStaticType(
                  decl["declarationPath"], decl["declaredName"]);
              var converter = _this.conversionMap[staticType];
              var args = expression["arguments"];
              if (isBlank(args)) {
                args = [];
              }
              return isPresent(converter)
                  ? converter(moduleContext, args)
                  : null;
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
   * 
   */
  Map<String, dynamic> getModuleMetadata(String module) {
    var moduleMetadata = this.metadataCache[module];
    if (!isPresent(moduleMetadata)) {
      moduleMetadata = this.host.getMetadataFor(module);
      if (!isPresent(moduleMetadata)) {
        moduleMetadata = {
          "___symbolic": "module",
          "module": module,
          "metadata": {}
        };
      }
      this.metadataCache[module] = moduleMetadata;
    }
    return moduleMetadata;
  }

  Map<String, dynamic> getTypeMetadata(StaticType type) {
    var moduleMetadata = this.getModuleMetadata(type.moduleId);
    var result = moduleMetadata["metadata"][type.name];
    if (!isPresent(result)) {
      result = {"___symbolic": "class"};
    }
    return result;
  }
}

bool isClassMetadata(dynamic expression) {
  return !isPrimitive(expression) &&
      !isArray(expression) &&
      expression["___symbolic"] == "class";
}

Map<String, dynamic> mapStringMap(Map<String, dynamic> input,
    dynamic /* (value: any, key: string) => any */ transform) {
  if (isBlank(input)) return {};
  var result = {};
  StringMapWrapper.keys(input).forEach((key) {
    result[key] = transform(input[key], key);
  });
  return result;
}
