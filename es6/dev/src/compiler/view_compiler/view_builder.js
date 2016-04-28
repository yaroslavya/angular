import { isPresent, StringWrapper } from 'angular2/src/facade/lang';
import { ListWrapper, StringMapWrapper, SetWrapper } from 'angular2/src/facade/collection';
import * as o from '../output/output_ast';
import { Identifiers, identifierToken } from '../identifiers';
import { ViewConstructorVars, InjectMethodVars, DetectChangesVars, ViewTypeEnum, ViewEncapsulationEnum, ChangeDetectionStrategyEnum, ViewProperties } from './constants';
import { ChangeDetectionStrategy, isDefaultChangeDetectionStrategy } from 'angular2/src/core/change_detection/change_detection';
import { CompileView } from './compile_view';
import { CompileElement, CompileNode } from './compile_element';
import { templateVisitAll } from '../template_ast';
import { getViewFactoryName, createFlatArray, createDiTokenExpression } from './util';
import { ViewType } from 'angular2/src/core/linker/view_type';
import { ViewEncapsulation } from 'angular2/src/core/metadata/view';
import { CompileIdentifierMetadata } from '../compile_metadata';
const IMPLICIT_TEMPLATE_VAR = '\$implicit';
const CLASS_ATTR = 'class';
const STYLE_ATTR = 'style';
var parentRenderNodeVar = o.variable('parentRenderNode');
var rootSelectorVar = o.variable('rootSelector');
export class ViewCompileDependency {
    constructor(comp, factoryPlaceholder) {
        this.comp = comp;
        this.factoryPlaceholder = factoryPlaceholder;
    }
}
export function buildView(view, template, targetDependencies) {
    var builderVisitor = new ViewBuilderVisitor(view, targetDependencies);
    templateVisitAll(builderVisitor, template, view.declarationElement.isNull() ?
        view.declarationElement :
        view.declarationElement.parent);
    return builderVisitor.nestedViewCount;
}
export function finishView(view, targetStatements) {
    view.afterNodes();
    createViewTopLevelStmts(view, targetStatements);
    view.nodes.forEach((node) => {
        if (node instanceof CompileElement && node.hasEmbeddedView) {
            finishView(node.embeddedView, targetStatements);
        }
    });
}
class ViewBuilderVisitor {
    constructor(view, targetDependencies) {
        this.view = view;
        this.targetDependencies = targetDependencies;
        this.nestedViewCount = 0;
    }
    _isRootNode(parent) { return parent.view !== this.view; }
    _addRootNodeAndProject(node, ngContentIndex, parent) {
        var vcAppEl = (node instanceof CompileElement && node.hasViewContainer) ? node.appElement : null;
        if (this._isRootNode(parent)) {
            // store appElement as root node only for ViewContainers
            if (this.view.viewType !== ViewType.COMPONENT) {
                this.view.rootNodesOrAppElements.push(isPresent(vcAppEl) ? vcAppEl : node.renderNode);
            }
        }
        else if (isPresent(parent.component) && isPresent(ngContentIndex)) {
            parent.addContentNode(ngContentIndex, isPresent(vcAppEl) ? vcAppEl : node.renderNode);
        }
    }
    _getParentRenderNode(parent) {
        if (this._isRootNode(parent)) {
            if (this.view.viewType === ViewType.COMPONENT) {
                return parentRenderNodeVar;
            }
            else {
                // root node of an embedded/host view
                return o.NULL_EXPR;
            }
        }
        else {
            return isPresent(parent.component) &&
                parent.component.template.encapsulation !== ViewEncapsulation.Native ?
                o.NULL_EXPR :
                parent.renderNode;
        }
    }
    visitBoundText(ast, parent) {
        return this._visitText(ast, '', ast.ngContentIndex, parent);
    }
    visitText(ast, parent) {
        return this._visitText(ast, ast.value, ast.ngContentIndex, parent);
    }
    _visitText(ast, value, ngContentIndex, parent) {
        var fieldName = `_text_${this.view.nodes.length}`;
        this.view.fields.push(new o.ClassField(fieldName, o.importType(this.view.genConfig.renderTypes.renderText), [o.StmtModifier.Private]));
        var renderNode = o.THIS_EXPR.prop(fieldName);
        var compileNode = new CompileNode(parent, this.view, this.view.nodes.length, renderNode, ast);
        var createRenderNode = o.THIS_EXPR.prop(fieldName)
            .set(ViewProperties.renderer.callMethod('createText', [
            this._getParentRenderNode(parent),
            o.literal(value),
            this.view.createMethod.resetDebugInfoExpr(this.view.nodes.length, ast)
        ]))
            .toStmt();
        this.view.nodes.push(compileNode);
        this.view.createMethod.addStmt(createRenderNode);
        this._addRootNodeAndProject(compileNode, ngContentIndex, parent);
        return renderNode;
    }
    visitNgContent(ast, parent) {
        // the projected nodes originate from a different view, so we don't
        // have debug information for them...
        this.view.createMethod.resetDebugInfo(null, ast);
        var parentRenderNode = this._getParentRenderNode(parent);
        var nodesExpression = ViewProperties.projectableNodes.key(o.literal(ast.index), new o.ArrayType(o.importType(this.view.genConfig.renderTypes.renderNode)));
        if (parentRenderNode !== o.NULL_EXPR) {
            this.view.createMethod.addStmt(ViewProperties.renderer.callMethod('projectNodes', [
                parentRenderNode,
                o.importExpr(Identifiers.flattenNestedViewRenderNodes)
                    .callFn([nodesExpression])
            ])
                .toStmt());
        }
        else if (this._isRootNode(parent)) {
            if (this.view.viewType !== ViewType.COMPONENT) {
                // store root nodes only for embedded/host views
                this.view.rootNodesOrAppElements.push(nodesExpression);
            }
        }
        else {
            if (isPresent(parent.component) && isPresent(ast.ngContentIndex)) {
                parent.addContentNode(ast.ngContentIndex, nodesExpression);
            }
        }
        return null;
    }
    visitElement(ast, parent) {
        var nodeIndex = this.view.nodes.length;
        var createRenderNodeExpr;
        var debugContextExpr = this.view.createMethod.resetDebugInfoExpr(nodeIndex, ast);
        if (nodeIndex === 0 && this.view.viewType === ViewType.HOST) {
            createRenderNodeExpr = o.THIS_EXPR.callMethod('selectOrCreateHostElement', [o.literal(ast.name), rootSelectorVar, debugContextExpr]);
        }
        else {
            createRenderNodeExpr = ViewProperties.renderer.callMethod('createElement', [this._getParentRenderNode(parent), o.literal(ast.name), debugContextExpr]);
        }
        var fieldName = `_el_${nodeIndex}`;
        this.view.fields.push(new o.ClassField(fieldName, o.importType(this.view.genConfig.renderTypes.renderElement), [o.StmtModifier.Private]));
        this.view.createMethod.addStmt(o.THIS_EXPR.prop(fieldName).set(createRenderNodeExpr).toStmt());
        var renderNode = o.THIS_EXPR.prop(fieldName);
        var component = ast.getComponent();
        var directives = ast.directives.map(directiveAst => directiveAst.directive);
        var variables = _readHtmlAndDirectiveVariables(ast.exportAsVars, ast.directives, this.view.viewType);
        var htmlAttrs = _readHtmlAttrs(ast.attrs);
        var attrNameAndValues = _mergeHtmlAndDirectiveAttrs(htmlAttrs, directives);
        for (var i = 0; i < attrNameAndValues.length; i++) {
            var attrName = attrNameAndValues[i][0];
            var attrValue = attrNameAndValues[i][1];
            this.view.createMethod.addStmt(ViewProperties.renderer.callMethod('setElementAttribute', [renderNode, o.literal(attrName), o.literal(attrValue)])
                .toStmt());
        }
        var compileElement = new CompileElement(parent, this.view, nodeIndex, renderNode, ast, component, directives, ast.providers, ast.hasViewContainer, false, variables);
        this.view.nodes.push(compileElement);
        var compViewExpr = null;
        if (isPresent(component)) {
            var nestedComponentIdentifier = new CompileIdentifierMetadata({ name: getViewFactoryName(component, 0) });
            this.targetDependencies.push(new ViewCompileDependency(component, nestedComponentIdentifier));
            compViewExpr = o.variable(`compView_${nodeIndex}`);
            compileElement.setComponentView(compViewExpr);
            this.view.createMethod.addStmt(compViewExpr.set(o.importExpr(nestedComponentIdentifier)
                .callFn([
                ViewProperties.viewUtils,
                compileElement.injector,
                compileElement.appElement
            ]))
                .toDeclStmt());
        }
        compileElement.beforeChildren();
        this._addRootNodeAndProject(compileElement, ast.ngContentIndex, parent);
        templateVisitAll(this, ast.children, compileElement);
        compileElement.afterChildren(this.view.nodes.length - nodeIndex - 1);
        if (isPresent(compViewExpr)) {
            var codeGenContentNodes;
            if (this.view.component.type.isHost) {
                codeGenContentNodes = ViewProperties.projectableNodes;
            }
            else {
                codeGenContentNodes = o.literalArr(compileElement.contentNodesByNgContentIndex.map(nodes => createFlatArray(nodes)));
            }
            this.view.createMethod.addStmt(compViewExpr.callMethod('create', [codeGenContentNodes, o.NULL_EXPR]).toStmt());
        }
        return null;
    }
    visitEmbeddedTemplate(ast, parent) {
        var nodeIndex = this.view.nodes.length;
        var fieldName = `_anchor_${nodeIndex}`;
        this.view.fields.push(new o.ClassField(fieldName, o.importType(this.view.genConfig.renderTypes.renderComment), [o.StmtModifier.Private]));
        this.view.createMethod.addStmt(o.THIS_EXPR.prop(fieldName)
            .set(ViewProperties.renderer.callMethod('createTemplateAnchor', [
            this._getParentRenderNode(parent),
            this.view.createMethod.resetDebugInfoExpr(nodeIndex, ast)
        ]))
            .toStmt());
        var renderNode = o.THIS_EXPR.prop(fieldName);
        var templateVariableBindings = ast.vars.map(varAst => [varAst.value.length > 0 ? varAst.value : IMPLICIT_TEMPLATE_VAR, varAst.name]);
        var directives = ast.directives.map(directiveAst => directiveAst.directive);
        var compileElement = new CompileElement(parent, this.view, nodeIndex, renderNode, ast, null, directives, ast.providers, ast.hasViewContainer, true, {});
        this.view.nodes.push(compileElement);
        this.nestedViewCount++;
        var embeddedView = new CompileView(this.view.component, this.view.genConfig, this.view.pipeMetas, o.NULL_EXPR, this.view.viewIndex + this.nestedViewCount, compileElement, templateVariableBindings);
        this.nestedViewCount += buildView(embeddedView, ast.children, this.targetDependencies);
        compileElement.beforeChildren();
        this._addRootNodeAndProject(compileElement, ast.ngContentIndex, parent);
        compileElement.afterChildren(0);
        return null;
    }
    visitAttr(ast, ctx) { return null; }
    visitDirective(ast, ctx) { return null; }
    visitEvent(ast, eventTargetAndNames) {
        return null;
    }
    visitVariable(ast, ctx) { return null; }
    visitDirectiveProperty(ast, context) { return null; }
    visitElementProperty(ast, context) { return null; }
}
function _mergeHtmlAndDirectiveAttrs(declaredHtmlAttrs, directives) {
    var result = {};
    StringMapWrapper.forEach(declaredHtmlAttrs, (value, key) => { result[key] = value; });
    directives.forEach(directiveMeta => {
        StringMapWrapper.forEach(directiveMeta.hostAttributes, (value, name) => {
            var prevValue = result[name];
            result[name] = isPresent(prevValue) ? mergeAttributeValue(name, prevValue, value) : value;
        });
    });
    return mapToKeyValueArray(result);
}
function _readHtmlAttrs(attrs) {
    var htmlAttrs = {};
    attrs.forEach((ast) => { htmlAttrs[ast.name] = ast.value; });
    return htmlAttrs;
}
function _readHtmlAndDirectiveVariables(elementExportAsVars, directives, viewType) {
    var variables = {};
    var component = null;
    directives.forEach((directive) => {
        if (directive.directive.isComponent) {
            component = directive.directive;
        }
        directive.exportAsVars.forEach(varAst => { variables[varAst.name] = identifierToken(directive.directive.type); });
    });
    elementExportAsVars.forEach((varAst) => {
        variables[varAst.name] = isPresent(component) ? identifierToken(component.type) : null;
    });
    return variables;
}
function mergeAttributeValue(attrName, attrValue1, attrValue2) {
    if (attrName == CLASS_ATTR || attrName == STYLE_ATTR) {
        return `${attrValue1} ${attrValue2}`;
    }
    else {
        return attrValue2;
    }
}
function mapToKeyValueArray(data) {
    var entryArray = [];
    StringMapWrapper.forEach(data, (value, name) => { entryArray.push([name, value]); });
    // We need to sort to get a defined output order
    // for tests and for caching generated artifacts...
    ListWrapper.sort(entryArray, (entry1, entry2) => StringWrapper.compare(entry1[0], entry2[0]));
    var keyValueArray = [];
    entryArray.forEach((entry) => { keyValueArray.push([entry[0], entry[1]]); });
    return keyValueArray;
}
function createViewTopLevelStmts(view, targetStatements) {
    var nodeDebugInfosVar = o.NULL_EXPR;
    if (view.genConfig.genDebugInfo) {
        nodeDebugInfosVar = o.variable(`nodeDebugInfos_${view.component.type.name}${view.viewIndex}`);
        targetStatements.push(nodeDebugInfosVar
            .set(o.literalArr(view.nodes.map(createStaticNodeDebugInfo), new o.ArrayType(new o.ExternalType(Identifiers.StaticNodeDebugInfo), [o.TypeModifier.Const])))
            .toDeclStmt(null, [o.StmtModifier.Final]));
    }
    var renderCompTypeVar = o.variable(`renderType_${view.component.type.name}`);
    if (view.viewIndex === 0) {
        targetStatements.push(renderCompTypeVar.set(o.NULL_EXPR)
            .toDeclStmt(o.importType(Identifiers.RenderComponentType)));
    }
    var viewClass = createViewClass(view, renderCompTypeVar, nodeDebugInfosVar);
    targetStatements.push(viewClass);
    targetStatements.push(createViewFactory(view, viewClass, renderCompTypeVar));
}
function createStaticNodeDebugInfo(node) {
    var compileElement = node instanceof CompileElement ? node : null;
    var providerTokens = [];
    var componentToken = o.NULL_EXPR;
    var varTokenEntries = [];
    if (isPresent(compileElement)) {
        providerTokens = compileElement.getProviderTokens();
        if (isPresent(compileElement.component)) {
            componentToken = createDiTokenExpression(identifierToken(compileElement.component.type));
        }
        StringMapWrapper.forEach(compileElement.variableTokens, (token, varName) => {
            varTokenEntries.push([varName, isPresent(token) ? createDiTokenExpression(token) : o.NULL_EXPR]);
        });
    }
    return o.importExpr(Identifiers.StaticNodeDebugInfo)
        .instantiate([
        o.literalArr(providerTokens, new o.ArrayType(o.DYNAMIC_TYPE, [o.TypeModifier.Const])),
        componentToken,
        o.literalMap(varTokenEntries, new o.MapType(o.DYNAMIC_TYPE, [o.TypeModifier.Const]))
    ], o.importType(Identifiers.StaticNodeDebugInfo, null, [o.TypeModifier.Const]));
}
function createViewClass(view, renderCompTypeVar, nodeDebugInfosVar) {
    var emptyTemplateVariableBindings = view.templateVariableBindings.map((entry) => [entry[0], o.NULL_EXPR]);
    var viewConstructorArgs = [
        new o.FnParam(ViewConstructorVars.viewUtils.name, o.importType(Identifiers.ViewUtils)),
        new o.FnParam(ViewConstructorVars.parentInjector.name, o.importType(Identifiers.Injector)),
        new o.FnParam(ViewConstructorVars.declarationEl.name, o.importType(Identifiers.AppElement))
    ];
    var viewConstructor = new o.ClassMethod(null, viewConstructorArgs, [
        o.SUPER_EXPR.callFn([
            o.variable(view.className),
            renderCompTypeVar,
            ViewTypeEnum.fromValue(view.viewType),
            o.literalMap(emptyTemplateVariableBindings),
            ViewConstructorVars.viewUtils,
            ViewConstructorVars.parentInjector,
            ViewConstructorVars.declarationEl,
            ChangeDetectionStrategyEnum.fromValue(getChangeDetectionMode(view)),
            nodeDebugInfosVar
        ])
            .toStmt()
    ]);
    var viewMethods = [
        new o.ClassMethod('createInternal', [new o.FnParam(rootSelectorVar.name, o.STRING_TYPE)], generateCreateMethod(view), o.importType(Identifiers.AppElement)),
        new o.ClassMethod('injectorGetInternal', [
            new o.FnParam(InjectMethodVars.token.name, o.DYNAMIC_TYPE),
            // Note: Can't use o.INT_TYPE here as the method in AppView uses number
            new o.FnParam(InjectMethodVars.requestNodeIndex.name, o.NUMBER_TYPE),
            new o.FnParam(InjectMethodVars.notFoundResult.name, o.DYNAMIC_TYPE)
        ], addReturnValuefNotEmpty(view.injectorGetMethod.finish(), InjectMethodVars.notFoundResult), o.DYNAMIC_TYPE),
        new o.ClassMethod('detectChangesInternal', [new o.FnParam(DetectChangesVars.throwOnChange.name, o.BOOL_TYPE)], generateDetectChangesMethod(view)),
        new o.ClassMethod('dirtyParentQueriesInternal', [], view.dirtyParentQueriesMethod.finish()),
        new o.ClassMethod('destroyInternal', [], view.destroyMethod.finish())
    ].concat(view.eventHandlerMethods);
    var viewClass = new o.ClassStmt(view.className, o.importExpr(Identifiers.AppView, [getContextType(view)]), view.fields, view.getters, viewConstructor, viewMethods.filter((method) => method.body.length > 0));
    return viewClass;
}
function createViewFactory(view, viewClass, renderCompTypeVar) {
    var viewFactoryArgs = [
        new o.FnParam(ViewConstructorVars.viewUtils.name, o.importType(Identifiers.ViewUtils)),
        new o.FnParam(ViewConstructorVars.parentInjector.name, o.importType(Identifiers.Injector)),
        new o.FnParam(ViewConstructorVars.declarationEl.name, o.importType(Identifiers.AppElement))
    ];
    var initRenderCompTypeStmts = [];
    var templateUrlInfo;
    if (view.component.template.templateUrl == view.component.type.moduleUrl) {
        templateUrlInfo =
            `${view.component.type.moduleUrl} class ${view.component.type.name} - inline template`;
    }
    else {
        templateUrlInfo = view.component.template.templateUrl;
    }
    if (view.viewIndex === 0) {
        initRenderCompTypeStmts = [
            new o.IfStmt(renderCompTypeVar.identical(o.NULL_EXPR), [
                renderCompTypeVar.set(ViewConstructorVars
                    .viewUtils.callMethod('createRenderComponentType', [
                    o.literal(templateUrlInfo),
                    o.literal(view.component
                        .template.ngContentSelectors.length),
                    ViewEncapsulationEnum
                        .fromValue(view.component.template.encapsulation),
                    view.styles
                ]))
                    .toStmt()
            ])
        ];
    }
    return o.fn(viewFactoryArgs, initRenderCompTypeStmts.concat([
        new o.ReturnStatement(o.variable(viewClass.name)
            .instantiate(viewClass.constructorMethod.params.map((param) => o.variable(param.name))))
    ]), o.importType(Identifiers.AppView, [getContextType(view)]))
        .toDeclStmt(view.viewFactory.name, [o.StmtModifier.Final]);
}
function generateCreateMethod(view) {
    var parentRenderNodeExpr = o.NULL_EXPR;
    var parentRenderNodeStmts = [];
    if (view.viewType === ViewType.COMPONENT) {
        parentRenderNodeExpr = ViewProperties.renderer.callMethod('createViewRoot', [o.THIS_EXPR.prop('declarationAppElement').prop('nativeElement')]);
        parentRenderNodeStmts = [
            parentRenderNodeVar.set(parentRenderNodeExpr)
                .toDeclStmt(o.importType(view.genConfig.renderTypes.renderNode), [o.StmtModifier.Final])
        ];
    }
    var resultExpr;
    if (view.viewType === ViewType.HOST) {
        resultExpr = view.nodes[0].appElement;
    }
    else {
        resultExpr = o.NULL_EXPR;
    }
    return parentRenderNodeStmts.concat(view.createMethod.finish())
        .concat([
        o.THIS_EXPR.callMethod('init', [
            createFlatArray(view.rootNodesOrAppElements),
            o.literalArr(view.nodes.map(node => node.renderNode)),
            o.literalArr(view.disposables),
            o.literalArr(view.subscriptions)
        ])
            .toStmt(),
        new o.ReturnStatement(resultExpr)
    ]);
}
function generateDetectChangesMethod(view) {
    var stmts = [];
    if (view.detectChangesInInputsMethod.isEmpty() && view.updateContentQueriesMethod.isEmpty() &&
        view.afterContentLifecycleCallbacksMethod.isEmpty() &&
        view.detectChangesRenderPropertiesMethod.isEmpty() &&
        view.updateViewQueriesMethod.isEmpty() && view.afterViewLifecycleCallbacksMethod.isEmpty()) {
        return stmts;
    }
    ListWrapper.addAll(stmts, view.detectChangesInInputsMethod.finish());
    stmts.push(o.THIS_EXPR.callMethod('detectContentChildrenChanges', [DetectChangesVars.throwOnChange])
        .toStmt());
    var afterContentStmts = view.updateContentQueriesMethod.finish().concat(view.afterContentLifecycleCallbacksMethod.finish());
    if (afterContentStmts.length > 0) {
        stmts.push(new o.IfStmt(o.not(DetectChangesVars.throwOnChange), afterContentStmts));
    }
    ListWrapper.addAll(stmts, view.detectChangesRenderPropertiesMethod.finish());
    stmts.push(o.THIS_EXPR.callMethod('detectViewChildrenChanges', [DetectChangesVars.throwOnChange])
        .toStmt());
    var afterViewStmts = view.updateViewQueriesMethod.finish().concat(view.afterViewLifecycleCallbacksMethod.finish());
    if (afterViewStmts.length > 0) {
        stmts.push(new o.IfStmt(o.not(DetectChangesVars.throwOnChange), afterViewStmts));
    }
    var varStmts = [];
    var readVars = o.findReadVarNames(stmts);
    if (SetWrapper.has(readVars, DetectChangesVars.changed.name)) {
        varStmts.push(DetectChangesVars.changed.set(o.literal(true)).toDeclStmt(o.BOOL_TYPE));
    }
    if (SetWrapper.has(readVars, DetectChangesVars.changes.name)) {
        varStmts.push(DetectChangesVars.changes.set(o.NULL_EXPR)
            .toDeclStmt(new o.MapType(o.importType(Identifiers.SimpleChange))));
    }
    if (SetWrapper.has(readVars, DetectChangesVars.valUnwrapper.name)) {
        varStmts.push(DetectChangesVars.valUnwrapper.set(o.importExpr(Identifiers.ValueUnwrapper).instantiate([]))
            .toDeclStmt(null, [o.StmtModifier.Final]));
    }
    return varStmts.concat(stmts);
}
function addReturnValuefNotEmpty(statements, value) {
    if (statements.length > 0) {
        return statements.concat([new o.ReturnStatement(value)]);
    }
    else {
        return statements;
    }
}
function getContextType(view) {
    var typeMeta = view.component.type;
    return typeMeta.isHost ? o.DYNAMIC_TYPE : o.importType(typeMeta);
}
function getChangeDetectionMode(view) {
    var mode;
    if (view.viewType === ViewType.COMPONENT) {
        mode = isDefaultChangeDetectionStrategy(view.component.changeDetection) ?
            ChangeDetectionStrategy.CheckAlways :
            ChangeDetectionStrategy.CheckOnce;
    }
    else {
        mode = ChangeDetectionStrategy.CheckAlways;
    }
    return mode;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlld19idWlsZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZGlmZmluZ19wbHVnaW5fd3JhcHBlci1vdXRwdXRfcGF0aC15Y1RuOUJ0Ry50bXAvYW5ndWxhcjIvc3JjL2NvbXBpbGVyL3ZpZXdfY29tcGlsZXIvdmlld19idWlsZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJPQUFPLEVBQUMsU0FBUyxFQUFXLGFBQWEsRUFBQyxNQUFNLDBCQUEwQjtPQUNuRSxFQUFDLFdBQVcsRUFBRSxnQkFBZ0IsRUFBRSxVQUFVLEVBQUMsTUFBTSxnQ0FBZ0M7T0FFakYsS0FBSyxDQUFDLE1BQU0sc0JBQXNCO09BQ2xDLEVBQUMsV0FBVyxFQUFFLGVBQWUsRUFBQyxNQUFNLGdCQUFnQjtPQUNwRCxFQUNMLG1CQUFtQixFQUNuQixnQkFBZ0IsRUFDaEIsaUJBQWlCLEVBQ2pCLFlBQVksRUFDWixxQkFBcUIsRUFDckIsMkJBQTJCLEVBQzNCLGNBQWMsRUFDZixNQUFNLGFBQWE7T0FDYixFQUNMLHVCQUF1QixFQUN2QixnQ0FBZ0MsRUFDakMsTUFBTSxxREFBcUQ7T0FFckQsRUFBQyxXQUFXLEVBQUMsTUFBTSxnQkFBZ0I7T0FDbkMsRUFBQyxjQUFjLEVBQUUsV0FBVyxFQUFDLE1BQU0sbUJBQW1CO09BRXRELEVBY0wsZ0JBQWdCLEVBR2pCLE1BQU0saUJBQWlCO09BRWpCLEVBQUMsa0JBQWtCLEVBQUUsZUFBZSxFQUFFLHVCQUF1QixFQUFDLE1BQU0sUUFBUTtPQUU1RSxFQUFDLFFBQVEsRUFBQyxNQUFNLG9DQUFvQztPQUNwRCxFQUFDLGlCQUFpQixFQUFDLE1BQU0saUNBQWlDO09BRTFELEVBQ0wseUJBQXlCLEVBRzFCLE1BQU0scUJBQXFCO0FBRTVCLE1BQU0scUJBQXFCLEdBQUcsWUFBWSxDQUFDO0FBQzNDLE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQztBQUMzQixNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUM7QUFFM0IsSUFBSSxtQkFBbUIsR0FB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QUMsQ0FBQztRQUMxQixNQUFNLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDM0QsQ0FBQztJQUFDLElBQUksQ0FBQyxDQUFDO1FBQ04sTUFBTSxDQUFDLFVBQVUsQ0FBQztJQUNwQixDQUFDO0FBQ0gsQ0FBQztBQUVELHdCQUF3QixJQUFpQjtJQUN2QyxJQUFJLFFBQVEsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQztJQUNuQyxNQUFNLENBQUMsUUFBUSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsWUFBWSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDbkUsQ0FBQztBQUVELGdDQUFnQyxJQUFpQjtJQUMvQyxJQUFJLElBQTZCLENBQUM7SUFDbEMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztRQUN6QyxJQUFJLEdBQUcsZ0NBQWdDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUM7WUFDNUQsdUJBQXVCLENBQUMsV0FBVztZQUNuQyx1QkFBdUIsQ0FBQyxTQUFTLENBQUM7SUFDL0MsQ0FBQztJQUFDLElBQUksQ0FBQyxDQUFDO1FBQ04sSUFBSSxHQUFHLHVCQUF1QixDQUFDLFdBQVcsQ0FBQztJQUM3QyxDQUFDO0lBQ0QsTUFBTSxDQUFDLElBQUksQ0FBQztBQUNkLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge2lzUHJlc2VudCwgaXNCbGFuaywgU3RyaW5nV3JhcHBlcn0gZnJvbSAnYW5ndWxhcjIvc3JjL2ZhY2FkZS9sYW5nJztcbmltcG9ydCB7TGlzdFdyYXBwZXIsIFN0cmluZ01hcFdyYXBwZXIsIFNldFdyYXBwZXJ9IGZyb20gJ2FuZ3VsYXIyL3NyYy9mYWNhZGUvY29sbGVjdGlvbic7XG5cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtJZGVudGlmaWVycywgaWRlbnRpZmllclRva2VufSBmcm9tICcuLi9pZGVudGlmaWVycyc7XG5pbXBvcnQge1xuICBWaWV3Q29uc3RydWN0b3JWYXJzLFxuICBJbmplY3RNZXRob2RWYXJzLFxuICBEZXRlY3RDaGFuZ2VzVmFycyxcbiAgVmlld1R5cGVFbnVtLFxuICBWaWV3RW5jYXBzdWxhdGlvbkVudW0sXG4gIENoYW5nZURldGVjdGlvblN0cmF0ZWd5RW51bSxcbiAgVmlld1Byb3BlcnRpZXNcbn0gZnJvbSAnLi9jb25zdGFudHMnO1xuaW1wb3J0IHtcbiAgQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3ksXG4gIGlzRGVmYXVsdENoYW5nZURldGVjdGlvblN0cmF0ZWd5XG59IGZyb20gJ2FuZ3VsYXIyL3NyYy9jb3JlL2NoYW5nZV9kZXRlY3Rpb24vY2hhbmdlX2RldGVjdGlvbic7XG5cbmltcG9ydCB7Q29tcGlsZVZpZXd9IGZyb20gJy4vY29tcGlsZV92aWV3JztcbmltcG9ydCB7Q29tcGlsZUVsZW1lbnQsIENvbXBpbGVOb2RlfSBmcm9tICcuL2NvbXBpbGVfZWxlbWVudCc7XG5cbmltcG9ydCB7XG4gIFRlbXBsYXRlQXN0LFxuICBUZW1wbGF0ZUFzdFZpc2l0b3IsXG4gIE5nQ29udGVudEFzdCxcbiAgRW1iZWRkZWRUZW1wbGF0ZUFzdCxcbiAgRWxlbWVudEFzdCxcbiAgVmFyaWFibGVBc3QsXG4gIEJvdW5kRXZlbnRBc3QsXG4gIEJvdW5kRWxlbWVudFByb3BlcnR5QXN0LFxuICBBdHRyQXN0LFxuICBCb3VuZFRleHRBc3QsXG4gIFRleHRBc3QsXG4gIERpcmVjdGl2ZUFzdCxcbiAgQm91bmREaXJlY3RpdmVQcm9wZXJ0eUFzdCxcbiAgdGVtcGxhdGVWaXNpdEFsbCxcbiAgUHJvcGVydHlCaW5kaW5nVHlwZSxcbiAgUHJvdmlkZXJBc3Rcbn0gZnJvbSAnLi4vdGVtcGxhdGVfYXN0JztcblxuaW1wb3J0IHtnZXRWaWV3RmFjdG9yeU5hbWUsIGNyZWF0ZUZsYXRBcnJheSwgY3JlYXRlRGlUb2tlbkV4cHJlc3Npb259IGZyb20gJy4vdXRpbCc7XG5cbmltcG9ydCB7Vmlld1R5cGV9IGZyb20gJ2FuZ3VsYXIyL3NyYy9jb3JlL2xpbmtlci92aWV3X3R5cGUnO1xuaW1wb3J0IHtWaWV3RW5jYXBzdWxhdGlvbn0gZnJvbSAnYW5ndWxhcjIvc3JjL2NvcmUvbWV0YWRhdGEvdmlldyc7XG5cbmltcG9ydCB7XG4gIENvbXBpbGVJZGVudGlmaWVyTWV0YWRhdGEsXG4gIENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSxcbiAgQ29tcGlsZVRva2VuTWV0YWRhdGFcbn0gZnJvbSAnLi4vY29tcGlsZV9tZXRhZGF0YSc7XG5cbmNvbnN0IElNUExJQ0lUX1RFTVBMQVRFX1ZBUiA9ICdcXCRpbXBsaWNpdCc7XG5jb25zdCBDTEFTU19BVFRSID0gJ2NsYXNzJztcbmNvbnN0IFNUWUxFX0FUVFIgPSAnc3R5bGUnO1xuXG52YXIgcGFyZW50UmVuZGVyTm9kZVZhciA9IG8udmFyaWFibGUoJ3BhcmVudFJlbmRlck5vZGUnKTtcbnZhciByb290U2VsZWN0b3JWYXIgPSBvLnZhcmlhYmxlKCdyb290U2VsZWN0b3InKTtcblxuZXhwb3J0IGNsYXNzIFZpZXdDb21waWxlRGVwZW5kZW5jeSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBjb21wOiBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsXG4gICAgICAgICAgICAgIHB1YmxpYyBmYWN0b3J5UGxhY2Vob2xkZXI6IENvbXBpbGVJZGVudGlmaWVyTWV0YWRhdGEpIHt9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBidWlsZFZpZXcodmlldzogQ29tcGlsZVZpZXcsIHRlbXBsYXRlOiBUZW1wbGF0ZUFzdFtdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXREZXBlbmRlbmNpZXM6IFZpZXdDb21waWxlRGVwZW5kZW5jeVtdKTogbnVtYmVyIHtcbiAgdmFyIGJ1aWxkZXJWaXNpdG9yID0gbmV3IFZpZXdCdWlsZGVyVmlzaXRvcih2aWV3LCB0YXJnZXREZXBlbmRlbmNpZXMpO1xuICB0ZW1wbGF0ZVZpc2l0QWxsKGJ1aWxkZXJWaXNpdG9yLCB0ZW1wbGF0ZSwgdmlldy5kZWNsYXJhdGlvbkVsZW1lbnQuaXNOdWxsKCkgP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZpZXcuZGVjbGFyYXRpb25FbGVtZW50IDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2aWV3LmRlY2xhcmF0aW9uRWxlbWVudC5wYXJlbnQpO1xuICByZXR1cm4gYnVpbGRlclZpc2l0b3IubmVzdGVkVmlld0NvdW50O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZmluaXNoVmlldyh2aWV3OiBDb21waWxlVmlldywgdGFyZ2V0U3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSkge1xuICB2aWV3LmFmdGVyTm9kZXMoKTtcbiAgY3JlYXRlVmlld1RvcExldmVsU3RtdHModmlldywgdGFyZ2V0U3RhdGVtZW50cyk7XG4gIHZpZXcubm9kZXMuZm9yRWFjaCgobm9kZSkgPT4ge1xuICAgIGlmIChub2RlIGluc3RhbmNlb2YgQ29tcGlsZUVsZW1lbnQgJiYgbm9kZS5oYXNFbWJlZGRlZFZpZXcpIHtcbiAgICAgIGZpbmlzaFZpZXcobm9kZS5lbWJlZGRlZFZpZXcsIHRhcmdldFN0YXRlbWVudHMpO1xuICAgIH1cbiAgfSk7XG59XG5cbmNsYXNzIFZpZXdCdWlsZGVyVmlzaXRvciBpbXBsZW1lbnRzIFRlbXBsYXRlQXN0VmlzaXRvciB7XG4gIG5lc3RlZFZpZXdDb3VudDogbnVtYmVyID0gMDtcblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgdmlldzogQ29tcGlsZVZpZXcsIHB1YmxpYyB0YXJnZXREZXBlbmRlbmNpZXM6IFZpZXdDb21waWxlRGVwZW5kZW5jeVtdKSB7fVxuXG4gIHByaXZhdGUgX2lzUm9vdE5vZGUocGFyZW50OiBDb21waWxlRWxlbWVudCk6IGJvb2xlYW4geyByZXR1cm4gcGFyZW50LnZpZXcgIT09IHRoaXMudmlldzsgfVxuXG4gIHByaXZhdGUgX2FkZFJvb3ROb2RlQW5kUHJvamVjdChub2RlOiBDb21waWxlTm9kZSwgbmdDb250ZW50SW5kZXg6IG51bWJlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhcmVudDogQ29tcGlsZUVsZW1lbnQpIHtcbiAgICB2YXIgdmNBcHBFbCA9XG4gICAgICAgIChub2RlIGluc3RhbmNlb2YgQ29tcGlsZUVsZW1lbnQgJiYgbm9kZS5oYXNWaWV3Q29udGFpbmVyKSA/IG5vZGUuYXBwRWxlbWVudCA6IG51bGw7XG4gICAgaWYgKHRoaXMuX2lzUm9vdE5vZGUocGFyZW50KSkge1xuICAgICAgLy8gc3RvcmUgYXBwRWxlbWVudCBhcyByb290IG5vZGUgb25seSBmb3IgVmlld0NvbnRhaW5lcnNcbiAgICAgIGlmICh0aGlzLnZpZXcudmlld1R5cGUgIT09IFZpZXdUeXBlLkNPTVBPTkVOVCkge1xuICAgICAgICB0aGlzLnZpZXcucm9vdE5vZGVzT3JBcHBFbGVtZW50cy5wdXNoKGlzUHJlc2VudCh2Y0FwcEVsKSA/IHZjQXBwRWwgOiBub2RlLnJlbmRlck5vZGUpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaXNQcmVzZW50KHBhcmVudC5jb21wb25lbnQpICYmIGlzUHJlc2VudChuZ0NvbnRlbnRJbmRleCkpIHtcbiAgICAgIHBhcmVudC5hZGRDb250ZW50Tm9kZShuZ0NvbnRlbnRJbmRleCwgaXNQcmVzZW50KHZjQXBwRWwpID8gdmNBcHBFbCA6IG5vZGUucmVuZGVyTm9kZSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfZ2V0UGFyZW50UmVuZGVyTm9kZShwYXJlbnQ6IENvbXBpbGVFbGVtZW50KTogby5FeHByZXNzaW9uIHtcbiAgICBpZiAodGhpcy5faXNSb290Tm9kZShwYXJlbnQpKSB7XG4gICAgICBpZiAodGhpcy52aWV3LnZpZXdUeXBlID09PSBWaWV3VHlwZS5DT01QT05FTlQpIHtcbiAgICAgICAgcmV0dXJuIHBhcmVudFJlbmRlck5vZGVWYXI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyByb290IG5vZGUgb2YgYW4gZW1iZWRkZWQvaG9zdCB2aWV3XG4gICAgICAgIHJldHVybiBvLk5VTExfRVhQUjtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGlzUHJlc2VudChwYXJlbnQuY29tcG9uZW50KSAmJlxuICAgICAgICAgICAgICAgICAgICAgcGFyZW50LmNvbXBvbmVudC50ZW1wbGF0ZS5lbmNhcHN1bGF0aW9uICE9PSBWaWV3RW5jYXBzdWxhdGlvbi5OYXRpdmUgP1xuICAgICAgICAgICAgICAgICBvLk5VTExfRVhQUiA6XG4gICAgICAgICAgICAgICAgIHBhcmVudC5yZW5kZXJOb2RlO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0Qm91bmRUZXh0KGFzdDogQm91bmRUZXh0QXN0LCBwYXJlbnQ6IENvbXBpbGVFbGVtZW50KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy5fdmlzaXRUZXh0KGFzdCwgJycsIGFzdC5uZ0NvbnRlbnRJbmRleCwgcGFyZW50KTtcbiAgfVxuICB2aXNpdFRleHQoYXN0OiBUZXh0QXN0LCBwYXJlbnQ6IENvbXBpbGVFbGVtZW50KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy5fdmlzaXRUZXh0KGFzdCwgYXN0LnZhbHVlLCBhc3QubmdDb250ZW50SW5kZXgsIHBhcmVudCk7XG4gIH1cbiAgcHJpdmF0ZSBfdmlzaXRUZXh0KGFzdDogVGVtcGxhdGVBc3QsIHZhbHVlOiBzdHJpbmcsIG5nQ29udGVudEluZGV4OiBudW1iZXIsXG4gICAgICAgICAgICAgICAgICAgICBwYXJlbnQ6IENvbXBpbGVFbGVtZW50KTogby5FeHByZXNzaW9uIHtcbiAgICB2YXIgZmllbGROYW1lID0gYF90ZXh0XyR7dGhpcy52aWV3Lm5vZGVzLmxlbmd0aH1gO1xuICAgIHRoaXMudmlldy5maWVsZHMucHVzaChuZXcgby5DbGFzc0ZpZWxkKGZpZWxkTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvLmltcG9ydFR5cGUodGhpcy52aWV3LmdlbkNvbmZpZy5yZW5kZXJUeXBlcy5yZW5kZXJUZXh0KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbby5TdG10TW9kaWZpZXIuUHJpdmF0ZV0pKTtcbiAgICB2YXIgcmVuZGVyTm9kZSA9IG8uVEhJU19FWFBSLnByb3AoZmllbGROYW1lKTtcbiAgICB2YXIgY29tcGlsZU5vZGUgPSBuZXcgQ29tcGlsZU5vZGUocGFyZW50LCB0aGlzLnZpZXcsIHRoaXMudmlldy5ub2Rlcy5sZW5ndGgsIHJlbmRlck5vZGUsIGFzdCk7XG4gICAgdmFyIGNyZWF0ZVJlbmRlck5vZGUgPVxuICAgICAgICBvLlRISVNfRVhQUi5wcm9wKGZpZWxkTmFtZSlcbiAgICAgICAgICAgIC5zZXQoVmlld1Byb3BlcnRpZXMucmVuZGVyZXIuY2FsbE1ldGhvZChcbiAgICAgICAgICAgICAgICAnY3JlYXRlVGV4dCcsXG4gICAgICAgICAgICAgICAgW1xuICAgICAgICAgICAgICAgICAgdGhpcy5fZ2V0UGFyZW50UmVuZGVyTm9kZShwYXJlbnQpLFxuICAgICAgICAgICAgICAgICAgby5saXRlcmFsKHZhbHVlKSxcbiAgICAgICAgICAgICAgICAgIHRoaXMudmlldy5jcmVhdGVNZXRob2QucmVzZXREZWJ1Z0luZm9FeHByKHRoaXMudmlldy5ub2Rlcy5sZW5ndGgsIGFzdClcbiAgICAgICAgICAgICAgICBdKSlcbiAgICAgICAgICAgIC50b1N0bXQoKTtcbiAgICB0aGlzLnZpZXcubm9kZXMucHVzaChjb21waWxlTm9kZSk7XG4gICAgdGhpcy52aWV3LmNyZWF0ZU1ldGhvZC5hZGRTdG10KGNyZWF0ZVJlbmRlck5vZGUpO1xuICAgIHRoaXMuX2FkZFJvb3ROb2RlQW5kUHJvamVjdChjb21waWxlTm9kZSwgbmdDb250ZW50SW5kZXgsIHBhcmVudCk7XG4gICAgcmV0dXJuIHJlbmRlck5vZGU7XG4gIH1cblxuICB2aXNpdE5nQ29udGVudChhc3Q6IE5nQ29udGVudEFzdCwgcGFyZW50OiBDb21waWxlRWxlbWVudCk6IGFueSB7XG4gICAgLy8gdGhlIHByb2plY3RlZCBub2RlcyBvcmlnaW5hdGUgZnJvbSBhIGRpZmZlcmVudCB2aWV3LCBzbyB3ZSBkb24ndFxuICAgIC8vIGhhdmUgZGVidWcgaW5mb3JtYXRpb24gZm9yIHRoZW0uLi5cbiAgICB0aGlzLnZpZXcuY3JlYXRlTWV0aG9kLnJlc2V0RGVidWdJbmZvKG51bGwsIGFzdCk7XG4gICAgdmFyIHBhcmVudFJlbmRlck5vZGUgPSB0aGlzLl9nZXRQYXJlbnRSZW5kZXJOb2RlKHBhcmVudCk7XG4gICAgdmFyIG5vZGVzRXhwcmVzc2lvbiA9IFZpZXdQcm9wZXJ0aWVzLnByb2plY3RhYmxlTm9kZXMua2V5KFxuICAgICAgICBvLmxpdGVyYWwoYXN0LmluZGV4KSxcbiAgICAgICAgbmV3IG8uQXJyYXlUeXBlKG8uaW1wb3J0VHlwZSh0aGlzLnZpZXcuZ2VuQ29uZmlnLnJlbmRlclR5cGVzLnJlbmRlck5vZGUpKSk7XG4gICAgaWYgKHBhcmVudFJlbmRlck5vZGUgIT09IG8uTlVMTF9FWFBSKSB7XG4gICAgICB0aGlzLnZpZXcuY3JlYXRlTWV0aG9kLmFkZFN0bXQoXG4gICAgICAgICAgVmlld1Byb3BlcnRpZXMucmVuZGVyZXIuY2FsbE1ldGhvZChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAncHJvamVjdE5vZGVzJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXJlbnRSZW5kZXJOb2RlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgby5pbXBvcnRFeHByKElkZW50aWZpZXJzLmZsYXR0ZW5OZXN0ZWRWaWV3UmVuZGVyTm9kZXMpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmNhbGxGbihbbm9kZXNFeHByZXNzaW9uXSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBdKVxuICAgICAgICAgICAgICAudG9TdG10KCkpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5faXNSb290Tm9kZShwYXJlbnQpKSB7XG4gICAgICBpZiAodGhpcy52aWV3LnZpZXdUeXBlICE9PSBWaWV3VHlwZS5DT01QT05FTlQpIHtcbiAgICAgICAgLy8gc3RvcmUgcm9vdCBub2RlcyBvbmx5IGZvciBlbWJlZGRlZC9ob3N0IHZpZXdzXG4gICAgICAgIHRoaXMudmlldy5yb290Tm9kZXNPckFwcEVsZW1lbnRzLnB1c2gobm9kZXNFeHByZXNzaW9uKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGlzUHJlc2VudChwYXJlbnQuY29tcG9uZW50KSAmJiBpc1ByZXNlbnQoYXN0Lm5nQ29udGVudEluZGV4KSkge1xuICAgICAgICBwYXJlbnQuYWRkQ29udGVudE5vZGUoYXN0Lm5nQ29udGVudEluZGV4LCBub2Rlc0V4cHJlc3Npb24pO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHZpc2l0RWxlbWVudChhc3Q6IEVsZW1lbnRBc3QsIHBhcmVudDogQ29tcGlsZUVsZW1lbnQpOiBhbnkge1xuICAgIHZhciBub2RlSW5kZXggPSB0aGlzLnZpZXcubm9kZXMubGVuZ3RoO1xuICAgIHZhciBjcmVhdGVSZW5kZXJOb2RlRXhwcjtcbiAgICB2YXIgZGVidWdDb250ZXh0RXhwciA9IHRoaXMudmlldy5jcmVhdGVNZXRob2QucmVzZXREZWJ1Z0luZm9FeHByKG5vZGVJbmRleCwgYXN0KTtcbiAgICBpZiAobm9kZUluZGV4ID09PSAwICYmIHRoaXMudmlldy52aWV3VHlwZSA9PT0gVmlld1R5cGUuSE9TVCkge1xuICAgICAgY3JlYXRlUmVuZGVyTm9kZUV4cHIgPSBvLlRISVNfRVhQUi5jYWxsTWV0aG9kKFxuICAgICAgICAgICdzZWxlY3RPckNyZWF0ZUhvc3RFbGVtZW50JywgW28ubGl0ZXJhbChhc3QubmFtZSksIHJvb3RTZWxlY3RvclZhciwgZGVidWdDb250ZXh0RXhwcl0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBjcmVhdGVSZW5kZXJOb2RlRXhwciA9IFZpZXdQcm9wZXJ0aWVzLnJlbmRlcmVyLmNhbGxNZXRob2QoXG4gICAgICAgICAgJ2NyZWF0ZUVsZW1lbnQnLFxuICAgICAgICAgIFt0aGlzLl9nZXRQYXJlbnRSZW5kZXJOb2RlKHBhcmVudCksIG8ubGl0ZXJhbChhc3QubmFtZSksIGRlYnVnQ29udGV4dEV4cHJdKTtcbiAgICB9XG4gICAgdmFyIGZpZWxkTmFtZSA9IGBfZWxfJHtub2RlSW5kZXh9YDtcbiAgICB0aGlzLnZpZXcuZmllbGRzLnB1c2goXG4gICAgICAgIG5ldyBvLkNsYXNzRmllbGQoZmllbGROYW1lLCBvLmltcG9ydFR5cGUodGhpcy52aWV3LmdlbkNvbmZpZy5yZW5kZXJUeXBlcy5yZW5kZXJFbGVtZW50KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICBbby5TdG10TW9kaWZpZXIuUHJpdmF0ZV0pKTtcbiAgICB0aGlzLnZpZXcuY3JlYXRlTWV0aG9kLmFkZFN0bXQoby5USElTX0VYUFIucHJvcChmaWVsZE5hbWUpLnNldChjcmVhdGVSZW5kZXJOb2RlRXhwcikudG9TdG10KCkpO1xuXG4gICAgdmFyIHJlbmRlck5vZGUgPSBvLlRISVNfRVhQUi5wcm9wKGZpZWxkTmFtZSk7XG5cbiAgICB2YXIgY29tcG9uZW50ID0gYXN0LmdldENvbXBvbmVudCgpO1xuICAgIHZhciBkaXJlY3RpdmVzID0gYXN0LmRpcmVjdGl2ZXMubWFwKGRpcmVjdGl2ZUFzdCA9PiBkaXJlY3RpdmVBc3QuZGlyZWN0aXZlKTtcbiAgICB2YXIgdmFyaWFibGVzID1cbiAgICAgICAgX3JlYWRIdG1sQW5kRGlyZWN0aXZlVmFyaWFibGVzKGFzdC5leHBvcnRBc1ZhcnMsIGFzdC5kaXJlY3RpdmVzLCB0aGlzLnZpZXcudmlld1R5cGUpO1xuICAgIHZhciBodG1sQXR0cnMgPSBfcmVhZEh0bWxBdHRycyhhc3QuYXR0cnMpO1xuICAgIHZhciBhdHRyTmFtZUFuZFZhbHVlcyA9IF9tZXJnZUh0bWxBbmREaXJlY3RpdmVBdHRycyhodG1sQXR0cnMsIGRpcmVjdGl2ZXMpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXR0ck5hbWVBbmRWYWx1ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBhdHRyTmFtZSA9IGF0dHJOYW1lQW5kVmFsdWVzW2ldWzBdO1xuICAgICAgdmFyIGF0dHJWYWx1ZSA9IGF0dHJOYW1lQW5kVmFsdWVzW2ldWzFdO1xuICAgICAgdGhpcy52aWV3LmNyZWF0ZU1ldGhvZC5hZGRTdG10KFxuICAgICAgICAgIFZpZXdQcm9wZXJ0aWVzLnJlbmRlcmVyLmNhbGxNZXRob2QoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3NldEVsZW1lbnRBdHRyaWJ1dGUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFtyZW5kZXJOb2RlLCBvLmxpdGVyYWwoYXR0ck5hbWUpLCBvLmxpdGVyYWwoYXR0clZhbHVlKV0pXG4gICAgICAgICAgICAgIC50b1N0bXQoKSk7XG4gICAgfVxuICAgIHZhciBjb21waWxlRWxlbWVudCA9XG4gICAgICAgIG5ldyBDb21waWxlRWxlbWVudChwYXJlbnQsIHRoaXMudmlldywgbm9kZUluZGV4LCByZW5kZXJOb2RlLCBhc3QsIGNvbXBvbmVudCwgZGlyZWN0aXZlcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzdC5wcm92aWRlcnMsIGFzdC5oYXNWaWV3Q29udGFpbmVyLCBmYWxzZSwgdmFyaWFibGVzKTtcbiAgICB0aGlzLnZpZXcubm9kZXMucHVzaChjb21waWxlRWxlbWVudCk7XG4gICAgdmFyIGNvbXBWaWV3RXhwcjogby5SZWFkVmFyRXhwciA9IG51bGw7XG4gICAgaWYgKGlzUHJlc2VudChjb21wb25lbnQpKSB7XG4gICAgICB2YXIgbmVzdGVkQ29tcG9uZW50SWRlbnRpZmllciA9XG4gICAgICAgICAgbmV3IENvbXBpbGVJZGVudGlmaWVyTWV0YWRhdGEoe25hbWU6IGdldFZpZXdGYWN0b3J5TmFtZShjb21wb25lbnQsIDApfSk7XG4gICAgICB0aGlzLnRhcmdldERlcGVuZGVuY2llcy5wdXNoKG5ldyBWaWV3Q29tcGlsZURlcGVuZGVuY3koY29tcG9uZW50LCBuZXN0ZWRDb21wb25lbnRJZGVudGlmaWVyKSk7XG4gICAgICBjb21wVmlld0V4cHIgPSBvLnZhcmlhYmxlKGBjb21wVmlld18ke25vZGVJbmRleH1gKTtcbiAgICAgIGNvbXBpbGVFbGVtZW50LnNldENvbXBvbmVudFZpZXcoY29tcFZpZXdFeHByKTtcbiAgICAgIHRoaXMudmlldy5jcmVhdGVNZXRob2QuYWRkU3RtdChjb21wVmlld0V4cHIuc2V0KG8uaW1wb3J0RXhwcihuZXN0ZWRDb21wb25lbnRJZGVudGlmaWVyKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5jYWxsRm4oW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgVmlld1Byb3BlcnRpZXMudmlld1V0aWxzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29tcGlsZUVsZW1lbnQuaW5qZWN0b3IsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21waWxlRWxlbWVudC5hcHBFbGVtZW50XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXSkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC50b0RlY2xTdG10KCkpO1xuICAgIH1cbiAgICBjb21waWxlRWxlbWVudC5iZWZvcmVDaGlsZHJlbigpO1xuICAgIHRoaXMuX2FkZFJvb3ROb2RlQW5kUHJvamVjdChjb21waWxlRWxlbWVudCwgYXN0Lm5nQ29udGVudEluZGV4LCBwYXJlbnQpO1xuICAgIHRlbXBsYXRlVmlzaXRBbGwodGhpcywgYXN0LmNoaWxkcmVuLCBjb21waWxlRWxlbWVudCk7XG4gICAgY29tcGlsZUVsZW1lbnQuYWZ0ZXJDaGlsZHJlbih0aGlzLnZpZXcubm9kZXMubGVuZ3RoIC0gbm9kZUluZGV4IC0gMSk7XG5cbiAgICBpZiAoaXNQcmVzZW50KGNvbXBWaWV3RXhwcikpIHtcbiAgICAgIHZhciBjb2RlR2VuQ29udGVudE5vZGVzO1xuICAgICAgaWYgKHRoaXMudmlldy5jb21wb25lbnQudHlwZS5pc0hvc3QpIHtcbiAgICAgICAgY29kZUdlbkNvbnRlbnROb2RlcyA9IFZpZXdQcm9wZXJ0aWVzLnByb2plY3RhYmxlTm9kZXM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb2RlR2VuQ29udGVudE5vZGVzID0gby5saXRlcmFsQXJyKFxuICAgICAgICAgICAgY29tcGlsZUVsZW1lbnQuY29udGVudE5vZGVzQnlOZ0NvbnRlbnRJbmRleC5tYXAobm9kZXMgPT4gY3JlYXRlRmxhdEFycmF5KG5vZGVzKSkpO1xuICAgICAgfVxuICAgICAgdGhpcy52aWV3LmNyZWF0ZU1ldGhvZC5hZGRTdG10KFxuICAgICAgICAgIGNvbXBWaWV3RXhwci5jYWxsTWV0aG9kKCdjcmVhdGUnLCBbY29kZUdlbkNvbnRlbnROb2Rlcywgby5OVUxMX0VYUFJdKS50b1N0bXQoKSk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdmlzaXRFbWJlZGRlZFRlbXBsYXRlKGFzdDogRW1iZWRkZWRUZW1wbGF0ZUFzdCwgcGFyZW50OiBDb21waWxlRWxlbWVudCk6IGFueSB7XG4gICAgdmFyIG5vZGVJbmRleCA9IHRoaXMudmlldy5ub2Rlcy5sZW5ndGg7XG4gICAgdmFyIGZpZWxkTmFtZSA9IGBfYW5jaG9yXyR7bm9kZUluZGV4fWA7XG4gICAgdGhpcy52aWV3LmZpZWxkcy5wdXNoKFxuICAgICAgICBuZXcgby5DbGFzc0ZpZWxkKGZpZWxkTmFtZSwgby5pbXBvcnRUeXBlKHRoaXMudmlldy5nZW5Db25maWcucmVuZGVyVHlwZXMucmVuZGVyQ29tbWVudCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgW28uU3RtdE1vZGlmaWVyLlByaXZhdGVdKSk7XG4gICAgdGhpcy52aWV3LmNyZWF0ZU1ldGhvZC5hZGRTdG10KFxuICAgICAgICBvLlRISVNfRVhQUi5wcm9wKGZpZWxkTmFtZSlcbiAgICAgICAgICAgIC5zZXQoVmlld1Byb3BlcnRpZXMucmVuZGVyZXIuY2FsbE1ldGhvZChcbiAgICAgICAgICAgICAgICAnY3JlYXRlVGVtcGxhdGVBbmNob3InLFxuICAgICAgICAgICAgICAgIFtcbiAgICAgICAgICAgICAgICAgIHRoaXMuX2dldFBhcmVudFJlbmRlck5vZGUocGFyZW50KSxcbiAgICAgICAgICAgICAgICAgIHRoaXMudmlldy5jcmVhdGVNZXRob2QucmVzZXREZWJ1Z0luZm9FeHByKG5vZGVJbmRleCwgYXN0KVxuICAgICAgICAgICAgICAgIF0pKVxuICAgICAgICAgICAgLnRvU3RtdCgpKTtcbiAgICB2YXIgcmVuZGVyTm9kZSA9IG8uVEhJU19FWFBSLnByb3AoZmllbGROYW1lKTtcblxuICAgIHZhciB0ZW1wbGF0ZVZhcmlhYmxlQmluZGluZ3MgPSBhc3QudmFycy5tYXAoXG4gICAgICAgIHZhckFzdCA9PiBbdmFyQXN0LnZhbHVlLmxlbmd0aCA+IDAgPyB2YXJBc3QudmFsdWUgOiBJTVBMSUNJVF9URU1QTEFURV9WQVIsIHZhckFzdC5uYW1lXSk7XG5cbiAgICB2YXIgZGlyZWN0aXZlcyA9IGFzdC5kaXJlY3RpdmVzLm1hcChkaXJlY3RpdmVBc3QgPT4gZGlyZWN0aXZlQXN0LmRpcmVjdGl2ZSk7XG4gICAgdmFyIGNvbXBpbGVFbGVtZW50ID1cbiAgICAgICAgbmV3IENvbXBpbGVFbGVtZW50KHBhcmVudCwgdGhpcy52aWV3LCBub2RlSW5kZXgsIHJlbmRlck5vZGUsIGFzdCwgbnVsbCwgZGlyZWN0aXZlcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzdC5wcm92aWRlcnMsIGFzdC5oYXNWaWV3Q29udGFpbmVyLCB0cnVlLCB7fSk7XG4gICAgdGhpcy52aWV3Lm5vZGVzLnB1c2goY29tcGlsZUVsZW1lbnQpO1xuXG4gICAgdGhpcy5uZXN0ZWRWaWV3Q291bnQrKztcbiAgICB2YXIgZW1iZWRkZWRWaWV3ID0gbmV3IENvbXBpbGVWaWV3KFxuICAgICAgICB0aGlzLnZpZXcuY29tcG9uZW50LCB0aGlzLnZpZXcuZ2VuQ29uZmlnLCB0aGlzLnZpZXcucGlwZU1ldGFzLCBvLk5VTExfRVhQUixcbiAgICAgICAgdGhpcy52aWV3LnZpZXdJbmRleCArIHRoaXMubmVzdGVkVmlld0NvdW50LCBjb21waWxlRWxlbWVudCwgdGVtcGxhdGVWYXJpYWJsZUJpbmRpbmdzKTtcbiAgICB0aGlzLm5lc3RlZFZpZXdDb3VudCArPSBidWlsZFZpZXcoZW1iZWRkZWRWaWV3LCBhc3QuY2hpbGRyZW4sIHRoaXMudGFyZ2V0RGVwZW5kZW5jaWVzKTtcblxuICAgIGNvbXBpbGVFbGVtZW50LmJlZm9yZUNoaWxkcmVuKCk7XG4gICAgdGhpcy5fYWRkUm9vdE5vZGVBbmRQcm9qZWN0KGNvbXBpbGVFbGVtZW50LCBhc3QubmdDb250ZW50SW5kZXgsIHBhcmVudCk7XG4gICAgY29tcGlsZUVsZW1lbnQuYWZ0ZXJDaGlsZHJlbigwKTtcblxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdmlzaXRBdHRyKGFzdDogQXR0ckFzdCwgY3R4OiBhbnkpOiBhbnkgeyByZXR1cm4gbnVsbDsgfVxuICB2aXNpdERpcmVjdGl2ZShhc3Q6IERpcmVjdGl2ZUFzdCwgY3R4OiBhbnkpOiBhbnkgeyByZXR1cm4gbnVsbDsgfVxuICB2aXNpdEV2ZW50KGFzdDogQm91bmRFdmVudEFzdCwgZXZlbnRUYXJnZXRBbmROYW1lczogTWFwPHN0cmluZywgQm91bmRFdmVudEFzdD4pOiBhbnkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdmlzaXRWYXJpYWJsZShhc3Q6IFZhcmlhYmxlQXN0LCBjdHg6IGFueSk6IGFueSB7IHJldHVybiBudWxsOyB9XG4gIHZpc2l0RGlyZWN0aXZlUHJvcGVydHkoYXN0OiBCb3VuZERpcmVjdGl2ZVByb3BlcnR5QXN0LCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gbnVsbDsgfVxuICB2aXNpdEVsZW1lbnRQcm9wZXJ0eShhc3Q6IEJvdW5kRWxlbWVudFByb3BlcnR5QXN0LCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gbnVsbDsgfVxufVxuXG5mdW5jdGlvbiBfbWVyZ2VIdG1sQW5kRGlyZWN0aXZlQXR0cnMoZGVjbGFyZWRIdG1sQXR0cnM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRpcmVjdGl2ZXM6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YVtdKTogc3RyaW5nW11bXSB7XG4gIHZhciByZXN1bHQ6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG4gIFN0cmluZ01hcFdyYXBwZXIuZm9yRWFjaChkZWNsYXJlZEh0bWxBdHRycywgKHZhbHVlLCBrZXkpID0+IHsgcmVzdWx0W2tleV0gPSB2YWx1ZTsgfSk7XG4gIGRpcmVjdGl2ZXMuZm9yRWFjaChkaXJlY3RpdmVNZXRhID0+IHtcbiAgICBTdHJpbmdNYXBXcmFwcGVyLmZvckVhY2goZGlyZWN0aXZlTWV0YS5ob3N0QXR0cmlidXRlcywgKHZhbHVlLCBuYW1lKSA9PiB7XG4gICAgICB2YXIgcHJldlZhbHVlID0gcmVzdWx0W25hbWVdO1xuICAgICAgcmVzdWx0W25hbWVdID0gaXNQcmVzZW50KHByZXZWYWx1ZSkgPyBtZXJnZUF0dHJpYnV0ZVZhbHVlKG5hbWUsIHByZXZWYWx1ZSwgdmFsdWUpIDogdmFsdWU7XG4gICAgfSk7XG4gIH0pO1xuICByZXR1cm4gbWFwVG9LZXlWYWx1ZUFycmF5KHJlc3VsdCk7XG59XG5cbmZ1bmN0aW9uIF9yZWFkSHRtbEF0dHJzKGF0dHJzOiBBdHRyQXN0W10pOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSB7XG4gIHZhciBodG1sQXR0cnM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG4gIGF0dHJzLmZvckVhY2goKGFzdCkgPT4geyBodG1sQXR0cnNbYXN0Lm5hbWVdID0gYXN0LnZhbHVlOyB9KTtcbiAgcmV0dXJuIGh0bWxBdHRycztcbn1cblxuZnVuY3Rpb24gX3JlYWRIdG1sQW5kRGlyZWN0aXZlVmFyaWFibGVzKGVsZW1lbnRFeHBvcnRBc1ZhcnM6IFZhcmlhYmxlQXN0W10sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGlyZWN0aXZlczogRGlyZWN0aXZlQXN0W10sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmlld1R5cGU6IFZpZXdUeXBlKToge1trZXk6IHN0cmluZ106IENvbXBpbGVUb2tlbk1ldGFkYXRhfSB7XG4gIHZhciB2YXJpYWJsZXM6IHtba2V5OiBzdHJpbmddOiBDb21waWxlVG9rZW5NZXRhZGF0YX0gPSB7fTtcbiAgdmFyIGNvbXBvbmVudDogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhID0gbnVsbDtcbiAgZGlyZWN0aXZlcy5mb3JFYWNoKChkaXJlY3RpdmUpID0+IHtcbiAgICBpZiAoZGlyZWN0aXZlLmRpcmVjdGl2ZS5pc0NvbXBvbmVudCkge1xuICAgICAgY29tcG9uZW50ID0gZGlyZWN0aXZlLmRpcmVjdGl2ZTtcbiAgICB9XG4gICAgZGlyZWN0aXZlLmV4cG9ydEFzVmFycy5mb3JFYWNoKFxuICAgICAgICB2YXJBc3QgPT4geyB2YXJpYWJsZXNbdmFyQXN0Lm5hbWVdID0gaWRlbnRpZmllclRva2VuKGRpcmVjdGl2ZS5kaXJlY3RpdmUudHlwZSk7IH0pO1xuICB9KTtcbiAgZWxlbWVudEV4cG9ydEFzVmFycy5mb3JFYWNoKCh2YXJBc3QpID0+IHtcbiAgICB2YXJpYWJsZXNbdmFyQXN0Lm5hbWVdID0gaXNQcmVzZW50KGNvbXBvbmVudCkgPyBpZGVudGlmaWVyVG9rZW4oY29tcG9uZW50LnR5cGUpIDogbnVsbDtcbiAgfSk7XG4gIHJldHVybiB2YXJpYWJsZXM7XG59XG5cbmZ1bmN0aW9uIG1lcmdlQXR0cmlidXRlVmFsdWUoYXR0ck5hbWU6IHN0cmluZywgYXR0clZhbHVlMTogc3RyaW5nLCBhdHRyVmFsdWUyOiBzdHJpbmcpOiBzdHJpbmcge1xuICBpZiAoYXR0ck5hbWUgPT0gQ0xBU1NfQVRUUiB8fCBhdHRyTmFtZSA9PSBTVFlMRV9BVFRSKSB7XG4gICAgcmV0dXJuIGAke2F0dHJWYWx1ZTF9ICR7YXR0clZhbHVlMn1gO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBhdHRyVmFsdWUyO1xuICB9XG59XG5cbmZ1bmN0aW9uIG1hcFRvS2V5VmFsdWVBcnJheShkYXRhOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSk6IHN0cmluZ1tdW10ge1xuICB2YXIgZW50cnlBcnJheSA9IFtdO1xuICBTdHJpbmdNYXBXcmFwcGVyLmZvckVhY2goZGF0YSwgKHZhbHVlLCBuYW1lKSA9PiB7IGVudHJ5QXJyYXkucHVzaChbbmFtZSwgdmFsdWVdKTsgfSk7XG4gIC8vIFdlIG5lZWQgdG8gc29ydCB0byBnZXQgYSBkZWZpbmVkIG91dHB1dCBvcmRlclxuICAvLyBmb3IgdGVzdHMgYW5kIGZvciBjYWNoaW5nIGdlbmVyYXRlZCBhcnRpZmFjdHMuLi5cbiAgTGlzdFdyYXBwZXIuc29ydChlbnRyeUFycmF5LCAoZW50cnkxLCBlbnRyeTIpID0+IFN0cmluZ1dyYXBwZXIuY29tcGFyZShlbnRyeTFbMF0sIGVudHJ5MlswXSkpO1xuICB2YXIga2V5VmFsdWVBcnJheSA9IFtdO1xuICBlbnRyeUFycmF5LmZvckVhY2goKGVudHJ5KSA9PiB7IGtleVZhbHVlQXJyYXkucHVzaChbZW50cnlbMF0sIGVudHJ5WzFdXSk7IH0pO1xuICByZXR1cm4ga2V5VmFsdWVBcnJheTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlVmlld1RvcExldmVsU3RtdHModmlldzogQ29tcGlsZVZpZXcsIHRhcmdldFN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10pIHtcbiAgdmFyIG5vZGVEZWJ1Z0luZm9zVmFyOiBvLkV4cHJlc3Npb24gPSBvLk5VTExfRVhQUjtcbiAgaWYgKHZpZXcuZ2VuQ29uZmlnLmdlbkRlYnVnSW5mbykge1xuICAgIG5vZGVEZWJ1Z0luZm9zVmFyID0gby52YXJpYWJsZShgbm9kZURlYnVnSW5mb3NfJHt2aWV3LmNvbXBvbmVudC50eXBlLm5hbWV9JHt2aWV3LnZpZXdJbmRleH1gKTtcbiAgICB0YXJnZXRTdGF0ZW1lbnRzLnB1c2goXG4gICAgICAgICg8by5SZWFkVmFyRXhwcj5ub2RlRGVidWdJbmZvc1ZhcilcbiAgICAgICAgICAgIC5zZXQoby5saXRlcmFsQXJyKHZpZXcubm9kZXMubWFwKGNyZWF0ZVN0YXRpY05vZGVEZWJ1Z0luZm8pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IG8uQXJyYXlUeXBlKG5ldyBvLkV4dGVybmFsVHlwZShJZGVudGlmaWVycy5TdGF0aWNOb2RlRGVidWdJbmZvKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbby5UeXBlTW9kaWZpZXIuQ29uc3RdKSkpXG4gICAgICAgICAgICAudG9EZWNsU3RtdChudWxsLCBbby5TdG10TW9kaWZpZXIuRmluYWxdKSk7XG4gIH1cblxuXG4gIHZhciByZW5kZXJDb21wVHlwZVZhcjogby5SZWFkVmFyRXhwciA9IG8udmFyaWFibGUoYHJlbmRlclR5cGVfJHt2aWV3LmNvbXBvbmVudC50eXBlLm5hbWV9YCk7XG4gIGlmICh2aWV3LnZpZXdJbmRleCA9PT0gMCkge1xuICAgIHRhcmdldFN0YXRlbWVudHMucHVzaChyZW5kZXJDb21wVHlwZVZhci5zZXQoby5OVUxMX0VYUFIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAudG9EZWNsU3RtdChvLmltcG9ydFR5cGUoSWRlbnRpZmllcnMuUmVuZGVyQ29tcG9uZW50VHlwZSkpKTtcbiAgfVxuXG4gIHZhciB2aWV3Q2xhc3MgPSBjcmVhdGVWaWV3Q2xhc3ModmlldywgcmVuZGVyQ29tcFR5cGVWYXIsIG5vZGVEZWJ1Z0luZm9zVmFyKTtcbiAgdGFyZ2V0U3RhdGVtZW50cy5wdXNoKHZpZXdDbGFzcyk7XG4gIHRhcmdldFN0YXRlbWVudHMucHVzaChjcmVhdGVWaWV3RmFjdG9yeSh2aWV3LCB2aWV3Q2xhc3MsIHJlbmRlckNvbXBUeXBlVmFyKSk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVN0YXRpY05vZGVEZWJ1Z0luZm8obm9kZTogQ29tcGlsZU5vZGUpOiBvLkV4cHJlc3Npb24ge1xuICB2YXIgY29tcGlsZUVsZW1lbnQgPSBub2RlIGluc3RhbmNlb2YgQ29tcGlsZUVsZW1lbnQgPyBub2RlIDogbnVsbDtcbiAgdmFyIHByb3ZpZGVyVG9rZW5zOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICB2YXIgY29tcG9uZW50VG9rZW46IG8uRXhwcmVzc2lvbiA9IG8uTlVMTF9FWFBSO1xuICB2YXIgdmFyVG9rZW5FbnRyaWVzID0gW107XG4gIGlmIChpc1ByZXNlbnQoY29tcGlsZUVsZW1lbnQpKSB7XG4gICAgcHJvdmlkZXJUb2tlbnMgPSBjb21waWxlRWxlbWVudC5nZXRQcm92aWRlclRva2VucygpO1xuICAgIGlmIChpc1ByZXNlbnQoY29tcGlsZUVsZW1lbnQuY29tcG9uZW50KSkge1xuICAgICAgY29tcG9uZW50VG9rZW4gPSBjcmVhdGVEaVRva2VuRXhwcmVzc2lvbihpZGVudGlmaWVyVG9rZW4oY29tcGlsZUVsZW1lbnQuY29tcG9uZW50LnR5cGUpKTtcbiAgICB9XG4gICAgU3RyaW5nTWFwV3JhcHBlci5mb3JFYWNoKGNvbXBpbGVFbGVtZW50LnZhcmlhYmxlVG9rZW5zLCAodG9rZW4sIHZhck5hbWUpID0+IHtcbiAgICAgIHZhclRva2VuRW50cmllcy5wdXNoKFxuICAgICAgICAgIFt2YXJOYW1lLCBpc1ByZXNlbnQodG9rZW4pID8gY3JlYXRlRGlUb2tlbkV4cHJlc3Npb24odG9rZW4pIDogby5OVUxMX0VYUFJdKTtcbiAgICB9KTtcbiAgfVxuICByZXR1cm4gby5pbXBvcnRFeHByKElkZW50aWZpZXJzLlN0YXRpY05vZGVEZWJ1Z0luZm8pXG4gICAgICAuaW5zdGFudGlhdGUoXG4gICAgICAgICAgW1xuICAgICAgICAgICAgby5saXRlcmFsQXJyKHByb3ZpZGVyVG9rZW5zLCBuZXcgby5BcnJheVR5cGUoby5EWU5BTUlDX1RZUEUsIFtvLlR5cGVNb2RpZmllci5Db25zdF0pKSxcbiAgICAgICAgICAgIGNvbXBvbmVudFRva2VuLFxuICAgICAgICAgICAgby5saXRlcmFsTWFwKHZhclRva2VuRW50cmllcywgbmV3IG8uTWFwVHlwZShvLkRZTkFNSUNfVFlQRSwgW28uVHlwZU1vZGlmaWVyLkNvbnN0XSkpXG4gICAgICAgICAgXSxcbiAgICAgICAgICBvLmltcG9ydFR5cGUoSWRlbnRpZmllcnMuU3RhdGljTm9kZURlYnVnSW5mbywgbnVsbCwgW28uVHlwZU1vZGlmaWVyLkNvbnN0XSkpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVWaWV3Q2xhc3ModmlldzogQ29tcGlsZVZpZXcsIHJlbmRlckNvbXBUeXBlVmFyOiBvLlJlYWRWYXJFeHByLFxuICAgICAgICAgICAgICAgICAgICAgICAgIG5vZGVEZWJ1Z0luZm9zVmFyOiBvLkV4cHJlc3Npb24pOiBvLkNsYXNzU3RtdCB7XG4gIHZhciBlbXB0eVRlbXBsYXRlVmFyaWFibGVCaW5kaW5ncyA9XG4gICAgICB2aWV3LnRlbXBsYXRlVmFyaWFibGVCaW5kaW5ncy5tYXAoKGVudHJ5KSA9PiBbZW50cnlbMF0sIG8uTlVMTF9FWFBSXSk7XG4gIHZhciB2aWV3Q29uc3RydWN0b3JBcmdzID0gW1xuICAgIG5ldyBvLkZuUGFyYW0oVmlld0NvbnN0cnVjdG9yVmFycy52aWV3VXRpbHMubmFtZSwgby5pbXBvcnRUeXBlKElkZW50aWZpZXJzLlZpZXdVdGlscykpLFxuICAgIG5ldyBvLkZuUGFyYW0oVmlld0NvbnN0cnVjdG9yVmFycy5wYXJlbnRJbmplY3Rvci5uYW1lLCBvLmltcG9ydFR5cGUoSWRlbnRpZmllcnMuSW5qZWN0b3IpKSxcbiAgICBuZXcgby5GblBhcmFtKFZpZXdDb25zdHJ1Y3RvclZhcnMuZGVjbGFyYXRpb25FbC5uYW1lLCBvLmltcG9ydFR5cGUoSWRlbnRpZmllcnMuQXBwRWxlbWVudCkpXG4gIF07XG4gIHZhciB2aWV3Q29uc3RydWN0b3IgPSBuZXcgby5DbGFzc01ldGhvZChudWxsLCB2aWV3Q29uc3RydWN0b3JBcmdzLCBbXG4gICAgby5TVVBFUl9FWFBSLmNhbGxGbihbXG4gICAgICAgICAgICAgICAgICBvLnZhcmlhYmxlKHZpZXcuY2xhc3NOYW1lKSxcbiAgICAgICAgICAgICAgICAgIHJlbmRlckNvbXBUeXBlVmFyLFxuICAgICAgICAgICAgICAgICAgVmlld1R5cGVFbnVtLmZyb21WYWx1ZSh2aWV3LnZpZXdUeXBlKSxcbiAgICAgICAgICAgICAgICAgIG8ubGl0ZXJhbE1hcChlbXB0eVRlbXBsYXRlVmFyaWFibGVCaW5kaW5ncyksXG4gICAgICAgICAgICAgICAgICBWaWV3Q29uc3RydWN0b3JWYXJzLnZpZXdVdGlscyxcbiAgICAgICAgICAgICAgICAgIFZpZXdDb25zdHJ1Y3RvclZhcnMucGFyZW50SW5qZWN0b3IsXG4gICAgICAgICAgICAgICAgICBWaWV3Q29uc3RydWN0b3JWYXJzLmRlY2xhcmF0aW9uRWwsXG4gICAgICAgICAgICAgICAgICBDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneUVudW0uZnJvbVZhbHVlKGdldENoYW5nZURldGVjdGlvbk1vZGUodmlldykpLFxuICAgICAgICAgICAgICAgICAgbm9kZURlYnVnSW5mb3NWYXJcbiAgICAgICAgICAgICAgICBdKVxuICAgICAgICAudG9TdG10KClcbiAgXSk7XG5cbiAgdmFyIHZpZXdNZXRob2RzID0gW1xuICAgIG5ldyBvLkNsYXNzTWV0aG9kKCdjcmVhdGVJbnRlcm5hbCcsIFtuZXcgby5GblBhcmFtKHJvb3RTZWxlY3RvclZhci5uYW1lLCBvLlNUUklOR19UWVBFKV0sXG4gICAgICAgICAgICAgICAgICAgICAgZ2VuZXJhdGVDcmVhdGVNZXRob2QodmlldyksIG8uaW1wb3J0VHlwZShJZGVudGlmaWVycy5BcHBFbGVtZW50KSksXG4gICAgbmV3IG8uQ2xhc3NNZXRob2QoXG4gICAgICAgICdpbmplY3RvckdldEludGVybmFsJyxcbiAgICAgICAgW1xuICAgICAgICAgIG5ldyBvLkZuUGFyYW0oSW5qZWN0TWV0aG9kVmFycy50b2tlbi5uYW1lLCBvLkRZTkFNSUNfVFlQRSksXG4gICAgICAgICAgLy8gTm90ZTogQ2FuJ3QgdXNlIG8uSU5UX1RZUEUgaGVyZSBhcyB0aGUgbWV0aG9kIGluIEFwcFZpZXcgdXNlcyBudW1iZXJcbiAgICAgICAgICBuZXcgby5GblBhcmFtKEluamVjdE1ldGhvZFZhcnMucmVxdWVzdE5vZGVJbmRleC5uYW1lLCBvLk5VTUJFUl9UWVBFKSxcbiAgICAgICAgICBuZXcgby5GblBhcmFtKEluamVjdE1ldGhvZFZhcnMubm90Rm91bmRSZXN1bHQubmFtZSwgby5EWU5BTUlDX1RZUEUpXG4gICAgICAgIF0sXG4gICAgICAgIGFkZFJldHVyblZhbHVlZk5vdEVtcHR5KHZpZXcuaW5qZWN0b3JHZXRNZXRob2QuZmluaXNoKCksIEluamVjdE1ldGhvZFZhcnMubm90Rm91bmRSZXN1bHQpLFxuICAgICAgICBvLkRZTkFNSUNfVFlQRSksXG4gICAgbmV3IG8uQ2xhc3NNZXRob2QoJ2RldGVjdENoYW5nZXNJbnRlcm5hbCcsXG4gICAgICAgICAgICAgICAgICAgICAgW25ldyBvLkZuUGFyYW0oRGV0ZWN0Q2hhbmdlc1ZhcnMudGhyb3dPbkNoYW5nZS5uYW1lLCBvLkJPT0xfVFlQRSldLFxuICAgICAgICAgICAgICAgICAgICAgIGdlbmVyYXRlRGV0ZWN0Q2hhbmdlc01ldGhvZCh2aWV3KSksXG4gICAgbmV3IG8uQ2xhc3NNZXRob2QoJ2RpcnR5UGFyZW50UXVlcmllc0ludGVybmFsJywgW10sIHZpZXcuZGlydHlQYXJlbnRRdWVyaWVzTWV0aG9kLmZpbmlzaCgpKSxcbiAgICBuZXcgby5DbGFzc01ldGhvZCgnZGVzdHJveUludGVybmFsJywgW10sIHZpZXcuZGVzdHJveU1ldGhvZC5maW5pc2goKSlcbiAgXS5jb25jYXQodmlldy5ldmVudEhhbmRsZXJNZXRob2RzKTtcbiAgdmFyIHZpZXdDbGFzcyA9IG5ldyBvLkNsYXNzU3RtdChcbiAgICAgIHZpZXcuY2xhc3NOYW1lLCBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMuQXBwVmlldywgW2dldENvbnRleHRUeXBlKHZpZXcpXSksIHZpZXcuZmllbGRzLFxuICAgICAgdmlldy5nZXR0ZXJzLCB2aWV3Q29uc3RydWN0b3IsIHZpZXdNZXRob2RzLmZpbHRlcigobWV0aG9kKSA9PiBtZXRob2QuYm9keS5sZW5ndGggPiAwKSk7XG4gIHJldHVybiB2aWV3Q2xhc3M7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVZpZXdGYWN0b3J5KHZpZXc6IENvbXBpbGVWaWV3LCB2aWV3Q2xhc3M6IG8uQ2xhc3NTdG10LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVuZGVyQ29tcFR5cGVWYXI6IG8uUmVhZFZhckV4cHIpOiBvLlN0YXRlbWVudCB7XG4gIHZhciB2aWV3RmFjdG9yeUFyZ3MgPSBbXG4gICAgbmV3IG8uRm5QYXJhbShWaWV3Q29uc3RydWN0b3JWYXJzLnZpZXdVdGlscy5uYW1lLCBvLmltcG9ydFR5cGUoSWRlbnRpZmllcnMuVmlld1V0aWxzKSksXG4gICAgbmV3IG8uRm5QYXJhbShWaWV3Q29uc3RydWN0b3JWYXJzLnBhcmVudEluamVjdG9yLm5hbWUsIG8uaW1wb3J0VHlwZShJZGVudGlmaWVycy5JbmplY3RvcikpLFxuICAgIG5ldyBvLkZuUGFyYW0oVmlld0NvbnN0cnVjdG9yVmFycy5kZWNsYXJhdGlvbkVsLm5hbWUsIG8uaW1wb3J0VHlwZShJZGVudGlmaWVycy5BcHBFbGVtZW50KSlcbiAgXTtcbiAgdmFyIGluaXRSZW5kZXJDb21wVHlwZVN0bXRzID0gW107XG4gIHZhciB0ZW1wbGF0ZVVybEluZm87XG4gIGlmICh2aWV3LmNvbXBvbmVudC50ZW1wbGF0ZS50ZW1wbGF0ZVVybCA9PSB2aWV3LmNvbXBvbmVudC50eXBlLm1vZHVsZVVybCkge1xuICAgIHRlbXBsYXRlVXJsSW5mbyA9XG4gICAgICAgIGAke3ZpZXcuY29tcG9uZW50LnR5cGUubW9kdWxlVXJsfSBjbGFzcyAke3ZpZXcuY29tcG9uZW50LnR5cGUubmFtZX0gLSBpbmxpbmUgdGVtcGxhdGVgO1xuICB9IGVsc2Uge1xuICAgIHRlbXBsYXRlVXJsSW5mbyA9IHZpZXcuY29tcG9uZW50LnRlbXBsYXRlLnRlbXBsYXRlVXJsO1xuICB9XG4gIGlmICh2aWV3LnZpZXdJbmRleCA9PT0gMCkge1xuICAgIGluaXRSZW5kZXJDb21wVHlwZVN0bXRzID0gW1xuICAgICAgbmV3IG8uSWZTdG10KHJlbmRlckNvbXBUeXBlVmFyLmlkZW50aWNhbChvLk5VTExfRVhQUiksXG4gICAgICAgICAgICAgICAgICAgW1xuICAgICAgICAgICAgICAgICAgICAgcmVuZGVyQ29tcFR5cGVWYXIuc2V0KFZpZXdDb25zdHJ1Y3RvclZhcnNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnZpZXdVdGlscy5jYWxsTWV0aG9kKCdjcmVhdGVSZW5kZXJDb21wb25lbnRUeXBlJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgby5saXRlcmFsKHRlbXBsYXRlVXJsSW5mbyksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG8ubGl0ZXJhbCh2aWV3LmNvbXBvbmVudFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC50ZW1wbGF0ZS5uZ0NvbnRlbnRTZWxlY3RvcnMubGVuZ3RoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgVmlld0VuY2Fwc3VsYXRpb25FbnVtXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuZnJvbVZhbHVlKHZpZXcuY29tcG9uZW50LnRlbXBsYXRlLmVuY2Fwc3VsYXRpb24pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2aWV3LnN0eWxlc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXSkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgLnRvU3RtdCgpXG4gICAgICAgICAgICAgICAgICAgXSlcbiAgICBdO1xuICB9XG4gIHJldHVybiBvLmZuKHZpZXdGYWN0b3J5QXJncywgaW5pdFJlbmRlckNvbXBUeXBlU3RtdHMuY29uY2F0KFtcbiAgICAgICAgICAgIG5ldyBvLlJldHVyblN0YXRlbWVudChvLnZhcmlhYmxlKHZpZXdDbGFzcy5uYW1lKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuaW5zdGFudGlhdGUodmlld0NsYXNzLmNvbnN0cnVjdG9yTWV0aG9kLnBhcmFtcy5tYXAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAocGFyYW0pID0+IG8udmFyaWFibGUocGFyYW0ubmFtZSkpKSlcbiAgICAgICAgICBdKSxcbiAgICAgICAgICAgICAgby5pbXBvcnRUeXBlKElkZW50aWZpZXJzLkFwcFZpZXcsIFtnZXRDb250ZXh0VHlwZSh2aWV3KV0pKVxuICAgICAgLnRvRGVjbFN0bXQodmlldy52aWV3RmFjdG9yeS5uYW1lLCBbby5TdG10TW9kaWZpZXIuRmluYWxdKTtcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGVDcmVhdGVNZXRob2QodmlldzogQ29tcGlsZVZpZXcpOiBvLlN0YXRlbWVudFtdIHtcbiAgdmFyIHBhcmVudFJlbmRlck5vZGVFeHByOiBvLkV4cHJlc3Npb24gPSBvLk5VTExfRVhQUjtcbiAgdmFyIHBhcmVudFJlbmRlck5vZGVTdG10cyA9IFtdO1xuICBpZiAodmlldy52aWV3VHlwZSA9PT0gVmlld1R5cGUuQ09NUE9ORU5UKSB7XG4gICAgcGFyZW50UmVuZGVyTm9kZUV4cHIgPSBWaWV3UHJvcGVydGllcy5yZW5kZXJlci5jYWxsTWV0aG9kKFxuICAgICAgICAnY3JlYXRlVmlld1Jvb3QnLCBbby5USElTX0VYUFIucHJvcCgnZGVjbGFyYXRpb25BcHBFbGVtZW50JykucHJvcCgnbmF0aXZlRWxlbWVudCcpXSk7XG4gICAgcGFyZW50UmVuZGVyTm9kZVN0bXRzID0gW1xuICAgICAgcGFyZW50UmVuZGVyTm9kZVZhci5zZXQocGFyZW50UmVuZGVyTm9kZUV4cHIpXG4gICAgICAgICAgLnRvRGVjbFN0bXQoby5pbXBvcnRUeXBlKHZpZXcuZ2VuQ29uZmlnLnJlbmRlclR5cGVzLnJlbmRlck5vZGUpLCBbby5TdG10TW9kaWZpZXIuRmluYWxdKVxuICAgIF07XG4gIH1cbiAgdmFyIHJlc3VsdEV4cHI6IG8uRXhwcmVzc2lvbjtcbiAgaWYgKHZpZXcudmlld1R5cGUgPT09IFZpZXdUeXBlLkhPU1QpIHtcbiAgICByZXN1bHRFeHByID0gKDxDb21waWxlRWxlbWVudD52aWV3Lm5vZGVzWzBdKS5hcHBFbGVtZW50O1xuICB9IGVsc2Uge1xuICAgIHJlc3VsdEV4cHIgPSBvLk5VTExfRVhQUjtcbiAgfVxuICByZXR1cm4gcGFyZW50UmVuZGVyTm9kZVN0bXRzLmNvbmNhdCh2aWV3LmNyZWF0ZU1ldGhvZC5maW5pc2goKSlcbiAgICAgIC5jb25jYXQoW1xuICAgICAgICBvLlRISVNfRVhQUi5jYWxsTWV0aG9kKCdpbml0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjcmVhdGVGbGF0QXJyYXkodmlldy5yb290Tm9kZXNPckFwcEVsZW1lbnRzKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG8ubGl0ZXJhbEFycih2aWV3Lm5vZGVzLm1hcChub2RlID0+IG5vZGUucmVuZGVyTm9kZSkpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgby5saXRlcmFsQXJyKHZpZXcuZGlzcG9zYWJsZXMpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgby5saXRlcmFsQXJyKHZpZXcuc3Vic2NyaXB0aW9ucylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBdKVxuICAgICAgICAgICAgLnRvU3RtdCgpLFxuICAgICAgICBuZXcgby5SZXR1cm5TdGF0ZW1lbnQocmVzdWx0RXhwcilcbiAgICAgIF0pO1xufVxuXG5mdW5jdGlvbiBnZW5lcmF0ZURldGVjdENoYW5nZXNNZXRob2QodmlldzogQ29tcGlsZVZpZXcpOiBvLlN0YXRlbWVudFtdIHtcbiAgdmFyIHN0bXRzID0gW107XG4gIGlmICh2aWV3LmRldGVjdENoYW5nZXNJbklucHV0c01ldGhvZC5pc0VtcHR5KCkgJiYgdmlldy51cGRhdGVDb250ZW50UXVlcmllc01ldGhvZC5pc0VtcHR5KCkgJiZcbiAgICAgIHZpZXcuYWZ0ZXJDb250ZW50TGlmZWN5Y2xlQ2FsbGJhY2tzTWV0aG9kLmlzRW1wdHkoKSAmJlxuICAgICAgdmlldy5kZXRlY3RDaGFuZ2VzUmVuZGVyUHJvcGVydGllc01ldGhvZC5pc0VtcHR5KCkgJiZcbiAgICAgIHZpZXcudXBkYXRlVmlld1F1ZXJpZXNNZXRob2QuaXNFbXB0eSgpICYmIHZpZXcuYWZ0ZXJWaWV3TGlmZWN5Y2xlQ2FsbGJhY2tzTWV0aG9kLmlzRW1wdHkoKSkge1xuICAgIHJldHVybiBzdG10cztcbiAgfVxuICBMaXN0V3JhcHBlci5hZGRBbGwoc3RtdHMsIHZpZXcuZGV0ZWN0Q2hhbmdlc0luSW5wdXRzTWV0aG9kLmZpbmlzaCgpKTtcbiAgc3RtdHMucHVzaChcbiAgICAgIG8uVEhJU19FWFBSLmNhbGxNZXRob2QoJ2RldGVjdENvbnRlbnRDaGlsZHJlbkNoYW5nZXMnLCBbRGV0ZWN0Q2hhbmdlc1ZhcnMudGhyb3dPbkNoYW5nZV0pXG4gICAgICAgICAgLnRvU3RtdCgpKTtcbiAgdmFyIGFmdGVyQ29udGVudFN0bXRzID0gdmlldy51cGRhdGVDb250ZW50UXVlcmllc01ldGhvZC5maW5pc2goKS5jb25jYXQoXG4gICAgICB2aWV3LmFmdGVyQ29udGVudExpZmVjeWNsZUNhbGxiYWNrc01ldGhvZC5maW5pc2goKSk7XG4gIGlmIChhZnRlckNvbnRlbnRTdG10cy5sZW5ndGggPiAwKSB7XG4gICAgc3RtdHMucHVzaChuZXcgby5JZlN0bXQoby5ub3QoRGV0ZWN0Q2hhbmdlc1ZhcnMudGhyb3dPbkNoYW5nZSksIGFmdGVyQ29udGVudFN0bXRzKSk7XG4gIH1cbiAgTGlzdFdyYXBwZXIuYWRkQWxsKHN0bXRzLCB2aWV3LmRldGVjdENoYW5nZXNSZW5kZXJQcm9wZXJ0aWVzTWV0aG9kLmZpbmlzaCgpKTtcbiAgc3RtdHMucHVzaChvLlRISVNfRVhQUi5jYWxsTWV0aG9kKCdkZXRlY3RWaWV3Q2hpbGRyZW5DaGFuZ2VzJywgW0RldGVjdENoYW5nZXNWYXJzLnRocm93T25DaGFuZ2VdKVxuICAgICAgICAgICAgICAgICAudG9TdG10KCkpO1xuICB2YXIgYWZ0ZXJWaWV3U3RtdHMgPVxuICAgICAgdmlldy51cGRhdGVWaWV3UXVlcmllc01ldGhvZC5maW5pc2goKS5jb25jYXQodmlldy5hZnRlclZpZXdMaWZlY3ljbGVDYWxsYmFja3NNZXRob2QuZmluaXNoKCkpO1xuICBpZiAoYWZ0ZXJWaWV3U3RtdHMubGVuZ3RoID4gMCkge1xuICAgIHN0bXRzLnB1c2gobmV3IG8uSWZTdG10KG8ubm90KERldGVjdENoYW5nZXNWYXJzLnRocm93T25DaGFuZ2UpLCBhZnRlclZpZXdTdG10cykpO1xuICB9XG5cbiAgdmFyIHZhclN0bXRzID0gW107XG4gIHZhciByZWFkVmFycyA9IG8uZmluZFJlYWRWYXJOYW1lcyhzdG10cyk7XG4gIGlmIChTZXRXcmFwcGVyLmhhcyhyZWFkVmFycywgRGV0ZWN0Q2hhbmdlc1ZhcnMuY2hhbmdlZC5uYW1lKSkge1xuICAgIHZhclN0bXRzLnB1c2goRGV0ZWN0Q2hhbmdlc1ZhcnMuY2hhbmdlZC5zZXQoby5saXRlcmFsKHRydWUpKS50b0RlY2xTdG10KG8uQk9PTF9UWVBFKSk7XG4gIH1cbiAgaWYgKFNldFdyYXBwZXIuaGFzKHJlYWRWYXJzLCBEZXRlY3RDaGFuZ2VzVmFycy5jaGFuZ2VzLm5hbWUpKSB7XG4gICAgdmFyU3RtdHMucHVzaChEZXRlY3RDaGFuZ2VzVmFycy5jaGFuZ2VzLnNldChvLk5VTExfRVhQUilcbiAgICAgICAgICAgICAgICAgICAgICAudG9EZWNsU3RtdChuZXcgby5NYXBUeXBlKG8uaW1wb3J0VHlwZShJZGVudGlmaWVycy5TaW1wbGVDaGFuZ2UpKSkpO1xuICB9XG4gIGlmIChTZXRXcmFwcGVyLmhhcyhyZWFkVmFycywgRGV0ZWN0Q2hhbmdlc1ZhcnMudmFsVW53cmFwcGVyLm5hbWUpKSB7XG4gICAgdmFyU3RtdHMucHVzaChcbiAgICAgICAgRGV0ZWN0Q2hhbmdlc1ZhcnMudmFsVW53cmFwcGVyLnNldChvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMuVmFsdWVVbndyYXBwZXIpLmluc3RhbnRpYXRlKFtdKSlcbiAgICAgICAgICAgIC50b0RlY2xTdG10KG51bGwsIFtvLlN0bXRNb2RpZmllci5GaW5hbF0pKTtcbiAgfVxuICByZXR1cm4gdmFyU3RtdHMuY29uY2F0KHN0bXRzKTtcbn1cblxuZnVuY3Rpb24gYWRkUmV0dXJuVmFsdWVmTm90RW1wdHkoc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSwgdmFsdWU6IG8uRXhwcmVzc2lvbik6IG8uU3RhdGVtZW50W10ge1xuICBpZiAoc3RhdGVtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIHN0YXRlbWVudHMuY29uY2F0KFtuZXcgby5SZXR1cm5TdGF0ZW1lbnQodmFsdWUpXSk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHN0YXRlbWVudHM7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0Q29udGV4dFR5cGUodmlldzogQ29tcGlsZVZpZXcpOiBvLlR5cGUge1xuICB2YXIgdHlwZU1ldGEgPSB2aWV3LmNvbXBvbmVudC50eXBlO1xuICByZXR1cm4gdHlwZU1ldGEuaXNIb3N0ID8gby5EWU5BTUlDX1RZUEUgOiBvLmltcG9ydFR5cGUodHlwZU1ldGEpO1xufVxuXG5mdW5jdGlvbiBnZXRDaGFuZ2VEZXRlY3Rpb25Nb2RlKHZpZXc6IENvbXBpbGVWaWV3KTogQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3kge1xuICB2YXIgbW9kZTogQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3k7XG4gIGlmICh2aWV3LnZpZXdUeXBlID09PSBWaWV3VHlwZS5DT01QT05FTlQpIHtcbiAgICBtb2RlID0gaXNEZWZhdWx0Q2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3kodmlldy5jb21wb25lbnQuY2hhbmdlRGV0ZWN0aW9uKSA/XG4gICAgICAgICAgICAgICBDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneS5DaGVja0Fsd2F5cyA6XG4gICAgICAgICAgICAgICBDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneS5DaGVja09uY2U7XG4gIH0gZWxzZSB7XG4gICAgbW9kZSA9IENoYW5nZURldGVjdGlvblN0cmF0ZWd5LkNoZWNrQWx3YXlzO1xuICB9XG4gIHJldHVybiBtb2RlO1xufVxuIl19